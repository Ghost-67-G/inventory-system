import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { usePermission } from '@/hooks/usePermission';
import { useSettings } from '@/hooks/useSettings';
import { AccountTab } from '@/pages/settings/tabs/AccountTab';
import { CustomFieldsTab } from '@/pages/settings/tabs/CustomFieldsTab';
import { GeneralSettingsTab } from '@/pages/settings/tabs/GeneralSettingsTab';

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'custom-fields', label: 'Custom Fields' },
  { key: 'account', label: 'Account' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const { role } = usePermission();
  const canManage = role === 'owner';

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
    </div>
  );
}
