'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Download, Pencil, Rocket, Search } from 'lucide-react';
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

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBoardId, setSelectedBoardId] = useState('');

  useEffect(() => {
    if (authLoading) return;
    fetchData();
  }, [authLoading, user?.role, selectedBoardId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const taskParams = new URLSearchParams();
      if (selectedBoardId) taskParams.set('boardId', selectedBoardId);
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

  const stats = useMemo(() => {
    const rawWl = tasks.reduce((sum, task) => sum + Number(task.quantity || 0), 0);
    const doneTasks = tasks.filter((task) => ['done', 'completed', 'release'].includes(task.status));
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
    const headers = [
      'Task ID',
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
      const doneWl = ['done', 'completed', 'release'].includes(task.status) ? quantity : 0;
      const releaseWl = task.status === 'release' ? quantity : 0;

      return [
        task.id,
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
        <button
          onClick={exportTaskJournal}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0b4d7f] px-4 text-sm font-semibold text-white hover:bg-[#083b63]"
        >
          <Download className="h-4 w-4" />
          Export Excel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Tổng task" value={`${stats.total}`} icon={<AlertCircle className="h-4 w-4" />} />
        <StatCard label="Raw WL" value={`${stats.rawWl}`} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Done WL" value={`${stats.doneWl}`} icon={<CheckCircle className="h-4 w-4" />} />
        <StatCard label="Release WL" value={`${stats.releaseWl}`} icon={<Rocket className="h-4 w-4" />} />
        <StatCard label="In progress" value={`${stats.inProgress}`} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Pending" value={`${stats.pending}`} icon={<AlertCircle className="h-4 w-4" />} />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="border-b border-slate-200 bg-slate-50">
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
                filteredTasks.map((task) => {
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
                        {Number(task.quantity || 0)} WL
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
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
      </section>

      {editingTask && (
        <CreateTaskModal
          projects={projects}
          boards={boards}
          selectedBoardId={selectedBoardId}
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSuccess={() => {
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
