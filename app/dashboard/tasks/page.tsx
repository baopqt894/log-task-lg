'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Pencil,
  Plus,
  Rocket,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { CreateTaskModal } from '@/components/create-task-modal';
import { downloadXlsxFile } from '@/lib/export-xlsx';

type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'in_review'
  | 'release'
  | 'block'
  | 'not_started'
  | 'completed';

type FilterStatus = 'pending' | 'in_progress' | 'done' | 'in_review' | 'release' | 'block';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  project_id?: string | null;
  board_id?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  status: TaskStatus;
  task_type?: string | null;
  quantity?: number | null;
  due_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  project?: ProjectOption | null;
  assignee?: UserOption | null;
  creator?: UserOption | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  email: string;
  full_name?: string | null;
  roles?: { name: string } | Array<{ name: string }> | null;
}

interface BoardOption {
  id: string;
  name: string;
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
  pending: 'bg-slate-100 text-slate-600 dark:bg-[#2c333a] dark:text-[#b6c2cf]',
  not_started: 'bg-slate-100 text-slate-600 dark:bg-[#2c333a] dark:text-[#b6c2cf]',
  in_progress: 'bg-[#e9f2ff] text-[#0c66e4] dark:bg-[#1c2b41] dark:text-[#579dff]',
  done: 'bg-[#dcfff1] text-[#1f845a] dark:bg-[#1c3329] dark:text-[#4bce97]',
  completed: 'bg-[#dcfff1] text-[#1f845a] dark:bg-[#1c3329] dark:text-[#4bce97]',
  in_review: 'bg-[#f3f0ff] text-[#6e5dc6] dark:bg-[#2b244d] dark:text-[#9f8fef]',
  release: 'bg-[#fff7d6] text-[#946f00] dark:bg-[#3b2d13] dark:text-[#f5cd47]',
  block: 'bg-[#ffeceb] text-[#ae2e24] dark:bg-[#42221f] dark:text-[#f87168]',
};

const statusFilterOptions: Array<{ value: FilterStatus; label: string }> = [
  { value: 'pending', label: 'pending' },
  { value: 'in_progress', label: 'in progress' },
  { value: 'done', label: 'done' },
  { value: 'in_review', label: 'in review' },
  { value: 'release', label: 'release' },
  { value: 'block', label: 'block' },
];

const DEFAULT_TASKS_PER_PAGE = 10;
const TASKS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
const MIN_TASKS_PER_PAGE = 1;
const MAX_TASKS_PER_PAGE = 200;

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('vi-VN');
}

function getTaskOwnerId(task: Task) {
  return task.assigned_to || task.created_by || '';
}

function getTaskOwner(task: Task) {
  return task.assignee || task.creator || null;
}

function getRoleName(user?: UserOption) {
  if (!user) return 'member';
  const role = Array.isArray(user.roles) ? user.roles[0] : user.roles;
  return role?.name || 'member';
}

function formatWl(value: number) {
  return Number(value || 0).toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
  });
}

function isDoneStatus(status: TaskStatus) {
  return ['done', 'completed', 'in_review', 'release'].includes(status);
}

