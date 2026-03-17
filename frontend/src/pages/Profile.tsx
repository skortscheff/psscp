import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { usersApi } from '../api/resources'
import { useAuth } from '../context/AuthContext'
import { Layout } from '../components/Layout'

export function Profile() {
  const { user, refetch } = useAuth()
  const [form, setForm] = useState({ email: user?.email ?? '', password: '' })
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => usersApi.update(user!.id, {
      email: form.email !== user?.email ? form.email : undefined,
      password: form.password || undefined,
    }),
    onSuccess: () => { setSuccess(true); setError(''); refetch() },
    onError: () => setError('Failed to update profile'),
  })

  if (!user) return null

  return (
    <Layout>
      <div className="p-6 max-w-md">
        <h1 className="text-2xl font-bold text-primary mb-6">Profile</h1>
        <div className="bg-surface rounded-lg shadow border border-line p-6">
          <div className="mb-4">
            <span className="text-sm text-secondary">Role: </span>
            <span className="font-medium text-primary capitalize">{user.role}</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Email</label>
              <input
                className="w-full border border-input-b bg-input-bg text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">New Password</label>
              <input
                type="password"
                className="w-full border border-input-b bg-input-bg text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Leave blank to keep current"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            {success && <p className="text-green-500 text-sm">Profile updated</p>}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full bg-accent text-on-accent rounded py-2 text-sm hover:bg-accent-dim disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
