'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Download, Rocket, Target, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { downloadXlsxFile } from '@/lib/export-xlsx';

interface Task {
  id: string;
  status: string;
  approval_status?: string | null;
  quantity?: number | null;
  estimated_hours?: number | null;
  project_id?: string;
  assigned_to?: string | null;
  created_by?: string | null;
  due_date?: string | null;
  created_at?: string;
}

interface ReportUser {
  id: string;
  full_name?: string | null;
  email: string;
  monthly_wl_kpi?: number | null;
  is_active?: boolean;
  roles?: { name: string } | Array<{ name: string }> | null;
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<ReportUser[]>([]);

  useEffect(() => {
    if (authLoading) return;
    fetchData();
  }, [authLoading, user?.role]);

  const fetchData = async () => {
    try {
      if (user?.role !== 'admin') {
        const tasksResponse = await fetch('/api/tasks?scope=mine');
        const tasksData = await tasksResponse.json();
        setTasks(tasksData.tasks || []);
        return;
      }

      const [tasksResponse, usersResponse] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/admin/users'),
      ]);
      const tasksData = await tasksResponse.json();
      const usersData = await usersResponse.json();

      setTasks(tasksData.tasks || []);
      setUsers(usersData.users || []);
    } catch (error) {
      console.error('Error fetching report data:', error);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  if (user.role !== 'admin') {
    return <MemberKpiReport tasks={tasks} target={Number(user.monthlyWlKpi || 0)} />;
  }

  return <AdminKpiReport tasks={tasks} users={users} />;
}

function getRoleName(user: ReportUser) {
  const role = Array.isArray(user.roles) ? user.roles[0] : user.roles;
  return role?.name || 'member';
}

function getTaskOwnerId(task: Task) {
  return task.assigned_to || task.created_by || '';
}

function getMonthlyTasks(tasks: Task[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return tasks.filter((task) => {
    const date = new Date(task.due_date || task.created_at || '');
    return date >= monthStart && date < nextMonthStart;
  });
}

function sumWl(tasks: Task[]) {
  return tasks.reduce((sum, task) => sum + Number(task.quantity || 0), 0);
}

function isDoneStatus(status: string) {
  return ['done', 'completed', 'in_review', 'release'].includes(status);
}

function isTaskApproved(task: Task) {
  return task.approval_status === 'approved';
}

function formatWl(value: number) {
  return Number(value || 0).toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
  });
}

function getKpiPercent(value: number, target: number) {
  return target > 0 ? Math.round((value / target) * 100) : 0;
}

function getProgressWidth(percent: number) {
  return `${Math.min(percent, 100)}%`;
}

function getKpiTrend(percent: number, label: string) {
  return percent > 100 ? `Vượt ${percent - 100}% ${label}` : `${percent}% ${label}`;
}

