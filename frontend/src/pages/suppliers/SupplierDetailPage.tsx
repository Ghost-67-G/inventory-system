import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SupplierFormDrawer } from '@/components/suppliers/SupplierFormDrawer';
import { SupplierProductModal } from '@/components/suppliers/SupplierProductModal';
import { useSupplier, useSupplierProducts, useUnlinkProduct, useDeactivateSupplier } from '@/hooks/useSuppliers';
import { useTenantFormatting } from '@/hooks/useTenantFormatting';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import type { ISupplierProduct } from '@/types';

/** `productId` is typed as a string but may arrive populated from the API. */
function getLinkProductId(link: ISupplierProduct): string {
  const productId = link.productId as unknown;
  if (typeof productId === 'string') return productId;
  if (productId && typeof productId === 'object' && '_id' in productId) {
    return String((productId as { _id: unknown })._id);
  }
  return '';
}

export function SupplierDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { formatMoney, formatDate } = useTenantFormatting();
  const supplierQuery = useSupplier(id);
  const unlinkMutation = useUnlinkProduct();
  const deactivateMutation = useDeactivateSupplier();

  const [editOpen, setEditOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ISupplierProduct | undefined>();

  const supplier = supplierQuery.data?.supplier;
  const supplierProductsQuery = useSupplierProducts(id);
  const links = useMemo(() => (supplierProductsQuery.data ?? []) as ISupplierProduct[], [supplierProductsQuery.data]);

  if (supplierQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading supplier...</div>;
  }

  if (!supplier) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/suppliers')}
        >
          <ArrowLeft className="h-4 w-4" />
          Suppliers
        </button>
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Supplier not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => navigate('/suppliers')}
      >
        <ArrowLeft className="h-4 w-4" />
        Suppliers
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-semibold text-foreground">{supplier.name}</h1>
                <span className="mt-2 inline-flex rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">{supplier.code}</span>
              </div>
              <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs ${supplier.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                {supplier.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Contact</p>
                <p className="text-sm">{supplier.contactName || '-'}</p>
                <p className="text-sm">{supplier.email || '-'}</p>
                <p className="text-sm">{supplier.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Commercial terms</p>
                <p className="text-sm">{supplier.paymentTerms}</p>
                <p className="text-sm">Lead time: {supplier.leadTimeDays} days</p>
                <p className="text-sm">Currency: {supplier.currency}</p>
              </div>
            </div>

            {supplier.notes ? (
              <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{supplier.notes}</div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <PermissionGuard permission="supplier.manage">
                <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
              </PermissionGuard>
              {supplier.isActive ? (
                <PermissionGuard permission="supplier.manage">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deactivateMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Deactivate supplier "${supplier.name}"?`)) {
                        void deactivateMutation.mutateAsync(supplier._id).catch(() => undefined);
                      }
                    }}
                  >
                    {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate'}
                  </Button>
                </PermissionGuard>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">Products from this supplier</h3>
              <PermissionGuard permission="supplier.manage">
                <Button type="button" variant="outline" onClick={() => { setEditingLink(undefined); setProductModalOpen(true); }}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Link product
                </Button>
              </PermissionGuard>
            </div>

            <div className="space-y-2">
              {links.length === 0 ? <p className="text-sm text-muted-foreground">No linked products</p> : null}
              {links.map((link) => (
                <div key={link._id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{link.supplierSku || 'No supplier SKU'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(link.unitCost)} | MOQ {link.minimumOrderQty}
                      {link.isPreferred ? ' | Preferred' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <PermissionGuard permission="supplier.manage">
                      <button type="button" className="text-xs text-blue-600 hover:underline dark:text-blue-400" onClick={() => { setEditingLink(link); setProductModalOpen(true); }}>
                        Edit
                      </button>
                    </PermissionGuard>
                    <PermissionGuard permission="supplier.manage">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                        disabled={unlinkMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Unlink this product from the supplier?')) {
                            void unlinkMutation
                              .mutateAsync({ supplierId: supplier._id, productId: getLinkProductId(link) })
                              .catch(() => undefined);
                          }
                        }}
                      >
                        Unlink
                      </button>
                    </PermissionGuard>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total orders</p>
            <p className="text-xl font-semibold">{supplier.totalOrders}</p>
            <p className="mt-2 text-xs text-muted-foreground">Total order value</p>
            <p className="text-lg font-semibold">{formatMoney(supplier.totalOrderValue)}</p>
            <p className="mt-2 text-xs text-muted-foreground">On-time delivery</p>
            <p className="text-lg font-semibold">{(supplier.onTimeDeliveryRate ?? 0).toFixed(1)}%</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-2 text-sm font-semibold">Recent purchase orders</h4>
            <div className="space-y-2">
              {(supplierQuery.data?.recentPOs ?? []).map((po: any) => (
                <div key={po._id} className="rounded border border-border p-2 text-sm">
                  <p className="font-medium">{po.poNumber}</p>
                  <p className="text-xs text-muted-foreground">{po.status} | {formatDate(po.createdAt)}</p>
                </div>
              ))}
              <button type="button" className="text-xs text-blue-600 hover:underline dark:text-blue-400" onClick={() => navigate(`/purchase-orders?supplierId=${supplier._id}`)}>
                View all
              </button>
            </div>
          </div>
        </div>
      </div>

      <SupplierFormDrawer open={editOpen} onClose={() => setEditOpen(false)} supplier={supplier} />
      <SupplierProductModal open={productModalOpen} onClose={() => setProductModalOpen(false)} supplier={supplier} link={editingLink} />
    </div>
  );
}
