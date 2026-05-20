'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  monthly_wl_kpi: number;
  is_active: boolean;
  created_at: string;
  role?: { name: string };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [createError, setCreateError] = useState('');
  const [savingKpiUserId, setSavingKpiUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    roleId: '',
    monthlyWlKpi: '',
    isActive: true,
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      const nextUsers = (data.users || []).map((user: any) => ({
        ...user,
        monthly_wl_kpi: Number(user.monthly_wl_kpi || 0),
        role: Array.isArray(user.roles) ? user.roles[0] : user.roles,
      }));
      setUsers(nextUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/admin/roles');
      const data = await response.json();
      const nextRoles = data.roles || [];
      setRoles(nextRoles);
      setFormData((current) => ({
        ...current,
        roleId:
          current.roleId ||
          nextRoles.find((role: any) => role.name === 'member')?.id ||
          nextRoles[0]?.id ||
          '',
      }));
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleDelete = async (userId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
      try {
        await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        setCreateError(
          [
            data.message || 'Không thể tạo người dùng',
            data.details ? `Chi tiết: ${data.details}` : '',
            data.requestId ? `Request ID: ${data.requestId}` : '',
          ]
            .filter(Boolean)
            .join(' - ')
        );
        return;
      }

      setShowCreateForm(false);
      setFormData({
        email: '',
        fullName: '',
        password: '',
        monthlyWlKpi: '',
        roleId:
          roles.find((role: any) => role.name === 'member')?.id ||
          roles[0]?.id ||
          '',
        isActive: true,
      });
      fetchUsers();
    } catch (error) {
      setCreateError('Không thể tạo người dùng');
      console.error('Error creating user:', error);
    }
  };

  const handleKpiChange = (userId: string, value: string) => {
    const nextValue = Number(value || 0);
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, monthly_wl_kpi: nextValue } : user
      )
    );
  };

  const handleKpiSave = async (user: User) => {
    setSavingKpiUserId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_wl_kpi: user.monthly_wl_kpi }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        alert(data?.message || 'Không thể lưu KPI');
      }
    } catch (error) {
      console.error('Error saving KPI:', error);
      alert('Không thể lưu KPI');
    } finally {
      setSavingKpiUserId(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Quản Lý Người Dùng</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Thêm Người Dùng
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hoặc email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {showCreateForm && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Thêm Người Dùng</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateError('');
                  }}
                  className="text-sm text-slate-500 hover:text-slate-900"
                >
                  Hủy
                </button>
              </div>

              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Vai trò
                  </label>
                  <select
                    required
                    value={formData.roleId}
                    onChange={(e) =>
                      setFormData({ ...formData, roleId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Chọn vai trò</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    KPI WL/tháng
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.monthlyWlKpi}
                    onChange={(e) =>
                      setFormData({ ...formData, monthlyWlKpi: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                Hoạt động
              </label>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Tạo Người Dùng
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-600">Đang tải...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">
                    Tên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">
                    Vai Trò
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">
                    KPI WL/tháng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">
                    Trạng Thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 uppercase">
                    Hành Động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-900">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {user.full_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {user.role?.name || 'member'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={user.monthly_wl_kpi}
                          onChange={(e) => handleKpiChange(user.id, e.target.value)}
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        <button
                          onClick={() => handleKpiSave(user)}
                          disabled={savingKpiUserId === user.id}
                          className="rounded-md bg-[#0b4d7f] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {savingKpiUserId === user.id ? 'Lưu...' : 'Lưu'}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.is_active ? 'Hoạt động' : 'Không hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-slate-600">Không tìm thấy người dùng</p>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
