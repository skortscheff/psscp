import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

// Separate instance for refresh calls — must NOT go through the interceptor
// or it creates an infinite 401 retry loop.
export const authClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const res = await authClient.post('/auth/refresh')
        const newToken = res.data.access_token
        setAccessToken(newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return apiClient(original)
      } catch {
        setAccessToken(null)
        // Don't hard-reload — let AuthContext / router handle the redirect
      }
    }
    return Promise.reject(error)
  }
)
