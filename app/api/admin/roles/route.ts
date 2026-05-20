import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

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

    const supabase = await createClient()

    const { data: roles, error } = await supabase
      .from('roles')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ roles })
  } catch (error) {
    console.error('Get roles error:', error)
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
    if (!payload || !(await checkAdminAccess(payload))) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { name, description, permissions } = await request.json()

    if (!name) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: role, error } = await supabase
      .from('roles')
      .insert([{ name, description, permissions }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ role }, { status: 201 })
  } catch (error) {
    console.error('Create role error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
