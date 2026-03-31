import client from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import type { CreateImportResponse, IImportJob } from '@/types';

export const importApi = {
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);

    return client.post<{ data: CreateImportResponse }>('/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      }
    });
  },

  getJob: (jobId: string) => client.get<{ data: { job: IImportJob } }>(`/import/${jobId}`),

  listJobs: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: { jobs: IImportJob[]; nextCursor: string | null; hasMore: boolean } }>('/import', {
      params
    }),

  downloadTemplate: async (): Promise<void> => {
    const token = useAuthStore.getState().accessToken;
    const response = await fetch(`${import.meta.env.VITE_API_URL}/import/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      throw new Error(`Template download failed: ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'product-import-template.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(url);
  }
};
