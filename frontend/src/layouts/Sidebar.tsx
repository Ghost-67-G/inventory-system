import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
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
import { cn } from '@/lib/utils';
import type { Permission } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  badge?: () => number;
}

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
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
  { label: 'Audit log', href: '/audit', icon: ClipboardList, permission: 'audit.view' },
  { label: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view' }
];

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const { canDo } = usePermission();
  const location = useLocation();
  const { data: alertCount = 0 } = usePendingAlertCount();

  return (
    <aside className={cn('sidebar flex h-full w-full flex-col border-r border-border bg-card/95 p-4 backdrop-blur', className)}>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Inventory</h2>
      <nav className="space-y-2">
        {navItems
          .filter((item) => !item.permission || canDo(item.permission))
          .map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
