import { ArrowDownToLine, CheckCircle2, Minus, Package, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OnboardingStatus } from '@/types';

interface StepFourProps {
  status?: OnboardingStatus;
  onComplete: (destination: string) => Promise<void>;
  isCompleting: boolean;
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-700">
      {done ? <CheckCircle2 size={16} className="mt-0.5 text-emerald-600" /> : <Minus size={16} className="mt-0.5 text-slate-400" />}
      <span>{label}</span>
    </li>
  );
}

export function StepFour({ status, onComplete, isCompleting }: StepFourProps) {
  return (
    <div className="space-y-6">
      <style>
        {`@keyframes onboarding-pop-in { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }`}
      </style>

      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-emerald-100 p-3" style={{ animation: 'onboarding-pop-in 200ms ease-out' }}>
          <CheckCircle2 size={56} className="text-emerald-600" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">You&apos;re all set! 🎉</h1>
        <p className="text-sm text-slate-600">Your inventory system is ready to use.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-slate-800">Summary</p>
        <ul className="space-y-2">
          <ChecklistItem
            done={true}
            label={`Business configured: ${status?.tenant.name ?? 'Your business'} · ${status?.tenant.currency ?? 'USD'}`}
          />
          <ChecklistItem
            done={Boolean(status?.hasWarehouse)}
            label={status?.hasWarehouse ? `Warehouse created: ${status?.warehouseName ?? 'Created'}` : 'Warehouse not added yet'}
          />
          <ChecklistItem
            done={Boolean(status?.hasProduct)}
            label={status?.hasProduct ? `First product added: ${status?.productName ?? 'Created'}` : 'No products yet'}
          />
        </ul>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-slate-800">What to do next</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <Package size={18} className="text-slate-700" />
            <p className="mt-2 text-sm font-medium text-slate-800">Add more products</p>
            <p className="text-xs text-slate-500">Import via CSV or add one by one</p>
            <Button className="mt-3 w-full" variant="outline" disabled={isCompleting} onClick={() => void onComplete('/products')}>
              Go to Products →
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <ArrowDownToLine size={18} className="text-slate-700" />
            <p className="mt-2 text-sm font-medium text-slate-800">Record stock in</p>
            <p className="text-xs text-slate-500">Add your current inventory levels</p>
            <Button className="mt-3 w-full" variant="outline" disabled={isCompleting} onClick={() => void onComplete('/stock')}>
              Record stock →
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <Users size={18} className="text-slate-700" />
            <p className="mt-2 text-sm font-medium text-slate-800">Invite your team</p>
            <p className="text-xs text-slate-500">Add managers and staff members</p>
            <Button className="mt-3 w-full" variant="outline" disabled={isCompleting} onClick={() => void onComplete('/settings/users')}>
              Manage team →
            </Button>
          </div>
        </div>
      </div>

      <Button className="w-full" disabled={isCompleting} onClick={() => void onComplete('/dashboard')}>
        {isCompleting ? 'Finishing setup...' : 'Go to dashboard →'}
      </Button>

      <p className="text-center text-xs text-slate-500">You can revisit setup anytime from Settings → Onboarding</p>
    </div>
  );
}
