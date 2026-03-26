import client from '@/api/client';
import type {
  AddCustomFieldDto,
  ICustomField,
  Tenant,
  UpdateCustomFieldDto,
  UpdateGeneralSettingsDto,
} from '@/types';

export const settingsApi = {
  get: () =>
    client.get<{ data: { tenant: Tenant } }>('/settings'),

  updateGeneral: (data: UpdateGeneralSettingsDto) =>
    client.patch<{ data: { tenant: Tenant } }>('/settings', data),

  addCustomField: (data: AddCustomFieldDto) =>
    client.post<{ data: { field: ICustomField } }>('/settings/custom-fields', data),

  updateCustomField: (fieldId: string, data: UpdateCustomFieldDto) =>
    client.patch<{ data: { field: ICustomField } }>(`/settings/custom-fields/${fieldId}`, data),

  deleteCustomField: (fieldId: string) =>
    client.delete(`/settings/custom-fields/${fieldId}`),

  reorderCustomFields: (fields: Array<{ fieldId: string; order: number }>) =>
    client.put<{ data: { fields: ICustomField[] } }>('/settings/custom-fields/reorder', { fields }),

  completeOnboarding: () =>
    client.post('/settings/onboarding/complete'),
};
