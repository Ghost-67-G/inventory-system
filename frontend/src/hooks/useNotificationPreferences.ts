import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api/endpoints/settings';
import type { EmailNotificationPreferences } from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: async () => {
      const response = await settingsApi.getNotificationPreferences();
      const payload = response.data as ApiEnvelope<{ preferences: EmailNotificationPreferences }>;
      return payload.data.preferences;
    },
    staleTime: 5 * 60 * 1000
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<EmailNotificationPreferences>) => settingsApi.updateNotificationPreferences(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings', 'notifications'] });
    }
  });
}
