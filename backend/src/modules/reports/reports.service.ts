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
 * Stock Valuation Report — JSON with cursor-based pagination
 * Returns paginated rows + summary for all products
 *
 * Optimized: summary runs a lightweight aggregate (no $lookup).
 * Rows pipeline runs $sort + $skip + $limit BEFORE expensive $lookup stages.
 * Summary is only computed on the first page (no cursor).
 */
export async function getStockValuation(tenantId: string, query: StockValuationQuery) {
  const tenantOid = new mongoose.Types.ObjectId(tenantId);
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);

  const sortField =
    query.sortBy === 'stockValue' ? 'stockValue'
      : query.sortBy === 'totalStock' ? 'totalStock'
        : query.sortBy === 'name' ? 'name'
          : 'sku';
  const sortDir: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;

  // Decode offset cursor
  let offset = 0;
  if (query.cursor) {
    const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
    offset = parseInt(decoded, 10) || 0;
  }

  const isFirstPage = offset === 0;

  // When warehouseId is set, start from WarehouseStocks (indexed by tenant+warehouse)
  // instead of scanning all 1M products with a per-row $lookup.
  if (query.warehouseId) {
    return getStockValuationByWarehouse(tenantOid, query, limit, offset, isFirstPage);
  }

  // ---- No warehouse filter: operate directly on Products ----
  const matchFilter: Record<string, unknown> = {
    tenantId: tenantOid,
    isActive: query.isActive !== 'false',
    ...(query.categoryId ? { categoryId: new mongoose.Types.ObjectId(query.categoryId) } : {})
  };

  const summaryPromise = isFirstPage
    ? Product.aggregate([
        { $match: matchFilter },
        { $addFields: { effectiveStock: '$totalStock' } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalUnits: { $sum: '$effectiveStock' },
            totalStockValue: { $sum: { $multiply: ['$effectiveStock', '$costPrice'] } },
            totalPotentialRevenue: { $sum: { $multiply: ['$effectiveStock', '$sellingPrice'] } },
            avgMargin: {
              $avg: {
                $cond: [
                  { $gt: ['$sellingPrice', 0] },
                  { $multiply: [{ $divide: [{ $subtract: ['$sellingPrice', '$costPrice'] }, '$sellingPrice'] }, 100] },
                  0
                ]
              }
            }
          }
        }
      ])
    : Promise.resolve([]);

  const rowsPromise = Product.aggregate([
    { $match: matchFilter },
    { $addFields: { stockValue: { $multiply: ['$totalStock', '$costPrice'] } } },
    { $sort: { [sortField]: sortDir } },
    ...(offset > 0 ? [{ $skip: offset } as PipelineStage] : []),
    { $limit: limit + 1 },
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
                  { $eq: ['$tenantId', tenantOid] }
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
    {
      $addFields: {
        potentialRevenue: { $multiply: ['$totalStock', '$sellingPrice'] },
        margin: {
          $cond: [
            { $gt: ['$sellingPrice', 0] },
            { $multiply: [{ $divide: [{ $subtract: ['$sellingPrice', '$costPrice'] }, '$sellingPrice'] }, 100] },
            0
          ]
        },
        effectiveStock: '$totalStock'
      }
    }
  ]);

  return buildValuationResponse(summaryPromise, rowsPromise, limit, offset);
}

/**
 * Warehouse-filtered stock valuation.
 * Starts from WarehouseStocks (small set per warehouse) → joins Products.
 * Avoids 1M per-product $lookup.
 */
