import {
  BarChart3,
  Bell,
  Boxes,
  LayoutDashboard,
  Package,
  Settings,
  Tag,
  Users,
  Warehouse,
  type LucideIcon
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import { usePendingAlertCount } from '@/hooks/useStock';
import type { Permission } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  badge?: () => number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { label: 'Products', href: '/products', icon: Package, permission: 'product.view' },
  { label: 'Stock', href: '/stock', icon: Boxes, permission: 'stock.view' },
  { label: 'Warehouses', href: '/warehouses', icon: Warehouse, permission: 'warehouse.view' },
  { label: 'Alerts', href: '/alerts', icon: Bell, permission: 'alert.view' },
  { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'report.view' },
  { label: 'Team', href: '/settings/users', icon: Users, permission: 'user.view' },
  { label: 'Categories', href: '/settings/categories', icon: Tag, permission: 'category.manage' },
  { label: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view' }
];

export function Sidebar() {
  const { canDo } = usePermission();
  const location = useLocation();
  const { data: alertCount = 0 } = usePendingAlertCount();

  return (
    <aside className="w-full border-r border-slate-200 bg-white/90 p-4 md:w-64">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Inventory</h2>
      <nav className="space-y-2">
        {navItems
          .filter((item) => !item.permission || canDo(item.permission))
          .map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                location.pathname.endsWith(item.href)
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
              {item.label === 'Alerts' && alertCount > 0 ? (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              ) : null}
            </Link>
          ))}
      </nav>
    </aside>
  );
}
