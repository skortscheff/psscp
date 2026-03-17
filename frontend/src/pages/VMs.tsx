import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vmsApi, clustersApi, flavorsApi, networksApi } from '../api/resources'
import { Layout } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'
import { JobProgressModal } from '../components/JobProgressModal'
import type { VMStatus } from '../api/types'

const inputCls = 'w-full border border-input-b bg-input-bg text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

export function VMs() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<VMStatus | ''>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const { data: vms = [], isLoading } = useQuery({
    queryKey: ['vms', statusFilter],
    queryFn: () => vmsApi.list(statusFilter || undefined),
    refetchInterval: 5000,
  })

  const filtered = statusFilter ? vms.filter(v => v.status === statusFilter) : vms

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Virtual Machines</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-accent text-on-accent px-4 py-2 rounded-md text-sm font-medium hover:bg-accent-dim"
          >
            + New VM
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          {(['', 'running', 'stopped', 'provisioning', 'error'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s as VMStatus | '')}
              className={`px-3 py-1 rounded text-sm ${statusFilter === s ? 'bg-accent text-on-accent' : 'bg-surface border border-line text-secondary hover:text-primary hover:bg-raised'}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-secondary">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted">No VMs found</div>
        ) : (
          <div className="bg-surface rounded-lg shadow border border-line overflow-hidden">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-raised">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Created</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(vm => (
                  <tr key={vm.id} className="hover:bg-raised">
                    <td className="px-6 py-4 text-sm font-medium">
                      <Link to={`/vms/${vm.id}`} className="text-accent-text hover:underline">{vm.name}</Link>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={vm.status} /></td>
                    <td className="px-6 py-4 text-sm text-secondary font-mono">{vm.ip_address || '—'}</td>
                    <td className="px-6 py-4 text-sm text-secondary">{new Date(vm.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/vms/${vm.id}`} className="text-sm text-accent-text hover:underline">Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateVMModal
          onClose={() => setShowCreateModal(false)}
          onJobCreated={(jobId) => {
            setShowCreateModal(false)
            setActiveJobId(jobId)
            queryClient.invalidateQueries({ queryKey: ['vms'] })
          }}
        />
      )}

      {activeJobId && (
        <JobProgressModal
          jobId={activeJobId}
          title="Creating VM"
          onClose={() => { setActiveJobId(null); queryClient.invalidateQueries({ queryKey: ['vms'] }) }}
        />
      )}
    </Layout>
  )
}

function CreateVMModal({ onClose, onJobCreated }: { onClose: () => void; onJobCreated: (id: string) => void }) {
  const [form, setForm] = useState({ name: '', cluster_id: '', flavor_id: '', template_id: '', network_id: '' })
  const [error, setError] = useState('')

  const { data: clusters = [] } = useQuery({ queryKey: ['clusters'], queryFn: clustersApi.list })
  const { data: flavors = [] } = useQuery({
    queryKey: ['flavors', form.cluster_id],
    queryFn: () => flavorsApi.list(form.cluster_id),
    enabled: !!form.cluster_id,
  })
  const { data: networks = [] } = useQuery({
    queryKey: ['networks', form.cluster_id],
    queryFn: () => networksApi.list(form.cluster_id),
    enabled: !!form.cluster_id,
  })
  const { data: templates = [] } = useQuery({
    queryKey: ['templates', form.cluster_id],
    queryFn: () => clustersApi.templates(form.cluster_id),
    enabled: !!form.cluster_id,
  })

  const mutation = useMutation({
    mutationFn: () => vmsApi.create(form),
    onSuccess: (data) => onJobCreated(data.job_id),
    onError: () => setError('Failed to create VM'),
  })

  return (
    <Modal title="Create VM" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Name</label>
          <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Cluster</label>
          <select className={inputCls} value={form.cluster_id} onChange={e => setForm(f => ({ ...f, cluster_id: e.target.value, flavor_id: '', template_id: '', network_id: '' }))}>
            <option value="">Select cluster</option>
            {clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Flavor</label>
          <select className={inputCls} value={form.flavor_id} onChange={e => setForm(f => ({ ...f, flavor_id: e.target.value }))} disabled={!form.cluster_id}>
            <option value="">Select flavor</option>
            {flavors.map(f => <option key={f.id} value={f.id}>{f.name} ({f.vcpus}vCPU, {f.ram_mb}MB)</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Template</label>
          <select className={inputCls} value={form.template_id} onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))} disabled={!form.cluster_id}>
            <option value="">Select template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Network (optional)</label>
          <select className={inputCls} value={form.network_id} onChange={e => setForm(f => ({ ...f, network_id: e.target.value }))} disabled={!form.cluster_id}>
            <option value="">No network</option>
            {networks.map(n => <option key={n.id} value={n.id}>{n.name} ({n.type})</option>)}
          </select>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded text-secondary hover:text-primary hover:bg-raised">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name || !form.cluster_id || !form.flavor_id || !form.template_id}
            className="px-4 py-2 text-sm bg-accent text-on-accent rounded hover:bg-accent-dim disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create VM'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