function normalizeTasksPerPage(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_TASKS_PER_PAGE;

  return Math.min(MAX_TASKS_PER_PAGE, Math.max(MIN_TASKS_PER_PAGE, Math.floor(value)));
}

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<FilterStatus[]>([]);
  const [projectFilterSearch, setProjectFilterSearch] = useState('');
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [tasksPerPage, setTasksPerPage] = useState(DEFAULT_TASKS_PER_PAGE);
  const [tasksPerPageInput, setTasksPerPageInput] = useState(String(DEFAULT_TASKS_PER_PAGE));
  const [tasksPerPageDropdownOpen, setTasksPerPageDropdownOpen] = useState(false);
  const selectedProjectParam = selectedProjectIds.join(',');
  const selectedStatusParam = selectedStatuses.join(',');

  useEffect(() => {
    if (authLoading) return;
    fetchData();
  }, [authLoading, user?.role, selectedBoardId, selectedProjectParam, selectedStatusParam]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const taskParams = new URLSearchParams();
      if (selectedBoardId) taskParams.set('boardId', selectedBoardId);
      if (selectedProjectParam) taskParams.set('projectIds', selectedProjectParam);
      if (selectedStatusParam) taskParams.set('statuses', selectedStatusParam);
      if (user?.role !== 'admin') taskParams.set('scope', 'mine');
      const requests = [
        fetch(`/api/tasks${taskParams.toString() ? `?${taskParams}` : ''}`),
        fetch('/api/projects?options=1'),
        fetch('/api/boards'),
      ];
      if (user?.role === 'admin') {
        requests.push(fetch('/api/admin/users'));
      }

      const [tasksResponse, projectsResponse, boardsResponse, usersResponse] = await Promise.all(requests);
      const tasksData = await tasksResponse.json();
      const projectsData = await projectsResponse.json();
      const boardsData = await boardsResponse.json();
      const usersData = usersResponse ? await usersResponse.json() : { users: [] };

      setTasks(tasksData.tasks || []);
      setProjects(projectsData.projects || []);
      setBoards(boardsData.boards || []);
      setUsers(usersData.users || []);
    } catch (error) {
      console.error('Error fetching task journal:', error);
    } finally {
      setLoading(false);
    }
  };

  const canEditTask = (task: Task) => task.created_by === user?.id;

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  );
  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedProjectIds.includes(project.id)),
    [projects, selectedProjectIds]
  );
  const sortedProjectOptions = useMemo(
    () =>
      [...projects].sort((a, b) =>
        a.name.localeCompare(b.name, 'vi', {
          numeric: true,
          sensitivity: 'base',
        })
      ),
    [projects]
  );

  useEffect(() => {
    if (!projectFilterOpen) {
      setProjectFilterSearch('');
    }
  }, [projectFilterOpen]);

  const normalizedProjectFilterSearch = normalizeSearchValue(projectFilterSearch);
  const filteredProjectOptions = useMemo(() => {
    if (!normalizedProjectFilterSearch) {
      return sortedProjectOptions;
    }

    return sortedProjectOptions.filter((project) =>
      normalizeSearchValue(project.name).includes(normalizedProjectFilterSearch)
    );
  }, [normalizedProjectFilterSearch, sortedProjectOptions]);

  const toggleProjectFilter = (projectId: string) => {
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId]
    );
  };

  const toggleStatusFilter = (status: FilterStatus) => {
    setSelectedStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]
    );
  };

  const userMap = useMemo(
    () => new Map(users.map((item) => [item.id, item.full_name || item.email])),
    [users]
  );

  const userDetailMap = useMemo(
    () => new Map(users.map((item) => [item.id, item])),
    [users]
  );

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const source = [...tasks].sort((a, b) => {
      const aTime = new Date(a.due_date || a.created_at || 0).getTime();
      const bTime = new Date(b.due_date || b.created_at || 0).getTime();
      return bTime - aTime;
    });

    if (!query) return source;

    return source.filter((task) => {
      const owner = getTaskOwner(task);
      const projectName = task.project?.name || (task.project_id ? projectMap.get(task.project_id) || '' : '');
      const memberName =
        owner?.full_name ||
        owner?.email ||
        userMap.get(getTaskOwnerId(task)) ||
        user?.fullName ||
        '';
      return [task.title, task.description || '', projectName, memberName]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [projectMap, searchTerm, tasks, user?.fullName, userMap]);
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / tasksPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTasks = useMemo(() => {
    const start = (safeCurrentPage - 1) * tasksPerPage;
    return filteredTasks.slice(start, start + tasksPerPage);
  }, [filteredTasks, safeCurrentPage, tasksPerPage]);
  const pageNumbers = useMemo(() => {
    const maxVisiblePages = 5;
    const startPage = Math.max(
      1,
      Math.min(safeCurrentPage - Math.floor(maxVisiblePages / 2), totalPages - maxVisiblePages + 1)
    );
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  }, [safeCurrentPage, totalPages]);
  const pageStart = filteredTasks.length === 0 ? 0 : (safeCurrentPage - 1) * tasksPerPage + 1;
  const pageEnd = Math.min(safeCurrentPage * tasksPerPage, filteredTasks.length);
  const shouldScrollTable = tasksPerPage > DEFAULT_TASKS_PER_PAGE;
  const customTasksPerPage = tasksPerPageInput.trim()
    ? normalizeTasksPerPage(Number(tasksPerPageInput))
    : null;
  const showCustomTasksPerPage =
    customTasksPerPage != null && !TASKS_PER_PAGE_OPTIONS.includes(customTasksPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBoardId, selectedProjectParam, selectedStatusParam]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const updateTasksPerPage = (value: string | number) => {
    const next = normalizeTasksPerPage(Number(value));

    setTasksPerPage(next);
    setTasksPerPageInput(String(next));
    setCurrentPage(1);
  };

  const commitTasksPerPageInput = () => {
    if (!tasksPerPageInput.trim()) {
      setTasksPerPageInput(String(tasksPerPage));
      return;
    }

    updateTasksPerPage(tasksPerPageInput);
  };

  const stats = useMemo(() => {
    const rawWl = tasks.reduce((sum, task) => sum + Number(task.quantity || 0), 0);
    const doneTasks = tasks.filter((task) => isDoneStatus(task.status));
    const releaseTasks = tasks.filter((task) => task.status === 'release');

    return {
      total: tasks.length,
      rawWl,
      doneWl: doneTasks.reduce((sum, task) => sum + Number(task.quantity || 0), 0),
      releaseWl: releaseTasks.reduce((sum, task) => sum + Number(task.quantity || 0), 0),
      inProgress: tasks.filter((task) => task.status === 'in_progress').length,
      pending: tasks.filter((task) => task.status === 'pending' || task.status === 'not_started').length,
    };
  }, [tasks]);

  const exportTaskJournal = () => {
    if (!user) return;

    const headers = [
      'Task ID',
      'Task',
      'Task Date',
      'Member',
      'Role',
      'Project',
      'Work Type',
      'Quantity',
      'Unit WL',
      'Raw WL',
      'Task Status',
      'Done WL',
      'Release WL',
      'KPI Result',
      'Evidence Link',
      'Notes',
      'Created At',
      'Updated At',
    ];

    const rows = filteredTasks.map((task) => {
      const ownerId = getTaskOwnerId(task);
      const owner = userDetailMap.get(ownerId) || getTaskOwner(task) || undefined;
      const ownerName = owner?.full_name || owner?.email || (ownerId === user.id ? user.fullName : '-');
      const status = statusLabels[task.status] || task.status;
      const quantity = Number(task.quantity || 0);
      const doneWl = isDoneStatus(task.status) ? quantity : 0;
      const releaseWl = task.status === 'release' ? quantity : 0;

      return [
        task.id,
        task.title,
        formatDate(task.due_date || task.created_at),
        ownerName,
        getRoleName(owner) || (ownerId === user.id ? user.role : 'member'),
        task.project?.name || (task.project_id ? projectMap.get(task.project_id) || '' : ''),
        task.task_type || '',
        quantity,
        'WL',
        quantity,
        status,
        doneWl,
        releaseWl,
        releaseWl > 0 ? 'Counted' : 'Not counted',
        '',
        task.description || '',
        task.created_at ? new Date(task.created_at).toLocaleString('vi-VN') : '',
        task.updated_at ? new Date(task.updated_at).toLocaleString('vi-VN') : '',
      ];
    });

    downloadXlsxFile('task-journal.xlsx', headers, rows, 'Task Journal');
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Nhật Ký Tác Vụ</h1>
        <p className="mt-1 text-slate-600">
          {user.role === 'admin'
            ? 'Xem toàn bộ task của tất cả user.'
            : 'Xem nhật ký task của riêng bạn.'}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Tìm theo task, dự án, thành viên..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <select
            value={selectedBoardId}
            onChange={(event) => setSelectedBoardId(event.target.value)}
            className="h-11 min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Tất cả bảng</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
          <div className="relative min-w-[220px] lg:w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={projectFilterSearch}
              onFocus={() => setProjectFilterOpen(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  setProjectFilterOpen(false);
                  setProjectFilterSearch('');
                }, 120);
              }}
              onChange={(event) => {
                setProjectFilterSearch(event.target.value);
                setProjectFilterOpen(true);
              }}
              placeholder={selectedProjectIds.length > 0 ? 'Tìm thêm dự án' : 'Tìm dự án'}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {projectFilterSearch && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm dự án"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setProjectFilterSearch('')}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {projectFilterOpen && (
              <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSelectedProjectIds([]);
                    setProjectFilterSearch('');
                    setProjectFilterOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="line-clamp-1">Tất cả dự án</span>
                  {selectedProjectIds.length === 0 && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                </button>
                {filteredProjectOptions.length > 0 ? (
                  filteredProjectOptions.map((project) => {
                    const selected = selectedProjectIds.includes(project.id);

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          toggleProjectFilter(project.id);
                          setProjectFilterSearch('');
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="line-clamp-1">{project.name}</span>
                        {selected && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-3 text-sm text-slate-500">Không tìm thấy dự án</div>
                )}
              </div>
            )}
          </div>
          <div
            className="relative min-w-[190px]"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setStatusFilterOpen(false);
              }
            }}
          >
            <button
              type="button"
              onClick={() => setStatusFilterOpen((open) => !open)}
              className="inline-flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <span>{selectedStatuses.length > 0 ? `${selectedStatuses.length} trạng thái` : 'Tất cả trạng thái'}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {statusFilterOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSelectedStatuses([]);
                    setStatusFilterOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>Tất cả trạng thái</span>
                  {selectedStatuses.length === 0 && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                </button>
                {statusFilterOptions.map((status) => {
                  const selected = selectedStatuses.includes(status.value);

                  return (
                    <button
                      key={status.value}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => toggleStatusFilter(status.value)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                      <span>{status.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={boards.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Tạo Task
          </button>
          <button
            onClick={exportTaskJournal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0b4d7f] px-4 text-sm font-semibold text-white hover:bg-[#083b63]"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>

        {selectedProjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {selectedProjects.map((project) => (
              <span
                key={project.id}
                className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-blue-700 bg-blue-600 pl-3 pr-1 text-xs font-semibold text-white shadow-sm"
              >
                <span className="max-w-[220px] truncate">{project.name}</span>
                <button
                  type="button"
                  aria-label={`Bỏ chọn dự án ${project.name}`}
                  onClick={() => setSelectedProjectIds((current) => current.filter((id) => id !== project.id))}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white/85 hover:bg-white/20 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Tổng task" value={`${stats.total}`} icon={<AlertCircle className="h-4 w-4" />} />
        <StatCard label="Raw WL" value={formatWl(stats.rawWl)} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Done WL" value={formatWl(stats.doneWl)} icon={<CheckCircle className="h-4 w-4" />} />
        <StatCard label="Release WL" value={formatWl(stats.releaseWl)} icon={<Rocket className="h-4 w-4" />} />
        <StatCard label="In progress" value={`${stats.inProgress}`} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Pending" value={`${stats.pending}`} icon={<AlertCircle className="h-4 w-4" />} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className={`overflow-x-auto rounded-t-lg ${shouldScrollTable ? 'max-h-[640px] overflow-y-auto' : ''}`}>
          <table className="w-full min-w-[960px]">
            <thead
              className={`border-b border-slate-200 bg-slate-50 ${
                shouldScrollTable ? 'sticky top-0 z-10 shadow-[0_1px_0_rgba(148,163,184,0.25)]' : ''
              }`}
            >
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Ngày</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Task</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Dự án</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Thành viên</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">WL</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Trạng thái</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Cập nhật</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-600">Sửa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    Không có task phù hợp
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task) => {
                  const ownerId = getTaskOwnerId(task);
                  const owner = getTaskOwner(task);
                  const ownerName =
                    owner?.full_name ||
                    owner?.email ||
                    userMap.get(ownerId) ||
                    (ownerId === user.id ? user.fullName : '-') ||
                    '-';
                  return (
                    <tr key={task.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                        {formatDate(task.due_date || task.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950">{task.title}</p>
                        {task.description && (
                          <p className="mt-1 line-clamp-1 text-sm text-slate-500">{task.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {task.project?.name || (task.project_id ? projectMap.get(task.project_id) || '-' : '-')}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">{ownerName}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-950">
                        {formatWl(Number(task.quantity || 0))} WL
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                            statusClasses[task.status] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {statusLabels[task.status] || task.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                        {formatDate(task.updated_at || task.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        {canEditTask(task) ? (
                          <button
                            onClick={() => setEditingTask(task)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Sửa
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">Chỉ xem</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredTasks.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Hiển thị {pageStart}-{pageEnd} / {filteredTasks.length} tác vụ
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Dòng/trang</span>
                <div className="relative w-36">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label="Số dòng mỗi trang"
                    value={tasksPerPageInput}
                    onFocus={(event) => {
                      setTasksPerPageInput(String(tasksPerPage));
                      setTasksPerPageDropdownOpen(true);
                      event.currentTarget.select();
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setTasksPerPageDropdownOpen(false);
                        commitTasksPerPageInput();
                      }, 120);
                    }}
                    onChange={(event) => {
                      setTasksPerPageInput(event.target.value.replace(/\D/g, ''));
                      setTasksPerPageDropdownOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitTasksPerPageInput();
                        setTasksPerPageDropdownOpen(false);
                        event.currentTarget.blur();
                      }
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  {tasksPerPageDropdownOpen && (
                    <div className="absolute bottom-full z-20 mb-2 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {TASKS_PER_PAGE_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            updateTasksPerPage(option);
                            setTasksPerPageDropdownOpen(false);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <span>{option}</span>
                          {tasksPerPage === option && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                        </button>
                      ))}
                      {showCustomTasksPerPage && customTasksPerPage != null && (
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            updateTasksPerPage(customTasksPerPage);
                            setTasksPerPageDropdownOpen(false);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <span>Dùng {customTasksPerPage}</span>
                          {tasksPerPage === customTasksPerPage && (
                            <Check className="h-4 w-4 shrink-0 text-blue-600" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Trước
                  </button>
                  {pageNumbers.map((page) => (
                    <button
                      key={page}
                      type="button"
                      aria-current={safeCurrentPage === page ? 'page' : undefined}
                      onClick={() => setCurrentPage(page)}
                      className={`h-10 min-w-10 rounded-lg px-3 text-sm font-semibold ${
                        safeCurrentPage === page
                          ? 'bg-[#0b4d7f] text-white'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sau
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {(showCreateModal || editingTask) && (
        <CreateTaskModal
          projects={projects}
          boards={boards}
          selectedBoardId={selectedBoardId}
          task={editingTask}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTask(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingTask(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-950">{value}</div>
    </div>
  );
}
