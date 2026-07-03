import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

export const useSocket = () => {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const tenantId = useAuthStore((s) => s.user?.tenantId);

  // Create the socket exactly once for the lifetime of this hook's owner.
  // Recreating it on every token refresh caused repeated handshakes, and those
  // external-store-driven re-renders kept aborting React Router's navigation
  // transition (URL changed, view stayed put).
  const socketRef = useRef<Socket | null>(null);
  if (!socketRef.current) {
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, { autoConnect: false });
  }
  const socket = socketRef.current;

  // Keep the latest tenantId reachable from the connect handler without
  // re-subscribing the listeners (which would churn the socket).
  const tenantIdRef = useRef(tenantId);
  tenantIdRef.current = tenantId;

  // Register event listeners once. queryClient is stable, so this runs a single time.
  useEffect(() => {
    const handleConnect = () => {
      const currentTenantId = tenantIdRef.current;
      if (currentTenantId) {
        socket.emit('join:tenant', currentTenantId);
      }
    };

    const handleStockUpdated = (payload: { productId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'movements'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'activity'] });
      if (payload?.productId) {
        void queryClient.invalidateQueries({ queryKey: ['products', payload.productId] });
      }
    };

    const handleDashboardRefreshed = () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    };

    const handleImportCompleted = (payload: {
      jobId: string;
      status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
      successCount: number;
      errorCount: number;
    }) => {
      void queryClient.invalidateQueries({ queryKey: ['import', 'jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });

      if (payload.status === 'COMPLETED') {
        toast.success(`Import complete - ${payload.successCount} products added`);
      } else if (payload.status === 'PARTIAL') {
        toast.warning(`Import finished - ${payload.successCount} added, ${payload.errorCount} failed`);
      } else {
        toast.error('Import failed - check the error report');
      }
    };

    const handleAlertNew = (payload: {
      productName?: string;
      currentStock?: number;
      threshold?: number;
      warehouseId?: string;
    }) => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'alerts'] });
      queryClient.setQueryData<number>(['stock', 'alerts', 'count'], (previous) => (previous ?? 0) + 1);

      toast.warning(
        `Low stock alert: ${payload.productName ?? 'Product'} - ${payload.currentStock ?? 0} remaining (threshold ${payload.threshold ?? 0})`,
        { duration: 10_000 }
      );
    };

    socket.on('connect', handleConnect);
    socket.on('stock:updated', handleStockUpdated);
    socket.on('dashboard:refreshed', handleDashboardRefreshed);
    socket.on('import:completed', handleImportCompleted);
    socket.on('alert:new', handleAlertNew);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('stock:updated', handleStockUpdated);
      socket.off('dashboard:refreshed', handleDashboardRefreshed);
      socket.off('import:completed', handleImportCompleted);
      socket.off('alert:new', handleAlertNew);
    };
  }, [socket, queryClient]);

  // Manage the connection based on auth state WITHOUT tearing the socket down on
  // every token refresh. The server authenticates at handshake; an already-open
  // connection stays valid, so we only (re)connect when we transition into having
  // a token and disconnect when we lose it.
  useEffect(() => {
    if (!token) {
      socket.disconnect();
      return;
    }

    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
  }, [socket, token]);

  // Tear the socket down only when the owning component unmounts.
  useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return socket;
};
