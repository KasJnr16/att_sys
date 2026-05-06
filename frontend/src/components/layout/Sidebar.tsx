import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Settings,
  LogOut,
  GraduationCap,
  History,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  href: string;
  icon: React.FC<{ className?: string }>;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/lecturer', icon: LayoutDashboard, roles: ['lecturer'] },
  { label: 'Classes', href: '/dashboard/lecturer/classes', icon: BookOpen, roles: ['lecturer'] },
  { label: 'History', href: '/dashboard/lecturer/history', icon: History, roles: ['lecturer'] },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['lecturer'] },

  { label: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard, roles: ['admin'] },
  { label: 'Users', href: '/dashboard/admin', icon: GraduationCap, roles: ['admin'] },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['admin'] },

];

interface SidebarProps {
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const filteredItems = navItems.filter((item) => !item.roles || (user?.role?.name && item.roles.includes(user.role.name)));

  const isActive = (href: string) => {
    if (href === '/dashboard/lecturer') {
      return pathname === href || pathname === '/dashboard/lecturer' || pathname === '/dashboard';
    }
    if (href === '/dashboard/admin') {
      return pathname === href || pathname === '/dashboard/admin' || pathname === '/dashboard';
    }
    if (href === '/dashboard/lecturer/history') {
      return pathname.startsWith(href);
    }
    return pathname === href;
  };

  return (
    <aside className="flex h-full w-64 max-w-full flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 p-5 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">UniAtt</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {filteredItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active 
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className={`h-5 w-5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <button
          onClick={() => {
            onNavigate?.();
            logout();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  );
};
