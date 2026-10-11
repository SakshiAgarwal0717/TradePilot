import * as React from 'react'
import { apiRequest, setAuthToken } from '@/lib/api'

export interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)

  // Hydrate user on mount / page refresh
  React.useEffect(() => {
    let isMounted = true

    async function checkAuth() {
      try {
        const currentUser = await apiRequest<User>('/auth/me')
        if (isMounted) {
          setUser(currentUser)
        }
      } catch (err) {
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    checkAuth()

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ access_token?: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (data.access_token) {
      setAuthToken(data.access_token)
    }
    setUser(data.user)
  }

  const register = async (email: string, username: string, password: string) => {
    const data = await apiRequest<{ access_token?: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    })
    if (data.access_token) {
      setAuthToken(data.access_token)
    }
    setUser(data.user)
  }

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } finally {
      setAuthToken(null)
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
