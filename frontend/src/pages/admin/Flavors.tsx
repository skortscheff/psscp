import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { flavorsApi, clustersApi } from '../../api/resources'
import { Layout } from '../../components/Layout'
import { Modal } from '../../components/Modal'
import { InfoBox, FieldHint } from '../../components/InfoBox'
import type { DiskBus } from '../../api/types'

const inputCls = 'w-full border border-input-b bg-input-bg text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

export function AdminFlavors() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: flavors = [], isLoading } = useQuery({ queryKey: ['flavors'], queryFn: () => flavorsApi.list() })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => flavorsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flavors'] }),
    onError: () => alert('Cannot delete flavor — it may be in use by existing VMs'),
  })

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-primary">Flavors</h1>
          <button onClick={() => setShowCreate(true)} className="bg-accent text-on-accent px-4 py-2 rounded text-sm hover:bg-accent-dim">+ New Flavor</button>
        </div>

        <InfoBox title="About Flavors">
          <p>Flavors are VM size presets users choose when creating a VM — similar to AWS EC2 instance types. Each flavor is tied to a specific cluster and defines CPU, memory, and disk resources. Flavors cannot be deleted while VMs are using them.</p>
        </InfoBox>

        {isLoading ? <div className="text-center py-12 text-secondary">Loading...</div> : flavors.length === 0 ? (
          <div className="text-center py-12 text-muted">No flavors yet. Click <strong>+ New Flavor</strong> to define your first VM size preset.</div>
        ) : (
          <div className="bg-surface rounded-lg shadow border border-line overflow-hidden">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-raised">
                <tr>
                  {['Name', 'vCPUs', 'RAM', 'Disk', 'Bus', ''].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {flavors.map(f => (
                  <tr key={f.id} className="hover:bg-raised">
                    <td className="px-6 py-4 text-sm font-medium text-primary">{f.name}</td>
                    <td className="px-6 py-4 text-sm text-secondary">{f.vcpus}</td>
                    <td className="px-6 py-4 text-sm text-secondary">{f.ram_mb} MB</td>
                    <td className="px-6 py-4 text-sm text-secondary">{f.disk_gb} GB</td>
                    <td className="px-6 py-4 text-sm text-secondary">{f.disk_bus}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { if (confirm('Delete this flavor?')) deleteMutation.mutate(f.id) }} className="text-sm text-red-500 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateFlavorModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['flavors'] }) }}
        />
      )}
    </Layout>
  )
}

function CreateFlavorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ cluster_id: '', name: '', vcpus: 2, ram_mb: 2048, disk_gb: 20, disk_bus: 'virtio' as DiskBus })
  const { data: clusters = [] } = useQuery({ queryKey: ['clusters'], queryFn: clustersApi.list })

  const mutation = useMutation({ mutationFn: () => flavorsApi.create(form), onSuccess: onCreated })

  return (
    <Modal title="Create Flavor" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Cluster</label>
          <select className={inputCls} value={form.cluster_id} onChange={e => setForm(f => ({ ...f, cluster_id: e.target.value }))}>
            <option value="">Select cluster</option>
            {clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <FieldHint>Flavors are cluster-specific and must be unique per cluster.</FieldHint>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Name</label>
          <input className={inputCls} placeholder="e.g. small, 4cpu-8gb" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">vCPUs</label>
            <input type="number" min={1} className={inputCls} value={form.vcpus} onChange={e => setForm(f => ({ ...f, vcpus: +e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">RAM (MB)</label>
            <input type="number" min={512} step={512} className={inputCls} value={form.ram_mb} onChange={e => setForm(f => ({ ...f, ram_mb: +e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Disk (GB)</label>
            <input type="number" min={1} className={inputCls} value={form.disk_gb} onChange={e => setForm(f => ({ ...f, disk_gb: +e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Disk Bus</label>
          <select className={inputCls} value={form.disk_bus} onChange={e => setForm(f => ({ ...f, disk_bus: e.target.value as DiskBus }))}>
            <option value="virtio">virtio (recommended — best performance)</option>
            <option value="scsi">scsi (good compatibility)</option>
            <option value="ide">ide (legacy)</option>
          </select>
          <FieldHint>Must match the disk controller supported by the VM template.</FieldHint>
        </div>
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
