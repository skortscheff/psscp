import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../api/resources'
import { Layout } from '../../components/Layout'
import { Modal } from '../../components/Modal'
import { InfoBox, FieldHint } from '../../components/InfoBox'
import type { UserRole } from '../../api/types'

const inputCls = 'w-full border border-input-b bg-input-bg text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

export function AdminUsers() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: () => alert('Cannot deactivate user — they may have active VMs'),
  })

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-primary">Users</h1>
          <button onClick={() => setShowCreate(true)} className="bg-accent text-on-accent px-4 py-2 rounded text-sm hover:bg-accent-dim">+ New User</button>
        </div>

        <InfoBox title="About Users">
          <p><strong>User</strong> — can create, start, stop, reboot, and delete their own VMs.</p>
          <p className="mt-1"><strong>Admin</strong> — full access including cluster registration, flavor/network management, and user administration.</p>
          <p className="mt-1">Deactivating a user blocks their login but does not delete their VMs. Users with active VMs cannot be deactivated.</p>
        </InfoBox>

        {isLoading ? <div className="text-center py-12 text-secondary">Loading...</div> : (
          <div className="bg-surface rounded-lg shadow border border-line overflow-hidden">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-raised">
                <tr>
                  {['Email', 'Role', 'Status', 'Created', ''].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-raised">
                    <td className="px-6 py-4 text-sm font-medium text-primary">{u.email}</td>
                    <td className="px-6 py-4 text-sm text-secondary capitalize">{u.role}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs ${u.is_active ? 'bg-green-500/10 text-green-500' : 'bg-raised text-muted border border-line'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-secondary">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      {u.is_active && (
                        <button onClick={() => { if (confirm('Deactivate this user?')) deleteMutation.mutate(u.id) }} className="text-sm text-red-500 hover:underline">
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['users'] }) }}
        />
      )}
    </Layout>
  )
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ email: '', password: '', role: 'user' as UserRole })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => usersApi.create(form),
    onSuccess: onCreated,
    onError: () => setError('Failed to create user — the email may already be in use'),
  })

  return (
    <Modal title="Create User" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Email</label>
          <input type="email" className={inputCls} placeholder="user@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <FieldHint>Used to log in. Must be unique across all accounts.</FieldHint>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Password</label>
          <input type="password" className={inputCls} placeholder="At least 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <FieldHint>The user can change this from their profile page after logging in.</FieldHint>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Role</label>
          <select className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
            <option value="user">User — self-service VM access only</option>
            <option value="admin">Admin — full administrative access</option>
          </select>
          <FieldHint>Grant admin access only to trusted operators.</FieldHint>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded text-secondary hover:text-primary hover:bg-raised">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-4 py-2 text-sm bg-accent text-on-accent rounded hover:bg-accent-dim disabled:opacity-50">
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
