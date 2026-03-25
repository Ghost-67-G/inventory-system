import { PERMISSIONS } from '../lib/constants';
import type { Permission } from '../types';
import { useAuthStore } from '../store/authStore';

export const usePermission = () => {
  const role = useAuthStore((s) => s.user?.role);

  const canDo = (permission: Permission): boolean => {
    if (!role) {
      return false;
    }

    return PERMISSIONS[permission].includes(role);
  };

  return { canDo };
};
