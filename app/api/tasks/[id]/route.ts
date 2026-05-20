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

async function isBoardMember(userId: string, boardId?: string | null) {
  if (!boardId) return false

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('board_members')
    .select('id')
    .eq('user_id', userId)
    .eq('board_id', boardId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const supabase = createAdminClient()
    const currentRole = await getCurrentRole(payload.userId)

    if (!currentRole) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    // Verify user has access to this task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('project_id, board_id, created_by, assigned_to')
      .eq('id', id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 })
    }

    const isCreator = task.created_by === payload.userId

    if (!isCreator) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const update: Record<string, unknown> = {}

    if ('status' in body) {
      if (!TASK_STATUSES.includes(body.status)) {
        return NextResponse.json({ message: 'Invalid task status' }, { status: 400 })
      }
      update.status = body.status
    }

    if ('title' in body) update.title = body.title
    if ('description' in body) update.description = body.description
    if ('project_id' in body) update.project_id = body.project_id
    if ('projectId' in body) update.project_id = body.projectId
    if ('board_id' in body) update.board_id = body.board_id || null
    if ('boardId' in body) update.board_id = body.boardId || null
    if ('task_type' in body) update.task_type = body.task_type
    if ('taskType' in body) update.task_type = body.taskType
    if ('quantity' in body) {
      const nextQuantity =
        body.quantity === null || body.quantity === undefined || body.quantity === ''
          ? null
          : Number(body.quantity)

      if (nextQuantity !== null && !Number.isFinite(nextQuantity)) {
        return NextResponse.json({ message: 'Quantity must be a valid number' }, { status: 400 })
      }

      update.quantity = nextQuantity
    }
    if ('estimated_hours' in body) {
      update.estimated_hours = body.estimated_hours === null ? null : Number(body.estimated_hours || 0)
    }
    if ('estimatedHours' in body) {
      update.estimated_hours = body.estimatedHours === null ? null : Number(body.estimatedHours || 0)
    }
    if ('due_date' in body) update.due_date = body.due_date
    if ('dueDate' in body) update.due_date = body.dueDate

    const nextBoardId = String(update.board_id || task.board_id || '')
    if (nextBoardId && currentRole !== 'admin' && !(await isBoardMember(payload.userId, nextBoardId))) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update({
        ...update,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ task: updatedTask })
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const currentRole = await getCurrentRole(payload.userId)

    if (!currentRole) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    // Verify access
    const { data: task } = await supabase
      .from('tasks')
      .select('project_id, board_id, created_by')
      .eq('id', id)
      .single()

    if (!task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 })
    }

    if (currentRole !== 'admin' && task.created_by !== payload.userId) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) throw error

    return NextResponse.json({ message: 'Task deleted' })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
