import { useTenantStore } from '@/store/tenantStore';

export function AccountTab() {
  const tenant = useTenantStore((s) => s.tenant);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground">Account</h3>
      <p className="mt-1 text-sm text-muted-foreground">Workspace profile details.</p>

      <div className="mt-4 grid gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tenant Name</p>
          <p className="text-sm text-foreground">{tenant?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Slug</p>
          <p className="font-mono text-sm text-foreground">{tenant?.slug ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
