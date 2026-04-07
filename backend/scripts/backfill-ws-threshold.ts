/**
 * One-time migration: backfill lowStockThreshold from Products onto WarehouseStocks.
 *
 * Usage:
 *   npx tsx scripts/backfill-ws-threshold.ts
 *
 * Safe to run multiple times (idempotent).
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product';
import { WarehouseStockModel } from '../src/models/WarehouseStock';

dotenv.config();

const BATCH_SIZE = 500;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Stream products that have a threshold > 0
  const cursor = Product.find(
    { lowStockThreshold: { $gt: 0 } },
    { _id: 1, tenantId: 1, lowStockThreshold: 1 }
  ).lean().cursor();

  let updated = 0;
  let bulkOps: Array<{ updateMany: { filter: Record<string, unknown>; update: Record<string, unknown> } }> = [];

  for await (const product of cursor) {
    bulkOps.push({
      updateMany: {
        filter: { productId: product._id, tenantId: product.tenantId },
        update: { $set: { lowStockThreshold: product.lowStockThreshold } }
      }
    });

    if (bulkOps.length >= BATCH_SIZE) {
      const result = await WarehouseStockModel.bulkWrite(bulkOps as never[], { ordered: false });
      updated += result.modifiedCount;
      console.log(`Backfilled ${updated} warehouse stock rows...`);
      bulkOps = [];
    }
  }

  // Flush remaining
  if (bulkOps.length > 0) {
    const result = await WarehouseStockModel.bulkWrite(bulkOps as never[], { ordered: false });
    updated += result.modifiedCount;
  }

  console.log(`Done. Updated ${updated} WarehouseStock records.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
