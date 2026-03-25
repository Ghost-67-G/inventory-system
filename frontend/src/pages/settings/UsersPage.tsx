import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { ChangeRoleModal } from '@/components/users/ChangeRoleModal';
import { ConfirmDeactivateDialog } from '@/components/users/ConfirmDeactivateDialog';
import { EditProfileModal } from '@/components/users/EditProfileModal';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { useAuthStore } from '@/store/authStore';
import { useDeactivateUser, useReactivateUser, useUsers } from '@/hooks/useUsers';
import type { Role, SafeUser } from '@/types';

const roleBadgeClass: Record<Role, string> = {
  owner: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  staff: 'bg-teal-100 text-teal-800',
  viewer: 'bg-slate-100 text-slate-700'
};

const avatarColorTokens = ['teal', 'purple', 'amber', 'rose', 'blue'] as const;

function getInitials(name: string): string {
  const words = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]?.toUpperCase() ?? '').join('');
}

function hashName(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function avatarClassForName(name: string): string {
  const bucket = avatarColorTokens[hashName(name) % avatarColorTokens.length];
  const map: Record<(typeof avatarColorTokens)[number], string> = {
    teal: 'bg-teal-100 text-teal-700',
    purple: 'bg-purple-100 text-purple-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700'
  };
  return map[bucket];
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

function isLastActiveOwner(target: SafeUser, users: SafeUser[]): boolean {
  if (target.role !== 'owner' || !target.isActive) {
    return false;
  }

  const activeOwners = users.filter((user) => user.role === 'owner' && user.isActive);
  return activeOwners.length <= 1;
}

function formatRelativeTime(value: string): string {
  const now = Date.now();
  const then = new Date(value).getTime();
  const diff = Math.max(0, now - then);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

export function UsersPage() {
  const currentUser = useAuthStore((state) => state.user);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changeRoleUser, setChangeRoleUser] = useState<SafeUser | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<SafeUser | null>(null);

  const debouncedSearch = useDebouncedValue(search, 400);

  const { data, isLoading } = useUsers({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
    role: roleFilter === 'all' ? undefined : roleFilter,
    isActive: statusFilter === 'all' ? undefined : (statusFilter as 'true' | 'false')
  });

  const deactivateMutation = useDeactivateUser();
  const reactivateMutation = useReactivateUser();

  const users = data?.users ?? [];
  const showingFrom = data && data.total > 0 ? (data.page - 1) * 10 + 1 : 0;
  const showingTo = data ? Math.min(data.page * 10, data.total) : 0;

  const onConfirmDeactivate = async () => {
    if (!deactivateUser) {
      return;
    }

    await deactivateMutation.mutateAsync({ userId: deactivateUser._id, userName: deactivateUser.name });
    setDeactivateUser(null);
  };

  return (
    <div>
      <PageHeader title="Team members" subtitle="Invite and manage access for your team.">
        <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
      </PageHeader>

      <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <input
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search name or email"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All roles</option>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
          <option value="viewer">Viewer</option>
        </select>
        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Loading members...
                </td>
              </tr>
            ) : null}

            {!isLoading && users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No team members found.
                </td>
              </tr>
            ) : null}

            {users.map((user) => {
              const ownRow = currentUser?._id === user._id;
              const hideDeactivate = isLastActiveOwner(user, users);
              const hideChangeRole = user.role === 'owner';

              return (
                <tr key={user._id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ${avatarClassForName(
                          user.name
                        )}`}
                      >
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${roleBadgeClass[user.role]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        user.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {ownRow ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditProfileOpen(true)}>
                            Edit profile
                          </Button>
                          <Link to="/settings/security">
                            <Button size="sm" variant="outline">
                              Change password
                            </Button>
                          </Link>
                        </>
                      ) : null}

                      {!ownRow && user.isActive ? (
                        <>
                          {!hideChangeRole ? (
                            <Button size="sm" variant="outline" onClick={() => setChangeRoleUser(user)}>
                              Change role
                            </Button>
                          ) : null}
                          {!hideDeactivate ? (
                            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => setDeactivateUser(user)}>
                              Deactivate
                            </Button>
                          ) : null}
                        </>
                      ) : null}

                      {!ownRow && !user.isActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reactivateMutation.isPending}
                          onClick={() => void reactivateMutation.mutateAsync(user._id)}
                        >
                          Reactivate
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <p>
          Showing {showingFrom}-{showingTo} of {data?.total ?? 0} members
        </p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
            Prev
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(data && page >= data.totalPages)}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ChangeRoleModal user={changeRoleUser} open={Boolean(changeRoleUser)} onClose={() => setChangeRoleUser(null)} />
      <ConfirmDeactivateDialog
        open={Boolean(deactivateUser)}
        name={deactivateUser?.name ?? ''}
        loading={deactivateMutation.isPending}
        onCancel={() => setDeactivateUser(null)}
        onConfirm={() => void onConfirmDeactivate()}
      />
      <EditProfileModal open={editProfileOpen} user={currentUser} onClose={() => setEditProfileOpen(false)} />
    </div>
  );
}
