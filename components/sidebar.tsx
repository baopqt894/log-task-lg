'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard,
  CheckSquare,
  FolderOpen,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  Shield,
} from 'lucide-react';

export function Sidebar() {
  return <SidebarWithAuth />;
}

export function SidebarWithUser({
  user,
  loading,
  collapsed = false,
}: {
  user: { role?: string } | null;
  loading: boolean;
  collapsed?: boolean;
}) {
  return <SidebarContent user={user} loading={loading} collapsed={collapsed} />;
}

function SidebarWithAuth() {
  const { user, loading } = useAuth();

  return <SidebarContent user={user} loading={loading} />;
}

function SidebarContent({
  user,
  loading,
  collapsed = false,
}: {
  user: { role?: string } | null;
  loading: boolean;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <aside className="w-64 bg-[#f7f9fc] text-slate-900 h-screen flex flex-col border-r border-slate-200">
        <div className="p-6">
          <div className="h-8 bg-slate-200 rounded animate-pulse"></div>
        </div>
      </aside>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const navItems = [
    { href: '/dashboard', label: 'Bảng Công Việc', icon: LayoutDashboard },
    { href: '/dashboard/tasks', label: 'Nhật Ký Tác Vụ', icon: CheckSquare },
    ...(isAdmin ? [{ href: '/dashboard/projects', label: 'Dự Án', icon: FolderOpen }] : []),
    { href: '/dashboard/reports', label: 'Báo Cáo', icon: BarChart3 },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 flex h-screen flex-col border-r border-slate-200 bg-[#f7f9fc] text-slate-700 transition-[width] duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className={`${collapsed ? 'p-4' : 'p-6'} border-b border-slate-200`}>
        <div className={`mb-2 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0b4d7f] font-bold text-white shadow-sm">
            LG
          </div>
          <div className={collapsed ? 'hidden' : ''}>
            <h1 className="font-extrabold text-lg leading-tight text-[#083b63]">Limgrow</h1>
            <p className="text-xs font-medium text-slate-500">Hệ thống điều hành</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`${collapsed ? 'p-3' : 'p-4'} flex-1 space-y-2 overflow-y-auto`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg py-3 transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-4'
              } ${
                active
                  ? 'bg-[#e6f0f8] text-[#0b4d7f] font-semibold shadow-[inset_-4px_0_0_#0b4d7f]'
                  : 'text-slate-600 hover:bg-white hover:text-[#0b4d7f]'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={`text-sm font-medium ${collapsed ? 'hidden' : ''}`}>{item.label}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-slate-200">
            <p className={`px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-400 ${collapsed ? 'hidden' : ''}`}>
              Admin
            </p>
            <Link
              href="/admin/users"
              title={collapsed ? 'Quản Lý Người Dùng' : undefined}
              className={`flex items-center gap-3 rounded-lg py-3 transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-4'
              } ${
                isActive('/admin/users')
                  ? 'bg-[#e6f0f8] text-[#0b4d7f] font-semibold shadow-[inset_-4px_0_0_#0b4d7f]'
                  : 'text-slate-600 hover:bg-white hover:text-[#0b4d7f]'
              }`}
            >
              <Shield className="h-5 w-5 shrink-0" />
              <span className={`text-sm font-medium ${collapsed ? 'hidden' : ''}`}>Quản Lý Người Dùng</span>
            </Link>
            <Link
              href="/admin/roles"
              title={collapsed ? 'Quản Lý Vai Trò' : undefined}
              className={`flex items-center gap-3 rounded-lg py-3 transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-4'
              } ${
                isActive('/admin/roles')
                  ? 'bg-[#e6f0f8] text-[#0b4d7f] font-semibold shadow-[inset_-4px_0_0_#0b4d7f]'
                  : 'text-slate-600 hover:bg-white hover:text-[#0b4d7f]'
              }`}
            >
              <Shield className="h-5 w-5 shrink-0" />
              <span className={`text-sm font-medium ${collapsed ? 'hidden' : ''}`}>Quản Lý Vai Trò</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={`${collapsed ? 'p-3' : 'p-4'} space-y-2 border-t border-slate-200`}>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Đăng xuất' : undefined}
          className={`mb-4 flex w-full items-center justify-center gap-3 rounded-lg bg-[#0b4d7f] py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#083b63] ${
            collapsed ? 'px-0' : 'px-4'
          }`}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className={`text-sm ${collapsed ? 'hidden' : ''}`}>Đăng xuất</span>
        </button>
        <Link
          href="/dashboard/settings"
          title={collapsed ? 'Cài Đặt' : undefined}
          className={`flex items-center gap-3 rounded-lg py-3 transition-colors ${
            collapsed ? 'justify-center px-0' : 'px-4'
          } ${
            isActive('/dashboard/settings')
              ? 'bg-[#e6f0f8] text-[#0b4d7f] font-semibold'
              : 'text-slate-600 hover:bg-white hover:text-[#0b4d7f]'
          }`}
        >
          <Settings className="h-5 w-5 shrink-0" />
          <span className={`text-sm font-medium ${collapsed ? 'hidden' : ''}`}>Cài Đặt</span>
        </Link>
        <Link
          href="/dashboard/help"
          title={collapsed ? 'Trợ Giúp' : undefined}
          className={`flex items-center gap-3 rounded-lg py-3 transition-colors ${
            collapsed ? 'justify-center px-0' : 'px-4'
          } ${
            isActive('/dashboard/help')
              ? 'bg-[#e6f0f8] text-[#0b4d7f] font-semibold'
              : 'text-slate-600 hover:bg-white hover:text-[#0b4d7f]'
          }`}
        >
          <HelpCircle className="h-5 w-5 shrink-0" />
          <span className={`text-sm font-medium ${collapsed ? 'hidden' : ''}`}>Trợ Giúp</span>
        </Link>
      </div>
    </aside>
  );
}
