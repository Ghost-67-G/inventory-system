import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Menu, UserCircle2 } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/useAuth';
import { usePendingAlertCount } from '@/hooks/useStock';
import { Sidebar } from '@/layouts/Sidebar';
import { cn } from '@/lib/utils';
import { useSocket } from '@/hooks/useSocket';

export function AppLayout() {
  useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const logoutMutation = useLogout();
  const { data: alertCount = 0 } = usePendingAlertCount();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsSidebarOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  // Close the user menu when clicking anywhere outside of it.
  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isUserMenuOpen]);

  // Lock body scroll while the mobile sidebar is open.
  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const initials = useMemo(() => {
    if (!user?.name) {
      return 'U';
    }
    return user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }, [user?.name]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <Sidebar className="w-60" />
      </aside>

      {isSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <aside
        aria-hidden={!isSidebarOpen}
        inert={!isSidebarOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-70 max-w-[85vw] -translate-x-full transition-transform duration-250 lg:hidden',
          isSidebarOpen && 'translate-x-0'
        )}
      >
        <Sidebar className="w-70" onNavigate={() => setIsSidebarOpen(false)} />
      </aside>

      <div className="min-h-screen lg:ml-60">
        <header className="sticky top-0 z-20 h-14 border-b border-border/80 bg-background/90 px-4 backdrop-blur">
          <div className="mx-auto flex h-full items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 lg:hidden"
                onClick={() => setIsSidebarOpen((value) => !value)}
                aria-label="Toggle sidebar"
                aria-expanded={isSidebarOpen}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <p className="text-sm font-semibold text-foreground">Inventory</p>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="relative size-10"
                onClick={() => void navigate('/alerts')}
                aria-label="Open alerts"
              >
                <Bell className="h-4 w-4" />
                {alertCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 animate-pulse items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                ) : null}
              </Button>

              <div ref={userMenuRef} className="relative">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 px-2"
                  onClick={() => setIsUserMenuOpen((value) => !value)}
                  aria-label="Open user menu"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                    {initials}
                  </span>
                  <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                </Button>

                {isUserMenuOpen ? (
                  <div className="absolute right-0 z-50 mt-2 w-64 rounded-md border border-border bg-popover p-1 shadow-md">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-medium text-foreground">{user?.name ?? 'User'}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email ?? 'No email'}</p>
                    </div>
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      className="w-full rounded-sm px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                      onClick={() => void navigate('/settings')}
                    >
                      Profile settings
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-sm px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                      onClick={() => void navigate('/settings/security')}
                    >
                      Change password
                    </button>
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      className="w-full rounded-sm px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => logoutMutation.mutate()}
                      disabled={logoutMutation.isPending}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="w-full min-w-0 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
