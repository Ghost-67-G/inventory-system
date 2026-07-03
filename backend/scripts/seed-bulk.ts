/**
 * Bulk Seed Script — generate millions of products for performance testing.
 *
 * Usage:
 *   npm run seed:bulk                  # 1 million products (default)
 *   npm run seed:bulk -- --count 5000000  # 5 million products
 *   npm run seed:bulk -- --fresh          # wipe demo tenants first
 *   npm run seed:bulk -- --movements      # also generate 1 stock movement per product
 *
 * Strategy:
 *   - Uses insertMany with ordered:false in batches of 5000
 *   - Generates products from the template pool with randomized variants
 *   - Creates warehouse stock records in bulk
 *   - Optionally generates one initial IN movement per product
 *   - Skips Mongoose validation/hooks for speed (data is pre-normalized)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { CATEGORY_DEFINITIONS } from './data/categories';
import { PRODUCT_TEMPLATES } from './data/products';
import { TENANT_DEFINITIONS } from './data/tenants';
import { WAREHOUSE_DEFINITIONS } from './data/warehouses';
import { CategoryModel } from '../src/models/Category';
import { Product } from '../src/models/Product';
import { StockAlertModel } from '../src/models/StockAlert';
import { StockMovementModel } from '../src/models/StockMovement';
import { TenantModel } from '../src/models/Tenant';
import { UserModel } from '../src/models/User';
import { WarehouseModel } from '../src/models/Warehouse';
import { WarehouseStockModel } from '../src/models/WarehouseStock';
import bcrypt from 'bcryptjs';

dotenv.config();

// --------------- CLI args ---------------

const parseIntArg = (flag: string, fallback: number): number => {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  const val = parseInt(process.argv[idx + 1], 10);
  return Number.isFinite(val) && val > 0 ? val : fallback;
};

const TOTAL_PRODUCTS = parseIntArg('--count', 1_000_000);
const BATCH_SIZE = parseIntArg('--batch', 5_000);
const IS_FRESH = process.argv.includes('--fresh');
const WITH_MOVEMENTS = process.argv.includes('--movements');
const TENANT_INDEX = 0; // seed into the first tenant

// --------------- Helpers ---------------

const toFieldKey = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const rng = (seed: number): (() => number) => {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
};

const formatNumber = (n: number): string => n.toLocaleString('en-US');

const elapsed = (start: number): string => `${((Date.now() - start) / 1000).toFixed(1)}s`;

/** Minimal shape needed to bulk-insert; any concrete Mongoose model satisfies it. */
interface BulkInsertable {
  insertMany(
    docs: Array<Record<string, unknown>>,
    options: { ordered?: boolean; lean?: boolean },
  ): Promise<unknown>;
}

/** True for a MongoDB duplicate-key error (code 11000), single or bulk-write form. */
const isDuplicateKeyError = (err: unknown): boolean => {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: number; writeErrors?: Array<{ code?: number }> };
  // Code 11000 = duplicate key. With ordered:false, non-duplicates are still inserted.
  return e.code === 11000 || (Array.isArray(e.writeErrors) && e.writeErrors.every((w) => w.code === 11000));
};

/** insertMany with ordered:false, ignoring duplicate key errors */
const bulkInsertIgnoreDups = async (model: BulkInsertable, docs: Array<Record<string, unknown>>) => {
  try {
    await model.insertMany(docs, { ordered: false, lean: true });
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) return;
    throw err;
  }
};

// --------------- Wipe ---------------

const wipeTenantData = async (tenantId: mongoose.Types.ObjectId): Promise<void> => {
  console.log('Wiping existing data for tenant...');
  await Promise.all([
    StockMovementModel.deleteMany({ tenantId }),
    StockAlertModel.deleteMany({ tenantId }),
    WarehouseStockModel.deleteMany({ tenantId }),
    Product.deleteMany({ tenantId }),
    CategoryModel.deleteMany({ tenantId }),
    WarehouseModel.deleteMany({ tenantId }),
    UserModel.deleteMany({ tenantId }),
    TenantModel.deleteMany({ _id: tenantId }),
  ]);
  console.log('Wipe complete.');
};

// --------------- Setup tenant / categories / warehouses / users ---------------

const ensureTenant = async () => {
  const def = TENANT_DEFINITIONS[TENANT_INDEX];
  const customFields = def.tenant.customFields.map((f, i) => ({
    name: f.name,
    key: toFieldKey(f.name),
    type: f.type,
    required: f.required,
    order: i,
  }));

  if (IS_FRESH) {
    const existing = await TenantModel.findOne({ slug: def.tenant.slug });
    if (existing) await wipeTenantData(existing._id);
  }

  let tenant = await TenantModel.findOne({ slug: def.tenant.slug });
  if (!tenant) {
    tenant = await TenantModel.create({ ...def.tenant, customFields });
  }
  return tenant;
};

