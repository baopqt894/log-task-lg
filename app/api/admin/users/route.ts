import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
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

function createAuthSignupClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function createAuthAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Unknown error'
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || !(await checkAdminAccess(payload))) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()

    let { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        monthly_wl_kpi,
        is_active,
        created_at,
        role_id,
        roles(name)
      `)
      .order('created_at', { ascending: false })

    if (error?.code === '42703') {
      const fallback = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          is_active,
          created_at,
          role_id,
          roles(name)
        `)
        .order('created_at', { ascending: false })

      users = (fallback.data || []).map((user: any) => ({
        ...user,
        monthly_wl_kpi: 0,
      }))
      error = fallback.error
    }

    if (error) throw error

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      console.warn('Admin create user rejected', {
        requestId,
        reason: 'missing auth-token',
      })
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || !(await checkAdminAccess(payload))) {
      console.warn('Admin create user rejected', {
        requestId,
        reason: 'forbidden',
        userId: payload?.userId,
      })
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { email, fullName, password, roleId, isActive, monthlyWlKpi } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!normalizedEmail || !fullName || !password || !roleId) {
      console.warn('Admin create user validation failed', {
        requestId,
        email: normalizedEmail || null,
        hasFullName: Boolean(fullName),
        hasPassword: Boolean(password),
        hasRoleId: Boolean(roleId),
      })
      return NextResponse.json(
        {
          message: 'Missing required fields',
          requestId,
        },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      console.warn('Admin create user validation failed', {
        requestId,
        email: normalizedEmail,
        reason: 'password too short',
      })
      return NextResponse.json(
        { message: 'Password must be at least 8 characters', requestId },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const adminAuthClient = createAuthAdminClient()
    const signupClient = adminAuthClient ? null : createAuthSignupClient()

    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, name')
      .eq('id', roleId)
      .single()

    if (roleError || !role) {
      console.error('Admin create user role lookup failed', {
        requestId,
        email: normalizedEmail,
        roleId,
        error: roleError,
      })
      return NextResponse.json(
        {
          message: 'Selected role does not exist',
          requestId,
          details: roleError?.message,
        },
        { status: 400 }
      )
    }

    let authUser

    if (adminAuthClient) {
      const { data: adminCreateData, error: adminCreateError } =
        await adminAuthClient.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
          },
        })

      if (adminCreateError || !adminCreateData.user) {
        console.error('Admin create user Supabase Auth admin createUser failed', {
          requestId,
          email: normalizedEmail,
          status: adminCreateError?.status,
          code: adminCreateError?.code,
          message: adminCreateError?.message,
        })

        return NextResponse.json(
          {
            message: adminCreateError?.message || 'Failed to create auth user',
            requestId,
            details: adminCreateError?.message,
          },
          { status: 400 }
        )
      }

      authUser = adminCreateData.user
    } else {
      const { data: signupData, error: signupError } = await signupClient!.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      authUser = signupData.user

      if (signupError || !authUser) {
        console.error('Admin create user Supabase Auth signUp failed', {
        requestId,
        email: normalizedEmail,
        status: signupError?.status,
        code: signupError?.code,
        message: signupError?.message,
        })

        const alreadyRegistered =
          signupError?.message?.toLowerCase().includes('already') ||
          signupError?.code === 'user_already_exists'

        if (alreadyRegistered) {
          const { data: signInData, error: signInError } =
          await signupClient!.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })

          if (signInError || !signInData.user) {
            console.error('Admin create user existing Auth user lookup failed', {
            requestId,
            email: normalizedEmail,
            status: signInError?.status,
            code: signInError?.code,
            message: signInError?.message,
            })

            return NextResponse.json(
              {
                message:
                  'Email already exists in Supabase Auth, but the provided password is not valid for that account.',
                requestId,
                details: signInError?.message,
              },
              { status: 400 }
            )
          }

          authUser = signInData.user
        } else {
          const message = signupError?.message || 'Failed to create auth user'
          const signupDisabled = message.toLowerCase().includes('signup')
          const emailRateLimited =
            signupError?.code === 'over_email_send_rate_limit' ||
            message.toLowerCase().includes('rate limit')

          return NextResponse.json(
            {
              message: emailRateLimited
                ? 'Supabase Auth email rate limit exceeded. Add SUPABASE_SERVICE_ROLE_KEY to .env so the app can create users without sending confirmation email, or wait for the rate limit to reset.'
                : signupDisabled
                  ? 'Supabase Auth signup is disabled. Enable signup in Supabase Auth settings or create the user manually in Authentication > Users.'
                  : message,
              requestId,
              details: signupError?.message,
            },
            { status: 400 }
          )
        }
      }
    }

    const { data: user, error } = await supabase
      .from('users')
      .upsert([
        {
          id: authUser.id,
          email: normalizedEmail,
          full_name: fullName,
          role_id: roleId,
          monthly_wl_kpi: Number(monthlyWlKpi || 0),
          is_active: isActive ?? true,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Admin create user public profile upsert failed', {
        requestId,
        email: normalizedEmail,
        authUserId: authUser.id,
        roleId,
        error,
      })
      return NextResponse.json(
        {
          message: error.message,
          requestId,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
        { status: 400 }
      )
    }

    console.log('Admin user created or linked', {
      requestId,
      email: normalizedEmail,
      userId: user.id,
      role: role.name,
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('Create user error:', {
      requestId,
      message: getErrorMessage(error),
      error,
    })
    return NextResponse.json(
      {
        message: getErrorMessage(error),
        requestId,
      },
      { status: 500 }
    )
  }
}
