import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { CATEGORY_DEFINITIONS } from './data/categories';
import { PRODUCT_TEMPLATES, type ProductTemplate } from './data/products';
import { TENANT_DEFINITIONS, type SeedTenantDefinition, type SeedUserDefinition } from './data/tenants';
import { WAREHOUSE_DEFINITIONS } from './data/warehouses';
import { CategoryModel } from '../src/models/Category';
import { Product, type IProduct } from '../src/models/Product';
import { StockAlertModel } from '../src/models/StockAlert';
import { StockMovementModel } from '../src/models/StockMovement';
import { TenantModel } from '../src/models/Tenant';
import { UserModel, type IUser } from '../src/models/User';
import { WarehouseModel } from '../src/models/Warehouse';
import { WarehouseStockModel } from '../src/models/WarehouseStock';

dotenv.config();

const DAY_MS = 24 * 60 * 60 * 1000;

type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE' | 'TRANSFER_OUT' | 'TRANSFER_IN';
type ReferenceType = 'MANUAL' | 'PURCHASE' | 'SALE' | 'TRANSFER' | 'WASTE' | 'ADJUSTMENT';

interface CreateMovementParams {
  tenantId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  quantityBefore: number;
  totalStockBefore: number;
  performedBy: mongoose.Types.ObjectId;
  referenceType: ReferenceType;
  note: string;
  createdAt: Date;
  transferPairId?: mongoose.Types.ObjectId;
}

interface StockRange {
  initial: [number, number];
  reorder: [number, number];
}

const STOCK_VOLUMES: Record<string, StockRange> = {
  Smartphones: { initial: [15, 30], reorder: [5, 15] },
  Laptops: { initial: [8, 15], reorder: [3, 8] },
  Audio: { initial: [30, 80], reorder: [10, 30] },
  'Cables & Adapters': { initial: [150, 400], reorder: [50, 150] },
  Batteries: { initial: [100, 300], reorder: [50, 100] },
  Monitors: { initial: [10, 20], reorder: [3, 8] },
  'Keyboards & Mice': { initial: [25, 60], reorder: [10, 25] },
  Storage: { initial: [40, 100], reorder: [15, 40] },
  Networking: { initial: [20, 50], reorder: [8, 20] },
  'Power & Charging': { initial: [60, 150], reorder: [20, 60] },
};

const seededInt = (min: number, max: number, seed: number): number => {
  if (max <= min) return min;
  return min + (Math.abs(seed) % (max - min + 1));
};

const toFieldKey = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const movementDateFromDaysAgo = (daysAgo: number): Date => {
  const safeDaysAgo = Math.max(1, Math.min(90, daysAgo));
  return new Date(Date.now() - safeDaysAgo * DAY_MS);
};

const createMovement = async (
  session: mongoose.ClientSession,
  {
    tenantId,
    productId,
    warehouseId,
    type,
    quantity,
    quantityBefore,
    totalStockBefore,
    performedBy,
    referenceType,
    note,
    createdAt,
    transferPairId,
  }: CreateMovementParams
): Promise<{ quantityAfter: number; totalStockAfter: number }> => {
  const movementQuantity = type === 'ADJUSTMENT' ? quantity : Math.abs(quantity);

  const quantityDelta =
    type === 'IN' || type === 'TRANSFER_IN'
      ? movementQuantity
      : type === 'ADJUSTMENT'
        ? movementQuantity
        : -movementQuantity;

  const quantityAfter = quantityBefore + quantityDelta;
  const totalDelta = type === 'TRANSFER_IN' || type === 'TRANSFER_OUT' ? 0 : quantityDelta;
  const totalStockAfter = totalStockBefore + totalDelta;

  if (quantityAfter < 0 || totalStockAfter < 0) {
    throw new Error(
      `Invalid movement state for product ${productId.toString()}: warehouse=${quantityAfter}, total=${totalStockAfter}`
    );
  }

  await StockMovementModel.create(
    [
      {
        tenantId,
        productId,
        warehouseId,
        type,
        quantity: movementQuantity,
        quantityBefore,
        quantityAfter,
        totalStockBefore,
        totalStockAfter,
        referenceType,
        referenceId: null,
        note,
        performedBy,
        transferPairId: transferPairId ?? null,
        createdAt,
      },
    ],
    { session }
  );

  await WarehouseStockModel.findOneAndUpdate(
    { tenantId, warehouseId, productId },
    {
      $inc: { quantity: quantityDelta },
      $setOnInsert: { reservedQuantity: 0 },
      $set: { updatedAt: createdAt },
    },
    { upsert: true, session }
  );

  if (type !== 'TRANSFER_IN' && type !== 'TRANSFER_OUT') {
    await Product.findByIdAndUpdate(productId, { $inc: { totalStock: quantityDelta } }, { session });
  }

  return { quantityAfter, totalStockAfter };
};

