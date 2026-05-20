'use client';

import { useState, useEffect, useRef } from 'react';
import { TaskCard } from '@/components/task-card';
import { CreateTaskModal } from '@/components/create-task-modal';
import { TaskDetailModal } from '@/components/task-detail-modal';
import { createClient } from '@/lib/supabase/client';
import {
  Search,
  Plus,
  LayoutGrid,
  Settings,
  X,
  Check,
  ChevronDown,
  Pencil,
  Copy,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'in_review'
  | 'release'
  | 'block'
  | 'not_started'
  | 'completed';

type BoardStatus = 'pending' | 'in_progress' | 'done' | 'in_review' | 'release' | 'block';

const statusColumns = [
  { key: 'pending', label: 'PENDING', dot: 'bg-slate-400', header: 'bg-slate-50 border-slate-200', border: 'border-slate-200' },
  { key: 'in_progress', label: 'IN-PROGRESS', dot: 'bg-blue-600', header: 'bg-blue-50 border-blue-200', border: 'border-blue-200' },
  { key: 'done', label: 'DONE', dot: 'bg-green-500', header: 'bg-green-50 border-green-200', border: 'border-green-200' },
  { key: 'in_review', label: 'IN-REVIEW', dot: 'bg-purple-500', header: 'bg-purple-50 border-purple-200', border: 'border-purple-200' },
  { key: 'release', label: 'RELEASE', dot: 'bg-emerald-600', header: 'bg-emerald-50 border-emerald-200', border: 'border-emerald-200' },
  { key: 'block', label: 'BLOCK', dot: 'bg-red-500', header: 'bg-red-50 border-red-200', border: 'border-red-200' },
] as const satisfies ReadonlyArray<{
  key: BoardStatus;
  label: string;
  dot: string;
  header: string;
  border: string;
}>;

function normalizeStatus(status: TaskStatus) {
  if (status === 'not_started') return 'pending';
  if (status === 'completed') return 'done';
  return status;
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN');
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigned_to: string;
  created_by?: string | null;
  project_id: string;
  board_id?: string | null;
  quantity?: number | null;
  due_date: string;
  created_at: string;
  updated_at?: string;
  project?: { name: string };
  assignee?: { full_name: string };
  creator?: { full_name?: string | null; email?: string | null };
}

interface Board {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  board_members?: Array<{ user_id: string; role: string }>;
}

interface UserOption {
  id: string;
  email: string;
  full_name?: string | null;
  roles?: { name: string } | Array<{ name: string }> | null;
}

function getUserRoleName(user: UserOption) {
  const role = Array.isArray(user.roles) ? user.roles[0] : user.roles;
  return role?.name || 'member';
}

function getUserDisplayName(user: UserOption) {
  return user.full_name || user.email.split('@')[0] || user.email;
}

function getUserInitials(user: UserOption) {
  const source = getUserDisplayName(user).trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase() || 'U';
}

function getCurrentMonthBoardName() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `Tháng ${month}/${now.getFullYear()}`;
}

function getBoardMonthValue(board: Board) {
  const match = board.name.match(/Tháng\s+(\d{2})\/(\d{4})/i);
  if (!match) return 0;

  const [, month, year] = match;
  return Number(year) * 100 + Number(month);
}

function getDefaultBoardId(boards: Board[]) {
  const currentMonthBoard = boards.find((board) => board.name === getCurrentMonthBoardName());
  if (currentMonthBoard) return currentMonthBoard.id;

  return [...boards].sort((a, b) => getBoardMonthValue(b) - getBoardMonthValue(a))[0]?.id || '';
}