async function getStockValuationByWarehouse(
  tenantOid: mongoose.Types.ObjectId,
  query: StockValuationQuery,
  limit: number,
  offset: number,
  isFirstPage: boolean
) {
  const warehouseOid = new mongoose.Types.ObjectId(query.warehouseId!);
  const sortField =
    query.sortBy === 'stockValue' ? 'stockValue'
      : query.sortBy === 'totalStock' ? 'effectiveStock'
        : query.sortBy === 'name' ? 'product.name'
          : 'product.sku';
  const sortDir: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;

  // Common match for warehousestocks
  const wsMatch: Record<string, unknown> = {
    tenantId: tenantOid,
    warehouseId: warehouseOid,
    quantity: { $gt: 0 }
  };

  // Summary: WarehouseStocks → join Product for prices, group
  const summaryPromise = isFirstPage
    ? WarehouseStockModel.aggregate([
        { $match: wsMatch },
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
            'product.isActive': query.isActive !== 'false',
            ...(query.categoryId
              ? { 'product.categoryId': new mongoose.Types.ObjectId(query.categoryId) }
              : {})
          }
        },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalUnits: { $sum: '$quantity' },
            totalStockValue: { $sum: { $multiply: ['$quantity', '$product.costPrice'] } },
            totalPotentialRevenue: { $sum: { $multiply: ['$quantity', '$product.sellingPrice'] } },
            avgMargin: {
              $avg: {
                $cond: [
                  { $gt: ['$product.sellingPrice', 0] },
                  {
                    $multiply: [
                      { $divide: [{ $subtract: ['$product.sellingPrice', '$product.costPrice'] }, '$product.sellingPrice'] },
                      100
                    ]
                  },
                  0
                ]
              }
            }
          }
        }
      ])
    : Promise.resolve([]);

  // Rows: WarehouseStocks → join Product → sort → skip → limit → join category + all warehouse breakdown
  const rowsPromise = WarehouseStockModel.aggregate([
    { $match: wsMatch },
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
        'product.isActive': query.isActive !== 'false',
        ...(query.categoryId
          ? { 'product.categoryId': new mongoose.Types.ObjectId(query.categoryId) }
          : {})
      }
    },
    // Compute sort fields
    {
      $addFields: {
        effectiveStock: '$quantity',
        stockValue: { $multiply: ['$quantity', '$product.costPrice'] }
      }
    },
    { $sort: { [sortField]: sortDir } },
    ...(offset > 0 ? [{ $skip: offset } as PipelineStage] : []),
    { $limit: limit + 1 },
    // Lookups only on the page
    {
      $lookup: {
        from: 'categories',
        localField: 'product.categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    // Get all warehouse breakdown for these products
    {
      $lookup: {
        from: 'warehousestocks',
        let: { productId: '$productId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$productId', '$$productId'] },
                  { $eq: ['$tenantId', tenantOid] }
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
    // Reshape to match the non-warehouse response shape
    {
      $addFields: {
        _id: '$product._id',
        sku: '$product.sku',
        name: '$product.name',
        unit: '$product.unit',
        costPrice: '$product.costPrice',
        sellingPrice: '$product.sellingPrice',
        totalStock: '$product.totalStock',
        potentialRevenue: { $multiply: ['$quantity', '$product.sellingPrice'] },
        margin: {
          $cond: [
            { $gt: ['$product.sellingPrice', 0] },
            { $multiply: [{ $divide: [{ $subtract: ['$product.sellingPrice', '$product.costPrice'] }, '$product.sellingPrice'] }, 100] },
            0
          ]
        }
      }
    }
  ]);

  return buildValuationResponse(summaryPromise, rowsPromise, limit, offset);
}

/**
 * Shared response builder for stock valuation
 */
