import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { networksApi, clustersApi } from '../../api/resources'
import { Layout } from '../../components/Layout'
import { Modal } from '../../components/Modal'
import { InfoBox, FieldHint } from '../../components/InfoBox'
import type { NetworkType } from '../../api/types'

const inputCls = 'w-full border border-input-b bg-input-bg text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

export function AdminNetworks() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: networks = [], isLoading } = useQuery({ queryKey: ['networks'], queryFn: () => networksApi.list() })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => networksApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['networks'] }),
    onError: () => alert('Cannot delete network — it may be in use by existing VMs'),
  })

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-primary">Networks</h1>
          <button onClick={() => setShowCreate(true)} className="bg-accent text-on-accent px-4 py-2 rounded text-sm hover:bg-accent-dim">+ New Network</button>
        </div>

        <InfoBox title="About Networks">
          <p><strong>Bridge</strong> — connects VMs to a Linux bridge on the Proxmox host. Works on any cluster.</p>
          <p className="mt-1"><strong>VXLAN</strong> — isolated overlay network using Proxmox SDN. Requires SDN enabled on the cluster.</p>
          <p className="mt-1">Networks cannot be deleted while VMs are attached to them.</p>
        </InfoBox>

        {isLoading ? <div className="text-center py-12 text-secondary">Loading...</div> : networks.length === 0 ? (
          <div className="text-center py-12 text-muted">No networks yet. Click <strong>+ New Network</strong> to add one.</div>
        ) : (
          <div className="bg-surface rounded-lg shadow border border-line overflow-hidden">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-raised">
                <tr>
                  {['Name', 'Type', 'Bridge', 'VXLAN ID', ''].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {networks.map(n => (
                  <tr key={n.id} className="hover:bg-raised">
                    <td className="px-6 py-4 text-sm font-medium text-primary">{n.name}</td>
                    <td className="px-6 py-4 text-sm text-secondary capitalize">{n.type}</td>
                    <td className="px-6 py-4 text-sm font-mono text-secondary">{n.bridge_name}</td>
                    <td className="px-6 py-4 text-sm text-secondary">{n.vxlan_id ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { if (confirm('Delete this network?')) deleteMutation.mutate(n.id) }} className="text-sm text-red-500 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateNetworkModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['networks'] }) }}
        />
      )}
    </Layout>
  )
}

function CreateNetworkModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ cluster_id: '', name: '', type: 'bridge' as NetworkType, bridge_name: 'vmbr0', vxlan_id: '' })
  const { data: clusters = [] } = useQuery({ queryKey: ['clusters'], queryFn: clustersApi.list })
  const selectedCluster = clusters.find(c => c.id === form.cluster_id)

  const mutation = useMutation({
    mutationFn: () => networksApi.create({ ...form, vxlan_id: form.vxlan_id ? +form.vxlan_id : null }),
    onSuccess: onCreated,
    onError: () => alert('Failed to create network'),
  })

  return (
    <Modal title="Create Network" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Cluster</label>
          <select className={inputCls} value={form.cluster_id} onChange={e => setForm(f => ({ ...f, cluster_id: e.target.value }))}>
            <option value="">Select cluster</option>
            {clusters.map(c => <option key={c.id} value={c.id}>{c.name} {c.sdn_enabled ? '(SDN enabled)' : ''}</option>)}
          </select>
          <FieldHint>VXLAN is only available on clusters with SDN enabled.</FieldHint>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Name</label>
          <input className={inputCls} placeholder="e.g. default, management" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Type</label>
          <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as NetworkType }))}>
            <option value="bridge">Bridge — standard Linux bridge</option>
            {selectedCluster?.sdn_enabled && <option value="vxlan">VXLAN — isolated overlay (requires SDN)</option>}
          </select>
          {!selectedCluster?.sdn_enabled && form.cluster_id && (
            <p className="text-xs text-amber-500 mt-1">VXLAN not available — this cluster does not have SDN enabled.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Bridge Name</label>
          <input className={inputCls} placeholder="vmbr0" value={form.bridge_name} onChange={e => setForm(f => ({ ...f, bridge_name: e.target.value }))} />
          <FieldHint>The Linux bridge interface on the Proxmox host (e.g. <code>vmbr0</code>).</FieldHint>
        </div>
        {form.type === 'vxlan' && (
          <div>
            <label className="block text-sm font-medium text-primary mb-1">VXLAN ID</label>
            <input type="number" min={1} max={16777215} className={inputCls} placeholder="e.g. 100" value={form.vxlan_id} onChange={e => setForm(f => ({ ...f, vxlan_id: e.target.value }))} />
            <FieldHint>A unique integer (1–16777215). PSSCP will auto-create the SDN VNet in Proxmox if it doesn't exist.</FieldHint>
          </div>
        )}
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