const ensureUsers = async (tenantId: mongoose.Types.ObjectId) => {
  const def = TENANT_DEFINITIONS[TENANT_INDEX];
  const users: mongoose.Types.ObjectId[] = [];

  for (const u of def.users) {
    let user = await UserModel.findOne({ tenantId, email: u.email.toLowerCase() });
    if (!user) {
      const hash = await bcrypt.hash(u.password, 12);
      user = await UserModel.create({
        tenantId,
        name: u.name,
        email: u.email.toLowerCase(),
        password: hash,
        role: u.role,
        isEmailVerified: true,
        isActive: true,
      });
    }
    users.push(user._id);
  }

  const owner = await UserModel.findOne({ tenantId, role: 'owner' });
  return { ownerId: owner!._id, userIds: users };
};

const ensureCategories = async (tenantId: mongoose.Types.ObjectId, ownerId: mongoose.Types.ObjectId) => {
  const map: Record<string, mongoose.Types.ObjectId> = {};
  for (const c of CATEGORY_DEFINITIONS) {
    let cat = await CategoryModel.findOne({ tenantId, name: c.name });
    if (!cat) {
      cat = await CategoryModel.create({
        tenantId,
        name: c.name,
        description: c.description,
        color: c.color,
        createdBy: ownerId,
      });
    }
    map[c.name] = cat._id as mongoose.Types.ObjectId;
  }
  return map;
};

const ensureWarehouses = async (tenantId: mongoose.Types.ObjectId, ownerId: mongoose.Types.ObjectId) => {
  const map: Record<string, mongoose.Types.ObjectId> = {};
  for (const w of WAREHOUSE_DEFINITIONS) {
    let wh = await WarehouseModel.findOne({ tenantId, code: w.code });
    if (!wh) {
      wh = await WarehouseModel.create({ tenantId, ...w, createdBy: ownerId });
    }
    map[w.code] = wh._id as mongoose.Types.ObjectId;
  }
  return map;
};

// --------------- Bulk product generation ---------------

const ADJECTIVES = [
  'Pro', 'Ultra', 'Max', 'Plus', 'Lite', 'Mini', 'Elite', 'Premium', 'Basic', 'Advanced',
  'Slim', 'Turbo', 'Eco', 'Neo', 'Mega', 'Super', 'Hyper', 'Nano', 'Flex', 'Smart',
];

const COLORS = [
  'Black', 'White', 'Silver', 'Gold', 'Blue', 'Red', 'Green', 'Gray', 'Rose', 'Navy',
];

const SIZES = [
  '16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB',
  'Small', 'Medium', 'Large', 'XL', '2XL',
];

const YEARS = ['2023', '2024', '2025', '2026'];

const generateBatch = (
  batchStart: number,
  batchCount: number,
  tenantId: mongoose.Types.ObjectId,
  categoryMap: Record<string, mongoose.Types.ObjectId>,
  ownerId: mongoose.Types.ObjectId,
  tenantCustomFields: Array<{ name: string; type: string }>,
  seed: number,
) => {
  const random = rng(seed + batchStart);
  const products: Array<Record<string, unknown>> = [];
  const templateCount = PRODUCT_TEMPLATES.length;

  for (let i = 0; i < batchCount; i++) {
    const globalIndex = batchStart + i;
    const template = PRODUCT_TEMPLATES[globalIndex % templateCount];
    const r = random();

    // Build unique variant name
    const adj = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)];
    const color = COLORS[Math.floor(random() * COLORS.length)];
    const size = SIZES[Math.floor(random() * SIZES.length)];
    const year = YEARS[Math.floor(random() * YEARS.length)];
    const variantName = `${template.name} ${adj} ${color} ${size} ${year}`;

    // Unique SKU: prefix + global index (zero-padded)
    const sku = `${template.skuPrefix}-${String(globalIndex).padStart(8, '0')}`.toUpperCase();

    // Vary prices ±20%
    const priceMul = 0.8 + r * 0.4;
    const costPrice = Math.round(template.costPrice * priceMul * 100) / 100;
    const sellingPrice = Math.round(template.sellingPrice * priceMul * 100) / 100;

    // Random initial stock 0–500
    const totalStock = Math.floor(random() * 500);

    const customFields: Record<string, unknown> = {};
    for (const f of tenantCustomFields) {
      if (f.type === 'text') customFields[f.name] = '';
      else if (f.type === 'number') customFields[f.name] = 0;
      else if (f.type === 'boolean') customFields[f.name] = false;
      else if (f.type === 'date') customFields[f.name] = null;
    }

    products.push({
      tenantId,
      sku,
      name: variantName.trim(),
      description: `${variantName} — quality product in ${template.categoryName} category`,
      categoryId: categoryMap[template.categoryName] ?? null,
      unit: template.unit,
      costPrice,
      sellingPrice,
      totalStock,
      lowStockThreshold: template.threshold,
      isActive: true,
      images: [],
      tags: [...template.tags, adj.toLowerCase(), color.toLowerCase()],
      customFields: new Map(Object.entries(customFields)),
      createdBy: ownerId,
      updatedBy: ownerId,
    });
  }

  return products;
};

