import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from '@/router';
import { bindSystemThemeListener, initializeTheme } from '@/store/themeStore';
import '@/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Fewer request bursts on token expiry / focus means fewer external-store
      // updates fighting React Router's navigation transition.
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

initializeTheme();
bindSystemThemeListener();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>
);
