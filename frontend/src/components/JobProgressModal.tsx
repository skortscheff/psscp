import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useJob } from '../hooks/useJob'
import { jobsApi } from '../api/resources'

interface Props {
  jobId: string
  onClose: () => void
  title?: string
}

export function JobProgressModal({ jobId, onClose, title = 'Job Progress' }: Props) {
  const { job } = useJob(jobId)
  const queryClient = useQueryClient()

  const cancelMutation = useMutation({
    mutationFn: () => jobsApi.cancel(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job', jobId] }),
  })

  const isActive = job && (job.status === 'pending' || job.status === 'running')
  const isTerminal = job && ['success', 'failed', 'cancelled'].includes(job.status)

  const statusColor =
    job?.status === 'failed'    ? 'text-red-500' :
    job?.status === 'cancelled' ? 'text-secondary' :
    job?.status === 'success'   ? 'text-green-500' :
    'text-accent-text'

  const barColor =
    job?.status === 'failed'    ? 'bg-red-500' :
    job?.status === 'cancelled' ? 'bg-raised' :
    'bg-accent'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg p-6 border border-line">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary text-xl leading-none" title="Close">&#x2715;</button>
        </div>

        {job ? (
          <>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className={`font-medium ${statusColor}`}>{job.status}</span>
                <span className="text-secondary">{job.progress}%</span>
              </div>
              <div className="w-full bg-raised rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${job.progress}%` }} />
              </div>
              {isActive && (
                <p className="text-xs text-muted mt-1">Closing this window will not stop the job — it will continue running in the background.</p>
              )}
            </div>

            {job.log && (
              <div className="bg-gray-900 text-gray-100 rounded p-3 text-xs font-mono h-48 overflow-y-auto whitespace-pre-wrap border border-line">
                {job.log}
              </div>
            )}

            <div className="flex justify-between items-center mt-4">
              <div>
                {isActive && (
                  <button
                    onClick={() => { if (confirm('Cancel this job? The operation will be stopped and the job marked as cancelled.')) cancelMutation.mutate() }}
                    disabled={cancelMutation.isPending}
                    className="px-3 py-1.5 text-sm text-red-500 border border-red-500/30 rounded hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Job'}
                  </button>
                )}
                {cancelMutation.isError && (
                  <p className="text-xs text-red-500 mt-1">Failed to cancel job.</p>
                )}
              </div>
              <button
                onClick={onClose}
                className={`px-4 py-1.5 text-sm rounded ${isTerminal ? 'bg-accent text-on-accent hover:bg-accent-dim' : 'border border-line text-secondary hover:text-primary hover:bg-raised'}`}
              >
                {isTerminal ? 'Done' : 'Close'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-secondary">Loading job...</div>
        )}
      </div>
    </div>
  )
}