const insertProducts = async (
  tenantId: mongoose.Types.ObjectId,
  categoryMap: Record<string, mongoose.Types.ObjectId>,
  ownerId: mongoose.Types.ObjectId,
  tenantCustomFields: Array<{ name: string; type: string }>,
) => {
  console.log(`\nGenerating ${formatNumber(TOTAL_PRODUCTS)} products in batches of ${formatNumber(BATCH_SIZE)}...`);
  const totalBatches = Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE);
  const start = Date.now();
  let inserted = 0;

  for (let b = 0; b < totalBatches; b++) {
    const batchStart = b * BATCH_SIZE;
    const batchCount = Math.min(BATCH_SIZE, TOTAL_PRODUCTS - batchStart);

    const docs = generateBatch(batchStart, batchCount, tenantId, categoryMap, ownerId, tenantCustomFields, 42);

    // ordered:false + lean:true for max throughput; skip validation since data is pre-normalized
    await bulkInsertIgnoreDups(Product, docs);

    inserted += batchCount;
    const pct = ((inserted / TOTAL_PRODUCTS) * 100).toFixed(1);
    const rate = Math.round(inserted / ((Date.now() - start) / 1000));
    process.stdout.write(
      `\r  Batch ${b + 1}/${totalBatches} — ${formatNumber(inserted)} products (${pct}%) — ${formatNumber(rate)}/sec`
    );
  }

  console.log(`\n  Products inserted in ${elapsed(start)}`);
  return inserted;
};

// --------------- Bulk warehouse stock ---------------

const insertWarehouseStock = async (
  tenantId: mongoose.Types.ObjectId,
  warehouseMap: Record<string, mongoose.Types.ObjectId>,
) => {
  console.log('\nCreating warehouse stock records...');
  const start = Date.now();

  const wh1 = warehouseMap['WH-001'];
  const wh2 = warehouseMap['WH-002'];

  let processed = 0;
  const cursor = Product.find({ tenantId }).select('_id totalStock lowStockThreshold').lean().cursor({ batchSize: 5000 });

  let stockBatch: Array<Record<string, unknown>> = [];

  const flushBatch = async () => {
    if (stockBatch.length === 0) return;
    await bulkInsertIgnoreDups(WarehouseStockModel, stockBatch);
    stockBatch = [];
  };

  for await (const product of cursor) {
    const total = (product as {totalStock: number}).totalStock ?? 0;
    const threshold = (product as {lowStockThreshold: number}).lowStockThreshold ?? 0;
    // Split ~60/40 between warehouses
    const wh1Qty = Math.ceil(total * 0.6);
    const wh2Qty = total - wh1Qty;

    stockBatch.push({
      tenantId,
      warehouseId: wh1,
      productId: product._id,
      quantity: wh1Qty,
      lowStockThreshold: threshold,
      reservedQuantity: 0,
      updatedAt: new Date(),
    });

    if (wh2Qty > 0) {
      stockBatch.push({
        tenantId,
        warehouseId: wh2,
        productId: product._id,
        quantity: wh2Qty,
        lowStockThreshold: threshold,
        reservedQuantity: 0,
        updatedAt: new Date(),
      });
    }

    processed++;

    if (stockBatch.length >= 10_000) {
      await flushBatch();
      if (processed % 50_000 === 0) {
        process.stdout.write(`\r  Stock records: ${formatNumber(processed)} products processed`);
      }
    }
  }

  await flushBatch();
  console.log(`\n  Warehouse stock created in ${elapsed(start)}`);
};

// --------------- Bulk movements (optional) ---------------

