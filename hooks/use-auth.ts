'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface User {
  id: string
  email: string
  fullName: string
  avatarUrl?: string | null
  role: string
  monthlyWlKpi: number
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refreshUser = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)

    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser(true)
  }, [refreshUser])

  useEffect(() => {
    const handleUserUpdated = (event: Event) => {
      const nextUser = (event as CustomEvent<{ user?: Partial<User> }>).detail?.user

      if (nextUser) {
        setUser((current) => (current ? { ...current, ...nextUser } : current))
      }

      refreshUser()
    }

    window.addEventListener('auth:user-updated', handleUserUpdated)
    return () => window.removeEventListener('auth:user-updated', handleUserUpdated)
  }, [refreshUser])

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return { user, loading, logout, refreshUser }
}
