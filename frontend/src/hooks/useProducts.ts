import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { productsApi } from '@/api/endpoints/products';
import type {
  BulkUpdateDto,
  CreateProductDto,
  IProduct,
  ListProductsParams,
  ProductListResponse,
  UpdateProductDto
} from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

function normalizeProduct(product: any): IProduct {
  const populatedCategory =
    product?.categoryId && typeof product.categoryId === 'object'
      ? {
          _id: String(product.categoryId._id),
          name: String(product.categoryId.name),
          color: String(product.categoryId.color)
        }
      : null;

  return {
    ...product,
    categoryId: populatedCategory?._id ?? product.categoryId ?? null,
    category: populatedCategory,
    customFields: product?.customFields ?? {}
  } as IProduct;
}

/**
 * Fetch products with infinite query for cursor-based pagisationation
 */
export function useProducts(params?: ListProductsParams) {
  return useInfiniteQuery({
    queryKey: ['products', params],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const mergedParams = { ...params, cursor: pageParam as string | undefined };
      const res = await productsApi.list(mergedParams);
      const payload = res.data as ApiEnvelope<ProductListResponse>;
      return {
        ...payload.data,
        products: payload.data.products.map(normalizeProduct)
      };
    },
    getNextPageParam: (lastPage: ProductListResponse) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    initialPageParam: undefined
  });
}

/**
 * Get product count
 */
export function useProductCount(params?: Omit<ListProductsParams, 'cursor' | 'limit'>) {
  return useQuery({
    queryKey: ['products', 'count', params],
    queryFn: async () => {
      const res = await productsApi.count(params);
      const payload = res.data as ApiEnvelope<{ count: number }>;
      return payload.data.count;
    },
    staleTime: 60_000
  });
}

/**
 * Get single product
 */
export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: async () => {
      const res = await productsApi.getOne(id);
      const payload = res.data as ApiEnvelope<{ product: IProduct }>;
      return normalizeProduct(payload.data.product);
    },
    staleTime: 5 * 60_000
  });
}

/**
 * Create product mutation
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductDto) => productsApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'count'] });
      toast.success('Product created successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to create product';
      toast.error(message);
    }
  });
}

/**
 * Update product mutation
 */
export function useUpdateProduct(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProductDto) => productsApi.update(productId, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', productId] });
      queryClient.invalidateQueries({ queryKey: ['products', 'count'] });
      toast.success('Product updated successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to update product';
      toast.error(message);
    }
  });
}

/**
 * Delete product mutation
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => productsApi.delete(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'count'] });
      toast.success('Product deleted successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to delete product';
      toast.error(message);
    }
  });
}

/**
 * Bulk update products mutation
 */
export function useBulkUpdateProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkUpdateDto) => productsApi.bulkUpdate(data),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'count'] });
      toast.success(`${variables.productIds.length} products updated successfully`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to update products';
      toast.error(message);
    }
  });
}
