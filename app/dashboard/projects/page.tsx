'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Grid3X3,
  List,
  Loader2,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
  description: string;
  status?: ProjectStatus | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
  project_members?: Array<{ user_id: string; role: string }>;
}

type ProjectStatus = 'running' | 'paused' | 'completed';

const projectStatusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'running', label: 'Đang chạy' },
  { value: 'paused', label: 'Tạm dừng' },
  { value: 'completed', label: 'Hoàn thành' },
];

const PROJECTS_PER_PAGE = 9;

const statusConfig = {
  running: {
    label: 'Đang chạy',
    dot: 'bg-sky-600',
    badge: 'bg-sky-100 text-sky-800',
  },
  paused: {
    label: 'Tạm dừng',
    dot: 'bg-slate-500',
    badge: 'bg-slate-100 text-slate-700',
  },
  completed: {
    label: 'Hoàn thành',
    dot: 'bg-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800',
  },
};

function getDerivedProject(project: Project) {
  const status = projectStatusOptions.some((option) => option.value === project.status)
    ? project.status as ProjectStatus
    : 'running';
  const date = new Date(project.created_at);

  return {
    ...project,
    status,
    dueLabel: date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' }),
    members: ['#0f5c8e', '#c78f68', '#6ea883'].slice(
      0,
      Math.max(2, project.project_members?.length || 2)
    ),
  };
}

