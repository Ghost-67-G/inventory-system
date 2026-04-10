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

  if (!supplier) {
    return <div className="text-sm text-muted-foreground">Loading supplier...</div>;
  }

  return (
    <div className="space-y-6">
      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate('/suppliers')}>
        <ArrowLeft className="h-4 w-4" />
        Suppliers
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold">{supplier.name}</h1>
                <span className="mt-2 inline-flex rounded bg-muted px-2 py-0.5 font-mono text-xs">{supplier.code}</span>
              </div>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${supplier.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
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

            <div className="mt-4 flex gap-2">
              <PermissionGuard permission="supplier.manage">
                <Button variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
              </PermissionGuard>
              <PermissionGuard permission="supplier.manage">
                <Button variant="destructive" onClick={() => void deactivateMutation.mutateAsync(supplier._id)}>
                  Deactivate
                </Button>
              </PermissionGuard>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Products from this supplier</h3>
              <PermissionGuard permission="supplier.manage">
                <Button variant="outline" onClick={() => { setEditingLink(undefined); setProductModalOpen(true); }}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Link product
                </Button>
              </PermissionGuard>
            </div>

            <div className="space-y-2">
              {links.length === 0 ? <p className="text-sm text-muted-foreground">No linked products</p> : null}
              {links.map((link) => (
                <div key={link._id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{link.supplierSku || 'No supplier SKU'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(link.unitCost)} | MOQ {link.minimumOrderQty}
                      {link.isPreferred ? ' | Preferred' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <PermissionGuard permission="supplier.manage">
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => { setEditingLink(link); setProductModalOpen(true); }}>
                        Edit
                      </button>
                    </PermissionGuard>
                    <PermissionGuard permission="supplier.manage">
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => void unlinkMutation.mutateAsync({ supplierId: supplier._id, productId: String(link.productId) })}
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
            <p className="text-lg font-semibold">{supplier.onTimeDeliveryRate.toFixed(1)}%</p>
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
              <button className="text-xs text-blue-600 hover:underline" onClick={() => navigate(`/purchase-orders?supplierId=${supplier._id}`)}>
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
