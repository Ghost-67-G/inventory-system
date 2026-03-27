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
  viewer: ['product.view', 'stock.view', 'warehouse.view', 'category.view', 'alert.view']
};

export const hasPermission = (role: Role, permission: Permission): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};

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

export interface IProduct {
  _id: string;
  tenantId: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string | null;
  category?: { _id: string; name: string; color: string } | null;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  totalStock: number;
  lowStockThreshold: number;
  isActive: boolean;
  images: string[];
  tags: string[];
  customFields: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  products: IProduct[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CreateProductDto {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  unit: string;
  costPrice?: number;
  sellingPrice?: number;
  lowStockThreshold?: number;
  images?: string[];
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export interface BulkUpdateDto {
  productIds: string[];
  updates: {
    categoryId?: string | null;
    isActive?: boolean;
    lowStockThreshold?: number;
  };
}

export interface ListProductsParams {
  cursor?: string;
  limit?: number;
  search?: string;
  categoryId?: string;
  isActive?: 'true' | 'false' | 'all';
  lowStock?: 'true';
  sortBy?: 'name' | 'sku' | 'totalStock' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  unit?: string;
}

export interface UserListResponse {
  users: SafeUser[];
  total: number;
  page: number;
  totalPages: number;
}

export interface InviteUserDto {
  name: string;
  email: string;
  role: 'manager' | 'staff' | 'viewer';
}

export interface UpdateUserDto {
  name?: string;
  role?: 'manager' | 'staff' | 'viewer';
}

// ─── Tenant Settings ──────────────────────────────────────────────────────────

export type CustomFieldType = 'text' | 'number' | 'boolean' | 'date';

export interface ICustomField {
  _id: string;
  name: string;
  key: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue?: string;
  order: number;
}

export interface TenantSettings {
  currency: string;
  timezone: string;
  lowStockThreshold: number;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  measurementUnit: 'metric' | 'imperial';
}

export interface Tenant {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  settings: TenantSettings;
  customFields: ICustomField[];
  onboardingComplete: boolean;
}

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'PKR', label: 'Pakistani Rupee' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'AED', label: 'UAE Dirham' },
  { code: 'SAR', label: 'Saudi Riyal' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'MXN', label: 'Mexican Peso' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'ZAR', label: 'South African Rand' },
  { code: 'EGP', label: 'Egyptian Pound' },
  { code: 'NGN', label: 'Nigerian Naira' },
  { code: 'KWD', label: 'Kuwaiti Dinar' },
  { code: 'QAR', label: 'Qatari Riyal' },
  { code: 'BDT', label: 'Bangladeshi Taka' },
  { code: 'THB', label: 'Thai Baht' },
  { code: 'MYR', label: 'Malaysian Ringgit' },
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

// ─── Settings DTOs ────────────────────────────────────────────────────────────

export interface UpdateGeneralSettingsDto {
  name?: string;
  settings?: Partial<TenantSettings>;
}

export interface AddCustomFieldDto {
  name: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue?: string;
}

export interface UpdateCustomFieldDto {
  name?: string;
  required?: boolean;
  defaultValue?: string;
  order?: number;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface ICategory {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  color: string;
  productCount: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDropdownItem {
  _id: string;
  name: string;
  color: string;
}

export interface CategoryListResponse {
  categories: ICategory[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

// ─── Warehouses ───────────────────────────────────────────────────────────────

export interface IWarehouse {
  _id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  isActive: boolean;
  isDefault: boolean;
  stockSummary: {
    totalProducts: number;
    totalUnits: number;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseStockItem {
  product: {
    _id: string;
    name: string;
    sku: string;
    unit: string;
    lowStockThreshold: number;
    categoryId: string | null;
  };
  quantity: number;
  reservedQuantity: number;
}

export interface WarehouseStockResponse {
  stock: WarehouseStockItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface WarehouseSummary {
  total: number;
  active: number;
  totalProducts: number;
  totalUnits: number;
}

export interface CreateWarehouseDto {
  name: string;
  code?: string;
  description?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  isDefault?: boolean;
}

export interface UpdateWarehouseDto extends Partial<CreateWarehouseDto> {
  isActive?: boolean;
}

export interface WarehouseStockParams {
  search?: string;
  lowStock?: 'true' | 'false';
  cursor?: string;
  limit?: number;
}

