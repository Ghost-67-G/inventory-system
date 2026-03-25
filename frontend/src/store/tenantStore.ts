import { create } from 'zustand';

interface TenantState {
  tenantId: string | null;
  settings: Record<string, unknown>;
  customFields: Array<{ name: string; type: string; required: boolean }>;
  setTenant: (tenantId: string, settings: Record<string, unknown>, customFields: Array<{ name: string; type: string; required: boolean }>) => void;
  clear: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  tenantId: null,
  settings: {},
  customFields: [],
  setTenant: (tenantId, settings, customFields) => set({ tenantId, settings, customFields }),
  clear: () => set({ tenantId: null, settings: {}, customFields: [] })
}));
