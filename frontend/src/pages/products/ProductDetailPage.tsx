import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CategoryBadge from '@/components/shared/CategoryBadge';
import StockBadge from '@/components/shared/StockBadge';
import ProductFormDrawer from '@/components/products/ProductFormDrawer';
import ConfirmDeleteProductDialog from '@/components/products/ConfirmDeleteProductDialog';
import { useProduct } from '@/hooks/useProducts';
import { useTenantFormatting } from '@/hooks/useTenantFormatting';
import { useTenantStore } from '@/store/tenantStore';
import { usePermission } from '@/hooks/usePermission';
import { PermissionGuard } from '@/router/guards/PermissionGuard';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatMoney, formatDate } = useTenantFormatting();
  const { canDo } = usePermission();
  const tenant = useTenantStore((s) => s.tenant);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: product, isLoading } = useProduct(id ?? '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Product not found</div>
      </div>
    );
  }

  const profitMargin =
    product.sellingPrice > 0
      ? (((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100).toFixed(1)
      : null;

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/products')}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Products
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — main info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center rounded bg-gray-100 px-2.5 py-0.5 font-mono text-xs text-gray-600">
                    {product.sku}
                  </span>
                  {product.category ? (
                    <CategoryBadge name={product.category.name} color={product.category.color} />
                  ) : null}
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <PermissionGuard permission="product.update">
                  <Button onClick={() => setDrawerOpen(true)} size="sm" variant="outline">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </PermissionGuard>
                <PermissionGuard permission="product.delete">
                  <Button
                    onClick={() => setDeleteDialogOpen(true)}
                    size="sm"
                    variant="destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </PermissionGuard>
              </div>
            </div>

            {product.description && (
              <p className="mt-4 text-sm text-gray-600">{product.description}</p>
            )}

            {product.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-blue-50 px-3 py-0.5 text-xs text-blue-600">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Pricing</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500">Cost Price</div>
                <div className="text-lg font-semibold">{formatMoney(product.costPrice)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Selling Price</div>
                <div className="text-lg font-semibold">{formatMoney(product.sellingPrice)}</div>
              </div>
              {profitMargin !== null && (
                <div>
                  <div className="text-xs text-gray-500">Margin</div>
                  <div
                    className={`text-lg font-semibold ${
                      Number(profitMargin) > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {profitMargin}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Custom fields */}
          {tenant?.customFields && tenant.customFields.length > 0 && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Custom Fields</h3>
              <dl className="grid grid-cols-2 gap-4">
                {tenant.customFields.map((field) => {
                  const value = product.customFields?.[field.key];
                  return (
                    <div key={field._id}>
                      <dt className="text-xs text-gray-500">{field.name}</dt>
                      <dd className="text-sm text-gray-900">{value !== undefined && value !== null ? String(value) : '—'}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}

          {/* Images */}
          {product.images.length > 0 && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Images</h3>
              <div className="flex gap-3 overflow-x-auto">
                {product.images.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`${product.name} ${idx + 1}`}
                    className="h-24 w-24 rounded-lg object-cover border shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — stock + meta */}
        <div className="space-y-6">
          {/* Stock card */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Stock</h3>
            <div className="space-y-3">
              <div>
                <StockBadge
                  stock={product.totalStock}
                  threshold={product.lowStockThreshold}
                  unit={product.unit}
                />
              </div>
              <div className="text-xs text-gray-500">
                Alert at {product.lowStockThreshold} {product.unit}
              </div>
            </div>
          </div>

          {/* Meta card */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Unit</dt>
                <dd className="text-sm text-gray-900">{product.unit}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900">{formatDate(product.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Last updated</dt>
                <dd className="text-sm text-gray-900">{formatDate(product.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <ProductFormDrawer
        mode="edit"
        product={product}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <ConfirmDeleteProductDialog
        product={product}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={() => navigate('/products')}
      />
    </div>
  );
}