const withTransaction = async (fn: (session: mongoose.ClientSession) => Promise<void>): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await fn(session);
    await session.commitTransaction();
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

const seedUsers = async (
  tenantId: mongoose.Types.ObjectId,
  users: SeedUserDefinition[]
): Promise<{ ownerUser: IUser; performers: IUser[] }> => {
  const createdUsers: IUser[] = [];

  for (const userDef of users) {
    let user = await UserModel.findOne({ tenantId, email: userDef.email.toLowerCase() });

    if (!user) {
      const passwordHash = await bcrypt.hash(userDef.password, 12);
      user = await UserModel.findOneAndUpdate(
        { tenantId, email: userDef.email.toLowerCase() },
        {
          $setOnInsert: {
            tenantId,
            name: userDef.name,
            email: userDef.email.toLowerCase(),
            password: passwordHash,
            role: userDef.role,
            isEmailVerified: true,
            isActive: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    if (!user) {
      throw new Error(`Failed to create/fetch user ${userDef.email}`);
    }

    createdUsers.push(user);
  }

  const ownerUser = createdUsers.find((u) => u.role === 'owner');
  if (!ownerUser) {
    throw new Error(`No owner user found for tenant ${tenantId.toString()}`);
  }

  const performers = createdUsers.filter((u) => u.role === 'manager' || u.role === 'staff' || u.role === 'owner');
  return { ownerUser, performers: performers.length > 0 ? performers : [ownerUser] };
};

const createTenantCustomFields = (def: SeedTenantDefinition['tenant']) =>
  def.customFields.map((field, index) => ({
    name: field.name,
    key: toFieldKey(field.name),
    type: field.type,
    required: field.required,
    order: index,
  }));

const buildProductCustomFields = (tenantCustomFields: Array<{ name: string; type: string }>): Map<string, unknown> => {
  const customFields: Record<string, unknown> = {};

  for (const field of tenantCustomFields) {
    if (field.type === 'text') customFields[field.name] = '';
    if (field.type === 'number') customFields[field.name] = 0;
    if (field.type === 'boolean') customFields[field.name] = false;
    if (field.type === 'date') customFields[field.name] = null;
  }

  return new Map(Object.entries(customFields));
};

const isWasteCategory = (categoryName: string): boolean =>
  categoryName === 'Batteries' || categoryName === 'Power & Charging';

const seedProductMovements = async (
  tenantId: mongoose.Types.ObjectId,
  tenantIndex: number,
  product: IProduct,
  template: ProductTemplate,
  productIndex: number,
  warehouseMap: Record<string, mongoose.Types.ObjectId>,
  performers: IUser[]
): Promise<number> => {
  const wh1 = warehouseMap['WH-001'];
  const wh2 = warehouseMap['WH-002'];

  if (!wh1 || !wh2) {
    throw new Error('Required warehouses WH-001 and WH-002 not found');
  }

  const stockRange = STOCK_VOLUMES[template.categoryName] ?? { initial: [20, 40], reorder: [8, 20] };
  const baseSeed = productIndex + tenantIndex * 1000 + 1;

  const warehouseStock: Record<string, number> = {
    [wh1.toString()]: 0,
    [wh2.toString()]: 0,
  };
  let totalStock = 0;
  let movementCount = 0;

  const performerFor = (offset: number): mongoose.Types.ObjectId =>
    performers[(baseSeed + offset) % performers.length]._id;

  await withTransaction(async (session) => {
    const initialQty = seededInt(stockRange.initial[0], stockRange.initial[1], baseSeed + 11);
    let result = await createMovement(session, {
      tenantId,
      productId: product._id,
      warehouseId: wh1,
      type: 'IN',
      quantity: initialQty,
      quantityBefore: warehouseStock[wh1.toString()],
      totalStockBefore: totalStock,
      performedBy: performerFor(1),
      referenceType: 'PURCHASE',
      note: 'Initial purchase order received',
      createdAt: movementDateFromDaysAgo(90 - (productIndex % 10)),
    });
    warehouseStock[wh1.toString()] = result.quantityAfter;
    totalStock = result.totalStockAfter;
    movementCount += 1;

    const secondaryPercent = seededInt(30, 50, baseSeed + 17);
    const secondaryQty = Math.max(1, Math.floor((initialQty * secondaryPercent) / 100));
    result = await createMovement(session, {
      tenantId,
      productId: product._id,
      warehouseId: wh2,
      type: 'IN',
      quantity: secondaryQty,
      quantityBefore: warehouseStock[wh2.toString()],
      totalStockBefore: totalStock,
      performedBy: performerFor(2),
      referenceType: 'PURCHASE',
      note: 'Secondary replenishment for east storage',
      createdAt: movementDateFromDaysAgo(70 - (productIndex % 8)),
    });
    warehouseStock[wh2.toString()] = result.quantityAfter;
    totalStock = result.totalStockAfter;
    movementCount += 1;

    const outCount = seededInt(3, 8, baseSeed + 29);
    for (let i = 0; i < outCount; i += 1) {
      const preferredWarehouse = (baseSeed + i) % 2 === 0 ? wh1 : wh2;
      const alternateWarehouse = preferredWarehouse.equals(wh1) ? wh2 : wh1;
      const preferredKey = preferredWarehouse.toString();
      const alternateKey = alternateWarehouse.toString();

      const warehouseId =
        warehouseStock[preferredKey] > 0
          ? preferredWarehouse
          : warehouseStock[alternateKey] > 0
            ? alternateWarehouse
            : null;

      if (!warehouseId) {
        continue;
      }

      const warehouseKey = warehouseId.toString();
      const available = warehouseStock[warehouseKey];
      const maxOut = Math.max(1, Math.floor(available * 0.2));
      const quantity = Math.min(available, seededInt(1, maxOut, baseSeed + 41 + i * 13));

      if (quantity <= 0) {
        continue;
      }

      const daysAgo = Math.max(2, 62 - Math.floor((i * 56) / Math.max(1, outCount - 1)) + (productIndex % 3));
      result = await createMovement(session, {
        tenantId,
        productId: product._id,
        warehouseId,
        type: 'OUT',
        quantity,
        quantityBefore: warehouseStock[warehouseKey],
        totalStockBefore: totalStock,
        performedBy: performerFor(10 + i),
        referenceType: 'SALE',
        note: 'Customer order fulfilled',
        createdAt: movementDateFromDaysAgo(daysAgo),
      });

      warehouseStock[warehouseKey] = result.quantityAfter;
      totalStock = result.totalStockAfter;
      movementCount += 1;
    }

    const adjustmentCount = seededInt(1, 2, baseSeed + 53);
    for (let i = 0; i < adjustmentCount; i += 1) {
      const warehouseId = (baseSeed + i) % 2 === 0 ? wh1 : wh2;
      const warehouseKey = warehouseId.toString();
      const magnitude = seededInt(5, 20, baseSeed + 67 + i);
      const sign = (baseSeed + i) % 2 === 0 ? 1 : -1;
      let signedQty = sign * magnitude;

      if (signedQty < 0 && warehouseStock[warehouseKey] < Math.abs(signedQty)) {
        signedQty = Math.min(warehouseStock[warehouseKey], magnitude);
      }

      if (signedQty === 0) {
        continue;
      }

      result = await createMovement(session, {
        tenantId,
        productId: product._id,
        warehouseId,
        type: 'ADJUSTMENT',
        quantity: signedQty,
        quantityBefore: warehouseStock[warehouseKey],
        totalStockBefore: totalStock,
        performedBy: performerFor(20 + i),
        referenceType: 'ADJUSTMENT',
        note: 'Cycle count audit correction',
        createdAt: movementDateFromDaysAgo(seededInt(8, 28, baseSeed + 73 + i)),
      });

      warehouseStock[warehouseKey] = result.quantityAfter;
      totalStock = result.totalStockAfter;
      movementCount += 1;
    }

    const shouldTransfer = (productIndex + tenantIndex) % 5 < 2;
    if (shouldTransfer && warehouseStock[wh1.toString()] > 0) {
      const transferPercent = seededInt(10, 30, baseSeed + 89);
      const transferQty = Math.max(1, Math.floor((warehouseStock[wh1.toString()] * transferPercent) / 100));

      if (transferQty > 0 && warehouseStock[wh1.toString()] >= transferQty) {
        const transferPairId = new mongoose.Types.ObjectId();
        const transferDate = movementDateFromDaysAgo(seededInt(6, 24, baseSeed + 97));

        result = await createMovement(session, {
          tenantId,
          productId: product._id,
          warehouseId: wh1,
          type: 'TRANSFER_OUT',
          quantity: transferQty,
          quantityBefore: warehouseStock[wh1.toString()],
          totalStockBefore: totalStock,
          performedBy: performerFor(30),
          referenceType: 'TRANSFER',
          note: 'Balancing stock between warehouses',
          createdAt: transferDate,
          transferPairId,
        });
        warehouseStock[wh1.toString()] = result.quantityAfter;
        totalStock = result.totalStockAfter;
        movementCount += 1;

        result = await createMovement(session, {
          tenantId,
          productId: product._id,
          warehouseId: wh2,
          type: 'TRANSFER_IN',
          quantity: transferQty,
          quantityBefore: warehouseStock[wh2.toString()],
          totalStockBefore: totalStock,
          performedBy: performerFor(31),
          referenceType: 'TRANSFER',
          note: 'Balancing stock between warehouses',
          createdAt: transferDate,
          transferPairId,
        });
        warehouseStock[wh2.toString()] = result.quantityAfter;
        totalStock = result.totalStockAfter;
        movementCount += 1;
      }
    }

    if (isWasteCategory(template.categoryName)) {
      const preferredWasteWarehouse = warehouseStock[wh2.toString()] > 0 ? wh2 : wh1;
      const key = preferredWasteWarehouse.toString();
      const available = warehouseStock[key];
      const wasteQty = Math.min(available, seededInt(1, 5, baseSeed + 113));

      if (wasteQty > 0) {
        result = await createMovement(session, {
          tenantId,
          productId: product._id,
          warehouseId: preferredWasteWarehouse,
          type: 'WASTE',
          quantity: wasteQty,
          quantityBefore: warehouseStock[key],
          totalStockBefore: totalStock,
          performedBy: performerFor(40),
          referenceType: 'WASTE',
          note: 'Damaged/expired units written off',
          createdAt: movementDateFromDaysAgo(seededInt(3, 14, baseSeed + 127)),
        });
        warehouseStock[key] = result.quantityAfter;
        totalStock = result.totalStockAfter;
        movementCount += 1;
      }
    }
  });

  return movementCount;
};

const seedTenant = async (def: SeedTenantDefinition, tenantIndex: number): Promise<void> => {
  let tenant = await TenantModel.findOne({ slug: def.tenant.slug });
  if (tenant) {
    console.log(`Tenant '${def.tenant.name}' already exists - skipping`);
    return;
  }

  tenant = await TenantModel.create({
    ...def.tenant,
    customFields: createTenantCustomFields(def.tenant),
  });
  console.log(`\nTenant: ${tenant.name} (${tenant.settings.currency})`);

  console.log('  Creating users...');
  const { ownerUser, performers } = await seedUsers(tenant._id, def.users);
  console.log(`    ${def.users.length} users created`);

  console.log('  Creating categories...');
  const categoryMap: Record<string, mongoose.Types.ObjectId> = {};
  let createdCategories = 0;

  for (const catDef of CATEGORY_DEFINITIONS) {
    let category = await CategoryModel.findOne({ tenantId: tenant._id, name: catDef.name });
    if (!category) {
      category = await CategoryModel.create({
        tenantId: tenant._id,
        name: catDef.name,
        description: catDef.description,
        color: catDef.color,
        createdBy: ownerUser._id,
      });
      createdCategories += 1;
    }
    categoryMap[catDef.name] = category._id as mongoose.Types.ObjectId;
  }
  console.log(`    ${createdCategories} categories created`);

  console.log('  Creating warehouses...');
  const warehouseMap: Record<string, mongoose.Types.ObjectId> = {};
  let createdWarehouses = 0;

  for (const whDef of WAREHOUSE_DEFINITIONS) {
    let warehouse = await WarehouseModel.findOne({ tenantId: tenant._id, code: whDef.code });
    if (!warehouse) {
      warehouse = await WarehouseModel.create({
        tenantId: tenant._id,
        ...whDef,
        createdBy: ownerUser._id,
      });
      createdWarehouses += 1;
    }
    warehouseMap[whDef.code] = warehouse._id as mongoose.Types.ObjectId;
  }
  console.log(`    ${createdWarehouses} warehouses created`);

  console.log('  Creating products...');
  const skuCounters: Record<string, number> = {};
  const productEntries: Array<{ product: IProduct; template: ProductTemplate; sku: string }> = [];
  const tenantCustomFields = tenant.customFields.map((field) => ({ name: field.name, type: field.type }));

  let createdProducts = 0;

  for (const template of PRODUCT_TEMPLATES) {
    skuCounters[template.skuPrefix] = (skuCounters[template.skuPrefix] ?? 0) + 1;
    const sku = `${template.skuPrefix}-${String(skuCounters[template.skuPrefix]).padStart(3, '0')}`;

    let product = await Product.findOne({ tenantId: tenant._id, sku });
    if (!product) {
      product = await Product.create({
        tenantId: tenant._id,
        sku,
        name: template.name,
        categoryId: categoryMap[template.categoryName] ?? null,
        unit: template.unit,
        costPrice: template.costPrice,
        sellingPrice: template.sellingPrice,
        lowStockThreshold: template.threshold,
        description: `${template.name} - quality product in ${template.categoryName} category`,
        tags: template.tags,
        totalStock: 0,
        isActive: true,
        customFields: buildProductCustomFields(tenantCustomFields),
        createdBy: ownerUser._id,
        updatedBy: ownerUser._id,
      });
      createdProducts += 1;
      await CategoryModel.findByIdAndUpdate(categoryMap[template.categoryName], { $inc: { productCount: 1 } });
    }

    productEntries.push({ product, template, sku });
  }
  console.log(`    ${createdProducts} products created`);

  console.log('  Creating stock movements...');
  for (let i = 0; i < productEntries.length; i += 1) {
    const entry = productEntries[i];
    const movementCount = await seedProductMovements(
      tenant._id,
      tenantIndex,
      entry.product,
      entry.template,
      i,
      warehouseMap,
      performers
    );
    console.log(`    ${entry.sku.padEnd(8)} ${entry.template.name.padEnd(30)} - ${movementCount} movements`);
  }

  console.log('  Creating stock alerts...');
  const lowStockProducts = await Product.find({
    tenantId: tenant._id,
    isActive: true,
    $expr: { $lte: ['$totalStock', '$lowStockThreshold'] },
  }).select('_id totalStock lowStockThreshold');

  let createdAlerts = 0;
  for (const product of lowStockProducts) {
    const ws = await WarehouseStockModel.findOne({
      tenantId: tenant._id,
      productId: product._id,
    }).sort({ quantity: 1 });

    if (!ws) continue;

    const existing = await StockAlertModel.findOne({
      tenantId: tenant._id,
      productId: product._id,
      status: 'PENDING',
    });
    if (existing) continue;

    await StockAlertModel.create({
      tenantId: tenant._id,
      productId: product._id,
      warehouseId: ws.warehouseId,
      currentStock: ws.quantity,
      threshold: product.lowStockThreshold,
      status: 'PENDING',
    });
    createdAlerts += 1;
  }
  console.log(`    ${createdAlerts} alerts created`);
};

const wipeFreshTenantData = async (): Promise<void> => {
  console.log('Fresh mode: wiping existing seed data...');

  const demoSlugs = TENANT_DEFINITIONS.map((d) => d.tenant.slug);
  const existingTenants = await TenantModel.find({ slug: { $in: demoSlugs } }).select('_id');
  const tenantIds = existingTenants.map((t) => t._id);

  if (tenantIds.length === 0) {
    console.log('No existing demo tenants found to wipe.');
    return;
  }

  await Promise.all([
    StockMovementModel.deleteMany({ tenantId: { $in: tenantIds } }),
    StockAlertModel.deleteMany({ tenantId: { $in: tenantIds } }),
    WarehouseStockModel.deleteMany({ tenantId: { $in: tenantIds } }),
    Product.deleteMany({ tenantId: { $in: tenantIds } }),
    CategoryModel.deleteMany({ tenantId: { $in: tenantIds } }),
    WarehouseModel.deleteMany({ tenantId: { $in: tenantIds } }),
    UserModel.deleteMany({ tenantId: { $in: tenantIds } }),
    TenantModel.deleteMany({ _id: { $in: tenantIds } }),
  ]);

  console.log('Wiped existing seed data');
};

const printSummary = async (): Promise<void> => {
  console.log('\n========================================');
  console.log('SEED COMPLETE');
  console.log('========================================');

  for (const def of TENANT_DEFINITIONS) {
    const tenant = await TenantModel.findOne({ slug: def.tenant.slug });
    if (!tenant) continue;

    const [products, movements, alerts, users] = await Promise.all([
      Product.countDocuments({ tenantId: tenant._id }),
      StockMovementModel.countDocuments({ tenantId: tenant._id }),
      StockAlertModel.countDocuments({ tenantId: tenant._id }),
      UserModel.countDocuments({ tenantId: tenant._id }),
    ]);

    console.log(`\nTenant: ${tenant.name} (${tenant.settings.currency})`);
    console.log(`  Users:     ${users}`);
    console.log(`  Products:  ${products}`);
    console.log(`  Movements: ${movements}`);
    console.log(`  Alerts:    ${alerts}`);
    console.log('\n  Login credentials:');

    for (const user of def.users) {
      console.log(`    ${user.role.padEnd(8)} ${user.email}  /  ${user.password}`);
    }
  }

  console.log('\n========================================\n');
};

const main = async (): Promise<void> => {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    throw new Error('MONGODB_URL is not set in environment');
  }

  const isFresh = process.argv.includes('--fresh');

  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');

  if (isFresh) {
    await wipeFreshTenantData();
  }

  for (let i = 0; i < TENANT_DEFINITIONS.length; i += 1) {
    await seedTenant(TENANT_DEFINITIONS[i], i);
  }

  await printSummary();
  await mongoose.disconnect();
  console.log('Disconnected. Done.');
  process.exit(0);
};

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error('Seed failed:', message);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
