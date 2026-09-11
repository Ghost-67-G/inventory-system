import axios from 'axios';
import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STEP_STORAGE_KEY);
  } catch {
    return 1;
  }
  if (raw === null) {
    return 1;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return clampStep(parsed);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
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
    try {
      await skipOnboarding.mutateAsync();
      localStorage.removeItem(STEP_STORAGE_KEY);
      setSkipDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not skip setup. Please try again.'));
    }
  };

  const handleComplete = async (destination: string) => {
    try {
      await completeOnboarding.mutateAsync(destination);
      localStorage.removeItem(STEP_STORAGE_KEY);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not finish setup. Please try again.'));
    }
  };

  if (statusQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  if (statusQuery.isError) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">
            {getErrorMessage(statusQuery.error, 'Could not load your setup progress.')}
          </p>
          <Button type="button" className="mt-4" variant="outline" onClick={() => void statusQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const stepLineProgress = ((currentStep - 1) / 3) * 100;

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
      <style>
        {`@keyframes onboarding-step-enter { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}
      </style>

      <div className="mx-auto w-full max-w-140">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold tracking-wide text-foreground">Inventory System</p>
          <button
            type="button"
            onClick={() => setSkipDialogOpen(true)}
            className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
            disabled={skipOnboarding.isPending}
          >
            Skip setup
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div
            className="relative mb-4 h-1 rounded-full bg-muted"
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={1}
            aria-valuemax={4}
            aria-valuenow={currentStep}
          >
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${stepLineProgress}%` }} />
          </div>

          <ol className="grid grid-cols-4 gap-2">
            {STEP_LABELS.map((label, index) => {
              const stepNumber = index + 1;
              const isDone = completedSteps.has(stepNumber) || currentStep > stepNumber;
              const isCurrent = currentStep === stepNumber;

              return (
                <li key={label} className="flex flex-col items-center gap-2" aria-current={isCurrent ? 'step' : undefined}>
                  <div
                    aria-hidden="true"
                    className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition-all ${
                      isDone
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : isCurrent
                          ? 'h-9 w-9 border-blue-600 bg-blue-600 text-white'
                          : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    {isDone ? <Check size={14} aria-hidden="true" /> : stepNumber}
                  </div>
                  <span className="sr-only text-center text-xs text-muted-foreground sm:not-sr-only">
                    {label}
                    {isDone ? <span className="sr-only"> (completed)</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div key={currentStep} className="rounded-xl border border-border bg-card p-5" style={{ animation: 'onboarding-step-enter 200ms ease-out' }}>
          {currentStep === 1 ? <StepOne status={statusQuery.data} onNext={handleNext} /> : null}
          {currentStep === 2 ? <StepTwo status={statusQuery.data} onNext={handleNext} /> : null}
          {currentStep === 3 ? <StepThree status={statusQuery.data} onNext={handleNext} /> : null}
          {currentStep === 4 ? (
            <StepFour status={statusQuery.data} onComplete={handleComplete} isCompleting={completeOnboarding.isPending} />
          ) : null}

          {currentStep === 2 || currentStep === 3 ? (
            <div className="mt-5 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={handleBack}>
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
            <AlertDialogCancel disabled={skipOnboarding.isPending}>Continue setup</AlertDialogCancel>
            <AlertDialogAction
              disabled={skipOnboarding.isPending}
              onClick={(event) => {
                // Keep the dialog open until the request settles so failures can be retried.
                event.preventDefault();
                void handleSkipConfirm();
              }}
            >
              {skipOnboarding.isPending ? 'Skipping...' : 'Skip anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
