import client from '@/api/client';
import type { ICategory, IProduct, IWarehouse, OnboardingStatus, StepOneDto, StepThreeDto, StepTwoDto, Tenant } from '@/types';

export const onboardingApi = {
  getStatus: () => client.get<{ data: OnboardingStatus }>('/onboarding/status'),

  completeStep1: (data: StepOneDto) =>
    client.post<{ data: { tenant: Pick<Tenant, 'name' | 'settings'> | Record<string, unknown> } }>('/onboarding/step/1', data),

  completeStep2: (data: StepTwoDto) =>
    client.post<{ data: { warehouse: IWarehouse } }>('/onboarding/step/2', data),

  completeStep3: (data: StepThreeDto) =>
    client.post<{ data: { category: ICategory; product: IProduct } }>('/onboarding/step/3', data),

  complete: () => client.post<{ data: { onboardingComplete: true } }>('/onboarding/complete'),

  skip: () => client.post<{ data: { onboardingComplete: true } }>('/onboarding/skip'),

  reset: () => client.post<{ data: { onboardingComplete: false } }>('/onboarding/reset')
};
