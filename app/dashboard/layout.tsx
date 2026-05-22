'use client';

import { SidebarWithUser } from '@/components/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, PanelLeftClose, PanelLeftOpen, RotateCcw, Search } from 'lucide-react';

function getInitials(name?: string, email?: string) {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-100">
        <div className="w-64 bg-slate-200 animate-pulse"></div>
        <div className="flex-1 p-8">
          <div className="h-8 bg-slate-200 rounded animate-pulse mb-4"></div>
          <div className="h-32 bg-slate-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#f4f7fb] dark:bg-[#101214]">
      <SidebarWithUser user={user} loading={loading} collapsed={sidebarCollapsed} />
      <main
        className={`flex-1 overflow-auto transition-[margin] duration-200 ${
          sidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <header className="flex h-[68px] items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur dark:border-[#2c333a] dark:bg-[#1d2125]/92">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-[#0b4d7f]"
            aria-label={sidebarCollapsed ? 'Mở sidebar' : 'Đóng sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
          <div className="flex items-center gap-6">
            <div className="relative w-[360px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="search"
                placeholder="Tìm kiếm..."
                className="h-11 w-full rounded-full border border-slate-300 bg-[#f7f9fc] pl-12 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-[#0b4d7f] focus:bg-white focus:ring-2 focus:ring-[#dbeafe]"
              />
            </div>
            <button className="text-slate-500 hover:text-[#0b4d7f]" aria-label="Thông báo">
              <Bell className="w-5 h-5" />
            </button>
            <button className="text-slate-500 hover:text-[#0b4d7f]" aria-label="Làm mới">
              <RotateCcw className="w-5 h-5" />
            </button>
            <ThemeToggle />
            <Avatar className="h-11 w-11 border border-slate-200 bg-slate-100 ring-2 ring-white shadow-sm dark:border-[#2c333a] dark:bg-[#22272b] dark:ring-[#101214]">
              {user.avatarUrl && (
                <AvatarImage src={user.avatarUrl} alt={user.fullName || user.email} />
              )}
              <AvatarFallback className="bg-slate-200 text-sm font-bold text-slate-600 dark:bg-[#2c333a] dark:text-[#b6c2cf]">
                {getInitials(user.fullName, user.email)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
