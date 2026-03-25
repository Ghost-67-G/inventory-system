import { ROLE_PERMISSIONS, type Permission, type Role } from '@/types';

export const hasPermission = (role: Role | undefined, permission: Permission): boolean => {
  if (!role) {
    return false;
  }

  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};
