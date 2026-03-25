export type Role = 'owner' | 'manager' | 'staff' | 'viewer';

export type Permission =
  | 'product.view'
  | 'product.create'
  | 'product.update'
  | 'product.delete'
  | 'stock.view'
  | 'stock.adjust'
  | 'stock.transfer'
  | 'warehouse.view'
  | 'warehouse.manage'
  | 'alert.view'
  | 'alert.acknowledge'
  | 'report.view'
  | 'user.view'
  | 'user.manage'
  | 'settings.view'
  | 'settings.manage';

export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  isEmailVerified: boolean;
}

export interface Product {
  _id: string;
  tenantId: string;
  sku: string;
  name: string;
  totalStock: number;
  sellingPrice: number;
}
