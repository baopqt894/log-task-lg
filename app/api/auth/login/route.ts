import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateToken, setAuthCookie, comparePassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get user from database. Retry without KPI for installs that have not run
    // the latest SQL migration yet.
    let { data: users, error: queryError } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, role_id, is_active, monthly_wl_kpi')
      .eq('email', email)
      .single()

    if (queryError?.code === '42703') {
      const fallback = await supabase
        .from('users')
        .select('id, email, full_name, role_id, is_active, monthly_wl_kpi')
        .eq('email', email)
        .single()

      users = fallback.data ? { ...fallback.data, avatar_url: null } : null
      queryError = fallback.error

      if (queryError?.code === '42703') {
        const legacyFallback = await supabase
          .from('users')
          .select('id, email, full_name, role_id, is_active')
          .eq('email', email)
          .single()

        users = legacyFallback.data
          ? { ...legacyFallback.data, avatar_url: null, monthly_wl_kpi: 0 }
          : null
        queryError = legacyFallback.error
      }
    }

    if (queryError || !users) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (!users.is_active) {
      return NextResponse.json(
        { message: 'Account is inactive' },
        { status: 401 }
      )
    }

    // For MVP: Using Supabase Auth to verify password
    // Get the auth user
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Get user role
    const { data: role } = await supabase
      .from('roles')
      .select('name')
      .eq('id', users.role_id)
      .single()

    // Generate JWT token
    const token = await generateToken({
      userId: users.id,
      email: users.email,
      role: role?.name || 'member',
    })

    // Set auth cookie
    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: users.id,
        email: users.email,
        fullName: users.full_name,
        avatarUrl: users.avatar_url || null,
        role: role?.name || 'member',
        monthlyWlKpi: Number(users.monthly_wl_kpi || 0),
      },
    })

    // Set HttpOnly cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
