import { apiClient } from './client'
import type { Cluster, ClusterDetail, ClusterTestResult, ClusterLiveResources, DashboardData, Flavor, Network, VM, Job, User, SystemConfig, SystemStats, TemplateInfo, JobResponse } from './types'

// Clusters
export const clustersApi = {
  list: () => apiClient.get<Cluster[]>('/clusters').then(r => r.data),
  get: (id: string) => apiClient.get<ClusterDetail>(`/clusters/${id}`).then(r => r.data),
  create: (data: unknown) => apiClient.post<JobResponse>('/clusters', data).then(r => r.data),
  update: (id: string, data: unknown) => apiClient.patch<Cluster>(`/clusters/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete<JobResponse>(`/clusters/${id}`).then(r => r.data),
  templates: (id: string) => apiClient.get<TemplateInfo[]>(`/clusters/${id}/templates`).then(r => r.data),
  test: (id: string) => apiClient.get<ClusterTestResult>(`/clusters/${id}/test`).then(r => r.data),
  liveResources: () => apiClient.get<ClusterLiveResources[]>('/clusters/live-resources').then(r => r.data),
}

// Flavors
export const flavorsApi = {
  list: (cluster_id?: string) => apiClient.get<Flavor[]>('/flavors', { params: cluster_id ? { cluster_id } : undefined }).then(r => r.data),
  get: (id: string) => apiClient.get<Flavor>(`/flavors/${id}`).then(r => r.data),
  create: (data: unknown) => apiClient.post<Flavor>('/flavors', data).then(r => r.data),
  update: (id: string, data: unknown) => apiClient.patch<Flavor>(`/flavors/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/flavors/${id}`),
}

// Networks
export const networksApi = {
  list: (cluster_id?: string) => apiClient.get<Network[]>('/networks', { params: cluster_id ? { cluster_id } : undefined }).then(r => r.data),
  get: (id: string) => apiClient.get<Network>(`/networks/${id}`).then(r => r.data),
  create: (data: unknown) => apiClient.post<Network>('/networks', data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/networks/${id}`),
}

// VMs
export const vmsApi = {
  list: (status?: string) => apiClient.get<VM[]>('/vms', { params: status ? { status } : undefined }).then(r => r.data),
  get: (id: string) => apiClient.get<VM>(`/vms/${id}`).then(r => r.data),
  create: (data: unknown) => apiClient.post<JobResponse>('/vms', data).then(r => r.data),
  delete: (id: string) => apiClient.delete<JobResponse>(`/vms/${id}`).then(r => r.data),
  start: (id: string) => apiClient.post<JobResponse>(`/vms/${id}/start`).then(r => r.data),
  stop: (id: string) => apiClient.post<JobResponse>(`/vms/${id}/stop`).then(r => r.data),
  reboot: (id: string) => apiClient.post<JobResponse>(`/vms/${id}/reboot`).then(r => r.data),
}

// Jobs
export const jobsApi = {
  list: (params?: { status?: string; type?: string }) => apiClient.get<Job[]>('/jobs', { params }).then(r => r.data),
  get: (id: string) => apiClient.get<Job>(`/jobs/${id}`).then(r => r.data),
  cancel: (id: string) => apiClient.post<Job>(`/jobs/${id}/cancel`).then(r => r.data),
}

// Users
export const usersApi = {
  list: () => apiClient.get<User[]>('/users').then(r => r.data),
  me: () => apiClient.get<User>('/users/me').then(r => r.data),
  get: (id: string) => apiClient.get<User>(`/users/${id}`).then(r => r.data),
  create: (data: unknown) => apiClient.post<User>('/users', data).then(r => r.data),
  update: (id: string, data: unknown) => apiClient.patch<User>(`/users/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/users/${id}`),
}

// System config + setup
export const systemApi = {
  getConfig: () => apiClient.get<SystemConfig>('/system/config').then(r => r.data),
  updateConfig: (data: unknown) => apiClient.patch<SystemConfig>('/system/config', data).then(r => r.data),
  health: () => apiClient.get('/system/health').then(r => r.data),
  stats: () => apiClient.get<SystemStats>('/system/stats').then(r => r.data),
  dashboard: () => apiClient.get<DashboardData>('/system/dashboard').then(r => r.data),
  setupStatus: () => apiClient.get<{ needs_setup: boolean }>('/system/setup-status').then(r => r.data),
  setup: (data: { email: string; password: string }) =>
    apiClient.post<{ access_token: string; token_type: string; expires_in: number }>('/system/setup', data).then(r => r.data),
}
