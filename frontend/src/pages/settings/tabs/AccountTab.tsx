import { useTenantStore } from '@/store/tenantStore';

export function AccountTab() {
  const tenant = useTenantStore((s) => s.tenant);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">Account</h3>
      <p className="mt-1 text-sm text-slate-500">Workspace profile details.</p>

      <div className="mt-4 grid gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tenant Name</p>
          <p className="text-sm text-slate-900">{tenant?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Slug</p>
          <p className="font-mono text-sm text-slate-900">{tenant?.slug ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
