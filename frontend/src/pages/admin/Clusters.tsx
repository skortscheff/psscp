import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clustersApi } from '../../api/resources'
import { Layout } from '../../components/Layout'
import { Modal } from '../../components/Modal'
import { JobProgressModal } from '../../components/JobProgressModal'
import { InfoBox, FieldHint } from '../../components/InfoBox'

const inputCls = 'w-full border border-input-b bg-input-bg text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

export function AdminClusters() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: clustersApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clustersApi.delete(id),
    onSuccess: (data) => { setActiveJobId(data.job_id); queryClient.invalidateQueries({ queryKey: ['clusters'] }) },
  })

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-primary">Clusters</h1>
          <button onClick={() => setShowCreate(true)} className="bg-accent text-on-accent px-4 py-2 rounded text-sm hover:bg-accent-dim">
            + Register Cluster
          </button>
        </div>

        <InfoBox title="About Proxmox Clusters">
          <p>Each cluster represents a Proxmox VE instance that PSSCP can provision VMs on. After registration, PSSCP will test connectivity and detect whether SDN is available.</p>
          <p className="mt-1"><strong>Prerequisite:</strong> Create a dedicated API token in Proxmox at <em>Datacenter → Permissions → API Tokens</em>. Copy the token secret immediately — it is only shown once.</p>
        </InfoBox>

        {isLoading ? (
          <div className="text-center py-12 text-secondary">Loading...</div>
        ) : clusters.length === 0 ? (
          <div className="text-center py-12 text-muted">No clusters registered yet. Click <strong>+ Register Cluster</strong> to get started.</div>
        ) : (
          <div className="bg-surface rounded-lg shadow border border-line overflow-hidden">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-raised">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">SDN</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {clusters.map(c => (
                  <tr key={c.id} className="hover:bg-raised">
                    <td className="px-6 py-4 text-sm font-medium">
                      <Link to={`/admin/clusters/${c.id}`} className="text-accent-text hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-secondary font-mono">{c.api_url}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs ${c.sdn_enabled ? 'bg-green-500/10 text-green-500' : 'bg-raised text-muted border border-line'}`}>
                        {c.sdn_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => { if (confirm('Delete cluster?')) deleteMutation.mutate(c.id) }}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <RegisterClusterModal
          onClose={() => setShowCreate(false)}
          onJobCreated={(id) => { setShowCreate(false); setActiveJobId(id); queryClient.invalidateQueries({ queryKey: ['clusters'] }) }}
        />
      )}

      {activeJobId && (
        <JobProgressModal
          jobId={activeJobId}
          title="Cluster Operation"
          onClose={() => { setActiveJobId(null); queryClient.invalidateQueries({ queryKey: ['clusters'] }) }}
        />
      )}
    </Layout>
  )
}

function RegisterClusterModal({ onClose, onJobCreated }: { onClose: () => void; onJobCreated: (id: string) => void }) {
  const [form, setForm] = useState({ name: '', api_url: '', api_token_id: '', api_token_secret: '', tls_verify: true })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => clustersApi.create(form),
    onSuccess: (data) => onJobCreated(data.job_id),
    onError: () => setError('Failed to register cluster'),
  })

  return (
    <Modal title="Register Cluster" onClose={onClose}>
      <div className="space-y-3">
        <InfoBox title="How to find your credentials">
          <p>In the Proxmox web UI, go to <em>Datacenter → Permissions → API Tokens</em>. The <strong>Token ID</strong> is in the format <code>user@realm!tokenname</code> (e.g. <code>root@pam!psscp</code>).</p>
        </InfoBox>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">Name</label>
          <input className={inputCls} type="text" placeholder="e.g. prod-cluster" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <FieldHint>A short display name to identify this cluster in the UI.</FieldHint>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">API URL</label>
          <input className={inputCls} type="text" placeholder="https://192.168.1.10:8006" value={form.api_url} onChange={e => setForm(f => ({ ...f, api_url: e.target.value }))} />
          <FieldHint>The base URL of the Proxmox API, including port 8006.</FieldHint>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">API Token ID</label>
          <input className={inputCls} type="text" placeholder="root@pam!psscp" value={form.api_token_id} onChange={e => setForm(f => ({ ...f, api_token_id: e.target.value }))} />
          <FieldHint>Format: <code>user@realm!tokenname</code></FieldHint>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">API Token Secret</label>
          <input className={inputCls} type="password" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={form.api_token_secret} onChange={e => setForm(f => ({ ...f, api_token_secret: e.target.value }))} />
          <FieldHint>The UUID secret shown once when the token was created. Stored encrypted at rest.</FieldHint>
        </div>
        <label className="flex items-center gap-2 text-sm text-primary">
          <input type="checkbox" checked={form.tls_verify} onChange={e => setForm(f => ({ ...f, tls_verify: e.target.checked }))} />
          Verify TLS certificate
          <span className="text-xs text-muted">(uncheck only for self-signed certs in lab environments)</span>
        </label>
        {!form.tls_verify && (
          <div className="flex items-start gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>Warning: Disabling TLS verification exposes cluster communication to man-in-the-middle attacks. Only use in isolated lab environments.</span>
          </div>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded text-secondary hover:text-primary hover:bg-raised">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-4 py-2 text-sm bg-accent text-on-accent rounded hover:bg-accent-dim disabled:opacity-50">
            {mutation.isPending ? 'Registering...' : 'Register'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
