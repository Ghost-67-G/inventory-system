import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

export const useSocket = () => {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const tenantId = useAuthStore((s) => s.user?.tenantId);

  const socket = useMemo(() => {
    return io(import.meta.env.VITE_SOCKET_URL, {
      autoConnect: false,
      auth: {
        token
      }
    });
  }, [token]);

  useEffect(() => {
    if (token) {
      socket.connect();

      socket.on('connect', () => {
        if (tenantId) {
          socket.emit('join:tenant', tenantId);
        }
      });

      socket.on('stock:updated', (payload: { productId: string }) => {
        void queryClient.invalidateQueries({ queryKey: ['stock', 'movements'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboard', 'activity'] });
        if (payload?.productId) {
          void queryClient.invalidateQueries({ queryKey: ['products', payload.productId] });
        }
      });

      socket.on('dashboard:refreshed', () => {
        void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
      });

      socket.on(
        'import:completed',
        (payload: { jobId: string; status: 'COMPLETED' | 'PARTIAL' | 'FAILED'; successCount: number; errorCount: number }) => {
          void queryClient.invalidateQueries({ queryKey: ['import', 'jobs'] });
          void queryClient.invalidateQueries({ queryKey: ['products'] });

          if (payload.status === 'COMPLETED') {
            toast.success(`Import complete - ${payload.successCount} products added`);
          } else if (payload.status === 'PARTIAL') {
            toast.warning(`Import finished - ${payload.successCount} added, ${payload.errorCount} failed`);
          } else {
            toast.error('Import failed - check the error report');
          }
        }
      );

      socket.on(
        'alert:new',
        (payload: { productName?: string; currentStock?: number; threshold?: number; warehouseId?: string }) => {
          void queryClient.invalidateQueries({ queryKey: ['stock', 'alerts'] });
          queryClient.setQueryData<number>(['stock', 'alerts', 'count'], (previous) => (previous ?? 0) + 1);

          toast.warning(
            `Low stock alert: ${payload.productName ?? 'Product'} - ${payload.currentStock ?? 0} remaining (threshold ${payload.threshold ?? 0})`,
            { duration: Infinity }
          );
        }
      );
    }

    return () => {
      socket.off('connect');
      socket.off('stock:updated');
      socket.off('dashboard:refreshed');
      socket.off('import:completed');
      socket.off('alert:new');
      socket.disconnect();
    };
  }, [queryClient, socket, tenantId, token]);

  return socket;
};
