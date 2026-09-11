import type { LucideIcon } from 'lucide-react';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import type { Permission } from '@/types';

interface FloatingActionButtonProps {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  permission?: Permission;
}

export function FloatingActionButton({ onClick, icon: Icon, label, permission }: FloatingActionButtonProps) {
  const content = (
    <div className="fixed bottom-6 right-6 z-40 md:hidden">
      <button
        type="button"
        onClick={onClick}
        className="grid h-14 w-14 min-h-14 min-w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        aria-label={label}
        title={label}
      >
        <Icon className="h-5 w-5" />
      </button>
    </div>
  );

  if (!permission) {
    return content;
  }

  return <PermissionGuard permission={permission}>{content}</PermissionGuard>;
}
