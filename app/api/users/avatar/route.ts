import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const UPLOAD_ENDPOINT = 'https://upload-services.limgrow.com/upload'
const UPLOAD_API_KEY =
  process.env.LIMGROW_UPLOAD_API_KEY || 'ab8db77d-b9ee-4996-a890-02cfa8b7407c'
const MAX_AVATAR_SIZE_BYTES = 8 * 1024 * 1024

function findUploadUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    return /^https?:\/\//i.test(value) ? value : null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findUploadUrl(item)
      if (url) return url
    }
    return null
  }

  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const preferredKeys = [
    'url',
    'link',
    'fileUrl',
    'file_url',
    'imageUrl',
    'image_url',
    'publicUrl',
    'public_url',
    'secure_url',
    'location',
  ]

  for (const key of preferredKeys) {
    const url = findUploadUrl(record[key])
    if (url) return url
  }

  for (const item of Object.values(record)) {
    const url = findUploadUrl(item)
    if (url) return url
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Image file is required' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ message: 'Only image files are allowed' }, { status: 400 })
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json({ message: 'Avatar image must be 8MB or smaller' }, { status: 400 })
    }

    const uploadFormData = new FormData()
    uploadFormData.append('file', file, file.name || 'avatar.png')
    uploadFormData.append('type', 'image')

    const uploadResponse = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'x-api-key': UPLOAD_API_KEY,
      },
      body: uploadFormData,
    })

    const responseText = await uploadResponse.text()
    let uploadData: unknown = responseText

    try {
      uploadData = responseText ? JSON.parse(responseText) : null
    } catch {
      uploadData = responseText
    }

    if (!uploadResponse.ok) {
      console.error('Avatar upload failed:', {
        status: uploadResponse.status,
        response: uploadData,
      })
      return NextResponse.json(
        { message: 'Could not upload avatar image' },
        { status: uploadResponse.status || 502 }
      )
    }

    const avatarUrl = findUploadUrl(uploadData)

    if (!avatarUrl) {
      console.error('Avatar upload response did not include a URL:', uploadData)
      return NextResponse.json(
        { message: 'Upload response did not include an image URL' },
        { status: 502 }
      )
    }

    const supabase = createAdminClient()
    const { data: user, error } = await supabase
      .from('users')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.userId)
      .select('id, email, full_name, avatar_url')
      .single()

    if (error) {
      console.error('Save avatar URL failed:', error)
      return NextResponse.json(
        {
          message:
            error.code === '42703'
              ? 'Missing avatar_url column. Run the latest Supabase migration first.'
              : error.message,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      avatarUrl,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
      },
    })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
