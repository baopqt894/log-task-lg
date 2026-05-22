import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown> | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ message: 'Invalid profile payload' }, { status: 400 })
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if ('full_name' in body || 'fullName' in body) {
      const nextFullName = String(body.full_name ?? body.fullName ?? '').trim()

      if (!nextFullName) {
        return NextResponse.json({ message: 'Full name is required' }, { status: 400 })
      }

      update.full_name = nextFullName
    }

    if ('avatar_url' in body || 'avatarUrl' in body) {
      const nextAvatarUrl = body.avatar_url ?? body.avatarUrl ?? null

      if (nextAvatarUrl) {
        try {
          new URL(String(nextAvatarUrl))
        } catch {
          return NextResponse.json({ message: 'Avatar URL is invalid' }, { status: 400 })
        }
      }

      update.avatar_url = nextAvatarUrl ? String(nextAvatarUrl) : null
    }

    if (Object.keys(update).length === 1) {
      return NextResponse.json({ message: 'No profile fields to update' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let { data: user, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', payload.userId)
      .select('id, email, full_name, avatar_url')
      .single()

    if (error?.code === '42703' && !('avatar_url' in update)) {
      const fallback = await supabase
        .from('users')
        .update(update)
        .eq('id', payload.userId)
        .select('id, email, full_name')
        .single()

      user = fallback.data ? { ...fallback.data, avatar_url: null } : null
      error = fallback.error
    }

    if (error) {
      console.error('Update profile failed:', error)
      return NextResponse.json({ message: error.message }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url || null,
      },
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
