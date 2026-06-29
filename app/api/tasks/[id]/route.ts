import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const TASK_STATUSES = ['pending', 'in_progress', 'done', 'in_review', 'release', 'block']
const TASK_APPROVAL_STATUSES = ['pending', 'approved', 'rejected']
const APPROVAL_FIELD_KEYS = new Set([
  'approvalStatus',
  'approval_status',
])

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
    let { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('project_id, board_id, created_by, assigned_to, approval_status')
      .eq('id', id)
      .single()

    if (taskError?.code === '42703' && String(taskError.message || '').includes('approval_status')) {
      const fallback = await supabase
        .from('tasks')
        .select('project_id, board_id, created_by, assigned_to')
        .eq('id', id)
        .single()

      task = fallback.data
        ? {
            ...fallback.data,
            approval_status: 'pending',
          }
        : fallback.data
      taskError = fallback.error
    }

    if (taskError || !task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 })
    }

    const isCreator = task.created_by === payload.userId
    const bodyKeys = Object.keys(body)
    const hasApprovalUpdate =
      'approvalStatus' in body ||
      'approval_status' in body
    const hasNonApprovalUpdate = bodyKeys.some((key) => !APPROVAL_FIELD_KEYS.has(key))

    if (hasApprovalUpdate && currentRole !== 'admin') {
      return NextResponse.json({ message: 'Only admins can update task approval' }, { status: 403 })
    }

    if (!isCreator && (currentRole !== 'admin' || hasNonApprovalUpdate)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const update: Record<string, unknown> = {}
    let hasTaskContentUpdate = false

    if ('status' in body) {
      if (!TASK_STATUSES.includes(body.status)) {
        return NextResponse.json({ message: 'Invalid task status' }, { status: 400 })
      }
      update.status = body.status
      hasTaskContentUpdate = true
    }

    if ('title' in body) {
      update.title = body.title
      hasTaskContentUpdate = true
    }
    if ('description' in body) {
      update.description = body.description
      hasTaskContentUpdate = true
    }
    if ('project_id' in body) {
      update.project_id = body.project_id
      hasTaskContentUpdate = true
    }
    if ('projectId' in body) {
      update.project_id = body.projectId
      hasTaskContentUpdate = true
    }
    if ('board_id' in body) {
      update.board_id = body.board_id || null
      hasTaskContentUpdate = true
    }
    if ('boardId' in body) {
      update.board_id = body.boardId || null
      hasTaskContentUpdate = true
    }
    if ('task_type' in body) {
      update.task_type = body.task_type
      hasTaskContentUpdate = true
    }
    if ('taskType' in body) {
      update.task_type = body.taskType
      hasTaskContentUpdate = true
    }
    if ('quantity' in body) {
      const nextQuantity =
        body.quantity === null || body.quantity === undefined || body.quantity === ''
          ? null
          : Number(body.quantity)

      if (nextQuantity !== null && !Number.isFinite(nextQuantity)) {
        return NextResponse.json({ message: 'Quantity must be a valid number' }, { status: 400 })
      }

      update.quantity = nextQuantity
      hasTaskContentUpdate = true
    }
    if ('estimated_hours' in body) {
      update.estimated_hours = body.estimated_hours === null ? null : Number(body.estimated_hours || 0)
      hasTaskContentUpdate = true
    }
    if ('estimatedHours' in body) {
      update.estimated_hours = body.estimatedHours === null ? null : Number(body.estimatedHours || 0)
      hasTaskContentUpdate = true
    }
    if ('due_date' in body) {
      update.due_date = body.due_date
      hasTaskContentUpdate = true
    }
    if ('dueDate' in body) {
      update.due_date = body.dueDate
      hasTaskContentUpdate = true
    }

    if ('approvalStatus' in body || 'approval_status' in body) {
      const nextApprovalStatus = body.approvalStatus ?? body.approval_status

      if (!TASK_APPROVAL_STATUSES.includes(nextApprovalStatus)) {
        return NextResponse.json({ message: 'Invalid task approval status' }, { status: 400 })
      }

      update.approval_status = nextApprovalStatus
    }

    if (hasTaskContentUpdate && currentRole !== 'admin') {
      update.approval_status = 'pending'
    }

    const nextBoardId = String(update.board_id || task.board_id || '')
    if (nextBoardId && currentRole !== 'admin' && !(await isBoardMember(payload.userId, nextBoardId))) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 })
    }

    let { data: updatedTask, error } = await supabase
      .from('tasks')
      .update({
        ...update,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error?.code === '42703' && String(error.message || '').includes('approval_status')) {
      if (hasApprovalUpdate && !hasTaskContentUpdate) {
        return NextResponse.json(
          {
            message:
              'Database chưa có cột approval_status. Hãy chạy migration add_task_approval_status trước khi approve/reject task.',
          },
          { status: 400 }
        )
      }

      const { approval_status, ...legacyUpdate } = update
      const fallback = await supabase
        .from('tasks')
        .update({
          ...legacyUpdate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      updatedTask = fallback.data
        ? {
            ...fallback.data,
            approval_status: 'pending',
          }
        : fallback.data
      error = fallback.error
    }

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
