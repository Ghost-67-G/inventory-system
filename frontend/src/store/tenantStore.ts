import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ICustomField, Tenant } from '../types/index.js';

interface TenantState {
  tenant: Tenant | null;
  onboardingComplete: boolean;

  setTenant: (tenant: Tenant) => void;
  setOnboardingComplete: (value: boolean) => void;
  updateSettings: (settings: Partial<Tenant['settings']>) => void;
  updateCustomFields: (fields: ICustomField[]) => void;
  addCustomField: (field: ICustomField) => void;
  updateCustomField: (fieldId: string, updates: Partial<ICustomField>) => void;
  removeCustomField: (fieldId: string) => void;
  clearTenant: () => void;

  getCustomField: (key: string) => ICustomField | undefined;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      tenant: null,
      onboardingComplete: false,

      setTenant: (tenant) => set({ tenant, onboardingComplete: tenant.onboardingComplete }),

      setOnboardingComplete: (value) =>
        set((state) => ({
          onboardingComplete: value,
          tenant: state.tenant ? { ...state.tenant, onboardingComplete: value } : state.tenant
        })),

      updateSettings: (settings) =>
        set((state) => {
          if (!state.tenant) return state;
          return { tenant: { ...state.tenant, settings: { ...state.tenant.settings, ...settings } } };
        }),

      updateCustomFields: (fields) =>
        set((state) => {
          if (!state.tenant) return state;
          return { tenant: { ...state.tenant, customFields: fields } };
        }),

      addCustomField: (field) =>
        set((state) => {
          if (!state.tenant) return state;
          return { tenant: { ...state.tenant, customFields: [...state.tenant.customFields, field] } };
        }),

      updateCustomField: (fieldId, updates) =>
        set((state) => {
          if (!state.tenant) return state;
          return {
            tenant: {
              ...state.tenant,
              customFields: state.tenant.customFields.map((f) =>
                f._id === fieldId ? { ...f, ...updates } : f
              ),
            },
          };
        }),

      removeCustomField: (fieldId) =>
        set((state) => {
          if (!state.tenant) return state;
          return {
            tenant: {
              ...state.tenant,
              customFields: state.tenant.customFields.filter((f) => f._id !== fieldId),
            },
          };
        }),

      clearTenant: () => set({ tenant: null, onboardingComplete: false }),

      getCustomField: (key) => {
        return get().tenant?.customFields.find((f) => f.key === key);
      },
    }),
    {
      name: 'tenant-storage',
      partialize: (state) => ({ tenant: state.tenant, onboardingComplete: state.onboardingComplete }),
    }
  )
);
