import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { TENANT_DEFINITIONS } from './data/tenants';
import { Product } from '../src/models/Product';
import { TenantModel } from '../src/models/Tenant';
import { WarehouseModel } from '../src/models/Warehouse';
import { WarehouseStockModel } from '../src/models/WarehouseStock';

dotenv.config();

interface Failure {
  tenant: string;
  message: string;
}

const validateTenant = async (tenantId: mongoose.Types.ObjectId, tenantName: string): Promise<Failure[]> => {
  const failures: Failure[] = [];

  const productCount = await Product.countDocuments({ tenantId });
  if (productCount !== 60) {
    failures.push({ tenant: tenantName, message: `Expected 60 products, found ${productCount}` });
  }

  const products = await Product.find({ tenantId }).select('_id name sku totalStock').lean();

  for (const product of products) {
    const wsSum = await WarehouseStockModel.aggregate<{ _id: null; total: number }>([
      { $match: { tenantId, productId: product._id } },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);

    const total = wsSum[0]?.total ?? 0;
    if (total !== product.totalStock) {
      failures.push({
        tenant: tenantName,
        message: `Stock mismatch for ${product.sku}: product.totalStock=${product.totalStock}, warehouseSum=${total}`,
      });
    }
  }

  const negativeWarehouseStocks = await WarehouseStockModel.countDocuments({ tenantId, quantity: { $lt: 0 } });
  if (negativeWarehouseStocks > 0) {
    failures.push({ tenant: tenantName, message: `Found ${negativeWarehouseStocks} warehouse stock rows with negative quantity` });
  }

  const defaultWarehouseCount = await WarehouseModel.countDocuments({ tenantId, isDefault: true });
  if (defaultWarehouseCount !== 1) {
    failures.push({
      tenant: tenantName,
      message: `Expected exactly one default warehouse, found ${defaultWarehouseCount}`,
    });
  }

  return failures;
};

const main = async (): Promise<void> => {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    throw new Error('MONGODB_URL is not set in environment');
  }

  await mongoose.connect(mongoUrl);

  const failures: Failure[] = [];

  for (const def of TENANT_DEFINITIONS) {
    const tenant = await TenantModel.findOne({ slug: def.tenant.slug }).select('_id name').lean();
    if (!tenant) {
      failures.push({ tenant: def.tenant.name, message: 'Tenant not found' });
      continue;
    }

    const tenantFailures = await validateTenant(tenant._id, tenant.name);
    failures.push(...tenantFailures);
  }

  if (failures.length === 0) {
    console.log('All checks passed');
  } else {
    console.log('Validation failures:');
    for (const failure of failures) {
      console.log(`- [${failure.tenant}] ${failure.message}`);
    }
    process.exitCode = 1;
  }

  await mongoose.disconnect();
};

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error('Validation failed:', message);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
