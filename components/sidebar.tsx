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
}: {
  user: { role?: string } | null;
  loading: boolean;
}) {
  return <SidebarContent user={user} loading={loading} />;
}

function SidebarWithAuth() {
  const { user, loading } = useAuth();

  return <SidebarContent user={user} loading={loading} />;
}

function SidebarContent({
  user,
  loading,
}: {
  user: { role?: string } | null;
  loading: boolean;
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
    <aside className="w-64 bg-[#f7f9fc] text-slate-700 h-screen flex flex-col fixed left-0 top-0 border-r border-slate-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#0b4d7f] rounded-full flex items-center justify-center font-bold text-white shadow-sm">
            LG
          </div>
          <div>
            <h1 className="font-extrabold text-lg leading-tight text-[#083b63]">Limgrow</h1>
            <p className="text-xs font-medium text-slate-500">Hệ thống điều hành</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-[#e6f0f8] text-[#0b4d7f] font-semibold shadow-[inset_-4px_0_0_#0b4d7f]'
                  : 'text-slate-600 hover:bg-white hover:text-[#0b4d7f]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-slate-200">
            <p className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
              Admin
            </p>
            <Link
              href="/admin/users"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive('/admin/users')
                  ? 'bg-[#e6f0f8] text-[#0b4d7f] font-semibold shadow-[inset_-4px_0_0_#0b4d7f]'
                  : 'text-slate-600 hover:bg-white hover:text-[#0b4d7f]'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Quản Lý Người Dùng</span>
            </Link>
            <Link
              href="/admin/roles"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive('/admin/roles')
                  ? 'bg-[#e6f0f8] text-[#0b4d7f] font-semibold shadow-[inset_-4px_0_0_#0b4d7f]'
                  : 'text-slate-600 hover:bg-white hover:text-[#0b4d7f]'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Quản Lý Vai Trò</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 space-y-2 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="mb-4 w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-[#0b4d7f] text-white font-semibold hover:bg-[#083b63] transition-colors shadow-sm"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">Đăng xuất</span>
        </button>
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/dashboard/settings')
              ? 'bg-[#e6f0f8] text-[#0b4d7f] font-semibold'
              : 'text-slate-600 hover:bg-white hover:text-[#0b4d7f]'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-sm font-medium">Cài Đặt</span>
        </Link>
        <Link
          href="/dashboard/help"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/dashboard/help')
              ? 'bg-[#e6f0f8] text-[#0b4d7f] font-semibold'
              : 'text-slate-600 hover:bg-white hover:text-[#0b4d7f]'
          }`}
        >
          <HelpCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Trợ Giúp</span>
        </Link>
      </div>
    </aside>
  );
}
