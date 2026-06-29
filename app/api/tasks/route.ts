import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const TASK_STATUSES = ['pending', 'in_progress', 'done', 'in_review', 'release', 'block']
const TASK_FILTER_STATUSES = new Set(TASK_STATUSES)
const STATUS_FILTER_VALUES: Record<string, string[]> = {
  pending: ['pending', 'not_started'],
  in_progress: ['in_progress'],
  done: ['done', 'completed'],
  in_review: ['in_review'],
  release: ['release'],
  block: ['block'],
}
const TASK_SELECT_COLUMNS = `
  id,
  board_id,
  title,
  description,
  project_id,
  assigned_to,
  status,
  approval_status,
  task_type,
  quantity,
  estimated_hours,
  due_date,
  created_by,
  created_at,
  updated_at
`
const LEGACY_TASK_SELECT_COLUMNS = `
  id,
  board_id,
  title,
  description,
  project_id,
  assigned_to,
  status,
  task_type,
  quantity,
  estimated_hours,
  due_date,
  created_by,
  created_at,
  updated_at
`

function parseListParam(value: string | null) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

async function getCurrentRole(userId: string) {
  const supabase = createAdminClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('role_id, roles(name)')
    .eq('id', userId)
    .single()

  if (error || !user) {
    console.error('Task permission lookup failed:', { userId, error })
    return null
  }

  const role = Array.isArray(user.roles) ? user.roles[0] : user.roles
  return role?.name || 'member'
}

async function getAllowedBoardIds(userId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('board_members')
    .select('board_id')
    .eq('user_id', userId)

  if (error) throw error
  return (data || []).map((item) => item.board_id).filter(Boolean)
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
    }

    const currentRole = await getCurrentRole(payload.userId)
    if (!currentRole) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const projectIds = parseListParam(searchParams.get('projectIds'))
    const boardId = searchParams.get('boardId')
    const scope = searchParams.get('scope')
    const statusIds = parseListParam(searchParams.get('statuses')).filter((status) =>
      TASK_FILTER_STATUSES.has(status)
    )

    const supabase = createAdminClient()
    let allowedBoardIds: string[] = []

    if (currentRole !== 'admin') {
      allowedBoardIds = await getAllowedBoardIds(payload.userId)

      if (allowedBoardIds.length === 0) {
        return NextResponse.json({ tasks: [] })
      }

      if (boardId && !allowedBoardIds.includes(boardId)) {
        return NextResponse.json({ tasks: [] })
      }
    }

    const selectTasks = async (selectColumns: string) => {
      let query = supabase
        .from('tasks')
        .select(selectColumns)
        .order('created_at', { ascending: false })

      if (projectIds.length > 0) {
        query = query.in('project_id', projectIds)
      } else if (projectId) {
        query = query.eq('project_id', projectId)
      }

      if (statusIds.length > 0) {
        const statusFilterValues = Array.from(
          new Set(statusIds.flatMap((status) => STATUS_FILTER_VALUES[status] || [status]))
        )
        query = query.in('status', statusFilterValues)
      }

      if (currentRole !== 'admin') {
        query = query.in('board_id', allowedBoardIds)

        if (scope === 'mine') {
          query = query.or(`assigned_to.eq.${payload.userId},created_by.eq.${payload.userId}`)
        }
      }

      if (boardId) {
        query = query.eq('board_id', boardId)
      }

      return query
    }

    let { data: tasks, error } = await selectTasks(TASK_SELECT_COLUMNS)

    if (error?.code === '42703' && String(error.message || '').includes('approval_status')) {
      const fallback = await selectTasks(LEGACY_TASK_SELECT_COLUMNS)
      tasks = (fallback.data || []).map((task) => ({
        ...task,
        approval_status: 'pending',
      }))
      error = fallback.error
    }

    if (error) throw error

    const userIds = Array.from(
      new Set(
        (tasks || [])
          .flatMap((task) => [task.assigned_to, task.created_by])
          .filter(Boolean)
      )
    )
    const taskProjectIds = Array.from(new Set((tasks || []).map((task) => task.project_id).filter(Boolean)))

    const [usersResult, { data: projects }] = await Promise.all([
      userIds.length
        ? supabase
            .from('users')
            .select('id, email, full_name, avatar_url, roles(name)')
            .in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      taskProjectIds.length
        ? supabase.from('projects').select('id, name').in('id', taskProjectIds)
        : Promise.resolve({ data: [] }),
    ])

    let users = usersResult.data || []
    let usersError = usersResult.error

    if (usersError?.code === '42703' && userIds.length) {
      const fallback = await supabase
        .from('users')
        .select('id, email, full_name, roles(name)')
        .in('id', userIds)

      users = (fallback.data || []).map((user: any) => ({
        ...user,
        avatar_url: null,
      }))
      usersError = fallback.error
    }

    if (usersError) throw usersError

    const userMap = new Map((users || []).map((item: any) => [item.id, item]))
    const projectMap = new Map((projects || []).map((item: any) => [item.id, item]))
    const enrichedTasks = (tasks || []).map((task) => ({
      ...task,
      assignee: task.assigned_to ? userMap.get(task.assigned_to) || null : null,
      creator: task.created_by ? userMap.get(task.created_by) || null : null,
      project: task.project_id ? projectMap.get(task.project_id) || null : null,
    }))

    return NextResponse.json({ tasks: enrichedTasks })
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
    }

    const currentRole = await getCurrentRole(payload.userId)
    if (!currentRole) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const {
      projectId,
      boardId,
      title,
      description,
      assignedTo,
      taskType,
      quantity,
      estimatedHours,
      dueDate,
      status,
    } = await request.json()

    if (!projectId || !boardId || !title) {
      return NextResponse.json({ message: 'Board ID, Project ID and title are required' }, { status: 400 })
    }

    if (status && !TASK_STATUSES.includes(status)) {
      return NextResponse.json({ message: 'Invalid task status' }, { status: 400 })
    }

    const normalizedQuantity =
      quantity === null || quantity === undefined || quantity === '' ? null : Number(quantity)

    if (normalizedQuantity !== null && !Number.isFinite(normalizedQuantity)) {
      return NextResponse.json({ message: 'Quantity must be a valid number' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (currentRole !== 'admin') {
      const allowedBoardIds = await getAllowedBoardIds(payload.userId)
      if (!allowedBoardIds.includes(boardId)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }
    }

    const insertPayload = {
      project_id: projectId,
      board_id: boardId || null,
      title,
      description,
      assigned_to: currentRole === 'admin' ? assignedTo || payload.userId : payload.userId,
      status: status || 'pending',
      approval_status: 'pending',
      task_type: taskType,
      quantity: normalizedQuantity,
      estimated_hours: estimatedHours,
      due_date: dueDate,
      created_by: payload.userId,
    }

    let { data: task, error } = await supabase
      .from('tasks')
      .insert([insertPayload])
      .select()
      .single()

    if (error?.code === '42703' && String(error.message || '').includes('approval_status')) {
      const { approval_status, ...legacyInsertPayload } = insertPayload
      const fallback = await supabase
        .from('tasks')
        .insert([legacyInsertPayload])
        .select()
        .single()

      task = fallback.data
        ? {
            ...fallback.data,
            approval_status: 'pending',
          }
        : fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('Create task insert failed:', error)
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
