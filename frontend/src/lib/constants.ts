import type { Permission, Role } from '../types';

export const PERMISSIONS: Record<Permission, Role[]> = {
  'product.view': ['owner', 'manager', 'staff', 'viewer'],
  'product.create': ['owner', 'manager'],
  'product.update': ['owner', 'manager'],
  'product.delete': ['owner'],
  'stock.view': ['owner', 'manager', 'staff', 'viewer'],
  'stock.adjust': ['owner', 'manager', 'staff'],
  'stock.transfer': ['owner', 'manager', 'staff'],
  'warehouse.view': ['owner', 'manager', 'staff', 'viewer'],
  'warehouse.manage': ['owner', 'manager'],
  'alert.view': ['owner', 'manager', 'staff'],
  'alert.acknowledge': ['owner', 'manager', 'staff'],
  'report.view': ['owner', 'manager'],
  'user.view': ['owner'],
  'user.manage': ['owner'],
  'settings.view': ['owner', 'manager'],
  'settings.manage': ['owner']
};