const insertMovements = async (
  tenantId: mongoose.Types.ObjectId,
  warehouseMap: Record<string, mongoose.Types.ObjectId>,
  userIds: mongoose.Types.ObjectId[],
) => {
  console.log('\nCreating stock movements (1 initial IN per product)...');
  const start = Date.now();
  const wh1 = warehouseMap['WH-001'];

  let processed = 0;
  let movementBatch: Array<Record<string, unknown>> = [];
  const cursor = Product.find({ tenantId }).select('_id totalStock').lean().cursor({ batchSize: 5000 });

  const flushBatch = async () => {
    if (movementBatch.length === 0) return;
    await bulkInsertIgnoreDups(StockMovementModel, movementBatch);
    movementBatch = [];
  };

  for await (const product of cursor) {
    const total = (product as {totalStock: number | string}).totalStock ?? 0;
    if (total === 0) { processed++; continue; }

    const daysAgo = 1 + (processed % 90);

    movementBatch.push({
      tenantId,
      productId: product._id,
      warehouseId: wh1,
      type: 'IN',
      quantity: total,
      quantityBefore: 0,
      quantityAfter: total,
      totalStockBefore: 0,
      totalStockAfter: total,
      referenceType: 'PURCHASE',
      referenceId: null,
      note: 'Bulk seed initial stock',
      performedBy: userIds[processed % userIds.length],
      transferPairId: null,
      createdAt: new Date(Date.now() - daysAgo * 86_400_000),
    });

    processed++;

    if (movementBatch.length >= 10_000) {
      await flushBatch();
      if (processed % 50_000 === 0) {
        process.stdout.write(`\r  Movements: ${formatNumber(processed)} products`);
      }
    }
  }

  await flushBatch();
  console.log(`\n  Movements created in ${elapsed(start)}`);
};

// --------------- Update category counts ---------------

const updateCategoryCounts = async (tenantId: mongoose.Types.ObjectId) => {
  console.log('\nUpdating category product counts...');
  const categories = await CategoryModel.find({ tenantId });
  for (const cat of categories) {
    const count = await Product.countDocuments({ tenantId, categoryId: cat._id });
    await CategoryModel.findByIdAndUpdate(cat._id, { productCount: count });
  }
  console.log('  Category counts updated.');
};

// --------------- Main ---------------

const main = async () => {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) throw new Error('MONGODB_URL is not set in environment');

  console.log('========================================');
  console.log('BULK SEED — Performance Testing');
  console.log('========================================');
  console.log(`Target:     ${formatNumber(TOTAL_PRODUCTS)} products`);
  console.log(`Batch size: ${formatNumber(BATCH_SIZE)}`);
  console.log(`Fresh:      ${IS_FRESH}`);
  console.log(`Movements:  ${WITH_MOVEMENTS}`);
  console.log('========================================\n');

  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');

  const globalStart = Date.now();

  // 1. Setup tenant, users, categories, warehouses
  const tenant = await ensureTenant();
  console.log(`Tenant: ${tenant.name}`);

  const { ownerId, userIds } = await ensureUsers(tenant._id);
  console.log(`Users: ${userIds.length}`);

  const categoryMap = await ensureCategories(tenant._id, ownerId);
  console.log(`Categories: ${Object.keys(categoryMap).length}`);

  const warehouseMap = await ensureWarehouses(tenant._id, ownerId);
  console.log(`Warehouses: ${Object.keys(warehouseMap).length}`);

  const tenantCustomFields = tenant.customFields.map((f: {name: string, type: string}) => ({ name: f.name, type: f.type }));

  // 2. Bulk insert products
  await insertProducts(tenant._id, categoryMap, ownerId, tenantCustomFields);

  // 3. Bulk insert warehouse stock
  await insertWarehouseStock(tenant._id, warehouseMap);

  // 4. Optionally insert movements
  if (WITH_MOVEMENTS) {
    await insertMovements(tenant._id, warehouseMap, userIds);
  }

  // 5. Update category counts
  await updateCategoryCounts(tenant._id);

  // 6. Summary
  const [productCount, stockCount, movementCount] = await Promise.all([
    Product.countDocuments({ tenantId: tenant._id }),
    WarehouseStockModel.countDocuments({ tenantId: tenant._id }),
    StockMovementModel.countDocuments({ tenantId: tenant._id }),
  ]);

  console.log('\n========================================');
  console.log('BULK SEED COMPLETE');
  console.log('========================================');
  console.log(`Products:         ${formatNumber(productCount)}`);
  console.log(`Stock records:    ${formatNumber(stockCount)}`);
  console.log(`Movements:        ${formatNumber(movementCount)}`);
  console.log(`Total time:       ${elapsed(globalStart)}`);
  console.log('========================================');

  const def = TENANT_DEFINITIONS[TENANT_INDEX];
  console.log('\nLogin credentials:');
  for (const u of def.users) {
    console.log(`  ${u.role.padEnd(8)} ${u.email}  /  ${u.password}`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
  process.exit(0);
};

main().catch(async (err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error('Bulk seed failed:', msg);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
