import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const TASK_STATUSES = ['pending', 'in_progress', 'done', 'in_review', 'release', 'block']

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
    const boardId = searchParams.get('boardId')

    const supabase = createAdminClient()

    let query = supabase
      .from('tasks')
      .select(`
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
      `)
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (currentRole !== 'admin') {
      const allowedBoardIds = await getAllowedBoardIds(payload.userId)

      if (allowedBoardIds.length === 0) {
        return NextResponse.json({ tasks: [] })
      }

      if (boardId && !allowedBoardIds.includes(boardId)) {
        return NextResponse.json({ tasks: [] })
      }

      query = query.in('board_id', allowedBoardIds)
    }

    if (boardId) {
      query = query.eq('board_id', boardId)
    }

    const { data: tasks, error } = await query

    if (error) throw error

    const userIds = Array.from(
      new Set(
        (tasks || [])
          .flatMap((task) => [task.assigned_to, task.created_by])
          .filter(Boolean)
      )
    )
    const projectIds = Array.from(new Set((tasks || []).map((task) => task.project_id).filter(Boolean)))

    const [{ data: users }, { data: projects }] = await Promise.all([
      userIds.length
        ? supabase
            .from('users')
            .select('id, email, full_name, roles(name)')
            .in('id', userIds)
        : Promise.resolve({ data: [] }),
      projectIds.length
        ? supabase.from('projects').select('id, name').in('id', projectIds)
        : Promise.resolve({ data: [] }),
    ])

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

    const supabase = createAdminClient()

    if (currentRole !== 'admin') {
      const allowedBoardIds = await getAllowedBoardIds(payload.userId)
      if (!allowedBoardIds.includes(boardId)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert([
        {
          project_id: projectId,
          board_id: boardId || null,
          title,
          description,
          assigned_to: currentRole === 'admin' ? assignedTo || payload.userId : payload.userId,
          status: status || 'pending',
          task_type: taskType,
          quantity,
          estimated_hours: estimatedHours,
          due_date: dueDate,
          created_by: payload.userId,
        },
      ])
      .select()
      .single()

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
