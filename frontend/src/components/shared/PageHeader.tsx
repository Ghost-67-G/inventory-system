import type { PropsWithChildren } from 'react';

interface PageHeaderProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}
