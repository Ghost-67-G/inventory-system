import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { settingsApi } from '@/api/endpoints/settings';
import { useTenantStore } from '@/store/tenantStore';
import type { AddCustomFieldDto, Tenant, UpdateCustomFieldDto, UpdateGeneralSettingsDto } from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}

export function useSettings() {
  const setTenant = useTenantStore((s) => s.setTenant);

  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await settingsApi.get();
      const payload = res.data as ApiEnvelope<{ tenant: Tenant }>;
      setTenant(payload.data.tenant);
      return payload.data.tenant;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateGeneralSettings() {
  const queryClient = useQueryClient();
  const updateSettings = useTenantStore((s) => s.updateSettings);

  return useMutation({
    mutationFn: (data: UpdateGeneralSettingsDto) => settingsApi.updateGeneral(data),
    onSuccess: (res) => {
      const payload = res.data as ApiEnvelope<{ tenant: Tenant }>;
      updateSettings(payload.data.tenant.settings);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to save settings'));
    },
  });
}

export function useAddCustomField() {
  const queryClient = useQueryClient();
  const addCustomField = useTenantStore((s) => s.addCustomField);

  return useMutation({
    mutationFn: (data: AddCustomFieldDto) => settingsApi.addCustomField(data),
    onSuccess: (res) => {
      const payload = res.data as ApiEnvelope<{ field: import('@/types').ICustomField }>;
      addCustomField(payload.data.field);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success(`Field '${payload.data.field.name}' added`);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to add custom field'));
    },
  });
}

export function useUpdateCustomField() {
  const queryClient = useQueryClient();
  const updateCustomField = useTenantStore((s) => s.updateCustomField);

  return useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: UpdateCustomFieldDto }) =>
      settingsApi.updateCustomField(fieldId, data),
    onSuccess: (res, variables) => {
      const payload = res.data as ApiEnvelope<{ field: import('@/types').ICustomField }>;
      updateCustomField(variables.fieldId, payload.data.field);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Field updated');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to update custom field'));
    },
  });
}

export function useDeleteCustomField() {
  const queryClient = useQueryClient();
  const removeCustomField = useTenantStore((s) => s.removeCustomField);

  return useMutation({
    mutationFn: (fieldId: string) => settingsApi.deleteCustomField(fieldId),
    onSuccess: (_res, fieldId) => {
      removeCustomField(fieldId);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Field deleted');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to delete custom field'));
    },
  });
}

export function useReorderCustomFields() {
  const queryClient = useQueryClient();
  const updateCustomFields = useTenantStore((s) => s.updateCustomFields);

  return useMutation({
    mutationFn: (fields: Array<{ fieldId: string; order: number }>) =>
      settingsApi.reorderCustomFields(fields),
    onSuccess: (res) => {
      const payload = res.data as ApiEnvelope<{ fields: import('@/types').ICustomField[] }>;
      updateCustomFields(payload.data.fields);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to reorder fields'));
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => settingsApi.completeOnboarding(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void navigate('/dashboard');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to complete onboarding'));
    },
  });
}
