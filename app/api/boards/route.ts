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

async function getPayload(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload(request)
    if (!payload) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const currentRole = await getCurrentRole(payload.userId)
    if (!currentRole) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    let query = supabase
      .from('boards')
      .select('id, name, description, created_by, created_at, updated_at, board_members(user_id, role)')
      .order('created_at', { ascending: false })

    if (currentRole !== 'admin') {
      const { data: memberships, error: membershipError } = await supabase
        .from('board_members')
        .select('board_id')
        .eq('user_id', payload.userId)

      if (membershipError) throw membershipError

      const boardIds = (memberships || []).map((item) => item.board_id).filter(Boolean)
      if (boardIds.length === 0) {
        return NextResponse.json({ boards: [] })
      }

      query = query.in('id', boardIds)
    }

    const { data: boards, error } = await query

    if (error) throw error

    return NextResponse.json({ boards })
  } catch (error) {
    console.error('Get boards error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload(request)
    if (!payload) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const currentRole = await getCurrentRole(payload.userId)
    if (currentRole !== 'admin') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { name, description, memberIds } = await request.json()
    const boardName = String(name || '').trim()

    if (!boardName) {
      return NextResponse.json({ message: 'Board name is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let { data: board, error } = await supabase
      .from('boards')
      .select('id, name, description, created_by, created_at, updated_at')
      .eq('name', boardName)
      .maybeSingle()

    if (error) throw error

    let status = 200

    if (!board) {
      const created = await supabase
        .from('boards')
        .insert([
          {
            name: boardName,
            description,
            created_by: payload.userId,
          },
        ])
        .select()
        .single()

      if (created.error) throw created.error
      board = created.data
      status = 201
    }

    const uniqueMemberIds = Array.from(
      new Set([payload.userId, ...((Array.isArray(memberIds) ? memberIds : []) as string[])])
    ).filter(Boolean)

    if (uniqueMemberIds.length > 0) {
      const { error: memberError } = await supabase
        .from('board_members')
        .upsert(
          uniqueMemberIds.map((userId) => ({
            board_id: board.id,
            user_id: userId,
            role: userId === payload.userId ? 'owner' : 'member',
          })),
          { onConflict: 'board_id,user_id' }
        )

      if (memberError) throw memberError
    }

    return NextResponse.json({ board }, { status })
  } catch (error) {
    console.error('Create board error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