async function buildValuationResponse(
  summaryPromise: Promise<Array<Record<string, number>>>,
  rowsPromise: mongoose.Aggregate<Array<Record<string, unknown>>>,
  limit: number,
  offset: number
) {
  const [summaryResult, rows] = await Promise.all([summaryPromise, rowsPromise]);

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  const nextCursor = hasMore
    ? Buffer.from(String(offset + limit)).toString('base64')
    : null;

  const formattedRows = rows.map((r) => {
    const row = r as Record<string, number>;
    return {
      ...r,
      stockValue: Math.round((Number(row.stockValue) || 0) * 100) / 100,
      potentialRevenue: Math.round((Number(row.potentialRevenue) || 0) * 100) / 100,
      margin: Math.round((Number(row.margin) || 0) * 10) / 10
    };
  });

  const summary = summaryResult[0] ?? null;

  return {
    rows: formattedRows,
    nextCursor,
    hasMore,
    ...(summary
      ? {
          summary: {
            totalProducts: summary.totalProducts,
            totalUnits: summary.totalUnits,
            totalStockValue: Math.round(summary.totalStockValue * 100) / 100,
            totalPotentialRevenue: Math.round(summary.totalPotentialRevenue * 100) / 100,
            avgMargin: Math.round((summary.avgMargin ?? 0) * 10) / 10
          }
        }
      : {}),
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

  const tenantOid = new mongoose.Types.ObjectId(tenantId);
  const sortField =
    query.sortBy === 'stockValue' ? 'stockValue'
      : query.sortBy === 'totalStock' ? 'effectiveStock'
        : query.sortBy === 'name' ? (query.warehouseId ? 'product.name' : 'name')
          : (query.warehouseId ? 'product.sku' : 'sku');
  const sortDir: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;

  let pipeline: PipelineStage[];

  if (query.warehouseId) {
    // Start from WarehouseStocks → join Product (fast path for warehouse filter)
    const warehouseOid = new mongoose.Types.ObjectId(query.warehouseId);
    pipeline = [
      { $match: { tenantId: tenantOid, warehouseId: warehouseOid, quantity: { $gt: 0 } } },
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
          'product.isActive': query.isActive !== 'false',
          ...(query.categoryId
            ? { 'product.categoryId': new mongoose.Types.ObjectId(query.categoryId) }
            : {})
        }
      },
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
          sku: '$product.sku',
          name: '$product.name',
          unit: '$product.unit',
          costPrice: '$product.costPrice',
          sellingPrice: '$product.sellingPrice',
          effectiveStock: '$quantity',
          stockValue: { $multiply: ['$quantity', '$product.costPrice'] },
          potentialRevenue: { $multiply: ['$quantity', '$product.sellingPrice'] },
          margin: {
            $cond: [
              { $gt: ['$product.sellingPrice', 0] },
              { $multiply: [{ $divide: [{ $subtract: ['$product.sellingPrice', '$product.costPrice'] }, '$product.sellingPrice'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { [sortField]: sortDir } }
    ];
  } else {
    // Start from Products (no warehouse filter)
    pipeline = [
      {
        $match: {
          tenantId: tenantOid,
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
        $addFields: {
          effectiveStock: '$totalStock',
          stockValue: { $multiply: ['$totalStock', '$costPrice'] },
          potentialRevenue: { $multiply: ['$totalStock', '$sellingPrice'] },
          margin: {
            $cond: [
              { $gt: ['$sellingPrice', 0] },
              { $multiply: [{ $divide: [{ $subtract: ['$sellingPrice', '$costPrice'] }, '$sellingPrice'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { [sortField]: sortDir } }
    ];
  }

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

  const model = query.warehouseId ? WarehouseStockModel : Product;
  const cursor = model.aggregate(pipeline).cursor();

  try {
    for await (const row of cursor) {
      const line = [
        escapeCsv(row.sku),
        escapeCsv(row.name),
        escapeCsv(row.category?.name ?? 'Uncategorized'),
        escapeCsv(row.unit),
        Number(row.costPrice).toFixed(2),
        Number(row.sellingPrice).toFixed(2),
        Number(row.margin).toFixed(1),
        row.effectiveStock,
        (Math.round(row.stockValue * 100) / 100).toFixed(2),
        (Math.round(row.potentialRevenue * 100) / 100).toFixed(2)
      ].join(',');
      res.write(line + '\n');
    }
    res.end();
  } catch (error) {
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
  const hasCursor = !!query.cursor;

  // Decode compound cursor (createdAt::_id)
  if (query.cursor) {
    const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
    const sepIdx = decoded.indexOf('::');
    let curCreatedAt: Date;
    let curId: mongoose.Types.ObjectId;
    if (sepIdx !== -1) {
      curCreatedAt = new Date(decoded.substring(0, sepIdx));
      curId = new mongoose.Types.ObjectId(decoded.substring(sepIdx + 2));
    } else {
      // Backwards compat: old cursor is just an ObjectId
      curId = new mongoose.Types.ObjectId(decoded);
      curCreatedAt = curId.getTimestamp();
    }

    const dateRange = filter.createdAt as Record<string, unknown> | undefined;
    delete filter.createdAt;

    filter.$or = [
      { createdAt: { $lt: curCreatedAt, ...dateRange } },
      { createdAt: { $eq: curCreatedAt, ...dateRange }, _id: { $lt: curId } }
    ];
  }

  const movements = await StockMovementModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('productId', 'name sku unit')
    .populate('warehouseId', 'name code')
    .populate('performedBy', 'name email')
    .lean();

  const hasMore = movements.length > limit;
  if (hasMore) movements.pop();

  const lastDoc = movements[movements.length - 1] as unknown as { _id: mongoose.Types.ObjectId; createdAt: Date };
  const nextCursor = hasMore && lastDoc
    ? Buffer.from(`${new Date(lastDoc.createdAt).toISOString()}::${lastDoc._id.toString()}`).toString('base64')
    : null;

  // Only compute summary on first page (no cursor) — it doesn't change between pages
  let summary: { _id: string; count: number; totalQuantity: number }[] | undefined;
  if (!hasCursor) {
    const summaryFilter = buildMovementsFilter(tenantId, query);
    summary = await StockMovementModel.aggregate([
      { $match: summaryFilter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);
  }

  return {
    movements,
    nextCursor,
    hasMore,
    ...(summary !== undefined ? { summary } : {}),
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
  const tenantOid = new mongoose.Types.ObjectId(tenantId);
  const sortField =
    query.sortBy === 'name' ? 'name'
      : query.sortBy === 'currentStock' ? 'ws.quantity'
        : 'shortage';
  const sortDir: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;

  const pipeline: PipelineStage[] = [
    // Start from Products that actually have a threshold (only these can be "low stock")
    {
      $match: {
        tenantId: tenantOid,
        isActive: true,
        lowStockThreshold: { $gt: 0 },
        ...(query.categoryId
          ? { categoryId: new mongoose.Types.ObjectId(query.categoryId) }
          : {})
      }
    },

    // Lookup only WarehouseStocks that are at or below threshold
    {
      $lookup: {
        from: 'warehousestocks',
        let: { pid: '$_id', threshold: '$lowStockThreshold' },
        pipeline: [
          {
            $match: {
              tenantId: tenantOid,
              ...(query.warehouseId
                ? { warehouseId: new mongoose.Types.ObjectId(query.warehouseId) }
                : {}),
              $expr: {
                $and: [
                  { $eq: ['$productId', '$$pid'] },
                  { $lte: ['$quantity', '$$threshold'] }
                ]
              }
            }
          }
        ],
        as: 'ws'
      }
    },

    // Drop products with no low-stock warehouses
    { $unwind: '$ws' },

    // Join Warehouse
    {
      $lookup: {
        from: 'warehouses',
        localField: 'ws.warehouseId',
        foreignField: '_id',
        as: 'warehouse'
      }
    },
    { $unwind: '$warehouse' },

    // Join Category
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },

    // Compute shortage and reorder suggestion
    {
      $addFields: {
        shortage: { $subtract: ['$lowStockThreshold', '$ws.quantity'] },
        reorderSuggestion: { $multiply: ['$lowStockThreshold', 3] }
      }
    },

    // Sort
    { $sort: { [sortField]: sortDir } },

    // Project final shape
    {
      $project: {
        sku: 1,
        productName: '$name',
        categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
        categoryColor: { $ifNull: ['$category.color', '#888780'] },
        warehouseName: '$warehouse.name',
        warehouseCode: '$warehouse.code',
        unit: 1,
        currentStock: '$ws.quantity',
        threshold: '$lowStockThreshold',
        shortage: 1,
        reorderSuggestion: 1,
        costPrice: 1,
        restockCost: { $multiply: ['$reorderSuggestion', '$costPrice'] }
      }
    }
  ];

  const rows = await Product.aggregate<LowStockRow>(pipeline);

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

  const tenantOid = new mongoose.Types.ObjectId(tenantId);
  const sortField =
    query.sortBy === 'name' ? 'name'
      : query.sortBy === 'currentStock' ? 'ws.quantity'
        : 'shortage';
  const sortDir: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;

  const pipeline: PipelineStage[] = [
    {
      $match: {
        tenantId: tenantOid,
        isActive: true,
        lowStockThreshold: { $gt: 0 },
        ...(query.categoryId
          ? { categoryId: new mongoose.Types.ObjectId(query.categoryId) }
          : {})
      }
    },
    {
      $lookup: {
        from: 'warehousestocks',
        let: { pid: '$_id', threshold: '$lowStockThreshold' },
        pipeline: [
          {
            $match: {
              tenantId: tenantOid,
              ...(query.warehouseId
                ? { warehouseId: new mongoose.Types.ObjectId(query.warehouseId) }
                : {}),
              $expr: {
                $and: [
                  { $eq: ['$productId', '$$pid'] },
                  { $lte: ['$quantity', '$$threshold'] }
                ]
              }
            }
          }
        ],
        as: 'ws'
      }
    },
    { $unwind: '$ws' },
    {
      $lookup: {
        from: 'warehouses',
        localField: 'ws.warehouseId',
        foreignField: '_id',
        as: 'warehouse'
      }
    },
    { $unwind: '$warehouse' },
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
      $addFields: {
        shortage: { $subtract: ['$lowStockThreshold', '$ws.quantity'] },
        reorderSuggestion: { $multiply: ['$lowStockThreshold', 3] }
      }
    },
    { $sort: { [sortField]: sortDir } },
    {
      $project: {
        sku: 1,
        productName: '$name',
        categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
        warehouseName: '$warehouse.name',
        warehouseCode: '$warehouse.code',
        unit: 1,
        currentStock: '$ws.quantity',
        threshold: '$lowStockThreshold',
        shortage: 1,
        reorderSuggestion: 1,
        costPrice: 1,
        restockCost: { $multiply: ['$reorderSuggestion', '$costPrice'] }
      }
    }
  ];

  const cursor = Product.aggregate(pipeline).cursor();

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
  const buildFilter = () => {
    const f: FilterQuery<IStockMovement> = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      type: query.type ? query.type : { $in: ['WASTE', 'ADJUSTMENT'] }
    };
    if (query.dateFrom || query.dateTo) {
      f.createdAt = {};
      if (query.dateFrom) f.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        f.createdAt.$lte = end;
      }
    }
    if (query.productId) f.productId = new mongoose.Types.ObjectId(query.productId);
    if (query.warehouseId) f.warehouseId = new mongoose.Types.ObjectId(query.warehouseId);
    return f;
  };

  const filter = buildFilter();
  const limit = Math.min(Number(query.limit ?? 100), 500);
  const hasCursor = !!query.cursor;

  // Decode compound cursor (createdAt::_id)
  if (query.cursor) {
    const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
    const sepIdx = decoded.indexOf('::');
    let curCreatedAt: Date;
    let curId: mongoose.Types.ObjectId;
    if (sepIdx !== -1) {
      curCreatedAt = new Date(decoded.substring(0, sepIdx));
      curId = new mongoose.Types.ObjectId(decoded.substring(sepIdx + 2));
    } else {
      curId = new mongoose.Types.ObjectId(decoded);
      curCreatedAt = curId.getTimestamp();
    }

    const dateRange = filter.createdAt as Record<string, unknown> | undefined;
    delete filter.createdAt;

    filter.$or = [
      { createdAt: { $lt: curCreatedAt, ...dateRange } },
      { createdAt: { $eq: curCreatedAt, ...dateRange }, _id: { $lt: curId } }
    ];
  }

  const movements = await StockMovementModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('productId', 'name sku unit costPrice')
    .populate('warehouseId', 'name code')
    .populate('performedBy', 'name')
    .lean();

  const hasMore = movements.length > limit;
  if (hasMore) movements.pop();

  const lastDoc = movements[movements.length - 1] as unknown as { _id: mongoose.Types.ObjectId; createdAt: Date };
  const nextCursor = hasMore && lastDoc
    ? Buffer.from(`${new Date(lastDoc.createdAt).toISOString()}::${lastDoc._id.toString()}`).toString('base64')
    : null;

  // Only compute summary on first page — it doesn't change between pages
  interface SummaryCount {
    _id: string;
    count: number;
    totalQuantity: number;
    totalValue: number;
  }

  let summary: { waste: SummaryCount; adjustment: SummaryCount } | undefined;
  if (!hasCursor) {
    const summaryFilter = buildFilter();
    const summaryCounts: SummaryCount[] = await StockMovementModel.aggregate([
      { $match: summaryFilter },
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
    ]);

    summary = {
      waste: summaryCounts.find((s) => s._id === 'WASTE') ?? {
        _id: 'WASTE',
        count: 0,
        totalQuantity: 0,
        totalValue: 0
      },
      adjustment: summaryCounts.find((s) => s._id === 'ADJUSTMENT') ?? {
        _id: 'ADJUSTMENT',
        count: 0,
        totalQuantity: 0,
        totalValue: 0
      }
    };
  }

  return {
    movements,
    nextCursor,
    hasMore,
    ...(summary !== undefined ? { summary } : {}),
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
