import type { ComponentType, ReactNode } from 'react';
import type { Permission } from '@/types';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGuardProps {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({ permission, fallback = null, children }: PermissionGuardProps) {
  const { canDo } = usePermission();

  if (!canDo(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function withPermission<P extends object>(Component: ComponentType<P>, permission: Permission) {
  return function PermissionWrappedComponent(props: P) {
    return (
      <PermissionGuard permission={permission}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}
