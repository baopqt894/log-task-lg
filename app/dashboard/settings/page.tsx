'use client';

import { useState, useEffect } from 'react';
import { Camera, KeyRound, Save, ShieldCheck, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

function getInitials(name?: string, email?: string) {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    avatar_url: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.fullName || '',
        email: user.email || '',
        avatar_url: user.avatarUrl || '',
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Không thể cập nhật hồ sơ',
          description: data?.message || 'Vui lòng thử lại sau.',
        });
        return;
      }

      toast({
        title: 'Đã cập nhật hồ sơ',
        description: 'Thông tin cá nhân đã được lưu lại.',
      });
      window.dispatchEvent(
        new CustomEvent('auth:user-updated', {
          detail: {
            user: {
              fullName: data?.user?.fullName || formData.full_name,
              avatarUrl: data?.user?.avatarUrl ?? formData.avatar_url,
            },
          },
        })
      );
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Không thể cập nhật hồ sơ',
        description: 'Vui lòng thử lại sau.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'File không hợp lệ',
        description: 'Vui lòng chọn file hình ảnh.',
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/users/avatar', {
        method: 'POST',
        body: uploadFormData,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Không thể cập nhật avatar',
          description: data?.message || 'Vui lòng thử lại sau.',
        });
        return;
      }

      setFormData((current) => ({
        ...current,
        avatar_url: data.avatarUrl || '',
      }));
      window.dispatchEvent(
        new CustomEvent('auth:user-updated', {
          detail: { user: { avatarUrl: data.avatarUrl } },
        })
      );
      await refreshUser();
      toast({
        title: 'Đã cập nhật avatar',
        description: 'Ảnh đại diện mới đã được lưu lại.',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        variant: 'destructive',
        title: 'Không thể cập nhật avatar',
        description: 'Vui lòng thử lại sau.',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Mật khẩu xác nhận không khớp',
        description: 'Vui lòng nhập lại mật khẩu mới.',
      });
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Không thể đổi mật khẩu',
          description: data?.message || 'Vui lòng kiểm tra lại thông tin.',
        });
        return;
      }

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast({
        title: 'Đã đổi mật khẩu',
        description: 'Bạn có thể dùng mật khẩu mới ở lần đăng nhập tiếp theo.',
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        variant: 'destructive',
        title: 'Không thể đổi mật khẩu',
        description: 'Vui lòng thử lại sau.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Cài Đặt</h1>
        <p className="text-slate-600 mt-1">Quản lý tài khoản và cài đặt hệ thống</p>
      </div>

      {/* Profile Settings */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Thông Tin Cá Nhân</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
              {formData.avatar_url ? (
                <img
                  src={formData.avatar_url}
                  alt={formData.full_name || 'Avatar'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-lg font-bold text-slate-600">
                  {getInitials(formData.full_name, formData.email)}
                </div>
              )}
              <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#0c66e4] text-white ring-2 ring-white">
                <Camera className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Avatar</p>
              <p className="mt-1 truncate text-sm text-slate-500">
                {formData.avatar_url || 'Chưa có ảnh đại diện'}
              </p>
            </div>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
              className="sr-only"
            />
            <label
              htmlFor="avatar-upload"
              className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 ${
                uploadingAvatar ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <Upload className="h-4 w-4" />
              {uploadingAvatar ? 'Đang tải...' : 'Tải ảnh'}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Họ Tên
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savingProfile ? 'Đang lưu...' : 'Lưu Thay Đổi'}
          </button>
        </form>
      </div>

      {/* Security Settings */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Bảo Mật</h2>
            <p className="mt-1 text-sm text-slate-600">
              Đổi mật khẩu đăng nhập của tài khoản hiện tại.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Mật khẩu hiện tại
            </label>
            <input
              type="password"
              required
              value={passwordData.currentPassword}
              onChange={(e) =>
                setPasswordData({ ...passwordData, currentPassword: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Mật khẩu mới
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Xác nhận mật khẩu mới
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0b4d7f] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#083b63] disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {savingPassword ? 'Đang đổi...' : 'Đổi Mật Khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}
