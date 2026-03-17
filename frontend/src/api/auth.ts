import { apiClient, authClient, setAccessToken } from './client'

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>('/auth/login', data)
  setAccessToken(res.data.access_token)
  return res.data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
  setAccessToken(null)
}

export async function refreshToken(): Promise<TokenResponse> {
  const res = await authClient.post<TokenResponse>('/auth/refresh')
  setAccessToken(res.data.access_token)
  return res.data
}
