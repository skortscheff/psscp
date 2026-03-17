import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clustersApi } from '../../api/resources'
import { Layout } from '../../components/Layout'
import type { ClusterTestResult } from '../../api/types'

const inputCls = 'w-full border border-input-b bg-input-bg text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 ** 3)
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function AdminClusterDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', api_url: '', api_token_id: '', api_token_secret: '', tls_verify: true })
  const [testResult, setTestResult] = useState<ClusterTestResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  const { data: cluster, isLoading } = useQuery({
    queryKey: ['cluster', id],
    queryFn: () => clustersApi.get(id!),
  })

  useEffect(() => {
    if (cluster) {
      setEditForm({ name: cluster.name, api_url: cluster.api_url, api_token_id: cluster.api_token_id, api_token_secret: '', tls_verify: cluster.tls_verify })
    }
  }, [cluster])

  const { data: templates = [], isLoading: templatesLoading, error: templatesError, refetch: refetchTemplates } = useQuery({
    queryKey: ['templates', id],
    queryFn: () => clustersApi.templates(id!),
    enabled: !!cluster,
    retry: false,
    staleTime: 0,
  })

  const testMutation = useMutation({
    mutationFn: () => clustersApi.test(id!),
    onSuccess: (data) => { setTestResult(data); setTestError(null) },
    onError: () => setTestError('Request failed — check API logs for details'),
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { ...editForm }
      if (!payload.api_token_secret) delete payload.api_token_secret
      return clustersApi.update(id!, payload)
    },
    onSuccess: () => { setEditing(false); queryClient.invalidateQueries({ queryKey: ['cluster', id] }) },
  })

  if (isLoading) return <Layout><div className="p-6 text-secondary">Loading...</div></Layout>
  if (!cluster) return <Layout><div className="p-6 text-red-500">Cluster not found</div></Layout>

  return (
    <Layout>
      <div className="p-6 max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/clusters')} className="text-secondary hover:text-primary text-lg">&#8592;</button>
          <h1 className="text-2xl font-bold text-primary flex-1">{cluster.name}</h1>
          <button onClick={() => setEditing(e => !e)} className="px-3 py-1.5 text-sm border border-line rounded text-secondary hover:text-primary hover:bg-raised">
            {editing ? 'Cancel Edit' : 'Edit'}
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active VMs', value: cluster.vm_count },
            { label: 'Flavors', value: cluster.flavor_count },
            { label: 'Networks', value: cluster.network_count },
          ].map(s => (
            <div key={s.label} className="bg-surface rounded-lg shadow border border-line p-4 text-center">
              <div className="text-3xl font-bold text-primary">{s.value}</div>
              <div className="text-sm text-secondary mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Edit form or detail view */}
        {editing ? (
          <div className="bg-surface rounded-lg shadow border border-line p-6 space-y-4">
            <h2 className="font-semibold text-primary">Edit Cluster</h2>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Name</label>
              <input className={inputCls} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">API URL</label>
              <input className={`${inputCls} font-mono`} value={editForm.api_url} onChange={e => setEditForm(f => ({ ...f, api_url: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">API Token ID</label>
              <input className={`${inputCls} font-mono`} value={editForm.api_token_id} onChange={e => setEditForm(f => ({ ...f, api_token_id: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">New API Token Secret <span className="text-muted font-normal">(leave blank to keep existing)</span></label>
              <input type="password" className={inputCls} placeholder="Leave blank to keep current secret" value={editForm.api_token_secret} onChange={e => setEditForm(f => ({ ...f, api_token_secret: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-primary">
              <input type="checkbox" checked={editForm.tls_verify} onChange={e => setEditForm(f => ({ ...f, tls_verify: e.target.checked }))} />
              Verify TLS certificate
            </label>
            {updateMutation.isError && <p className="text-red-500 text-sm">Failed to save changes.</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm border border-line rounded text-secondary hover:text-primary hover:bg-raised">Cancel</button>
              <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="px-4 py-2 text-sm bg-accent text-on-accent rounded hover:bg-accent-dim disabled:opacity-50">
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-lg shadow border border-line p-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs font-medium text-secondary uppercase tracking-wide">API URL</dt>
                <dd className="font-mono text-sm text-primary mt-1 break-all">{cluster.api_url}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary uppercase tracking-wide">Token ID</dt>
                <dd className="font-mono text-sm text-primary mt-1">{cluster.api_token_id}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary uppercase tracking-wide">TLS Verification</dt>
                <dd className="text-sm text-primary mt-1">{cluster.tls_verify ? 'Enabled' : 'Disabled (self-signed cert)'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-secondary uppercase tracking-wide">SDN</dt>
                <dd className="mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${cluster.sdn_enabled ? 'bg-green-500/10 text-green-500' : 'bg-raised text-muted border border-line'}`}>
                    {cluster.sdn_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Connectivity test */}
        <div className="bg-surface rounded-lg shadow border border-line p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-primary">Connectivity Test</h2>
              <p className="text-sm text-secondary mt-0.5">Verify credentials, fetch live node status, and re-check SDN availability.</p>
            </div>
            <button
              onClick={() => { setTestResult(null); setTestError(null); testMutation.mutate() }}
              disabled={testMutation.isPending}
              className="px-4 py-2 text-sm bg-accent text-on-accent rounded hover:bg-accent-dim disabled:opacity-50 whitespace-nowrap"
            >
              {testMutation.isPending ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {testError && <div className="rounded bg-red-500/10 border border-red-500/30 text-red-500 text-sm p-3">{testError}</div>}

          {testResult && (
            <div className="space-y-4">
              <div className={`flex items-center gap-2 text-sm font-medium ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                <span>{testResult.success ? '✓' : '✗'}</span>
                <span>{testResult.success ? 'Connection successful' : 'Connection failed'}</span>
                {testResult.version && <span className="ml-auto font-normal text-secondary">Proxmox VE {testResult.version}</span>}
              </div>

              {testResult.error && <div className="rounded bg-red-500/10 border border-red-500/30 text-red-500 text-sm p-3">{testResult.error}</div>}

              {testResult.success && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-secondary">SDN detected:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${testResult.sdn_detected ? 'bg-green-500/10 text-green-500' : 'bg-raised text-muted border border-line'}`}>
                    {testResult.sdn_detected ? 'Yes' : 'No'}
                  </span>
                  {testResult.sdn_detected !== cluster.sdn_enabled && (
                    <span className="text-amber-500 text-xs">⚠ differs from stored value — consider re-registering</span>
                  )}
                  <span className="ml-auto text-secondary">{testResult.template_count} template{testResult.template_count !== 1 ? 's' : ''} found</span>
                </div>
              )}

              {testResult.nodes.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-primary mb-2">Nodes</h3>
                  <table className="min-w-full text-sm divide-y divide-line border border-line rounded overflow-hidden">
                    <thead className="bg-raised">
                      <tr>
                        {['Node', 'Status', 'Uptime', 'CPU', 'Memory'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {testResult.nodes.map(node => (
                        <tr key={node.name} className="hover:bg-raised">
                          <td className="px-3 py-2 font-mono font-medium text-primary">{node.name}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${node.status === 'online' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                              {node.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-secondary">{node.uptime != null ? formatUptime(node.uptime) : '—'}</td>
                          <td className="px-3 py-2 text-secondary">{node.cpu_usage != null ? `${node.cpu_usage}%` : '—'}</td>
                          <td className="px-3 py-2 text-secondary">
                            {node.mem_used != null && node.mem_total != null
                              ? `${formatBytes(node.mem_used)} / ${formatBytes(node.mem_total)}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Templates */}
        <div className="bg-surface rounded-lg shadow border border-line p-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-primary">VM Templates</h2>
            <button
              onClick={() => refetchTemplates()}
              disabled={templatesLoading}
              className="px-3 py-1 text-xs border border-line rounded text-secondary hover:text-primary hover:bg-raised disabled:opacity-50"
            >
              {templatesLoading ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
          {templatesLoading ? (
            <p className="text-sm text-secondary">Loading templates from Proxmox...</p>
          ) : templatesError ? (
            <p className="text-sm text-amber-500">Could not load templates — run a connectivity test to check the connection.</p>
          ) : templates.length === 0 ? (
            <div className="text-sm space-y-1">
              <p className="text-muted">No templates found on this cluster.</p>
              <p className="text-muted">If you have templates in Proxmox, check that the API token has <span className="font-mono text-secondary">VM.Audit</span> permission on path <span className="font-mono text-secondary">/vms</span> (Datacenter → Permissions → Add).</p>
            </div>
          ) : (
            <table className="min-w-full text-sm divide-y divide-line">
              <thead>
                <tr>
                  {['VMID', 'Name', 'OS Type'].map(h => (
                    <th key={h} className="pb-2 text-left text-xs font-medium text-secondary uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {templates.map(t => (
                  <tr key={t.id} className="hover:bg-raised">
                    <td className="py-2 font-mono text-secondary">{t.id}</td>
                    <td className="py-2 font-medium text-primary px-4">{t.name}</td>
                    <td className="py-2 text-secondary">{t.os_type ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}
