import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi } from '../api/resources'
import { Layout } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'
import { JobProgressModal } from '../components/JobProgressModal'
import type { JobStatus } from '../api/types'

export function Jobs() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: () => jobsApi.list(statusFilter ? { status: statusFilter } : undefined),
    refetchInterval: 5000,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => jobsApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  })

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">Job History</h1>

        <div className="mb-4 flex gap-2">
          {(['', 'pending', 'running', 'success', 'failed', 'cancelled'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s as JobStatus | '')}
              className={`px-3 py-1 rounded text-sm ${statusFilter === s ? 'bg-accent text-on-accent' : 'bg-surface border border-line text-secondary hover:text-primary hover:bg-raised'}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-secondary">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-muted">No jobs found.</div>
        ) : (
          <div className="bg-surface rounded-lg shadow border border-line overflow-hidden">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-raised">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Created</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {jobs.map(job => {
                  const isActive = job.status === 'pending' || job.status === 'running'
                  return (
                    <tr key={job.id} className="hover:bg-raised">
                      <td className="px-6 py-4 text-sm font-medium text-primary cursor-pointer" onClick={() => setSelectedJobId(job.id)}>{job.type}</td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedJobId(job.id)}><StatusBadge status={job.status} /></td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedJobId(job.id)}>
                        <div className="w-24 bg-raised rounded-full h-1.5 border border-line">
                          <div
                            className={`h-1.5 rounded-full ${job.status === 'failed' ? 'bg-red-500' : job.status === 'cancelled' ? 'bg-muted' : 'bg-accent'}`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary cursor-pointer" onClick={() => setSelectedJobId(job.id)}>{new Date(job.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {isActive && (
                            <button
                              onClick={() => { if (confirm('Cancel this job?')) cancelMutation.mutate(job.id) }}
                              disabled={cancelMutation.isPending && cancelMutation.variables === job.id}
                              className="text-sm text-red-500 hover:underline disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                          <button onClick={() => setSelectedJobId(job.id)} className="text-sm text-accent-text hover:underline">View</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedJobId && (
        <JobProgressModal
          jobId={selectedJobId}
          title="Job Details"
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </Layout>
  )
}
