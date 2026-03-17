import { clsx } from 'clsx'
import type { VMStatus, JobStatus } from '../api/types'

type Status = VMStatus | JobStatus | string

const colorMap: Record<string, string> = {
  running: 'bg-green-100 text-green-800',
  success: 'bg-green-100 text-green-800',
  stopped: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  provisioning: 'bg-blue-100 text-blue-800',
  error: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  deleted: 'bg-gray-100 text-gray-400',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', colorMap[status] ?? 'bg-gray-100 text-gray-800')}>
      {status}
    </span>
  )
}
