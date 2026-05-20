import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { message: 'Registration is disabled. Contact an administrator.' },
    { status: 403 }
  )
}
