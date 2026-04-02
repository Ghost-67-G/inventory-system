import mongoose, { PipelineStage, FilterQuery } from 'mongoose';
import { Product } from '../../models/Product';
import { StockMovementModel, type IStockMovement } from '../../models/StockMovement';
import { WarehouseStockModel } from '../../models/WarehouseStock';
import { ApiError } from '../../utils/ApiError';
import { Response } from 'express';
import type { StockValuationQuery, MovementsQuery, LowStockQuery, WasteAdjustmentsQuery } from './reports.schema';

/**
 * Helper: Escape CSV values
 * Wraps in quotes if contains comma, quote, or newline
 * Escapes internal quotes by doubling them
 */
const escapeCsv = (value: unknown): string => {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Stock Valuation Report — JSON preview
 * Returns first 100 rows + summary for all products
 */
export async function getStockValuation(tenantId: string, query: StockValuationQuery) {
  const pipeline: PipelineStage[] = [
    // Stage 1: Match active products for tenant
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isActive: query.isActive !== 'false',
        ...(query.categoryId ? { categoryId: new mongoose.Types.ObjectId(query.categoryId) } : {})
      }
    },

    // Stage 2: Lookup category
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },

    // Stage 3: Lookup warehouse stock breakdown
    {
      $lookup: {
        from: 'warehousestocks',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$productId', '$$productId'] },
                  { $eq: ['$tenantId', new mongoose.Types.ObjectId(tenantId)] },
                  ...(query.warehouseId
                    ? [{ $eq: ['$warehouseId', new mongoose.Types.ObjectId(query.warehouseId)] }]
                    : [])
                ]
              }
            }
          },
          {
            $lookup: {
              from: 'warehouses',
              localField: 'warehouseId',
              foreignField: '_id',
              as: 'warehouse'
            }
          },
          { $unwind: '$warehouse' },
          {
            $project: {
              warehouseName: '$warehouse.name',
              warehouseCode: '$warehouse.code',
              quantity: 1
            }
          }
        ],
        as: 'warehouseBreakdown'
      }
    },

    // Stage 4: Compute derived fields
    {
      $addFields: {
        stockValue: { $multiply: ['$totalStock', '$costPrice'] },
        potentialRevenue: { $multiply: ['$totalStock', '$sellingPrice'] },
        margin: {
          $cond: [
            { $gt: ['$sellingPrice', 0] },
            {
              $multiply: [
                {
                  $divide: [
                    { $subtract: ['$sellingPrice', '$costPrice'] },
                    '$sellingPrice'
                  ]
                },
                100
              ]
            },
            0
          ]
        },
        effectiveStock: query.warehouseId
          ? { $sum: '$warehouseBreakdown.quantity' }
          : '$totalStock'
      }
    },

    // Stage 5: Sort
    {
      $sort: {
        [query.sortBy === 'stockValue'
          ? 'stockValue'
          : query.sortBy === 'totalStock'
            ? 'effectiveStock'
            : query.sortBy === 'name'
              ? 'name'
              : 'sku']: query.sortOrder === 'asc' ? 1 : -1
      }
    }
  ];

  // Run two queries in parallel: preview (100 rows) + summary (all rows)
  const [rows, summaryResult] = await Promise.all([
    // Preview: first 100 rows
    Product.aggregate([...pipeline, { $limit: 100 }]),

    // Summary: totals across ALL rows
    Product.aggregate([
      ...pipeline,
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalUnits: { $sum: '$effectiveStock' },
          totalStockValue: { $sum: '$stockValue' },
          totalPotentialRevenue: { $sum: '$potentialRevenue' },
          avgMargin: { $avg: '$margin' }
        }
      }
    ])
  ]);

  // Format rows with proper rounding
  const formattedRows = rows.map((r) => ({
    ...r,
    stockValue: Math.round(r.stockValue * 100) / 100,
    potentialRevenue: Math.round(r.potentialRevenue * 100) / 100,
    margin: Math.round((r.margin ?? 0) * 10) / 10
  }));

  const summary = summaryResult[0] ?? {
    totalProducts: 0,
    totalUnits: 0,
    totalStockValue: 0,
    totalPotentialRevenue: 0,
    avgMargin: 0
  };

  return {
    rows: formattedRows,
    summary: {
      totalProducts: summary.totalProducts,
      totalUnits: summary.totalUnits,
      totalStockValue: Math.round(summary.totalStockValue * 100) / 100,
      totalPotentialRevenue: Math.round(summary.totalPotentialRevenue * 100) / 100,
      avgMargin: Math.round((summary.avgMargin ?? 0) * 10) / 10
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * Stock Valuation Report — CSV export stream
 */
export async function streamStockValuationCSV(
  tenantId: string,
  query: StockValuationQuery,
  res: Response
) {
  const filename = `stock-valuation-${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write('\uFEFF'); // UTF-8 BOM

  // Build aggregation pipeline (same as JSON version, no $limit)
  const pipeline: PipelineStage[] = [
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isActive: query.isActive !== 'false',
        ...(query.categoryId ? { categoryId: new mongoose.Types.ObjectId(query.categoryId) } : {})
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'warehousestocks',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$productId', '$$productId'] },
                  { $eq: ['$tenantId', new mongoose.Types.ObjectId(tenantId)] },
                  ...(query.warehouseId
                    ? [{ $eq: ['$warehouseId', new mongoose.Types.ObjectId(query.warehouseId)] }]
                    : [])
                ]
              }
            }
          },
          {
            $lookup: {
              from: 'warehouses',
              localField: 'warehouseId',
              foreignField: '_id',
              as: 'warehouse'
            }
          },
          { $unwind: '$warehouse' },
          {
            $project: {
              warehouseCode: '$warehouse.code',
              warehouseName: '$warehouse.name',
              quantity: 1
            }
          }
        ],
        as: 'warehouseBreakdown'
      }
    },
    {
      $addFields: {
        stockValue: { $multiply: ['$totalStock', '$costPrice'] },
        potentialRevenue: { $multiply: ['$totalStock', '$sellingPrice'] },
        margin: {
          $cond: [
            { $gt: ['$sellingPrice', 0] },
            {
              $multiply: [
                {
                  $divide: [
                    { $subtract: ['$sellingPrice', '$costPrice'] },
                    '$sellingPrice'
                  ]
                },
                100
              ]
            },
            0
          ]
        },
        effectiveStock: query.warehouseId ? { $sum: '$warehouseBreakdown.quantity' } : '$totalStock'
      }
    },
    {
      $sort: {
        [query.sortBy === 'stockValue'
          ? 'stockValue'
          : query.sortBy === 'totalStock'
            ? 'effectiveStock'
            : query.sortBy === 'name'
              ? 'name'
              : 'sku']: query.sortOrder === 'asc' ? 1 : -1
      }
    }
  ];

  const headers = [
    'SKU',
    'Product Name',
    'Category',
    'Unit',
    'Cost Price',
    'Selling Price',
    'Margin %',
    'Total Stock',
    'Stock Value',
    'Potential Revenue'
  ].join(',');
  res.write(headers + '\n');

  const cursor = Product.aggregate(pipeline).cursor();

  try {
    for await (const row of cursor) {
      const line = [
        escapeCsv(row.sku),
        escapeCsv(row.name),
        escapeCsv(row.category?.name ?? 'Uncategorized'),
        escapeCsv(row.unit),
        row.costPrice.toFixed(2),
        row.sellingPrice.toFixed(2),
        row.margin.toFixed(1),
        row.effectiveStock,
        (Math.round(row.stockValue * 100) / 100).toFixed(2),
        (Math.round(row.potentialRevenue * 100) / 100).toFixed(2)
      ].join(',');
      res.write(line + '\n');
    }
    res.end();
  } catch (error) {
    // Headers already sent — can't set 500 status
    // Just end the stream
    console.error('Error streaming stock valuation CSV:', error);
    res.end();
  }
}

/**
 * Helper: Build filter for movements report
 */
function buildMovementsFilter(tenantId: string, query: MovementsQuery): FilterQuery<IStockMovement> {
  const filter: FilterQuery<IStockMovement> = { tenantId: new mongoose.Types.ObjectId(tenantId) };

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (query.type) {
    if (query.type === 'TRANSFER') {
      filter.type = { $in: ['TRANSFER_IN', 'TRANSFER_OUT'] };
    } else {
      filter.type = query.type;
    }
  }

  if (query.productId) filter.productId = new mongoose.Types.ObjectId(query.productId);
  if (query.warehouseId) filter.warehouseId = new mongoose.Types.ObjectId(query.warehouseId);
  if (query.performedBy) filter.performedBy = new mongoose.Types.ObjectId(query.performedBy);

  return filter;
}

/**
 * Stock Movements Report — JSON preview with cursor pagination
 */
export async function getMovementsReport(tenantId: string, query: MovementsQuery) {
  const filter = buildMovementsFilter(tenantId, query);
  const limit = Math.min(Number(query.limit ?? 100), 500);

  // Decode cursor if provided
  if (query.cursor) {
    const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
    filter._id = { $lt: new mongoose.Types.ObjectId(decoded) };
  }

  const movements = await StockMovementModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('productId', 'name sku unit')
    .populate('warehouseId', 'name code')
    .populate('performedBy', 'name email')
    .lean();

  const hasMore = movements.length > limit;
  if (hasMore) movements.pop();

  const nextCursor = hasMore
    ? Buffer.from(((movements[movements.length - 1] as unknown as IStockMovement)?._id?.toString()) ?? '').toString('base64')
    : null;

  // Summary for full filtered dataset
  const summaryPipeline: PipelineStage[] = [
    { $match: { ...filter, _id: { $exists: true } } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' }
      }
    }
  ];

  const summary = await StockMovementModel.aggregate(summaryPipeline);

  return {
    movements,
    nextCursor,
    hasMore,
    summary,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Stock Movements Report — CSV export stream
 * Requires date range
 */
export async function streamMovementsCSV(tenantId: string, query: MovementsQuery, res: Response) {
  if (!query.dateFrom || !query.dateTo) {
    throw new ApiError(
      400,
      'Date range (dateFrom and dateTo) is required for CSV export'
    );
  }

  const filename = `movements-${query.dateFrom}-to-${query.dateTo}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write('\uFEFF');

  const headers = [
    'Date',
    'Time',
    'Product Name',
    'SKU',
    'Warehouse',
    'Movement Type',
    'Quantity',
    'Stock After',
    'Reference Type',
    'Note',
    'Performed By'
  ].join(',');
  res.write(headers + '\n');

  const filter = buildMovementsFilter(tenantId, query);
  const cursor = StockMovementModel.find(filter)
    .sort({ createdAt: -1 })
    .populate('productId', 'name sku unit')
    .populate('warehouseId', 'name code')
    .populate('performedBy', 'name')
    .lean()
    .cursor();

  try {
    for await (const doc of cursor) {
      const typedDoc = doc as unknown as IStockMovement & {
        productId?: { name?: string; sku?: string; unit?: string };
        warehouseId?: { code?: string; name?: string };
        performedBy?: { name?: string };
      };
      
      const date = new Date(typedDoc.createdAt);
      const product = typedDoc.productId;
      const warehouse = typedDoc.warehouseId;
      const user = typedDoc.performedBy;

      const signedQty =
        ['IN', 'TRANSFER_IN'].includes(typedDoc.type) ? `+${typedDoc.quantity}` :
        typedDoc.type === 'ADJUSTMENT'
          ? typedDoc.quantityAfter > typedDoc.quantityBefore
            ? `+${typedDoc.quantity}`
            : `-${typedDoc.quantity}`
          : `-${typedDoc.quantity}`;

      const line = [
        date.toISOString().split('T')[0],
        date.toTimeString().split(' ')[0],
        escapeCsv(product?.name ?? ''),
        escapeCsv(product?.sku ?? ''),
        escapeCsv(`${warehouse?.code ?? ''} ${warehouse?.name ?? ''}`),
        typedDoc.type,
        signedQty,
        `${typedDoc.quantityAfter} ${product?.unit ?? ''}`,
        typedDoc.referenceType,
        escapeCsv(typedDoc.note),
        escapeCsv(user?.name ?? '')
      ].join(',');
      res.write(line + '\n');
    }
    res.end();
  } catch (error) {
    console.error('Error streaming movements CSV:', error);
    res.end();
  }
}

/**
 * Low Stock Report — JSON (small dataset, no pagination)
 */
interface LowStockRow {
  sku: string;
  productName: string;
  categoryName: string;
  categoryColor: string;
  warehouseName: string;
  warehouseCode: string;
  unit: string;
  currentStock: number;
  threshold: number;
  shortage: number;
  reorderSuggestion: number;
  costPrice: number;
  restockCost: number;
}

export async function getLowStockReport(tenantId: string, query: LowStockQuery) {
  const pipeline: PipelineStage[] = [
    // Match WarehouseStock for tenant with stock > 0
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        quantity: { $gt: 0 },
        ...(query.warehouseId ? { warehouseId: new mongoose.Types.ObjectId(query.warehouseId) } : {})
      }
    },

    // Join Product
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },

    // Filter: active products AND stock <= threshold
    {
      $match: {
        'product.isActive': true,
        $expr: { $lte: ['$quantity', '$product.lowStockThreshold'] },
        ...(query.categoryId
          ? { 'product.categoryId': new mongoose.Types.ObjectId(query.categoryId) }
          : {})
      }
    },

    // Join Warehouse
    {
      $lookup: {
        from: 'warehouses',
        localField: 'warehouseId',
        foreignField: '_id',
        as: 'warehouse'
      }
    },
    { $unwind: '$warehouse' },

    // Join Category
    {
      $lookup: {
        from: 'categories',
        localField: 'product.categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },

    // Compute shortage and reorder suggestion
    {
      $addFields: {
        shortage: { $subtract: ['$product.lowStockThreshold', '$quantity'] },
        reorderSuggestion: {
          $multiply: ['$product.lowStockThreshold', 3]
        }
      }
    },

    // Sort
    {
      $sort: {
        [query.sortBy === 'name'
          ? 'product.name'
          : query.sortBy === 'currentStock'
            ? 'quantity'
            : 'shortage']: query.sortOrder === 'asc' ? 1 : -1
      }
    },

    // Project final shape
    {
      $project: {
        sku: '$product.sku',
        productName: '$product.name',
        categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
        categoryColor: { $ifNull: ['$category.color', '#888780'] },
        warehouseName: '$warehouse.name',
        warehouseCode: '$warehouse.code',
        unit: '$product.unit',
        currentStock: '$quantity',
        threshold: '$product.lowStockThreshold',
        shortage: 1,
        reorderSuggestion: 1,
        costPrice: '$product.costPrice',
        restockCost: { $multiply: ['$reorderSuggestion', '$product.costPrice'] }
      }
    }
  ];

  const rows = await WarehouseStockModel.aggregate<LowStockRow>(pipeline);

  const summary = {
    totalItems: rows.length,
    outOfStock: rows.filter((r: LowStockRow) => r.currentStock === 0).length,
    criticalItems: rows.filter((r: LowStockRow) => r.currentStock <= Math.floor(r.threshold * 0.25)).length,
    totalRestockCost: Math.round(rows.reduce((sum: number, r: LowStockRow) => sum + (r.restockCost ?? 0), 0) * 100) / 100
  };

  return { rows, summary, generatedAt: new Date().toISOString() };
}

/**
 * Low Stock Report — CSV export stream
 */
export async function streamLowStockCSV(tenantId: string, query: LowStockQuery, res: Response) {
  const filename = `low-stock-${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write('\uFEFF');

  const headers = [
    'SKU',
    'Product Name',
    'Category',
    'Warehouse',
    'Unit',
    'Current Stock',
    'Threshold',
    'Shortage',
    'Reorder Suggestion',
    'Estimated Restock Cost'
  ].join(',');
  res.write(headers + '\n');

  const pipeline: PipelineStage[] = [
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        quantity: { $gt: 0 },
        ...(query.warehouseId ? { warehouseId: new mongoose.Types.ObjectId(query.warehouseId) } : {})
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $match: {
        'product.isActive': true,
        $expr: { $lte: ['$quantity', '$product.lowStockThreshold'] },
        ...(query.categoryId
          ? { 'product.categoryId': new mongoose.Types.ObjectId(query.categoryId) }
          : {})
      }
    },
    {
      $lookup: {
        from: 'warehouses',
        localField: 'warehouseId',
        foreignField: '_id',
        as: 'warehouse'
      }
    },
    { $unwind: '$warehouse' },
    {
      $lookup: {
        from: 'categories',
        localField: 'product.categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        shortage: { $subtract: ['$product.lowStockThreshold', '$quantity'] },
        reorderSuggestion: { $multiply: ['$product.lowStockThreshold', 3] }
      }
    },
    {
      $sort: {
        [query.sortBy === 'name'
          ? 'product.name'
          : query.sortBy === 'currentStock'
            ? 'quantity'
            : 'shortage']: query.sortOrder === 'asc' ? 1 : -1
      }
    },
    {
      $project: {
        sku: '$product.sku',
        productName: '$product.name',
        categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
        warehouseName: '$warehouse.name',
        warehouseCode: '$warehouse.code',
        unit: '$product.unit',
        currentStock: '$quantity',
        threshold: '$product.lowStockThreshold',
        shortage: 1,
        reorderSuggestion: 1,
        costPrice: '$product.costPrice',
        restockCost: { $multiply: ['$reorderSuggestion', '$product.costPrice'] }
      }
    }
  ];

  const cursor = WarehouseStockModel.aggregate(pipeline).cursor();

  try {
    for await (const row of cursor) {
      const line = [
        escapeCsv(row.sku),
        escapeCsv(row.productName),
        escapeCsv(row.categoryName),
        escapeCsv(`${row.warehouseCode} ${row.warehouseName}`),
        row.unit,
        row.currentStock,
        row.threshold,
        row.shortage,
        row.reorderSuggestion,
        row.restockCost.toFixed(2)
      ].join(',');
      res.write(line + '\n');
    }
    res.end();
  } catch (error) {
    console.error('Error streaming low stock CSV:', error);
    res.end();
  }
}

/**
 * Waste & Adjustments Report — JSON preview with cursor pagination
 */
export async function getWasteAdjustmentsReport(tenantId: string, query: WasteAdjustmentsQuery) {
  const filter: FilterQuery<IStockMovement> = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    type: query.type ? query.type : { $in: ['WASTE', 'ADJUSTMENT'] }
  };

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (query.productId) filter.productId = new mongoose.Types.ObjectId(query.productId);
  if (query.warehouseId) filter.warehouseId = new mongoose.Types.ObjectId(query.warehouseId);

  const limit = Math.min(Number(query.limit ?? 100), 500);

  // Decode cursor
  if (query.cursor) {
    const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
    filter._id = { $lt: new mongoose.Types.ObjectId(decoded) };
  }

  const movements = await StockMovementModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('productId', 'name sku unit costPrice')
    .populate('warehouseId', 'name code')
    .populate('performedBy', 'name')
    .lean();

  const hasMore = movements.length > limit;
  if (hasMore) movements.pop();

  const nextCursor = hasMore
    ? Buffer.from(((movements[movements.length - 1] as unknown as IStockMovement)?._id?.toString()) ?? '').toString('base64')
    : null;

  // Summary with value calculation
  const summaryPipeline: PipelineStage[] = [
    { $match: { ...filter, _id: { $exists: true } } },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalValue: { $sum: { $multiply: ['$quantity', '$product.costPrice'] } }
      }
    }
  ];

  interface SummaryCount {
    _id: string;
    count: number;
    totalQuantity: number;
    totalValue: number;
  }

  const summaryCounts = await StockMovementModel.aggregate(summaryPipeline);

  const summary = {
    waste: (summaryCounts as SummaryCount[]).find((s: SummaryCount) => s._id === 'WASTE') ?? {
      count: 0,
      totalQuantity: 0,
      totalValue: 0
    },
    adjustment: (summaryCounts as SummaryCount[]).find((s: SummaryCount) => s._id === 'ADJUSTMENT') ?? {
      count: 0,
      totalQuantity: 0,
      totalValue: 0
    }
  };

  return {
    movements,
    nextCursor,
    hasMore,
    summary,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Waste & Adjustments Report — CSV export stream
 */
export async function streamWasteAdjustmentsCSV(
  tenantId: string,
  query: WasteAdjustmentsQuery,
  res: Response
) {
  const filename = `waste-adjustments-${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write('\uFEFF');

  const headers = [
    'Date',
    'Time',
    'Type',
    'Product Name',
    'SKU',
    'Category',
    'Warehouse',
    'Quantity',
    'Estimated Value',
    'Note',
    'Performed By'
  ].join(',');
  res.write(headers + '\n');

  const filter: FilterQuery<IStockMovement> = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    type: query.type ? query.type : { $in: ['WASTE', 'ADJUSTMENT'] }
  };

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (query.productId) filter.productId = new mongoose.Types.ObjectId(query.productId);
  if (query.warehouseId) filter.warehouseId = new mongoose.Types.ObjectId(query.warehouseId);

  const cursor = StockMovementModel.find(filter)
    .sort({ createdAt: -1 })
    .populate('productId', 'name sku costPrice')
    .populate('warehouseId', 'name code')
    .populate('performedBy', 'name')
    .lean()
    .cursor();

  try {
    for await (const doc of cursor) {
      const typedDoc = doc as unknown as IStockMovement & {
        productId?: { name?: string; sku?: string; costPrice?: number };
        warehouseId?: { code?: string; name?: string };
        performedBy?: { name?: string };
      };
      
      const date = new Date(typedDoc.createdAt);
      const product = typedDoc.productId;
      const warehouse = typedDoc.warehouseId;
      const user = typedDoc.performedBy;

      const estimatedValue = ((typedDoc.quantity ?? 0) * (product?.costPrice ?? 0)).toFixed(2);

      const line = [
        date.toISOString().split('T')[0],
        date.toTimeString().split(' ')[0],
        typedDoc.type,
        escapeCsv(product?.name ?? ''),
        escapeCsv(product?.sku ?? ''),
        escapeCsv(''), // Category not included in fields — would require additional lookup
        escapeCsv(`${warehouse?.code ?? ''} ${warehouse?.name ?? ''}`),
        typedDoc.quantity,
        estimatedValue,
        escapeCsv(typedDoc.note),
        escapeCsv(user?.name ?? '')
      ].join(',');
      res.write(line + '\n');
    }
    res.end();
  } catch (error) {
    console.error('Error streaming waste/adjustments CSV:', error);
    res.end();
  }
}
