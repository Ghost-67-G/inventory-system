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

/** Safe user object returned from API — no secrets */
export interface SafeUser {
  _id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Keep backwards-compatible alias used elsewhere */
export type AuthUser = SafeUser;

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  tenantName?: string;
  name: string;
  email: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface LoginResponse {
  success: true;
  data: {
    accessToken: string;
    user: SafeUser;
  };
}

export interface RefreshResponse {
  success: true;
  data: {
    accessToken: string;
  };
}

export interface Product {
  _id: string;
  tenantId: string;
  sku: string;
  name: string;
  totalStock: number;
  sellingPrice: number;
}

