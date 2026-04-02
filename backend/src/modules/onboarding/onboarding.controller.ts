import type { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import * as onboardingService from './onboarding.service';
import type { StepOneDto, StepThreeDto, StepTwoDto } from './onboarding.schema';

export const getStatus = catchAsync(async (req: Request, res: Response) => {
  const status = await onboardingService.getOnboardingStatus(req.tenantId!);
  res.status(200).json({ success: true, data: status });
});

export const completeStepOne = catchAsync(async (req: Request, res: Response) => {
  const tenant = await onboardingService.completeStepOne(req.tenantId!, req.body as StepOneDto);
  res.status(200).json({ success: true, data: { tenant } });
});

export const completeStepTwo = catchAsync(async (req: Request, res: Response) => {
  const warehouse = await onboardingService.completeStepTwo(req.tenantId!, req.user!.id, req.body as StepTwoDto);
  res.status(200).json({ success: true, data: { warehouse } });
});

export const completeStepThree = catchAsync(async (req: Request, res: Response) => {
  const result = await onboardingService.completeStepThree(req.tenantId!, req.user!.id, req.body as StepThreeDto);
  res.status(200).json({ success: true, data: result });
});

export const completeOnboarding = catchAsync(async (req: Request, res: Response) => {
  const result = await onboardingService.completeOnboarding(req.tenantId!);
  res.status(200).json({ success: true, data: result });
});

export const skipOnboarding = catchAsync(async (req: Request, res: Response) => {
  const result = await onboardingService.skipOnboarding(req.tenantId!);
  res.status(200).json({ success: true, data: result });
});

export const resetOnboarding = catchAsync(async (req: Request, res: Response) => {
  const result = await onboardingService.resetOnboarding(req.tenantId!);
  res.status(200).json({ success: true, data: result });
});
