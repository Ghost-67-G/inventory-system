import { useTenantStore } from '@/store/tenantStore';

export const useTenant = () => {
  return useTenantStore();
};