function AdminKpiReport({ tasks, users }: { tasks: Task[]; users: ReportUser[] }) {
  const monthlyTasks = getMonthlyTasks(tasks);
  const memberUsers = users.filter((item) => getRoleName(item) !== 'admin' && item.is_active !== false);
  const memberIds = new Set(memberUsers.map((item) => item.id));
  const trackedTasks = monthlyTasks.filter((task) => memberIds.has(getTaskOwnerId(task)));
  const approvedTrackedTasks = trackedTasks.filter(isTaskApproved);
  const totalTarget = memberUsers.reduce((sum, item) => sum + Number(item.monthly_wl_kpi || 0), 0);
  const rawWl = sumWl(trackedTasks);
  const doneWl = sumWl(
    approvedTrackedTasks.filter((task) => isDoneStatus(task.status))
  );
  const releaseWl = sumWl(approvedTrackedTasks.filter((task) => task.status === 'release'));
  const progress = getKpiPercent(releaseWl, totalTarget);
  const monthLabel = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  const userRows = memberUsers
    .map((item) => {
      const userTasks = monthlyTasks.filter((task) => getTaskOwnerId(task) === item.id);
      const approvedUserTasks = userTasks.filter(isTaskApproved);
      const userDoneWl = sumWl(
        approvedUserTasks.filter((task) => isDoneStatus(task.status))
      );
      const userReleaseWl = sumWl(approvedUserTasks.filter((task) => task.status === 'release'));
      const target = Number(item.monthly_wl_kpi || 0);

      return {
        id: item.id,
        name: item.full_name || item.email,
        rawWl: sumWl(userTasks),
        doneWl: userDoneWl,
        releaseWl: userReleaseWl,
        target,
        progress: getKpiPercent(userReleaseWl, target),
      };
    })
    .sort((a, b) => b.doneWl - a.doneWl);

  const topUser = userRows[0];
  const exportKpiReport = () => {
    downloadXlsxFile(
      'kpi-report.xlsx',
      ['Member', 'KPI Target WL', 'Raw WL', 'Done WL', 'Release WL', 'Remaining WL', 'Progress %'],
      userRows.map((row) => [
        row.name,
        row.target,
        row.rawWl,
        row.doneWl,
        row.releaseWl,
        Math.max(row.target - row.releaseWl, 0),
        row.progress,
      ]),
      'KPI Report'
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl font-bold tracking-normal text-slate-950">Báo Cáo KPI Tổng</h1>
        <p className="mt-2 text-lg text-slate-600">
          Tổng WL của user trong {monthLabel}; chỉ task đã approved mới được tính KPI.
        </p>
        <button
          onClick={exportKpiReport}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[#0b4d7f] px-4 text-sm font-semibold text-white hover:bg-[#083b63]"
        >
          <Download className="h-4 w-4" />
          Export Excel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <MetricCard
          title="KPI Tổng"
          value={formatWl(totalTarget)}
          unit="WL"
          trend={`${memberUsers.length} user đang active`}
          icon={<Target className="w-6 h-6 text-[#0b4d7f]" />}
          iconClass="bg-blue-100"
        />
        <MetricCard
          title="Raw WL"
          value={formatWl(rawWl)}
          unit="WL"
          trend="Tổng WL đã log"
          icon={<CalendarDays className="w-6 h-6 text-slate-600" />}
          iconClass="bg-slate-100"
        />
        <MetricCard
          title="Done WL"
          value={formatWl(doneWl)}
          unit="WL"
          trend="Chỉ tính task đã approved"
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />}
          iconClass="bg-emerald-100"
        />
        <MetricCard
          title="Release WL"
          value={formatWl(releaseWl)}
          unit="WL"
          trend={getKpiTrend(progress, 'KPI tổng')}
          icon={<Rocket className="w-6 h-6 text-purple-700" />}
          iconClass="bg-purple-100"
        />
      </div>

      <section className="rounded-lg border border-slate-300 bg-white p-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-950">Tiến độ KPI tổng</h2>
          <span className="text-sm font-semibold text-slate-500">
            {releaseWl > totalTarget && totalTarget > 0
              ? `Vượt ${formatWl(releaseWl - totalTarget)} WL`
              : `Còn cần ${formatWl(Math.max(totalTarget - releaseWl, 0))} WL`}
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-[#0b4d7f]'}`}
            style={{ width: getProgressWidth(progress) }}
          />
        </div>
        <div className="mt-4 flex justify-between text-sm text-slate-600">
          <span>{formatWl(releaseWl)} WL release đã approved</span>
          <span>{formatWl(totalTarget)} WL mục tiêu</span>
        </div>
      </section>

      <section className="rounded-lg border border-slate-300 bg-white p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-950">User hoàn thành nhiều nhất</h2>
          <Users className="h-5 w-5 text-slate-500" />
        </div>
        {topUser ? (
          <div className="mb-6 rounded-lg bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-500">Top hiện tại</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-bold text-slate-950">{topUser.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatWl(topUser.doneWl)} done WL đã approved, trong đó {formatWl(topUser.releaseWl)} release WL
                </p>
              </div>
              <span className="text-3xl font-bold text-[#0b4d7f]">{topUser.progress}%</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Chưa có dữ liệu user.</p>
        )}

        <div className="space-y-3">
          {userRows.map((row) => (
            <div key={row.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[1fr_120px_120px_120px] md:items-center">
              <div>
                <p className="font-semibold text-slate-950">{row.name}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#0b4d7f]" style={{ width: getProgressWidth(row.progress) }} />
                </div>
              </div>
              <div className="text-sm text-slate-600">
                Raw: <span className="font-semibold text-slate-950">{formatWl(row.rawWl)}</span>
              </div>
              <div className="text-sm text-slate-600">
                Done: <span className="font-semibold text-slate-950">{formatWl(row.doneWl)}</span>
              </div>
              <div className="text-sm text-slate-600">
                KPI: <span className="font-semibold text-slate-950">{formatWl(row.releaseWl)}/{formatWl(row.target)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MemberKpiReport({ tasks, target }: { tasks: Task[]; target: number }) {
  const now = new Date();
  const monthlyTasks = getMonthlyTasks(tasks);

  const rawWl = sumWl(monthlyTasks);
  const approvedMonthlyTasks = monthlyTasks.filter(isTaskApproved);
  const doneWl = sumWl(
    approvedMonthlyTasks.filter((task) => isDoneStatus(task.status))
  );
  const releaseWl = sumWl(approvedMonthlyTasks.filter((task) => task.status === 'release'));

  const remaining = Math.max(target - releaseWl, 0);
  const progress = getKpiPercent(releaseWl, target);
  const monthLabel = now.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl font-bold tracking-normal text-slate-950">Báo Cáo KPI</h1>
        <p className="mt-2 text-lg text-slate-600">
          Chỉ task đã được admin approved mới được tính KPI trong {monthLabel}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <MetricCard
          title="KPI WL Tháng"
          value={formatWl(target)}
          unit="WL"
          trend={target > 0 ? 'Chỉ tiêu được admin thiết lập' : 'Chưa được thiết lập KPI'}
          icon={<Target className="w-6 h-6 text-[#0b4d7f]" />}
          iconClass="bg-blue-100"
        />
        <MetricCard
          title="Raw WL"
          value={formatWl(rawWl)}
          unit="WL"
          trend="Tổng WL đã log trong tháng"
          icon={<CalendarDays className="w-6 h-6 text-slate-600" />}
          iconClass="bg-slate-100"
        />
        <MetricCard
          title="Done WL"
          value={formatWl(doneWl)}
          unit="WL"
          trend="Chỉ tính task đã approved"
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />}
          iconClass="bg-emerald-100"
        />
        <MetricCard
          title="Release WL"
          value={formatWl(releaseWl)}
          unit="WL"
          trend={getKpiTrend(progress, 'KPI tháng')}
          icon={<Rocket className="w-6 h-6 text-purple-700" />}
          iconClass="bg-purple-100"
        />
      </div>

      <section className="rounded-lg border border-slate-300 bg-white p-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-950">Tiến độ KPI tháng</h2>
          <span className="text-sm font-semibold text-slate-500">
            {releaseWl > target && target > 0
              ? `Vượt ${formatWl(releaseWl - target)} WL`
              : `Còn cần ${formatWl(remaining)} WL`}
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-[#0b4d7f]'}`}
            style={{ width: getProgressWidth(progress) }}
          />
        </div>
        <div className="mt-4 flex justify-between text-sm text-slate-600">
          <span>{formatWl(releaseWl)} WL release đã approved</span>
          <span>{formatWl(target)} WL mục tiêu</span>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  unit,
  trend,
  icon,
  iconClass,
}: {
  title: string;
  value: string;
  unit: string;
  trend: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <section className="rounded-lg border border-slate-300 bg-white p-8">
      <div className="flex items-start justify-between">
        <div className="pt-5">
          <p className="font-semibold text-slate-600">{title}</p>
          <div className="mt-8 flex items-end gap-2">
            <span className="text-3xl font-bold text-slate-950">{value}</span>
            {unit && <span className="pb-1 text-base text-slate-700">{unit}</span>}
          </div>
          <p className="mt-5 flex items-center gap-1 text-sm font-medium text-emerald-600">
            <TrendingUp className="w-4 h-4" />
            {trend}
          </p>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-full ${iconClass}`}>{icon}</div>
      </div>
    </section>
  );
}
