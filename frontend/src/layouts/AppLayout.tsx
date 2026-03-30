import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/layouts/Sidebar';
import { useSocket } from '@/hooks/useSocket';

export function AppLayout() {
  useSocket();

  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <main className="w-full p-6">
        <Outlet />
      </main>
    </div>
  );
}
