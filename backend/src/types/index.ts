export type DeploymentMode = 'saas' | 'self_hosted';

export const ROLES = ['owner', 'manager', 'staff', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'product.view',
  'product.create',
  'product.update',
  'product.delete',
  'stock.view',
  'stock.adjust',
  'stock.transfer',
  'warehouse.view',
  'warehouse.manage',
  'category.view',
  'category.manage',
  'alert.view',
  'alert.acknowledge',
  'report.view',
  'report.export',
  'user.view',
  'user.invite',
  'user.update',
  'user.deactivate',
  'settings.view',
  'settings.manage',
  'audit.view'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'product.view',
    'product.create',
    'product.update',
    'product.delete',
    'stock.view',
    'stock.adjust',
    'stock.transfer',
    'warehouse.view',
    'warehouse.manage',
    'category.view',
    'category.manage',
    'alert.view',
    'alert.acknowledge',
    'report.view',
    'report.export',
    'user.view',
    'user.invite',
    'user.update',
    'user.deactivate',
    'settings.view',
    'settings.manage',
    'audit.view'
  ],
  manager: [
    'product.view',
    'product.create',
    'product.update',
    'stock.view',
    'stock.adjust',
    'stock.transfer',
    'warehouse.view',
    'warehouse.manage',
    'category.view',
    'category.manage',
    'alert.view',
    'alert.acknowledge',
    'report.view',
    'report.export',
    'user.view',
    'settings.view'
  ],
  staff: [
    'product.view',
    'stock.view',
    'stock.adjust',
    'stock.transfer',
    'warehouse.view',
    'category.view',
    'alert.view',
    'alert.acknowledge'
  ],
  viewer: [
    'product.view',
    'stock.view',
    'warehouse.view',
    'category.view',
    'alert.view'
  ]
};

export const hasPermission = (role: Role, permission: Permission): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};
