import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { systemApi, vmsApi, jobsApi } from '../api/resources'
import { Layout } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface rounded-lg shadow border border-line p-5">
      <div className={`text-3xl font-bold ${color ?? 'text-primary'}`}>{value}</div>
      <div className="text-sm font-medium text-secondary mt-1">{label}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  )
}

function VMStatusBar({ running, stopped, provisioning, error, total }: {
  running: number; stopped: number; provisioning: number; error: number; total: number
}) {
  if (total === 0) return null
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`
  const segments = [
    { count: running, color: 'bg-green-500', label: 'Running' },
    { count: provisioning, color: 'bg-accent', label: 'Provisioning' },
    { count: stopped, color: 'bg-raised border border-line', label: 'Stopped' },
    { count: error, color: 'bg-red-500', label: 'Error' },
  ].filter(s => s.count > 0)

  return (
    <div className="bg-surface rounded-lg shadow border border-line p-5">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-primary">VM Status Breakdown</h2>
        <span className="text-sm text-muted">{total} total</span>
      </div>
      <div className="flex rounded overflow-hidden h-4 gap-0.5">
        {segments.map(s => (
          <div key={s.label} className={`${s.color} h-full`} style={{ width: pct(s.count) }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-4 mt-3">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-secondary">
            <span className={`w-2.5 h-2.5 rounded-sm inline-block ${s.color}`} />
            {s.label} ({s.count})
          </div>
        ))}
      </div>
    </div>
  )
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

export function Dashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

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

  const { data: allJobs = [] } = useQuery({
    queryKey: ['jobs', ''],
    queryFn: () => jobsApi.list(),
    refetchInterval: 10000,
  })

  const recentJobs = allJobs.slice(0, 8)

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <span className="text-sm text-muted">Auto-refreshes every 30s</span>
        </div>

        {stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Total VMs" value={stats.vm_total} sub={isAdmin ? 'across all users' : 'your VMs'} />
              <StatCard label="Running" value={stats.vm_running} color={stats.vm_running > 0 ? 'text-green-500' : 'text-primary'} />
              <StatCard label="Active Jobs" value={stats.jobs_active} color={stats.jobs_active > 0 ? 'text-accent-text' : 'text-primary'} sub="pending + running" />
              <StatCard label="Failed Jobs" value={stats.jobs_failed} color={stats.jobs_failed > 0 ? 'text-red-500' : 'text-primary'} sub="all time" />
            </div>

            {isAdmin && stats.cluster_count !== undefined && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Clusters" value={stats.cluster_count} />
                <StatCard label="Active Users" value={stats.user_count ?? 0} />
                <StatCard label="VMs with Errors" value={stats.vm_error} color={stats.vm_error > 0 ? 'text-red-500' : 'text-primary'} />
                <StatCard label="Provisioning" value={stats.vm_provisioning} color={stats.vm_provisioning > 0 ? 'text-accent-text' : 'text-primary'} />
              </div>
            )}

            <VMStatusBar
              running={stats.vm_running}
              stopped={stats.vm_stopped}
              provisioning={stats.vm_provisioning}
              error={stats.vm_error}
              total={stats.vm_total}
            />
          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Running VMs */}
          <div className="bg-surface rounded-lg shadow border border-line">
            <div className="flex justify-between items-center px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-primary">Running VMs</h2>
              <Link to="/vms" className="text-sm text-accent-text hover:underline">View all</Link>
            </div>
            {runningVms.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted">No VMs currently running</div>
            ) : (
              <ul className="divide-y divide-line">
                {runningVms.slice(0, 8).map(vm => (
                  <li key={vm.id} className="px-5 py-3 flex items-center justify-between hover:bg-raised">
                    <div>
                      <Link to={`/vms/${vm.id}`} className="text-sm font-medium text-accent-text hover:underline">{vm.name}</Link>
                      {vm.ip_address && (
                        <span className="ml-2 text-xs text-muted font-mono">{vm.ip_address}</span>
                      )}
                    </div>
                    <StatusBadge status={vm.status} />
                  </li>
                ))}
                {runningVms.length > 8 && (
                  <li className="px-5 py-3 text-center text-xs text-muted">
                    +{runningVms.length - 8} more — <Link to="/vms" className="text-accent-text hover:underline">view all</Link>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Recent jobs */}
          <div className="bg-surface rounded-lg shadow border border-line">
            <div className="flex justify-between items-center px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-primary">Recent Jobs</h2>
              <Link to="/jobs" className="text-sm text-accent-text hover:underline">View all</Link>
            </div>
            {recentJobs.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted">No jobs yet</div>
            ) : (
              <ul className="divide-y divide-line">
                {recentJobs.map(job => (
                  <li key={job.id} className="px-5 py-3 flex items-center gap-3 hover:bg-raised">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">{job.type.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-muted">{timeAgo(job.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(job.status === 'running' || job.status === 'pending') && (
                        <div className="w-16 bg-raised rounded-full h-1 border border-line">
                          <div className="bg-accent h-1 rounded-full" style={{ width: `${job.progress}%` }} />
                        </div>
                      )}
                      <StatusBadge status={job.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="bg-surface rounded-lg shadow border border-line p-5">
            <h2 className="font-semibold text-primary mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { to: '/admin/clusters', label: '+ Register Cluster' },
                { to: '/admin/flavors', label: '+ New Flavor' },
                { to: '/admin/networks', label: '+ New Network' },
                { to: '/admin/users', label: '+ Create User' },
              ].map(a => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="px-4 py-2 text-sm border border-line rounded-md text-secondary hover:text-primary hover:bg-raised transition-colors"
                >
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