const TASK_EXIT_ANIMATION_MS = 220;
const TASK_ENTER_HIGHLIGHT_MS = 1200;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoaded, setBoardsLoaded] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [showBoardForm, setShowBoardForm] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [taskMenu, setTaskMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [appearingTaskIds, setAppearingTaskIds] = useState<string[]>([]);
  const [removingTaskIds, setRemovingTaskIds] = useState<string[]>([]);
  const [boardMonth, setBoardMonth] = useState(new Date().toISOString().slice(0, 7));
  const [boardMemberIds, setBoardMemberIds] = useState<string[]>([]);
  const [settingsMemberIds, setSettingsMemberIds] = useState<string[]>([]);
  const [savingBoardSettings, setSavingBoardSettings] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<BoardStatus | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const boardDropdownRef = useRef<HTMLDivElement | null>(null);
  const tasksRef = useRef<Task[]>([]);

  const markTasksAsAppearing = (taskIds: string[]) => {
    if (taskIds.length === 0) return;

    setAppearingTaskIds((current) => Array.from(new Set([...current, ...taskIds])));
    window.setTimeout(() => {
      setAppearingTaskIds((current) => current.filter((id) => !taskIds.includes(id)));
    }, TASK_ENTER_HIGHLIGHT_MS);
  };

  useEffect(() => {
    fetchProjects();
    fetchBoards();
  }, []);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user?.role]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        boardDropdownRef.current &&
        !boardDropdownRef.current.contains(event.target as Node)
      ) {
        setShowBoardDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!boardsLoaded) return;

    if (!selectedBoardId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    fetchTasks(selectedBoardId);
  }, [boardsLoaded, selectedBoardId]);

  useEffect(() => {
    if (!boardsLoaded || !selectedBoardId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`tasks-board-${selectedBoardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `board_id=eq.${selectedBoardId}`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedTaskId = String((payload.old as { id?: string } | null)?.id || '');

            if (deletedTaskId && tasksRef.current.some((task) => task.id === deletedTaskId)) {
              setRemovingTaskIds((current) => Array.from(new Set([...current, deletedTaskId])));
              await wait(TASK_EXIT_ANIMATION_MS);
              setTasks((current) => current.filter((task) => task.id !== deletedTaskId));
              setRemovingTaskIds((current) => current.filter((id) => id !== deletedTaskId));
            }

            refreshTasksQuietly(selectedBoardId);
            return;
          }

          refreshTasksQuietly(selectedBoardId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardsLoaded, selectedBoardId]);

  const fetchTasks = async (
    boardId = selectedBoardId,
    options: { showLoading?: boolean } = {}
  ) => {
    const showLoading = options.showLoading ?? true;
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (boardId) params.set('boardId', boardId);
      const response = await fetch(`/api/tasks${params.toString() ? `?${params}` : ''}`);
      const data = await response.json();
      const nextTasks = data.tasks || [];
      if (!showLoading) {
        const currentTaskIds = new Set(tasksRef.current.map((task) => task.id));
        const nextNewTaskIds = nextTasks
          .map((task: Task) => task.id)
          .filter((id: string) => !currentTaskIds.has(id));
        markTasksAsAppearing(nextNewTaskIds);
      }
      setTasks(nextTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const refreshTasksQuietly = (boardId = selectedBoardId) => {
    fetchTasks(boardId, { showLoading: false });
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects?options=1');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchBoards = async () => {
    try {
      const response = await fetch('/api/boards');
      const data = await response.json();
      const nextBoards = data.boards || [];
      setBoards(nextBoards);
      setSelectedBoardId((current) => {
        if (current && nextBoards.some((board: Board) => board.id === current)) {
          return current;
        }

        return getDefaultBoardId(nextBoards);
      });
    } catch (error) {
      console.error('Error fetching boards:', error);
    } finally {
      setBoardsLoaded(true);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleTaskCreated = () => {
    refreshTasksQuietly();
    setShowCreateModal(false);
    setEditingTask(null);
    setViewingTask(null);
  };

  const handleCreateBoard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!boardMonth) return;

    const [year, month] = boardMonth.split('-');
    const name = `Tháng ${month}/${year}`;

    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, memberIds: boardMemberIds }),
      });
      const data = await response.json();

      if (response.ok) {
        setBoards((current) => [
          data.board,
          ...current.filter((board) => board.id !== data.board.id),
        ]);
        setSelectedBoardId(data.board.id);
        setBoardMemberIds([]);
        setShowBoardForm(false);
      } else {
        console.error('Error creating board:', data.message);
      }
    } catch (error) {
      console.error('Error creating board:', error);
    }
  };

  const selectedBoard = boards.find((board) => board.id === selectedBoardId) || null;

  const visibleMembers = users.filter((item) => {
    const role = Array.isArray(item.roles) ? item.roles[0] : item.roles;
    return role?.name !== 'admin';
  });

  const openBoardSettings = () => {
    if (!selectedBoard) return;
    const nextMemberIds = (selectedBoard.board_members || [])
      .map((member) => member.user_id)
      .filter((id) => visibleMembers.some((member) => member.id === id));

    setSettingsMemberIds(nextMemberIds);
    setShowBoardSettings(true);
  };

  const handleSaveBoardSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBoard) return;

    setSavingBoardSettings(true);
    try {
      const response = await fetch(`/api/boards/${selectedBoard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: settingsMemberIds }),
      });
      const data = await response.json();

      if (response.ok) {
        setBoards((current) =>
          current.map((board) => (board.id === data.board.id ? data.board : board))
        );
        setShowBoardSettings(false);
      } else {
        console.error('Error saving board settings:', data.message);
      }
    } catch (error) {
      console.error('Error saving board settings:', error);
    } finally {
      setSavingBoardSettings(false);
    }
  };

  const handleTaskDrop = async (taskId: string, nextStatus: BoardStatus) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || normalizeStatus(task.status) === nextStatus || !canEditTask(task)) {
      return;
    }

    const previousTasks = tasks;
    setTasks((current) =>
      current.map((item) => (item.id === taskId ? { ...item, status: nextStatus } : item))
    );

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        setTasks(previousTasks);
        const data = await response.json().catch(() => null);
        console.error('Error moving task:', data?.message || response.statusText);
      }
    } catch (error) {
      setTasks(previousTasks);
      console.error('Error moving task:', error);
    }
  };

  const handleDuplicateTask = async (task: Task) => {
    setTaskMenu(null);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: task.project_id,
          boardId: task.board_id || selectedBoardId,
          title: `${task.title} (copy)`,
          description: task.description || '',
          assignedTo: task.assigned_to,
          quantity: task.quantity,
          estimatedHours: null,
          dueDate: task.due_date,
          status: task.status,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error('Error duplicating task:', data?.message || response.statusText);
        toast({
          variant: 'destructive',
          title: 'Không thể duplicate task',
          description: data?.message || 'Vui lòng thử lại sau.',
        });
        return;
      }

      const duplicatedTask = {
        ...task,
        ...(data?.task || {}),
        title: data?.task?.title || `${task.title} (copy)`,
        description: data?.task?.description ?? task.description,
        project: task.project,
        assignee: task.assignee,
        creator: task.creator,
      } as Task;

      setTasks((current) => {
        const sourceIndex = current.findIndex((item) => item.id === task.id);
        if (sourceIndex === -1) return [duplicatedTask, ...current];

        return [
          ...current.slice(0, sourceIndex + 1),
          duplicatedTask,
          ...current.slice(sourceIndex + 1),
        ];
      });
      markTasksAsAppearing([duplicatedTask.id]);
      toast({
        title: 'Đã duplicate task',
        description: `"${task.title}" đã được nhân bản.`,
      });
      refreshTasksQuietly();
    } catch (error) {
      console.error('Error duplicating task:', error);
      toast({
        variant: 'destructive',
        title: 'Không thể duplicate task',
        description: 'Vui lòng thử lại sau.',
      });
    }
  };

  const requestDeleteTask = (task: Task) => {
    if (!canEditTask(task)) return;
    setTaskMenu(null);
    setTaskToDelete(task);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete || !canEditTask(taskToDelete)) return;

    setDeletingTask(true);
    try {
      const response = await fetch(`/api/tasks/${taskToDelete.id}`, { method: 'DELETE' });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.error('Error deleting task:', data?.message || response.statusText);
        toast({
          variant: 'destructive',
          title: 'Không thể xoá task',
          description: data?.message || 'Vui lòng thử lại sau.',
        });
        return;
      }

      if (viewingTask?.id === taskToDelete.id) {
        setViewingTask(null);
      }
      toast({
        title: 'Đã xoá task',
        description: `"${taskToDelete.title}" đã được xoá khỏi bảng.`,
      });
      const deletedTaskId = taskToDelete.id;
      setTaskToDelete(null);
      setRemovingTaskIds((current) => Array.from(new Set([...current, deletedTaskId])));
      await wait(TASK_EXIT_ANIMATION_MS);
      setTasks((current) => current.filter((task) => task.id !== deletedTaskId));
      setRemovingTaskIds((current) => current.filter((id) => id !== deletedTaskId));
      refreshTasksQuietly();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        variant: 'destructive',
        title: 'Không thể xoá task',
        description: 'Vui lòng thử lại sau.',
      });
    } finally {
      setDeletingTask(false);
    }
  };

  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEditTask = (task: Task) => {
    if (!user) return false;
    return task.created_by === user.id;
  };

  const isOwnTask = (task: Task) => {
    if (!user) return false;
    return task.created_by === user.id;
  };

  const tasksByStatus = Object.fromEntries(
    statusColumns.map((column) => [
      column.key,
      filteredTasks.filter((task) => normalizeStatus(task.status) === column.key),
    ])
  ) as Record<(typeof statusColumns)[number]['key'], Task[]>;

  const boardRawWl = tasks.reduce((sum, task) => sum + Number(task.quantity || 0), 0);
  const boardDoneWl = tasks
    .filter((task) => ['done', 'completed', 'release'].includes(task.status))
    .reduce((sum, task) => sum + Number(task.quantity || 0), 0);
  const boardReleaseWl = tasks
    .filter((task) => task.status === 'release')
    .reduce((sum, task) => sum + Number(task.quantity || 0), 0);
  const boardMemberCount = (selectedBoard?.board_members || []).filter((member) =>
    visibleMembers.some((item) => item.id === member.user_id)
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Bảng Công Việc
          </p>
          <div ref={boardDropdownRef} className="relative mt-1 inline-block max-w-full">
            <button
              type="button"
              onClick={() => setShowBoardDropdown((current) => !current)}
              className="group flex max-w-full items-center gap-2 rounded-lg border border-transparent py-1 pr-2 text-left text-2xl font-bold text-slate-900 outline-none transition hover:border-slate-200 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <span className="truncate">{selectedBoard?.name || 'Chọn bảng tháng'}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${
                  showBoardDropdown ? 'rotate-180' : ''
                }`}
              />
            </button>
            {showBoardDropdown && (
              <div className="absolute left-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Chọn bảng tháng
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {boards.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-slate-500">Chưa có bảng tháng</p>
                  ) : (
                    boards.map((board) => {
                      const selected = board.id === selectedBoardId;

                      return (
                        <button
                          key={board.id}
                          type="button"
                          onClick={() => {
                            setSelectedBoardId(board.id);
                            setShowBoardDropdown(false);
                          }}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                            selected
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{board.name}</span>
                          {selected && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
    
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {user?.role === 'admin' && selectedBoardId && (
            <button
              type="button"
              onClick={openBoardSettings}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Settings className="h-4 w-4" />
              Cài đặt bảng
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowBoardForm(true)}
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LayoutGrid className="h-4 w-4" />
              Tạo Bảng
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedBoardId}
            className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Tạo Tác Vụ
          </button>
        </div>
      </div>

      {showBoardForm && user?.role === 'admin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Tạo Bảng Tháng</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Chọn tháng và phân quyền user được xem, log task trong bảng này.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBoardForm(false)}
                className="text-slate-400 transition-colors hover:text-slate-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateBoard} className="space-y-5 p-6">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-900">
                  Tháng của bảng <span className="text-red-500">*</span>
                </span>
                <input
                  type="month"
                  required
                  value={boardMonth}
                  onChange={(event) => setBoardMonth(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">User được xem bảng</p>
                    <p className="mt-1 text-sm text-slate-600">
                      User được chọn sẽ thấy bảng tháng này và có thể log task vào bảng.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {boardMemberIds.length} user
                  </span>
                </div>
                <BoardUserPicker
                  users={visibleMembers}
                  selectedIds={boardMemberIds}
                  onChange={setBoardMemberIds}
                  emptyText="Chưa có user member để thêm vào bảng."
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBoardForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Tạo bảng tháng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

   

      {showBoardSettings && selectedBoard && user?.role === 'admin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Cài Đặt Bảng</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedBoard.name} · Quản lý quyền xem và log task của user.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBoardSettings(false)}
                className="text-slate-400 transition-colors hover:text-slate-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSaveBoardSettings} className="space-y-5 p-6">
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                <BoardInfoStat label="User" value={`${settingsMemberIds.length}`} />
                <BoardInfoStat label="Task" value={`${tasks.length}`} />
                <BoardInfoStat label="Release WL" value={`${boardReleaseWl}`} />
              </div>

              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">User được phép truy cập</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Bỏ tick user sẽ ẩn bảng này khỏi tài khoản đó.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {settingsMemberIds.length} đang chọn
                  </span>
                </div>
                <BoardUserPicker
                  users={visibleMembers}
                  selectedIds={settingsMemberIds}
                  onChange={setSettingsMemberIds}
                  emptyText="Chưa có user member để phân quyền."
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBoardSettings(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingBoardSettings}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingBoardSettings ? 'Đang lưu...' : 'Lưu cài đặt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedBoard && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">Thông tin bảng: {selectedBoard.name}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Tạo lúc {formatDateTime(selectedBoard.created_at)} · Cập nhật {formatDateTime(selectedBoard.updated_at)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <BoardInfoStat label="User" value={`${boardMemberCount}`} />
            <BoardInfoStat label="Task" value={`${tasks.length}`} />
            <BoardInfoStat label="Raw WL" value={`${boardRawWl}`} />
            <BoardInfoStat label="Done WL" value={`${boardDoneWl}`} />
            <BoardInfoStat label="Release WL" value={`${boardReleaseWl}`} />
            <BoardInfoStat label="Block" value={`${tasksByStatus.block.length}`} />
          </div>
        </section>
      )}

      {/* Kanban Board */}
      {boardsLoaded && !selectedBoardId ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-base font-semibold text-slate-900">Chưa có bảng tháng để hiển thị</p>
          <p className="mt-2 text-sm text-slate-600">
            Admin cần tạo bảng tháng và add user vào bảng trước khi log task.
          </p>
        </div>
      ) : loading ? (
        <div className="flex gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-96 bg-slate-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="grid min-w-[2040px] grid-cols-6 gap-4">
          {statusColumns.map((column) => (
            <div
              key={column.key}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOverStatus(column.key);
              }}
              onDragLeave={() => setDragOverStatus((current) => (current === column.key ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId;
                setDragOverStatus(null);
                setDraggingTaskId(null);
                if (taskId) {
                  handleTaskDrop(taskId, column.key);
                }
              }}
              className={`bg-white rounded-lg border ${column.border} overflow-hidden transition ${
                dragOverStatus === column.key ? 'ring-2 ring-blue-300 ring-offset-2' : ''
              }`}
            >
              <div className={`p-3 border-b ${column.header}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.dot}`}></div>
                  <h2 className="font-semibold text-slate-900">{column.label}</h2>
                  <span className="ml-auto text-sm text-slate-600 bg-white px-2 py-1 rounded">
                    {tasksByStatus[column.key].length}
                  </span>
                </div>
              </div>
              <div className="h-[calc(100vh-420px)] min-h-[300px] max-h-[430px] space-y-3 overflow-y-auto p-3">
                {tasksByStatus[column.key].length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Không có tác vụ</p>
                ) : (
                  tasksByStatus[column.key].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onUpdate={refreshTasksQuietly}
                      draggable={canEditTask(task)}
                      isDragging={draggingTaskId === task.id}
                      isHighlighted={appearingTaskIds.includes(task.id)}
                      isRemoving={removingTaskIds.includes(task.id)}
                      onDragStart={(event) => {
                        if (!canEditTask(task)) return;
                        setDraggingTaskId(task.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', task.id);
                      }}
                      onDragEnd={() => {
                        setDraggingTaskId(null);
                        setDragOverStatus(null);
                      }}
                      canEdit={canEditTask(task)}
                      isOwnTask={isOwnTask(task)}
                      onOpen={() => setViewingTask(task)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setTaskMenu({
                          task,
                          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)),
                          y: Math.max(8, Math.min(event.clientY, window.innerHeight - 150)),
                        });
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {taskMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setTaskMenu(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            setTaskMenu(null);
          }}
        >
          <div
            className="fixed w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
            style={{ left: taskMenu.x, top: taskMenu.y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <ContextMenuButton
              icon={<Pencil className="h-4 w-4" />}
              label="Edit"
              disabled={!canEditTask(taskMenu.task)}
              onClick={() => {
                if (!canEditTask(taskMenu.task)) return;
                setEditingTask(taskMenu.task);
                setTaskMenu(null);
              }}
            />
            <ContextMenuButton
              icon={<Copy className="h-4 w-4" />}
              label="Duplicate"
              onClick={() => handleDuplicateTask(taskMenu.task)}
            />
            <ContextMenuButton
              icon={<Trash2 className="h-4 w-4" />}
              label="Delete"
              danger
              disabled={!canEditTask(taskMenu.task)}
              onClick={() => requestDeleteTask(taskMenu.task)}
            />
          </div>
        </div>
      )}

      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-start gap-4 border-b border-slate-200 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-950">Xoá task này?</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Task <span className="font-semibold text-slate-900">"{taskToDelete.title}"</span> sẽ bị xoá khỏi bảng công việc.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                disabled={deletingTask}
                className="text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-end gap-3 p-5">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                disabled={deletingTask}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={deletingTask}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deletingTask ? 'Đang xoá...' : 'Xoá task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingTask && (
        <TaskDetailModal
          task={viewingTask}
          canEdit={canEditTask(viewingTask)}
          onClose={() => setViewingTask(null)}
          onEdit={() => {
            setEditingTask(viewingTask);
            setViewingTask(null);
          }}
        />
      )}

      {/* Create Task Modal */}
      {(showCreateModal || editingTask) && (
        <CreateTaskModal
          projects={projects}
          boards={boards}
          selectedBoardId={selectedBoardId}
          task={editingTask}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTask(null);
            setViewingTask(null);
          }}
          onSuccess={handleTaskCreated}
        />
      )}
    </div>
  );
}

function BoardInfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function ContextMenuButton({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function BoardUserPicker({
  users,
  selectedIds,
  onChange,
  emptyText,
}: {
  users: UserOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyText: string;
}) {
  const toggleUser = (userId: string, checked: boolean) => {
    onChange(
      checked
        ? [...selectedIds, userId]
        : selectedIds.filter((id) => id !== userId)
    );
  };

  return (
    <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-2">
      {users.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {users.map((item) => {
            const selected = selectedIds.includes(item.id);
            const roleName = getUserRoleName(item);

            return (
              <label
                key={item.id}
                className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-blue-100 ${
                  selected
                    ? 'border-blue-300 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => toggleUser(item.id, event.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                    selected
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700'
                  }`}
                >
                  {getUserInitials(item)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {getUserDisplayName(item)}
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-500">
                      {roleName}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {item.email}
                  </span>
                </span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                    selected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-transparent group-hover:border-blue-300'
                  }`}
                >
                  <Check className="h-4 w-4" />
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
