// infra/mongo-init.js
// Runs once on first boot of the shared Mongo container.
// Seeds the inventory app DB user. Other projects should seed their own
// users via a one-off `docker exec mongodb mongosh` admin script after
// the shared instance is up.

const appUser = process.env.MONGO_APP_USERNAME || 'inventory_app';
const appPass = process.env.MONGO_APP_PASSWORD;

if (!appPass) {
  throw new Error('MONGO_APP_PASSWORD must be set for mongo-init.js');
}

db = db.getSiblingDB('inventory');

db.createUser({
  user: appUser,
  pwd: appPass,
  roles: [
    { role: 'readWrite', db: 'inventory' },
    { role: 'dbAdmin', db: 'inventory' }
  ]
});

db.users.createIndex({ tenantId: 1, email: 1 }, { unique: true });
db.products.createIndex({ tenantId: 1, sku: 1 }, { unique: true });
db.warehouses.createIndex({ tenantId: 1, code: 1 }, { unique: true });

print('MongoDB initialized for inventory app');
