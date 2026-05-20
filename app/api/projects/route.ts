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

    const optionsOnly = request.nextUrl.searchParams.get('options') === '1'
    const supabase = createAdminClient()

    if (currentRole !== 'admin' && !optionsOnly) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const createQuery = (includeStatus: boolean) => {
      let query = supabase
        .from('projects')
        .select(
          optionsOnly
            ? 'id, name'
            : `
              id,
              name,
              description,
              ${includeStatus ? 'status,' : ''}
              created_by,
              created_at,
              updated_at,
              project_members(user_id, role)
            `
        )
        .order('created_at', { ascending: false })

      if (currentRole !== 'admin' && !optionsOnly) {
        query = query.eq('created_by', payload.userId)
      }

      return query
    }

    let { data: projects, error } = await createQuery(true)

    if (error && !optionsOnly && isMissingProjectStatusColumn(error)) {
      const fallback = await createQuery(false)
      projects = fallback.data?.map((project) => ({ ...project, status: 'running' })) || null
      error = fallback.error
    }

    if (error) throw error

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Get projects error:', error)
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
    if (currentRole !== 'admin') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { name, description, status } = await request.json()

    if (!name) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 })
    }

    if (status && !PROJECT_STATUSES.includes(status)) {
      return NextResponse.json({ message: 'Invalid project status' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Create project
    const createPayload = {
      name,
      description,
      status: status || 'running',
      created_by: payload.userId,
    }

    let { data: project, error } = await supabase
      .from('projects')
      .insert([createPayload])
      .select()
      .single()

    if (error && isMissingProjectStatusColumn(error)) {
      const fallbackPayload = {
        name,
        description,
        created_by: payload.userId,
      }
      const fallback = await supabase
        .from('projects')
        .insert([fallbackPayload])
        .select()
        .single()

      project = fallback.data ? { ...fallback.data, status: 'running' } : null
      error = fallback.error
    }

    if (error) {
      console.error('Create project insert failed:', error)
      return NextResponse.json(getErrorPayload(error), { status: 400 })
    }

    // Add creator as owner
    const { error: memberError } = await supabase.from('project_members').insert([
      {
        project_id: project.id,
        user_id: payload.userId,
        role: 'owner',
      },
    ])

    if (memberError) {
      console.error('Create project member insert failed:', memberError)
      return NextResponse.json(getErrorPayload(memberError), { status: 400 })
    }

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json(getErrorPayload(error), { status: 500 })
  }
}
