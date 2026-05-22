'use client';

import { SidebarWithUser } from '@/components/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, PanelLeftClose, PanelLeftOpen, RotateCcw, Search } from 'lucide-react';

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
    <div className="flex h-screen bg-[#f4f7fb] dark:bg-[#172033]">
      <SidebarWithUser user={user} loading={loading} collapsed={sidebarCollapsed} />
      <main
        className={`flex-1 overflow-auto transition-[margin] duration-200 ${
          sidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <header className="flex h-[68px] items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur dark:border-[#3a4a61] dark:bg-[#202b3e]/92">
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
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-sky-200 via-cyan-100 to-amber-100 ring-2 ring-white shadow-sm" />
          </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
