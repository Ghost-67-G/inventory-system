import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { usersApi } from '@/api/endpoints/users';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/store/authStore';
import type { InviteUserDto, SafeUser, UpdateUserDto, UserListResponse } from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface UseUsersParams {
  page?: number;
  limit?: number;
  role?: string;
  isActive?: 'true' | 'false';
  search?: string;
}

export function useUsers(params?: UseUsersParams) {
  const { canDo } = usePermission();

  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const normalizedParams: Record<string, string | number | undefined> | undefined = params
        ? {
            page: params.page,
            limit: params.limit,
            role: params.role,
            isActive: params.isActive,
            search: params.search
          }
        : undefined;

      const res = await usersApi.list(normalizedParams);
      const payload = res.data as ApiEnvelope<UserListResponse>;
      return payload.data;
    },
    enabled: canDo('user.view'),
    staleTime: 30_000,
    // Keep non-blocking feedback for list errors.
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to load team members');
        return;
      }
      toast.error('Failed to load team members');
    }
  });
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: async () => {
      const res = await usersApi.getOne(userId);
      const payload = res.data as ApiEnvelope<{ user: SafeUser }>;
      return payload.data.user;
    },
    enabled: Boolean(userId)
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InviteUserDto) => usersApi.invite(data),
    onSuccess: (_res, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Invitation sent to ${variables.email}`);
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to send invitation');
        return;
      }
      toast.error('Failed to send invitation');
    }
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateUserDto }) => usersApi.update(userId, data),
    onSuccess: (_res, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['users', variables.userId] });
      toast.success('User updated successfully');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to update user');
        return;
      }
      toast.error('Failed to update user');
    }
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId }: { userId: string; userName: string }) => usersApi.deactivate(userId),
    onSuccess: (_res, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${variables.userName} has been deactivated`);
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to deactivate user');
        return;
      }
      toast.error('Failed to deactivate user');
    }
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => usersApi.reactivate(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User reactivated');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to reactivate user');
        return;
      }
      toast.error('Failed to reactivate user');
    }
  });
}

export function useMyProfile() {
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      const res = await usersApi.getMyProfile();
      const payload = res.data as ApiEnvelope<{ user: SafeUser }>;
      return payload.data.user;
    }
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const accessToken = useAuthStore((state) => state.accessToken);

  return useMutation({
    mutationFn: (data: { name: string }) => usersApi.updateMyProfile(data),
    onSuccess: (res) => {
      const payload = res.data as ApiEnvelope<{ user: SafeUser }>;
      const user = payload.data.user;
      if (accessToken) {
        setAuth(user, accessToken);
      }
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      toast.success('Profile updated');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        if (message) {
          toast.error(message);
          return;
        }
      }
      toast.error('Failed to update profile');
    }
  });
}