export default function ProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ProjectStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'running' as ProjectStatus,
  });

  useEffect(() => {
    if (authLoading) return;

    if (user?.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }

    fetchProjects();
  }, [authLoading, user?.role, router]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (!response.ok) {
        toast({
          title: 'Không tải được dự án',
          description: data?.message || 'Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Không tải được dự án',
        description: 'Có lỗi khi kết nối server.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingProject(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json().catch(() => null);

      if (response.ok) {
        fetchProjects();
        setCurrentPage(1);
        setShowCreateForm(false);
        setFormData({ name: '', description: '', status: 'running' });
        toast({
          title: 'Đã tạo dự án',
          description: formData.name,
        });
        return;
      }

      toast({
        title: 'Không tạo được dự án',
        description: data?.message || 'Vui lòng kiểm tra lại thông tin.',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Không tạo được dự án',
        description: 'Có lỗi khi kết nối server.',
        variant: 'destructive',
      });
    } finally {
      setCreatingProject(false);
    }
  };

  const handleStatusChange = async (projectId: string, status: ProjectStatus) => {
    const previousProjects = projects;
    const projectName = projects.find((project) => project.id === projectId)?.name || 'Dự án';
    setUpdatingProjectId(projectId);
    setProjects((current) =>
      current.map((project) => (project.id === projectId ? { ...project, status } : project))
    );

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setProjects(previousProjects);
        console.error('Error updating project status:', data?.message || response.statusText);
        toast({
          title: 'Không cập nhật được trạng thái',
          description: data?.message || 'Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }

      if (data?.project) {
        setProjects((current) =>
          current.map((project) => (project.id === data.project.id ? data.project : project))
        );
      }
      toast({
        title: 'Đã cập nhật trạng thái',
        description: projectName,
      });
    } catch (error) {
      setProjects(previousProjects);
      console.error('Error updating project status:', error);
      toast({
        title: 'Không cập nhật được trạng thái',
        description: 'Có lỗi khi kết nối server.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingProjectId(null);
    }
  };

  const displayProjects = useMemo(() => {
    const source = projects.map(getDerivedProject);
    return filter === 'all' ? source : source.filter((project) => project.status === filter);
  }, [filter, projects]);
  const totalPages = Math.max(1, Math.ceil(displayProjects.length / PROJECTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProjects = useMemo(() => {
    const start = (safeCurrentPage - 1) * PROJECTS_PER_PAGE;
    return displayProjects.slice(start, start + PROJECTS_PER_PAGE);
  }, [safeCurrentPage, displayProjects]);
  const pageNumbers = useMemo(() => {
    const maxVisiblePages = 5;
    const startPage = Math.max(
      1,
      Math.min(safeCurrentPage - Math.floor(maxVisiblePages / 2), totalPages - maxVisiblePages + 1)
    );
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  }, [safeCurrentPage, totalPages]);
  const pageStart = displayProjects.length === 0 ? 0 : (safeCurrentPage - 1) * PROJECTS_PER_PAGE + 1;
  const pageEnd = Math.min(safeCurrentPage * PROJECTS_PER_PAGE, displayProjects.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  if (authLoading || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-6xl font-bold tracking-normal text-[#083b63]">Dự Án</h1>
          <p className="mt-2 text-lg text-slate-600">
            Quản lý và theo dõi tiến độ các dự án hiện tại.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <SlidersHorizontal className="w-4 h-4" />
            Bộ lọc
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex h-11 items-center gap-2 rounded-lg bg-[#063b63] px-5 text-sm font-semibold text-white hover:bg-[#052f4f]"
          >
            <Plus className="w-4 h-4" />
            Tạo Dự Án Mới
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">Tên Dự Án</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">Mô Tả</label>
                <input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">Trạng Thái</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as ProjectStatus })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {projectStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                disabled={creatingProject}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={creatingProject}
                className="inline-flex items-center gap-2 rounded-lg bg-[#063b63] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingProject && <Loader2 className="h-4 w-4 animate-spin" />}
                {creatingProject ? 'Đang tạo...' : 'Tạo'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div className="flex items-center gap-2">
          {[
            ['all', 'Tất cả'],
            ['running', 'Đang chạy'],
            ['paused', 'Tạm dừng'],
            ['completed', 'Hoàn thành'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value as 'all' | ProjectStatus)}
              className={`h-9 rounded-full px-5 text-sm font-medium transition-colors ${
                filter === value
                  ? 'bg-[#0b4d7f] text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <button className="grid h-10 w-10 place-items-center rounded-md bg-slate-50 text-[#0b4d7f]">
            <Grid3X3 className="w-5 h-5" />
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-md text-slate-600">
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-[300px] rounded-lg bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : displayProjects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-base font-semibold text-slate-900">Chưa có dự án</p>
          <p className="mt-2 text-sm text-slate-600">
            Tạo dự án mới để bắt đầu log task theo dự án.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {paginatedProjects.map((project) => {
              const config = statusConfig[project.status];
              return (
                <article
                  key={project.id}
                  className="min-h-[260px] rounded-lg border border-slate-300 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <label
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold ${config.badge}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                      <span className="relative inline-flex items-center">
                        <select
                          aria-label={`Trạng thái dự án ${project.name}`}
                          value={project.status}
                          disabled={updatingProjectId === project.id}
                          onChange={(event) =>
                            handleStatusChange(project.id, event.target.value as ProjectStatus)
                          }
                          className="cursor-pointer appearance-none bg-transparent pr-6 font-semibold outline-none disabled:cursor-wait disabled:opacity-70"
                        >
                          {projectStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4" />
                      </span>
                      {updatingProjectId === project.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </label>
                  </div>

                  <h2 className="mt-7 line-clamp-2 text-xl font-bold text-slate-950">
                    {project.name}
                  </h2>
                  <p className="mt-3 line-clamp-2 min-h-12 text-base leading-6 text-slate-600">
                    {project.description}
                  </p>

                  <div className="mt-10 border-t border-slate-100 pt-5 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {project.members.map((color, index) => (
                        <div
                          key={`${project.id}-${color}-${index}`}
                          className="h-8 w-8 rounded-full border-2 border-white"
                          style={{
                            background: `radial-gradient(circle at 35% 30%, #fff 0 8%, ${color} 9% 100%)`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      {project.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Calendar className="w-4 h-4" />
                      )}
                      {project.dueLabel}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {displayProjects.length > PROJECTS_PER_PAGE && (
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Hiển thị {pageStart}-{pageEnd} / {displayProjects.length} dự án
              </p>
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
