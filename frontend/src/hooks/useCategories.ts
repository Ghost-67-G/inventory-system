import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { categoriesApi } from '@/api/endpoints/categories';
import type {
  CategoryDropdownItem,
  CategoryListResponse,
  CreateCategoryDto,
  ICategory,
  UpdateCategoryDto
} from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface UseCategoriesParams {
  search?: string;
  isActive?: 'true' | 'false';
  page?: number;
  limit?: number;
}

export function useCategories(params?: UseCategoriesParams) {
  return useQuery({
    queryKey: ['categories', params],
    queryFn: async () => {
      const normalized: Record<string, string | number | undefined> = {
        search: params?.search,
        isActive: params?.isActive,
        page: params?.page,
        limit: params?.limit
      };
      const res = await categoriesApi.list(normalized);
      const payload = res.data as ApiEnvelope<CategoryListResponse>;
      return payload.data;
    },
    staleTime: 60_000
  });
}

export function useCategoriesDropdown() {
  return useQuery({
    queryKey: ['categories', 'dropdown'],
    queryFn: async () => {
      const res = await categoriesApi.dropdown();
      const payload = res.data as ApiEnvelope<{ categories: CategoryDropdownItem[] }>;
      return payload.data.categories;
    },
    staleTime: 5 * 60_000
  });
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: ['categories', id],
    queryFn: async () => {
      const res = await categoriesApi.getOne(id);
      const payload = res.data as ApiEnvelope<{ category: ICategory }>;
      return payload.data.category;
    },
    enabled: Boolean(id)
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, CreateCategoryDto>({
    mutationFn: (data) => categoriesApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category created');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to create category');
        return;
      }
      toast.error('Failed to create category');
    }
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, { id: string; data: UpdateCategoryDto }>({
    mutationFn: ({ id, data }) => categoriesApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category updated');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to update category');
        return;
      }
      toast.error('Failed to update category');
    }
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, string>({
    mutationFn: (id) => categoriesApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        if (status === 400 && message) {
          toast.error(message);
          return;
        }
        toast.error(message ?? 'Failed to delete category');
        return;
      }
      toast.error('Failed to delete category');
    }
  });
}
