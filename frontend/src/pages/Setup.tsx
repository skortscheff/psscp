import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { systemApi } from '../api/resources'
import { setAccessToken } from '../api/client'
import { useAuth } from '../context/AuthContext'

export function Setup() {
  const navigate = useNavigate()
  const { refetch, needsSetup, loading: authLoading, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!authLoading && !needsSetup && user) return <Navigate to="/dashboard" replace />
  if (!authLoading && !needsSetup && !user) return <Navigate to="/login" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const res = await systemApi.setup({ email, password })
      setAccessToken(res.access_token)
      await refetch()
      navigate('/dashboard')
    } catch {
      setError('Setup failed — the system may already be configured')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <div className="bg-surface rounded-lg shadow border border-line p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Welcome to PSSCP</h1>
          <p className="text-secondary mt-1 text-sm">Create your administrator account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="admin@example.com"
              className="w-full border border-input-b bg-input-bg text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="At least 8 characters"
              className="w-full border border-input-b bg-input-bg text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full border border-input-b bg-input-bg text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-on-accent rounded-md py-2 text-sm font-medium hover:bg-accent-dim disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
