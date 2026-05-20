'use client';

import type { ReactNode } from 'react';
import { Calendar, ClipboardList, FolderOpen, Hash, User, X } from 'lucide-react';

type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'in_review'
  | 'release'
  | 'block'
  | 'not_started'
  | 'completed';

interface TaskDetail {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  project_id: string;
  board_id?: string | null;
  quantity?: number | null;
  due_date?: string | null;
  created_at: string;
  updated_at?: string;
  project?: { name: string } | null;
  assignee?: { full_name?: string | null; email?: string | null } | null;
  creator?: { full_name?: string | null; email?: string | null } | null;
}

interface TaskDetailModalProps {
  task: TaskDetail;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}

const statusLabels: Record<string, string> = {
  pending: 'pending',
  not_started: 'pending',
  in_progress: 'in progress',
  done: 'done',
  completed: 'done',
  in_review: 'in review',
  release: 'release',
  block: 'block',
};

const statusClasses: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  not_started: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  in_review: 'bg-purple-100 text-purple-700',
  release: 'bg-emerald-100 text-emerald-700',
  block: 'bg-red-100 text-red-700',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('vi-VN');
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN');
}

export function TaskDetailModal({ task, canEdit, onClose, onEdit }: TaskDetailModalProps) {
  const creatorName = task.creator?.full_name || task.creator?.email || '-';
  const assigneeName = task.assignee?.full_name || task.assignee?.email || '-';
  const statusLabel = statusLabels[task.status] || task.status;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusClasses[task.status] || 'bg-slate-100 text-slate-700'
                }`}
              >
                {statusLabel}
              </span>
              {task.project?.name && (
                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                  {task.project.name}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{task.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-slate-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem icon={<User className="h-4 w-4" />} label="Người tạo" value={creatorName} />
            <DetailItem icon={<User className="h-4 w-4" />} label="Thành viên" value={assigneeName} />
            <DetailItem icon={<FolderOpen className="h-4 w-4" />} label="Dự án" value={task.project?.name || '-'} />
            <DetailItem icon={<Hash className="h-4 w-4" />} label="Số lượng" value={`${Number(task.quantity || 0)} WL`} />
            <DetailItem icon={<Calendar className="h-4 w-4" />} label="Ngày task" value={formatDate(task.due_date)} />
            <DetailItem icon={<ClipboardList className="h-4 w-4" />} label="Cập nhật" value={formatDateTime(task.updated_at || task.created_at)} />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-900">Mô tả</p>
            <div className="min-h-24 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {task.description || 'Không có mô tả.'}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Đóng
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Chỉnh sửa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        {icon}
        {label}
      </div>
      <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
