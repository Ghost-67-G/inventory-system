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
      <span className={`font-mono rounded-full bg-gray-100 px-2 py-1 ${codeSizeClass} font-semibold`}>
        {code}
      </span>
      <span className={`${nameSizeClass} text-gray-700`}>
        {isDefault && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />}
        {name}
      </span>
    </div>
  );
}
