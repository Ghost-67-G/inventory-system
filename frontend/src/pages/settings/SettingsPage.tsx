import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
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
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from '@/hooks/useNotificationPreferences';
import { useTenantStore } from '@/store/tenantStore';
import { AccountTab } from '@/pages/settings/tabs/AccountTab';
import { CustomFieldsTab } from '@/pages/settings/tabs/CustomFieldsTab';
import { GeneralSettingsTab } from '@/pages/settings/tabs/GeneralSettingsTab';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import type { EmailNotificationPreferences } from '@/types';

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
  const tenant = useTenantStore((state) => state.tenant);
  const timezone = tenant?.settings.timezone ?? 'UTC';
  const { data: preferences } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const [draft, setDraft] = useState<EmailNotificationPreferences | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  useSettings();

  useEffect(() => {
    if (preferences) {
      setDraft(preferences);
    }
  }, [preferences]);

  const canEditNotifications = useMemo(() => role === 'owner', [role]);

  useEffect(() => {
    if (!canEditNotifications || !draft || !preferences) {
      return;
    }

    const hasChanges =
      draft.lowStockAlerts !== preferences.lowStockAlerts ||
      draft.dailySummary !== preferences.dailySummary ||
      draft.importCompletion !== preferences.importCompletion;

    if (!hasChanges) {
      return;
    }

    const timeout = window.setTimeout(() => {
      updatePreferences
        .mutateAsync(draft)
        .then(() => {
          setShowSaved(true);
          window.setTimeout(() => setShowSaved(false), 2000);
        })
        .catch(() => undefined);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [canEditNotifications, draft, preferences, updatePreferences]);

  const togglePreference = (key: keyof EmailNotificationPreferences) => {
    if (!draft || !canEditNotifications) {
      return;
    }

    setDraft({
      ...draft,
      [key]: !draft[key]
    });
  };

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

      {activeTab === 'general' ? (
        <PermissionGuard permission="settings.view">
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Email notifications</h3>
                <p className="mt-1 text-sm text-slate-600">Choose what emails you receive about your inventory</p>
              </div>
              {showSaved ? (
                <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                  <Check className="h-4 w-4" />
                  Saved
                </span>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Low stock alerts</p>
                    <p className="text-xs text-slate-600">Get emailed when a product drops below its alert threshold</p>
                    <p className="mt-1 text-xs text-slate-500">Max once per product every 4 hours</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePreference('lowStockAlerts')}
                    disabled={!canEditNotifications || !draft}
                    className={`relative h-7 w-12 rounded-full transition ${
                      draft?.lowStockAlerts ? 'bg-slate-900' : 'bg-slate-300'
                    } ${!canEditNotifications ? 'opacity-50' : ''}`}
                    aria-pressed={Boolean(draft?.lowStockAlerts)}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        draft?.lowStockAlerts ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Daily inventory summary</p>
                    <p className="text-xs text-slate-600">Receive a morning summary of alerts and activity at 8:00 AM</p>
                    <p className="mt-1 text-xs text-slate-500">Sent at 8:00 AM in your configured timezone ({timezone})</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePreference('dailySummary')}
                    disabled={!canEditNotifications || !draft}
                    className={`relative h-7 w-12 rounded-full transition ${
                      draft?.dailySummary ? 'bg-slate-900' : 'bg-slate-300'
                    } ${!canEditNotifications ? 'opacity-50' : ''}`}
                    aria-pressed={Boolean(draft?.dailySummary)}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        draft?.dailySummary ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Import notifications</p>
                    <p className="text-xs text-slate-600">Get emailed when a CSV import finishes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePreference('importCompletion')}
                    disabled={!canEditNotifications || !draft}
                    className={`relative h-7 w-12 rounded-full transition ${
                      draft?.importCompletion ? 'bg-slate-900' : 'bg-slate-300'
                    } ${!canEditNotifications ? 'opacity-50' : ''}`}
                    aria-pressed={Boolean(draft?.importCompletion)}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        draft?.importCompletion ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </PermissionGuard>
      ) : null}

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
