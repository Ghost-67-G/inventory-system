import type { PropsWithChildren, ReactNode } from 'react';
import type { Permission } from '@/types';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGuardProps extends PropsWithChildren {
  permission: Permission;
  fallback?: ReactNode;
}

export const PermissionGuard = ({
  permission,
  fallback = <div className="rounded border bg-white p-3 text-sm">You do not have permission.</div>,
  children
}: PermissionGuardProps) => {
  const { canDo } = usePermission();
  if (!canDo(permission)) {
    return fallback;
  }
  return <>{children}</>;
};
