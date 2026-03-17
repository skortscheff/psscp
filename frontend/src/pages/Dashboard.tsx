import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { systemApi, jobsApi, vmsApi } from '../api/resources'
import { Layout } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import type { DashboardNodeInfo, DashboardLiveVM, Job } from '../api/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface rounded-lg border border-line p-5">
      <div className={`text-3xl font-bold ${color ?? 'text-primary'}`}>{value}</div>
      <div className="text-sm font-medium text-secondary mt-1">{label}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  )
}

function UsageBar({ used, total, label, colorFn }: {
  used: number; total: number; label: string
  colorFn?: (pct: number) => string
}) {
  if (total === 0) return null
  const pct = Math.round((used / total) * 100)
  const color = colorFn ? colorFn(pct) : pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-accent'
  return (
    <div>
      <div className="flex justify-between text-xs text-secondary mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-raised rounded-full h-2 border border-line">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function NodeCard({ node }: { node: DashboardNodeInfo }) {
  const isOnline = node.status === 'online'
  const cpuPct = Math.round(node.cpu * 100)
  return (
    <div className="bg-surface border border-line rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-primary text-sm">{node.node}</div>
          <div className="text-xs text-muted">{node.cluster_name}</div>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          {node.status}
        </span>
      </div>

      {isOnline && (
        <div className="space-y-2">
          <UsageBar
            used={node.cpu * node.maxcpu}
            total={node.maxcpu}
            label={`CPU  ·  ${node.maxcpu} cores`}
          />
          <UsageBar
            used={node.mem}
            total={node.maxmem}
            label={`Memory  ·  ${formatBytes(node.maxmem)}`}
          />
          <UsageBar
            used={node.disk}
            total={node.maxdisk}
            label={`Disk  ·  ${formatBytes(node.maxdisk)}`}
          />
          <div className="flex justify-between text-xs text-muted pt-0.5">
            <span>Uptime</span>
            <span>{node.uptime > 0 ? formatUptime(node.uptime) : '—'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function LiveVMRow({ vm }: { vm: DashboardLiveVM & { clusterName?: string } }) {
  const cpuPct = Math.round(vm.cpu * 100)
  const memPct = vm.maxmem > 0 ? Math.round((vm.mem / vm.maxmem) * 100) : 0
  const isRunning = vm.status === 'running'
  return (
    <tr className="hover:bg-raised">
      <td className="px-4 py-2.5">
        <div className="text-sm font-medium text-primary">{vm.name}</div>
        <div className="text-xs text-muted font-mono">{vm.cluster_name} / {vm.node}</div>
      </td>
      <td className="px-4 py-2.5">
        <span className={`flex items-center gap-1.5 text-xs font-medium w-fit ${isRunning ? 'text-green-500' : 'text-muted'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-green-500' : 'bg-raised border border-line'}`} />
          {vm.status}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {isRunning ? (
          <div className="flex items-center gap-2">
            <div className="w-14 bg-raised rounded-full h-1.5 border border-line">
              <div className={`h-1.5 rounded-full ${cpuPct > 80 ? 'bg-red-500' : 'bg-accent'}`} style={{ width: `${cpuPct}%` }} />
            </div>
            <span className="text-xs text-secondary">{cpuPct}%</span>
          </div>
        ) : <span className="text-xs text-muted">—</span>}
      </td>
      <td className="px-4 py-2.5">
        {vm.maxmem > 0 ? (
          <div className="flex items-center gap-2">
            <div className="w-14 bg-raised rounded-full h-1.5 border border-line">
              <div className={`h-1.5 rounded-full ${memPct > 90 ? 'bg-red-500' : 'bg-accent'}`} style={{ width: `${memPct}%` }} />
            </div>
            <span className="text-xs text-secondary">{formatBytes(vm.mem)}</span>
          </div>
        ) : <span className="text-xs text-muted">—</span>}
      </td>
      <td className="px-4 py-2.5 text-xs text-secondary">
        {isRunning && vm.uptime > 0 ? formatUptime(vm.uptime) : '—'}
      </td>
    </tr>
  )
}

function RecentJobRow({ job }: { job: Job }) {
  return (
    <li className="px-4 py-2.5 flex items-center gap-3 hover:bg-raised">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-primary truncate">{job.type.replace(/_/g, ' ')}</div>
        <div className="text-xs text-muted">{timeAgo(job.created_at)}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(job.status === 'running' || job.status === 'pending') && (
          <div className="w-12 bg-raised rounded-full h-1 border border-line">
            <div className="bg-accent h-1 rounded-full" style={{ width: `${job.progress}%` }} />
          </div>
        )}
        <StatusBadge status={job.status} />
      </div>
    </li>
  )
}

// ── Admin dashboard ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: systemApi.dashboard,
    refetchInterval: 20000,
    staleTime: 0,
  })

  const { data: recentJobs = [] } = useQuery({
    queryKey: ['jobs-dashboard'],
    queryFn: () => jobsApi.list(),
    refetchInterval: 10000,
  })

  if (isLoading) return <div className="py-16 text-center text-secondary">Loading...</div>
  if (error || !data) return <div className="py-16 text-center text-red-500">Failed to load dashboard data</div>

  const nodesOnline = data.nodes.filter(n => n.status === 'online').length
  const liveRunning = data.live_vms.filter(v => v.status === 'running' && !v.template).length
  const totalCpu = data.nodes.reduce((s, n) => s + n.maxcpu, 0)
  const usedCpu = data.nodes.reduce((s, n) => s + n.cpu * n.maxcpu, 0)
  const totalMem = data.nodes.reduce((s, n) => s + n.maxmem, 0)
  const usedMem = data.nodes.reduce((s, n) => s + n.mem, 0)
  const totalDisk = data.nodes.reduce((s, n) => s + n.maxdisk, 0)
  const usedDisk = data.nodes.reduce((s, n) => s + n.disk, 0)

  const displayVMs = data.live_vms.filter(v => !v.template)

  // Group nodes by cluster
  const clusterNames = [...new Set(data.nodes.map(n => n.cluster_name))]

  return (
    <div className="space-y-6">
      {/* Cluster error banners */}
      {Object.entries(data.cluster_errors).map(([name, err]) => (
        <div key={name} className="rounded bg-red-500/10 border border-red-500/30 text-red-500 text-sm p-3">
          <strong>{name}:</strong> {err}
        </div>
      ))}

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Nodes Online" value={`${nodesOnline}/${data.nodes.length}`} color={nodesOnline === data.nodes.length ? 'text-green-500' : 'text-amber-500'} sub={`${data.cluster_count} cluster${data.cluster_count !== 1 ? 's' : ''}`} />
        <StatCard label="VMs Running" value={liveRunning} color={liveRunning > 0 ? 'text-green-500' : 'text-primary'} sub="live from Proxmox" />
        <StatCard label="Active Jobs" value={data.jobs_active} color={data.jobs_active > 0 ? 'text-accent-text' : 'text-primary'} sub="pending + running" />
        <StatCard label="Users" value={data.user_count} sub={`${data.vm_total} total VMs`} />
      </div>

      {/* Cluster resource usage */}
      {data.nodes.length > 0 && (
        <div className="bg-surface border border-line rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-primary">Cluster Resource Usage</h2>
            <span className="text-xs text-muted">{data.nodes.length} node{data.nodes.length !== 1 ? 's' : ''}</span>
          </div>
          <UsageBar used={usedCpu} total={totalCpu} label={`CPU  ·  ${totalCpu} cores total  ·  ${(usedCpu / totalCpu * 100).toFixed(1)}% used`} />
          <UsageBar used={usedMem} total={totalMem} label={`Memory  ·  ${formatBytes(totalMem)} total  ·  ${formatBytes(usedMem)} used`} />
          <UsageBar used={usedDisk} total={totalDisk} label={`Storage  ·  ${formatBytes(totalDisk)} total  ·  ${formatBytes(usedDisk)} used`} />
        </div>
      )}

      {/* Node cards per cluster */}
      {clusterNames.map(clusterName => {
        const clusterNodes = data.nodes.filter(n => n.cluster_name === clusterName)
        return (
          <div key={clusterName}>
            <h2 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-3">{clusterName}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clusterNodes.map(node => <NodeCard key={`${node.cluster_id}-${node.node}`} node={node} />)}
            </div>
          </div>
        )
      })}

      {/* VMs + Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* All VMs table */}
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-line">
            <h2 className="font-semibold text-primary">
              Virtual Machines
              <span className="ml-2 text-xs font-normal text-muted">{displayVMs.filter(v => v.status === 'running').length} running · {displayVMs.length} total</span>
            </h2>
            <Link to="/admin/resources" className="text-xs text-accent-text hover:underline">Full view →</Link>
          </div>
          {displayVMs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">No VMs found on clusters</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-line bg-raised">
                  <tr>
                    {['VM', 'Status', 'CPU', 'Memory', 'Uptime'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-secondary uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {displayVMs.slice(0, 10).map(vm => <LiveVMRow key={`${vm.cluster_name}-${vm.vmid}`} vm={vm} />)}
                </tbody>
              </table>
              {displayVMs.length > 10 && (
                <div className="px-4 py-2 text-xs text-muted text-center border-t border-line">
                  +{displayVMs.length - 10} more — <Link to="/admin/resources" className="text-accent-text hover:underline">view all</Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent jobs */}
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-line">
            <h2 className="font-semibold text-primary">Recent Jobs</h2>
            <Link to="/jobs" className="text-xs text-accent-text hover:underline">View all →</Link>
          </div>
          {recentJobs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">No jobs yet</div>
          ) : (
            <ul className="divide-y divide-line">
              {recentJobs.slice(0, 10).map(job => <RecentJobRow key={job.id} job={job} />)}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-surface border border-line rounded-lg p-4">
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { to: '/admin/clusters', label: '+ Register Cluster' },
            { to: '/admin/flavors', label: '+ New Flavor' },
            { to: '/admin/networks', label: '+ New Network' },
            { to: '/admin/users', label: '+ Create User' },
          ].map(a => (
            <Link key={a.to} to={a.to} className="px-3 py-1.5 text-sm border border-line rounded text-secondary hover:text-primary hover:bg-raised transition-colors">
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── User dashboard ────────────────────────────────────────────────────────────

function UserDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: systemApi.stats,
    refetchInterval: 30000,
  })
  const { data: runningVms = [] } = useQuery({
    queryKey: ['vms', 'running'],
    queryFn: () => vmsApi.list('running'),
    refetchInterval: 15000,
  })
  const { data: recentJobs = [] } = useQuery({
    queryKey: ['jobs-dashboard'],
    queryFn: () => jobsApi.list(),
    refetchInterval: 10000,
  })

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total VMs" value={stats.vm_total} />
          <StatCard label="Running" value={stats.vm_running} color={stats.vm_running > 0 ? 'text-green-500' : 'text-primary'} />
          <StatCard label="Active Jobs" value={stats.jobs_active} color={stats.jobs_active > 0 ? 'text-accent-text' : 'text-primary'} />
          <StatCard label="Failed Jobs" value={stats.jobs_failed} color={stats.jobs_failed > 0 ? 'text-red-500' : 'text-primary'} />
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-line">
            <h2 className="font-semibold text-primary">Running VMs</h2>
            <Link to="/vms" className="text-xs text-accent-text hover:underline">View all →</Link>
          </div>
          {runningVms.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">No VMs currently running</div>
          ) : (
            <ul className="divide-y divide-line">
              {runningVms.slice(0, 8).map(vm => (
                <li key={vm.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-raised">
                  <div>
                    <Link to={`/vms/${vm.id}`} className="text-sm font-medium text-accent-text hover:underline">{vm.name}</Link>
                    {vm.ip_address && <span className="ml-2 text-xs text-muted font-mono">{vm.ip_address}</span>}
                  </div>
                  <StatusBadge status={vm.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-line">
            <h2 className="font-semibold text-primary">Recent Jobs</h2>
            <Link to="/jobs" className="text-xs text-accent-text hover:underline">View all →</Link>
          </div>
          {recentJobs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">No jobs yet</div>
          ) : (
            <ul className="divide-y divide-line">
              {recentJobs.slice(0, 8).map(job => <RecentJobRow key={job.id} job={job} />)}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <Layout>
      <div className="p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <span className="text-xs text-muted">Refreshes automatically</span>
        </div>
        {isAdmin ? <AdminDashboard /> : <UserDashboard />}
      </div>
    </Layout>
  )
}
