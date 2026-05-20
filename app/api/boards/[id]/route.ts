import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

async function getCurrentRole(userId: string) {
  const supabase = createAdminClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('role_id, roles(name)')
    .eq('id', userId)
    .single()

  if (error || !user) {
    console.error('Board permission lookup failed:', { userId, error })
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
    const { id } = await params
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

    const body = await request.json()
    const { memberIds, name, description } = body
    const supabase = createAdminClient()

    const update: Record<string, unknown> = {}
    if (typeof name === 'string' && name.trim()) update.name = name.trim()
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      update.description = description || null
    }

    if (Object.keys(update).length > 0) {
      const { error: updateError } = await supabase
        .from('boards')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (updateError) throw updateError
    }

    if (Array.isArray(memberIds)) {
      const uniqueMemberIds = Array.from(new Set([payload.userId, ...memberIds])).filter(Boolean)

      const { error: deleteError } = await supabase
        .from('board_members')
        .delete()
        .eq('board_id', id)

      if (deleteError) throw deleteError

      if (uniqueMemberIds.length > 0) {
        const { error: insertError } = await supabase
          .from('board_members')
          .insert(
            uniqueMemberIds.map((userId) => ({
              board_id: id,
              user_id: userId,
              role: userId === payload.userId ? 'owner' : 'member',
            }))
          )

        if (insertError) throw insertError
      }
    }

    const { data: board, error } = await supabase
      .from('boards')
      .select('id, name, description, created_by, created_at, updated_at, board_members(user_id, role)')
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json({ board })
  } catch (error) {
    console.error('Update board error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
