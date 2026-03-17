import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { vmsApi } from '../api/resources'
import { Layout } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'
import { JobProgressModal } from '../components/JobProgressModal'

export function VMDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const { data: vm, isLoading } = useQuery({
    queryKey: ['vm', id],
    queryFn: () => vmsApi.get(id!),
    refetchInterval: 5000,
  })

  const doAction = (action: 'start' | 'stop' | 'reboot' | 'delete') => {
    const fn = {
      start: () => vmsApi.start(id!),
      stop: () => vmsApi.stop(id!),
      reboot: () => vmsApi.reboot(id!),
      delete: () => vmsApi.delete(id!),
    }[action]
    fn().then(res => {
      setActiveJobId(res.job_id)
      queryClient.invalidateQueries({ queryKey: ['vm', id] })
    })
  }

  if (isLoading) return <Layout><div className="p-6 text-secondary">Loading...</div></Layout>
  if (!vm) return <Layout><div className="p-6 text-red-500">VM not found</div></Layout>

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/vms')} className="text-secondary hover:text-primary">&#8592;</button>
          <h1 className="text-2xl font-bold text-primary">{vm.name}</h1>
          <StatusBadge status={vm.status} />
        </div>

        <div className="bg-surface rounded-lg shadow border border-line p-6 mb-6">
          <dl className="grid grid-cols-2 gap-4">
            <div><dt className="text-sm text-secondary">Status</dt><dd className="font-medium mt-1"><StatusBadge status={vm.status} /></dd></div>
            <div><dt className="text-sm text-secondary">IP Address</dt><dd className="font-medium font-mono text-primary mt-1">{vm.ip_address || '—'}</dd></div>
            <div><dt className="text-sm text-secondary">VMID</dt><dd className="font-medium text-primary mt-1">{vm.proxmox_vmid ?? '—'}</dd></div>
            <div><dt className="text-sm text-secondary">Created</dt><dd className="font-medium text-primary mt-1">{new Date(vm.created_at).toLocaleString()}</dd></div>
          </dl>
        </div>

        <div className="flex gap-3">
          {vm.status === 'stopped' && (
            <button onClick={() => doAction('start')} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">Start</button>
          )}
          {vm.status === 'running' && (
            <>
              <button onClick={() => doAction('stop')} className="px-4 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700">Stop</button>
              <button onClick={() => doAction('reboot')} className="px-4 py-2 bg-accent text-on-accent rounded text-sm hover:bg-accent-dim">Reboot</button>
            </>
          )}
          {vm.status !== 'provisioning' && vm.status !== 'deleted' && (
            <button
              onClick={() => { if (confirm('Delete this VM?')) doAction('delete') }}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {activeJobId && (
        <JobProgressModal
          jobId={activeJobId}
          title="VM Action"
          onClose={() => { setActiveJobId(null); queryClient.invalidateQueries({ queryKey: ['vm', id] }) }}
        />
      )}
    </Layout>
  )
}
