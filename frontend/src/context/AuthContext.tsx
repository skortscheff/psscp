import React, { createContext, useContext, useState, useEffect } from 'react'
import { usersApi, systemApi } from '../api/resources'
import { refreshToken } from '../api/auth'
import { getAccessToken } from '../api/client'
import type { User } from '../api/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  needsSetup: boolean
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  needsSetup: false,
  refetch: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  const fetchUser = async () => {
    setLoading(true)
    try {
      const { needs_setup } = await systemApi.setupStatus()
      if (needs_setup) {
        setNeedsSetup(true)
        setUser(null)
        return
      }
      setNeedsSetup(false)

      // Try to get a fresh access token via the refresh cookie.
      // If this fails (e.g. first load after setup over HTTP), we may still
      // have a valid in-memory access token — so don't give up yet.
      try {
        await refreshToken()
      } catch {
        // If there's no in-memory token either, we're definitely logged out.
        if (!getAccessToken()) {
          setUser(null)
          return
        }
      }

      const me = await usersApi.me()
      setUser(me)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUser() }, [])

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
