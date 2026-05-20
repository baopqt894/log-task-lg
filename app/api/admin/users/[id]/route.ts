import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkAdminAccess(payload: any) {
  const supabase = await createClient()
  const { data: user } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', payload.userId)
    .single()

  if (!user) return false

  const { data: role } = await supabase
    .from('roles')
    .select('name')
    .eq('id', user.role_id)
    .single()

  return role?.name === 'admin'
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
    if (!payload || !(await checkAdminAccess(payload))) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = createAdminClient()
    const update: Record<string, unknown> = {}

    if ('full_name' in body) update.full_name = body.full_name
    if ('role_id' in body) update.role_id = body.role_id
    if ('is_active' in body) update.is_active = Boolean(body.is_active)
    if ('monthly_wl_kpi' in body) update.monthly_wl_kpi = Number(body.monthly_wl_kpi || 0)

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 })
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Update user error:', error)
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
    if (!payload || !(await checkAdminAccess(payload))) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase.from('users').delete().eq('id', id)

    if (error) throw error

    return NextResponse.json({ message: 'User deleted' })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
