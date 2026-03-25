import { hasPermission } from '@/lib/permissions';
import type { Permission } from '@/types';
import { useAuthStore } from '@/store/authStore';

export const usePermission = () => {
  const role = useAuthStore((s) => s.user?.role);

  const canDo = (permission: Permission): boolean => {
    return hasPermission(role, permission);
  };

  const canDoAny = (...permissions: Permission[]): boolean => {
    return permissions.some((permission) => hasPermission(role, permission));
  };

  return { canDo, canDoAny, role };
};
