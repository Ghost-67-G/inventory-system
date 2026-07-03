import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { onboardingApi } from '@/api/endpoints/onboarding';
import { useAuthStore } from '@/store/authStore';
import { useTenantStore } from '@/store/tenantStore';
import type { StepOneDto, StepThreeDto, StepTwoDto } from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export function useOnboardingStatus() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: ['onboarding', 'status'],
    queryFn: async () => {
      const res = await onboardingApi.getStatus();
      const payload = res.data as ApiEnvelope<import('@/types').OnboardingStatus>;
      return payload.data;
    },
    enabled: user?.role === 'owner',
    // Was 0, which refetched on every navigation through the always-mounted
    // onboarding guard. Explicit invalidations after each step still force a
    // refetch, so correctness is unaffected.
    staleTime: 60_000
  });
}

export function useCompleteStep1() {
  const queryClient = useQueryClient();
  const updateSettings = useTenantStore((state) => state.updateSettings);
  const setTenant = useTenantStore((state) => state.setTenant);
  const tenant = useTenantStore((state) => state.tenant);

  return useMutation({
    mutationFn: (data: StepOneDto) => onboardingApi.completeStep1(data),
    onSuccess: (res) => {
      const payload = res.data as ApiEnvelope<{ tenant: { name?: string; currency?: string; timezone?: string; lowStockThreshold?: number } }>;
      const nextTenant = payload.data.tenant;

      if (tenant && nextTenant.name) {
        setTenant({ ...tenant, name: nextTenant.name });
      }
      updateSettings({
        currency: nextTenant.currency,
        timezone: nextTenant.timezone,
        lowStockThreshold: nextTenant.lowStockThreshold
      });

      void queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    }
  });
}

export function useCompleteStep2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StepTwoDto) => onboardingApi.completeStep2(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    }
  });
}

export function useCompleteStep3() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StepThreeDto) => onboardingApi.completeStep3(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setOnboardingComplete = useTenantStore((state) => state.setOnboardingComplete);

  return useMutation({
    mutationFn: (redirectTo?: string) => onboardingApi.complete().then((res) => ({ res, redirectTo })),
    onSuccess: async ({ redirectTo }) => {
      setOnboardingComplete(true);
      void queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      localStorage.removeItem('onboarding:step');
      await navigate(redirectTo ?? '/dashboard');
    }
  });
}

export function useSkipOnboarding() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setOnboardingComplete = useTenantStore((state) => state.setOnboardingComplete);

  return useMutation({
    mutationFn: () => onboardingApi.skip(),
    onSuccess: async () => {
      setOnboardingComplete(true);
      void queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      localStorage.removeItem('onboarding:step');
      await navigate('/dashboard');
    }
  });
}

export function useResetOnboarding() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setOnboardingComplete = useTenantStore((state) => state.setOnboardingComplete);

  return useMutation({
    mutationFn: () => onboardingApi.reset(),
    onSuccess: async () => {
      setOnboardingComplete(false);
      void queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Onboarding reset — you can go through setup again');
      await navigate('/onboarding');
    }
  });
}
