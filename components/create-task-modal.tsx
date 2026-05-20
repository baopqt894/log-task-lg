'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface CreateTaskModalProps {
  projects: any[];
  boards?: Array<{ id: string; name: string }>;
  selectedBoardId?: string;
  task?: {
    id: string;
    title: string;
    description?: string | null;
    project_id?: string | null;
    board_id?: string | null;
    quantity?: number | null;
    status?: string;
    due_date?: string | null;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTaskModal({
  projects,
  boards = [],
  selectedBoardId = '',
  task,
  onClose,
  onSuccess,
}: CreateTaskModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEditing = Boolean(task);
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    projectId: task?.project_id || '',
    boardId: task?.board_id || selectedBoardId || '',
    quantity: task?.quantity != null ? String(task.quantity) : '',
    status: task?.status || 'pending',
    due_date: task?.due_date || new Date().toISOString().slice(0, 10),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Không tìm thấy thông tin người dùng đăng nhập.');
      return;
    }

    if (!formData.boardId) {
      setError('Vui lòng chọn bảng công việc.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(isEditing ? `/api/tasks/${task!.id}` : '/api/tasks', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: formData.projectId,
          boardId: formData.boardId || null,
          title: formData.title,
          description: formData.description,
          assignedTo: user.id,
          quantity: formData.quantity ? Number(formData.quantity) : null,
          estimatedHours: null,
          dueDate: formData.due_date,
          status: formData.status,
        }),
      });

      if (response.ok) {
        onSuccess();
        return;
      }

      const data = await response.json().catch(() => null);
      setError(data?.message || (isEditing ? 'Không thể cập nhật task.' : 'Không thể gửi log công việc.'));
    } catch (error) {
      console.error('Error creating task:', error);
      setError(isEditing ? 'Không thể cập nhật task.' : 'Không thể gửi log công việc.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[1px] p-4">
      <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">
            {isEditing ? 'Chỉnh Sửa Task' : 'Ghi Nhật Kí Công Việc'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-slate-600 text-sm mb-6">
            Vui lòng điền thông tin chi tiết về công việc đã thực hiện để ghi nhận thời gian và khối lượng.
          </p>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Row 1: Date, Member, Role */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Ngày đăng ký <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Thành viên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={user?.fullName || ''}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Vai trò <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={user?.role || ''}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 outline-none"
              />
            </div>
          </div>

          {/* Row 2: Board, Project */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Bảng công việc <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.boardId}
                onChange={(e) => setFormData({ ...formData, boardId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Chọn bảng</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Dự án <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Chọn dự án</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Quantity, Estimated Hours, Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Số lượng <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="Vd dụ: 4"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Đơn vị WL
              </label>
              <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700">
                WL
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Trạng thái <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="pending">pending</option>
                <option value="in_progress">in progress</option>
                <option value="done">done</option>
                <option value="in_review">in review</option>
                <option value="release">release</option>
                <option value="block">block</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Tên công việc <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Nhập tên công việc"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Mô tả chi tiết (Tùy chọn)
            </label>
            <textarea
              placeholder="Nhập mô tả ngắn gọn về công việc đã thực hiện..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : isEditing ? 'Lưu Thay Đổi' : 'Gửi Log Công Việc'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
