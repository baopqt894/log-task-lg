import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify token
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Get user details. Keep a fallback so old databases can still login before
    // the KPI migration is applied.
    let { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role_id, monthly_wl_kpi')
      .eq('id', payload.userId)
      .single()

    if (error?.code === '42703') {
      const fallback = await supabase
        .from('users')
        .select('id, email, full_name, role_id')
        .eq('id', payload.userId)
        .single()

      user = fallback.data ? { ...fallback.data, monthly_wl_kpi: 0 } : null
      error = fallback.error
    }

    if (error || !user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Get role name
    const { data: role } = await supabase
      .from('roles')
      .select('name')
      .eq('id', user.role_id)
      .single()

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: role?.name || 'member',
        monthlyWlKpi: Number(user.monthly_wl_kpi || 0),
      },
    })
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
