import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useCompleteOnboarding, useOnboardingStatus, useSkipOnboarding } from '@/hooks/useOnboarding';
import { StepFour } from '@/pages/onboarding/steps/StepFour';
import { StepOne } from '@/pages/onboarding/steps/StepOne';
import { StepThree } from '@/pages/onboarding/steps/StepThree';
import { StepTwo } from '@/pages/onboarding/steps/StepTwo';

const STEP_STORAGE_KEY = 'onboarding:step';
const STEP_LABELS = ['Business', 'Warehouse', 'Products', 'All set!'] as const;

function clampStep(step: number): 1 | 2 | 3 | 4 {
  if (step <= 1) return 1;
  if (step >= 4) return 4;
  return step as 1 | 2 | 3 | 4;
}

function readStoredStep(): number {
  const raw = localStorage.getItem(STEP_STORAGE_KEY);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return clampStep(parsed);
}

export function OnboardingPage() {
  const statusQuery = useOnboardingStatus();
  const skipOnboarding = useSkipOnboarding();
  const completeOnboarding = useCompleteOnboarding();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);

  useEffect(() => {
    if (!statusQuery.data) {
      return;
    }

    const localStep = readStoredStep();
    const statusStep = statusQuery.data.currentStep;
    const nextStep = clampStep(Math.max(localStep, statusStep));
    setCurrentStep(nextStep);
  }, [statusQuery.data]);

  const completedSteps = useMemo(() => {
    const fromStatus = statusQuery.data?.completedSteps ?? [];
    return new Set(fromStatus);
  }, [statusQuery.data]);

  const setStep = (step: number) => {
    const nextStep = clampStep(step);
    setCurrentStep(nextStep);
    localStorage.setItem(STEP_STORAGE_KEY, String(nextStep));
  };

  const handleNext = () => {
    setStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep <= 1) {
      return;
    }
    setStep(currentStep - 1);
  };

  const handleSkipConfirm = async () => {
    await skipOnboarding.mutateAsync();
    localStorage.removeItem(STEP_STORAGE_KEY);
    setSkipDialogOpen(false);
  };

  const handleComplete = async (destination: string) => {
    await completeOnboarding.mutateAsync(destination);
    localStorage.removeItem(STEP_STORAGE_KEY);
  };

  if (statusQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  const stepLineProgress = ((currentStep - 1) / 3) * 100;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
      <style>
        {`@keyframes onboarding-step-enter { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}
      </style>

      <div className="mx-auto max-w-140">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm font-semibold tracking-wide text-slate-900">Inventory System</p>
          <button
            type="button"
            onClick={() => setSkipDialogOpen(true)}
            className="text-sm text-slate-600 underline-offset-4 hover:underline"
            disabled={skipOnboarding.isPending}
          >
            Skip setup
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="relative mb-4 h-1 rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${stepLineProgress}%` }} />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {STEP_LABELS.map((label, index) => {
              const stepNumber = index + 1;
              const isDone = completedSteps.has(stepNumber) || currentStep > stepNumber;
              const isCurrent = currentStep === stepNumber;

              return (
                <div key={label} className="flex flex-col items-center gap-2">
                  <div
                    className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition-all ${
                      isDone
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : isCurrent
                          ? 'h-9 w-9 border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-slate-500'
                    }`}
                  >
                    {isDone ? <Check size={14} /> : stepNumber}
                  </div>
                  <span className="text-xs text-slate-600">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div key={currentStep} className="rounded-xl border border-slate-200 bg-white p-5" style={{ animation: 'onboarding-step-enter 200ms ease-out' }}>
          {currentStep === 1 ? <StepOne status={statusQuery.data} onNext={handleNext} /> : null}
          {currentStep === 2 ? <StepTwo status={statusQuery.data} onNext={handleNext} /> : null}
          {currentStep === 3 ? <StepThree status={statusQuery.data} onNext={handleNext} /> : null}
          {currentStep === 4 ? (
            <StepFour status={statusQuery.data} onComplete={handleComplete} isCompleting={completeOnboarding.isPending} />
          ) : null}

          {currentStep === 2 || currentStep === 3 ? (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <AlertDialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip for now?</AlertDialogTitle>
            <AlertDialogDescription>
              You can complete setup later in Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue setup</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleSkipConfirm()}>
              Skip anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
