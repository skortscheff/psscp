import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clustersApi } from '../../api/resources'
import { Layout } from '../../components/Layout'
import type { LiveVM } from '../../api/types'

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

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-500',
    stopped: 'bg-raised border border-line',
    paused: 'bg-amber-500',
    unknown: 'bg-muted',
  }
  const labels: Record<string, string> = {
    running: 'text-green-500',
    stopped: 'text-muted',
    paused: 'text-amber-500',
    unknown: 'text-muted',
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] ?? 'bg-muted'}`} />
      <span className={`text-xs font-medium ${labels[status] ?? 'text-muted'}`}>{status}</span>
    </span>
  )
}

function VMRow({ vm }: { vm: LiveVM }) {
  const cpuPct = vm.cpu != null ? Math.round(vm.cpu * 100) : null
  const memPct = vm.mem != null && vm.maxmem ? Math.round((vm.mem / vm.maxmem) * 100) : null

  return (
    <tr className="hover:bg-raised">
      <td className="px-4 py-2.5 font-mono text-xs text-muted w-16">{vm.vmid}</td>
      <td className="px-4 py-2.5">
        <span className="text-sm font-medium text-primary">{vm.name}</span>
        {vm.template && (
          <span className="ml-2 text-xs text-muted border border-line rounded px-1">tmpl</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <StatusDot status={vm.status} />
      </td>
      <td className="px-4 py-2.5 text-xs text-secondary font-mono">{vm.node}</td>
      <td className="px-4 py-2.5 text-xs text-secondary">{vm.type.toUpperCase()}</td>
      <td className="px-4 py-2.5">
        {cpuPct != null ? (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-raised rounded-full h-1.5 border border-line">
              <div
                className={`h-1.5 rounded-full ${cpuPct > 80 ? 'bg-red-500' : cpuPct > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${cpuPct}%` }}
              />
            </div>
            <span className="text-xs text-secondary w-8">{cpuPct}%</span>
          </div>
        ) : <span className="text-xs text-muted">—</span>}
      </td>
      <td className="px-4 py-2.5">
        {vm.mem != null && vm.maxmem ? (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-raised rounded-full h-1.5 border border-line">
              <div
                className={`h-1.5 rounded-full ${(memPct ?? 0) > 90 ? 'bg-red-500' : (memPct ?? 0) > 70 ? 'bg-amber-500' : 'bg-accent'}`}
                style={{ width: `${memPct}%` }}
              />
            </div>
            <span className="text-xs text-secondary">{formatBytes(vm.mem)}</span>
          </div>
        ) : <span className="text-xs text-muted">—</span>}
      </td>
      <td className="px-4 py-2.5 text-xs text-secondary">
        {vm.uptime != null && vm.status === 'running' ? formatUptime(vm.uptime) : '—'}
      </td>
    </tr>
  )
}

export function AdminResources() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showTemplates, setShowTemplates] = useState(false)

  const { data: clusters = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['live-resources'],
    queryFn: clustersApi.liveResources,
    refetchInterval: 15000,
    staleTime: 0,
  })

  const allVMs = clusters.flatMap(c => c.vms.map(vm => ({ ...vm, clusterName: c.cluster_name })))
  const displayed = allVMs.filter(vm => {
    if (!showTemplates && vm.template) return false
    if (statusFilter !== 'all' && vm.status !== statusFilter) return false
    return true
  })

  const runningCount = allVMs.filter(v => !v.template && v.status === 'running').length
  const stoppedCount = allVMs.filter(v => !v.template && v.status === 'stopped').length
  const templateCount = allVMs.filter(v => v.template).length

  return (
    <Layout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Live Resources</h1>
            <p className="text-sm text-muted mt-0.5">All VMs and containers across registered Proxmox clusters</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 text-sm border border-line rounded text-secondary hover:text-primary hover:bg-raised disabled:opacity-50 transition-colors"
          >
            {isFetching ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface border border-line rounded-lg p-4">
            <div className="text-2xl font-bold text-green-500">{runningCount}</div>
            <div className="text-xs text-secondary mt-0.5">Running</div>
          </div>
          <div className="bg-surface border border-line rounded-lg p-4">
            <div className="text-2xl font-bold text-primary">{stoppedCount}</div>
            <div className="text-xs text-secondary mt-0.5">Stopped</div>
          </div>
          <div className="bg-surface border border-line rounded-lg p-4">
            <div className="text-2xl font-bold text-muted">{templateCount}</div>
            <div className="text-xs text-secondary mt-0.5">Templates</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {(['all', 'running', 'stopped'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded text-sm transition-colors ${statusFilter === s ? 'bg-accent text-on-accent' : 'bg-surface border border-line text-secondary hover:text-primary hover:bg-raised'}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTemplates}
              onChange={e => setShowTemplates(e.target.checked)}
              className="rounded"
            />
            Show templates
          </label>
          <span className="ml-auto text-xs text-muted">Auto-refreshes every 15s</span>
        </div>

        {/* Cluster error banners */}
        {clusters.filter(c => c.error).map(c => (
          <div key={c.cluster_id} className="rounded bg-red-500/10 border border-red-500/30 text-red-500 text-sm p-3">
            <strong>{c.cluster_name}:</strong> {c.error}
          </div>
        ))}

        {isLoading ? (
          <div className="text-center py-16 text-secondary">Loading cluster resources...</div>
        ) : error ? (
          <div className="text-center py-16 text-red-500">Failed to load resources</div>
        ) : clusters.length === 0 ? (
          <div className="text-center py-16 text-muted">No clusters registered</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-muted">No VMs match the current filter</div>
        ) : (
          /* Per-cluster tables */
          clusters.map(cluster => {
            const clusterVMs = cluster.vms.filter(vm => {
              if (!showTemplates && vm.template) return false
              if (statusFilter !== 'all' && vm.status !== statusFilter) return false
              return true
            })
            if (clusterVMs.length === 0 && !cluster.error) return null
            return (
              <div key={cluster.cluster_id} className="bg-surface rounded-lg shadow border border-line overflow-hidden">
                <div className="px-4 py-3 bg-raised border-b border-line flex items-center justify-between">
                  <span className="font-semibold text-primary text-sm">{cluster.cluster_name}</span>
                  <span className="text-xs text-muted">
                    {cluster.vms.filter(v => v.status === 'running' && !v.template).length} running
                    {' · '}
                    {cluster.vms.filter(v => !v.template).length} total
                  </span>
                </div>
                {cluster.error ? (
                  <div className="px-4 py-3 text-sm text-red-500">{cluster.error}</div>
                ) : clusterVMs.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted">No VMs match filter</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-line">
                      <tr>
                        {['ID', 'Name', 'Status', 'Node', 'Type', 'CPU', 'Memory', 'Uptime'].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-medium text-secondary uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {clusterVMs.map(vm => <VMRow key={`${vm.node}-${vm.vmid}`} vm={vm} />)}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })
        )}
      </div>
    </Layout>
  )
}
