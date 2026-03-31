import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { importApi } from '@/api/endpoints/import';
import type { CreateImportResponse } from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export function useImportJobs(params?: { cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: ['import', 'jobs', params],
    queryFn: async () => {
      const response = await importApi.listJobs(params);
      const payload = response.data as ApiEnvelope<{
        jobs: any[];
        nextCursor: string | null;
        hasMore: boolean;
      }>;
      return payload.data;
    },
    staleTime: 0
  });
}

export function useImportJob(jobId: string | null) {
  return useQuery({
    queryKey: ['import', 'jobs', jobId],
    queryFn: async () => {
      const response = await importApi.getJob(jobId as string);
      const payload = response.data as ApiEnvelope<{ job: any }>;
      return payload.data;
    },
    staleTime: 0,
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.job?.status as string | undefined;
      if (!status || status === 'COMPLETED' || status === 'FAILED' || status === 'PARTIAL') {
        return false;
      }
      return 2000;
    }
  });
}

export function useUploadCsv() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<CreateImportResponse> => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const response = await importApi.upload(file, setUploadProgress);
      const payload = response.data as ApiEnvelope<CreateImportResponse>;
      await queryClient.invalidateQueries({ queryKey: ['import', 'jobs'] });
      return payload.data;
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Upload failed';
      setUploadError(message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [queryClient]);

  return {
    upload,
    isUploading,
    uploadProgress,
    uploadError
  };
}
