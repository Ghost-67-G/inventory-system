import type { ReactNode } from 'react';

interface WarehouseBadgeProps {
  code: string;
  name: string;
  isDefault?: boolean;
  size?: 'sm' | 'md';
}

export function WarehouseBadge({ code, name, isDefault, size = 'md' }: WarehouseBadgeProps) {
  const codeSizeClass = size === 'sm' ? 'text-xs' : 'text-sm';
  const nameSizeClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-2">
      <span className={`font-mono rounded-full bg-muted px-2 py-1 ${codeSizeClass} font-semibold text-foreground`}>
        {code}
      </span>
      <span className={`${nameSizeClass} text-muted-foreground`}>
        {isDefault && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500 dark:bg-green-400" />}
        {name}
      </span>
    </div>
  );
}
