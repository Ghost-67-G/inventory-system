import { useState } from 'react';
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
import { PageHeader } from '@/components/shared/PageHeader';
import { usePermission } from '@/hooks/usePermission';
import { useResetOnboarding } from '@/hooks/useOnboarding';
import { useSettings } from '@/hooks/useSettings';
import { AccountTab } from '@/pages/settings/tabs/AccountTab';
import { CustomFieldsTab } from '@/pages/settings/tabs/CustomFieldsTab';
import { GeneralSettingsTab } from '@/pages/settings/tabs/GeneralSettingsTab';
import { PermissionGuard } from '@/router/guards/PermissionGuard';

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'custom-fields', label: 'Custom Fields' },
  { key: 'account', label: 'Account' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const { role } = usePermission();
  const canManage = role === 'owner';
  const resetOnboarding = useResetOnboarding();

  useSettings();

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your workspace configuration" />

      {!canManage ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have view-only access to settings. Contact an owner to make changes.
        </div>
      ) : null}

      <div className="mb-4 flex border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' ? <GeneralSettingsTab canManage={canManage} /> : null}
      {activeTab === 'custom-fields' ? <CustomFieldsTab canManage={canManage} /> : null}
      {activeTab === 'account' ? <AccountTab /> : null}

      <PermissionGuard permission="settings.manage">
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">Setup wizard</h3>
          <p className="mt-1 text-sm text-slate-600">
            Run through the initial setup wizard again to review or update your business configuration.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => setRestartDialogOpen(true)}>
            Restart onboarding
          </Button>
        </section>
      </PermissionGuard>

      <AlertDialog open={restartDialogOpen} onOpenChange={setRestartDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              This will not delete any of your data. It will just show you the setup wizard again on next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void resetOnboarding.mutateAsync()} disabled={resetOnboarding.isPending}>
              Restart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
