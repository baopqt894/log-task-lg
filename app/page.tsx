'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <div className="text-white font-bold text-2xl">QL</div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Quản Lý Tác Vụ</h1>
        <p className="text-slate-600 mt-2">Đang chuyển hướng...</p>
      </div>
    </div>
  );
}
