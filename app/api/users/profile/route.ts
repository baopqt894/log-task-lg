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

    const { full_name, fullName } = await request.json()
    const nextFullName = String(full_name ?? fullName ?? '').trim()

    if (!nextFullName) {
      return NextResponse.json({ message: 'Full name is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: user, error } = await supabase
      .from('users')
      .update({
        full_name: nextFullName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.userId)
      .select('id, email, full_name')
      .single()

    if (error) {
      console.error('Update profile failed:', error)
      return NextResponse.json({ message: error.message }, { status: 400 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
