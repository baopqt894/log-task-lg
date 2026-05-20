import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const PROJECT_STATUSES = ['running', 'paused', 'completed']

function isMissingProjectStatusColumn(error: unknown) {
  if (typeof error !== 'object' || !error) return false

  const code = 'code' in error ? String((error as { code: unknown }).code) : ''
  const message = 'message' in error ? String((error as { message: unknown }).message) : ''

  return code === 'PGRST204' && message.includes("'status' column") && message.includes("'projects'")
}

function getErrorPayload(error: unknown) {
  if (typeof error === 'object' && error && 'message' in error) {
    return {
      message: String((error as { message: unknown }).message),
      code: 'code' in error ? String((error as { code: unknown }).code) : undefined,
      details: 'details' in error ? (error as { details: unknown }).details : undefined,
      hint: 'hint' in error ? (error as { hint: unknown }).hint : undefined,
    }
  }

  return { message: error instanceof Error ? error.message : 'Internal server error' }
}

async function getCurrentRole(userId: string) {
  const supabase = createAdminClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('role_id, roles(name)')
    .eq('id', userId)
    .single()

  if (error || !user) {
    console.error('Project permission lookup failed:', { userId, error })
    return null
  }

  const role = Array.isArray(user.roles) ? user.roles[0] : user.roles
  return role?.name || 'member'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (currentRole !== 'admin') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const update: Record<string, unknown> = {}

    if ('name' in body) update.name = body.name
    if ('description' in body) update.description = body.description
    if ('status' in body) {
      if (!PROJECT_STATUSES.includes(body.status)) {
        return NextResponse.json({ message: 'Invalid project status' }, { status: 400 })
      }
      update.status = body.status
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 })
    }

    update.updated_at = new Date().toISOString()

    const supabase = createAdminClient()
    const selectProject = (includeStatus: boolean) => `
      id,
      name,
      description,
      ${includeStatus ? 'status,' : ''}
      created_by,
      created_at,
      updated_at,
      project_members(user_id, role)
    `

    let { data: project, error } = await supabase
      .from('projects')
      .update(update)
      .eq('id', id)
      .select(selectProject(true))
      .single()

    if (error && isMissingProjectStatusColumn(error)) {
      if ('status' in update) {
        const fallbackUpdate = { ...update }
        delete fallbackUpdate.status

        if (Object.keys(fallbackUpdate).length === 1 && 'updated_at' in fallbackUpdate) {
          return NextResponse.json(
            {
              message:
                'Database chưa có cột projects.status. Hãy chạy SQL migration rồi thử lại.',
              code: 'MISSING_PROJECT_STATUS_COLUMN',
            },
            { status: 409 }
          )
        }

        const fallback = await supabase
          .from('projects')
          .update(fallbackUpdate)
          .eq('id', id)
          .select(selectProject(false))
          .single()

        project = fallback.data ? { ...fallback.data, status: 'running' } : null
        error = fallback.error
      } else {
        const fallback = await supabase
          .from('projects')
          .update(update)
          .eq('id', id)
          .select(selectProject(false))
          .single()

        project = fallback.data ? { ...fallback.data, status: 'running' } : null
        error = fallback.error
      }
    }

    if (error) {
      console.error('Update project failed:', { id, update, error })
      return NextResponse.json(getErrorPayload(error), { status: 400 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Update project error:', error)
    return NextResponse.json(getErrorPayload(error), { status: 500 })
  }
}
