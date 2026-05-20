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
  assignee?: { full_name: string };
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
  onOpen?: () => void;
  onEdit?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
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
  onOpen,
  onEdit,
  onContextMenu,
}: TaskCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const normalizedStatus =
    task.status === 'not_started' ? 'pending' : task.status === 'completed' ? 'done' : task.status;

  const getStatusColor = () => {
    switch (normalizedStatus) {
      case 'pending':
        return 'text-slate-600';
      case 'in_progress':
        return 'text-blue-600';
      case 'done':
        return 'text-green-600';
      case 'in_review':
        return 'text-purple-600';
      case 'release':
        return 'text-emerald-600';
      case 'block':
        return 'text-red-600';
      default:
        return 'text-slate-600';
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
      className={`rounded-lg border p-5 hover:shadow-md transition-shadow ${
        isOwnTask ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white'
      } ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${
        isDragging ? 'opacity-50 ring-2 ring-blue-200' : ''
      }`}
    >
      {/* Project Tag */}
      {task.project && (
        <div className="mb-2">
          <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
            {task.project.name}
          </span>
        </div>
      )}

      {/* Title */}
      <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2 text-lg">{task.title}</h3>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-slate-600 mb-4 line-clamp-3">{task.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        {/* Assignee */}
        {task.assignee && (
          <div className="flex items-center">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {task.assignee.full_name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Due Date */}
        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="w-3 h-3" />
            <span>{new Date(task.due_date).toLocaleDateString('vi-VN')}</span>
          </div>
        )}

        <div className="text-xs font-semibold text-slate-700">
          {Number(task.quantity || 0)} WL
        </div>

        {/* Status Progress (for in progress tasks) */}
        {normalizedStatus === 'in_progress' && (
          <div className="flex-1 ml-2 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full w-2/3 bg-blue-600 rounded-full"></div>
          </div>
        )}
      </div>

      {/* Status Indicator */}
      <div className="mt-4 flex items-center justify-between gap-2">
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
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Sửa
          </button>
        )}
      </div>
    </div>
  );
}
