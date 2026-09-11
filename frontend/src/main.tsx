import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from '@/router';
import { bindSystemThemeListener, initializeTheme, useThemeStore } from '@/store/themeStore';
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

function ThemedToaster() {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  return <Toaster richColors closeButton position="top-right" theme={resolvedTheme} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ThemedToaster />
    </QueryClientProvider>
  </React.StrictMode>
);
