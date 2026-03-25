import { NavLink } from 'react-router-dom';
import { usePermission } from '../hooks/usePermission';

const items = [
  { to: '/dashboard', label: 'Dashboard', permission: 'report.view' as const },
  { to: '/products', label: 'Products', permission: 'product.view' as const },
  { to: '/warehouses', label: 'Warehouses', permission: 'warehouse.view' as const },
  { to: '/stock', label: 'Stock', permission: 'stock.view' as const },
  { to: '/alerts', label: 'Alerts', permission: 'alert.view' as const },
  { to: '/settings', label: 'Settings', permission: 'settings.view' as const }
];

export function Sidebar() {
  const { canDo } = usePermission();

  return (
    <aside className="w-full border-r border-slate-200 bg-white/90 p-4 md:w-64">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Inventory</h2>
      <nav className="space-y-2">
        {items
          .filter((item) => canDo(item.permission))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
      </nav>
    </aside>
  );
}
