'use client';

import { useState, type DragEvent, type MouseEvent } from 'react';
import { Calendar, AlertCircle, CheckCircle2, Clock, Rocket, ShieldCheck, Ban, Pencil } from 'lucide-react';

type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'in_review'
  | 'release'
  | 'block'
  | 'not_started'
  | 'completed';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  assigned_to?: string;
  created_by?: string | null;
  project_id: string;
  due_date?: string;
  created_at: string;
  quantity?: number | null;
  board_id?: string | null;
  task_type?: string;
  project?: { name: string };
  assignee?: { full_name?: string | null; email?: string | null; avatar_url?: string | null };
}

interface TaskCardProps {
  task: Task;
  onUpdate: () => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
  canEdit?: boolean;
  isOwnTask?: boolean;
  isHighlighted?: boolean;
  isRemoving?: boolean;
  onOpen?: () => void;
  onEdit?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}

function formatWl(value: number) {
  return Number(value || 0).toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
  });
}

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function TaskCard({
  task,
  onUpdate,
  draggable,
  onDragStart,
  onDragEnd,
  isDragging,
  canEdit = false,
  isOwnTask = false,
  isHighlighted = false,
  isRemoving = false,
  onOpen,
  onEdit,
  onContextMenu,
}: TaskCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const normalizedStatus =
    task.status === 'not_started' ? 'pending' : task.status === 'completed' ? 'done' : task.status;
  const assigneeName = task.assignee?.full_name || task.assignee?.email || 'Avatar';

  const getStatusColor = () => {
    switch (normalizedStatus) {
      case 'pending':
        return 'text-slate-500 dark:text-[#9fadbc]';
      case 'in_progress':
        return 'text-[#0c66e4] dark:text-[#579dff]';
      case 'done':
        return 'text-[#1f845a] dark:text-[#4bce97]';
      case 'in_review':
        return 'text-[#6e5dc6] dark:text-[#9f8fef]';
      case 'release':
        return 'text-[#1f845a] dark:text-[#4bce97]';
      case 'block':
        return 'text-[#ae2e24] dark:text-[#f87168]';
      default:
        return 'text-slate-500 dark:text-[#9fadbc]';
    }
  };

  const getStatusIcon = () => {
    switch (normalizedStatus) {
      case 'in_progress':
        return <Clock className="w-4 h-4" />;
      case 'done':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'in_review':
        return <ShieldCheck className="w-4 h-4" />;
      case 'release':
        return <Rocket className="w-4 h-4" />;
      case 'block':
        return <Ban className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit) return;

    setIsUpdating(true);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextStatus = () => {
    switch (normalizedStatus) {
      case 'pending':
        return 'in_progress';
      case 'in_progress':
        return 'in_review';
      case 'in_review':
        return 'done';
      case 'done':
        return 'release';
      case 'release':
      case 'block':
        return 'pending';
      default:
        return 'pending';
    }
  };

  const getStatusLabel = () => {
    switch (normalizedStatus) {
      case 'pending':
        return 'pending';
      case 'in_progress':
        return 'in progress';
      case 'done':
        return 'done';
      case 'in_review':
        return 'in review';
      case 'release':
        return 'release';
      case 'block':
        return 'block';
      default:
        return '';
    }
  };

  return (
    <div
      draggable={draggable}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded-md border p-3 transition-all duration-200 hover:border-slate-300 hover:shadow-sm dark:hover:border-[#454f59] ${
        isOwnTask
          ? 'border-[#85b8ff] bg-[#ffffff] ring-1 ring-[#85b8ff]/35 dark:border-[#1d7afc] dark:bg-[#22272b] dark:ring-[#1d7afc]/30'
          : 'border-slate-200 bg-[#ffffff] dark:border-[#2c333a] dark:bg-[#22272b]'
      } ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${
        isDragging ? 'opacity-50 ring-2 ring-[#85b8ff] dark:ring-[#579dff]' : ''
      } ${
        isHighlighted ? 'task-card-enter ring-2 ring-[#baf3db] dark:ring-[#4bce97]' : ''
      } ${
        isRemoving ? 'task-card-exit pointer-events-none' : ''
      }`}
    >
      {/* Project Tag */}
      {task.project && (
        <div className="mb-1.5">
          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-[#2c333a] dark:text-[#b6c2cf]">
            {task.project.name}
          </span>
        </div>
      )}

      {/* Title */}
      <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold leading-5 text-slate-900 dark:text-[#dee4ea]">{task.title}</h3>

      {/* Description */}
      {task.description && (
        <p className="mb-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-[#9fadbc]">{task.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-[#2c333a]">
        {/* Assignee */}
        {task.assignee && (
          <div className="flex items-center">
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[#44546f] text-xs font-bold text-white">
              {task.assignee.avatar_url ? (
                <img
                  src={task.assignee.avatar_url}
                  alt={assigneeName}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(task.assignee.full_name, task.assignee.email)
              )}
            </div>
          </div>
        )}

        {/* Due Date */}
        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-[#9fadbc]">
            <Calendar className="w-3 h-3" />
            <span>{new Date(task.due_date).toLocaleDateString('vi-VN')}</span>
          </div>
        )}

        <div className="text-xs font-semibold text-slate-700 dark:text-[#b6c2cf]">
          {formatWl(Number(task.quantity || 0))} WL
        </div>
      </div>

      {/* Status Indicator */}
      <div className="mt-2 flex items-center justify-between gap-2">
        {canEdit ? (
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleStatusChange(getNextStatus());
            }}
            disabled={isUpdating}
            className={`flex items-center gap-1 text-xs font-medium ${getStatusColor()} hover:opacity-80 transition-opacity disabled:opacity-50`}
          >
            {getStatusIcon()}
            <span>{getStatusLabel()}</span>
          </button>
        ) : (
          <div className={`flex items-center gap-1 text-xs font-medium ${getStatusColor()}`}>
            {getStatusIcon()}
            <span>{getStatusLabel()}</span>
          </div>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-[#2c333a] dark:text-[#b6c2cf] dark:hover:bg-[#2c333a]"
          >
            <Pencil className="h-3.5 w-3.5" />
            Sửa
          </button>
        )}
      </div>
    </div>
  );
}
