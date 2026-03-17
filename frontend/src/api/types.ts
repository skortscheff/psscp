export type UserRole = 'admin' | 'user'
export type VMStatus = 'provisioning' | 'running' | 'stopped' | 'error' | 'deleted'
export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
export type JobType = 'create_vm' | 'delete_vm' | 'start_vm' | 'stop_vm' | 'reboot_vm' | 'register_cluster' | 'delete_cluster'
export type NetworkType = 'bridge' | 'vxlan'
export type DiskBus = 'virtio' | 'scsi' | 'ide'

export interface User {
  id: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Cluster {
  id: string
  name: string
  api_url: string
  api_token_id: string
  tls_verify: boolean
  sdn_enabled: boolean
  is_active: boolean
}

export interface ClusterDetail extends Cluster {
  vm_count: number
  flavor_count: number
  network_count: number
}

export interface ClusterNodeInfo {
  name: string
  status: string
  uptime: number | null
  cpu_usage: number | null
  mem_used: number | null
  mem_total: number | null
}

export interface ClusterTestResult {
  success: boolean
  error: string | null
  version: string | null
  nodes: ClusterNodeInfo[]
  sdn_detected: boolean
  template_count: number
}

export interface Flavor {
  id: string
  cluster_id: string
  name: string
  vcpus: number
  ram_mb: number
  disk_gb: number
  disk_bus: DiskBus
  is_active: boolean
}

export interface Network {
  id: string
  cluster_id: string
  name: string
  type: NetworkType
  bridge_name: string
  vxlan_id: number | null
}

export interface VM {
  id: string
  name: string
  status: VMStatus
  cluster_id: string
  flavor_id: string
  ip_address: string | null
  created_at: string
  user_id?: string
  network_id?: string | null
  proxmox_vmid?: number | null
}

export interface Job {
  id: string
  type: JobType
  status: JobStatus
  progress: number
  created_at: string
  updated_at: string
  user_id?: string
  vm_id?: string | null
  log?: string
  celery_task_id?: string | null
}

export interface JobResponse {
  job_id: string
}

export interface SystemConfig {
  default_cluster_id: string | null
  vm_name_prefix: string
  max_vms_per_user: number
  allow_self_registration: boolean
}

export interface TemplateInfo {
  id: string
  name: string
  os_type: string | null
}

export interface DashboardNodeInfo {
  cluster_id: string
  cluster_name: string
  node: string
  status: string
  cpu: number
  maxcpu: number
  mem: number
  maxmem: number
  disk: number
  maxdisk: number
  uptime: number
}

export interface DashboardLiveVM {
  vmid: number
  name: string
  status: string
  node: string
  cluster_name: string
  cpu: number
  mem: number
  maxmem: number
  maxcpu: number
  uptime: number
  template: boolean
}

export interface DashboardData {
  vm_total: number
  vm_running: number
  vm_stopped: number
  vm_provisioning: number
  vm_error: number
  jobs_active: number
  jobs_failed: number
  cluster_count: number
  user_count: number
  nodes: DashboardNodeInfo[]
  live_vms: DashboardLiveVM[]
  cluster_errors: Record<string, string>
}

export interface LiveVM {
  vmid: number
  name: string
  status: string
  node: string
  type: string
  template: boolean
  cpu: number | null
  mem: number | null
  maxmem: number | null
  uptime: number | null
}

export interface ClusterLiveResources {
  cluster_id: string
  cluster_name: string
  error: string | null
  vms: LiveVM[]
}

export interface SystemStats {
  vm_total: number
  vm_running: number
  vm_stopped: number
  vm_provisioning: number
  vm_error: number
  jobs_active: number
  jobs_failed: number
  // admin only
  cluster_count?: number
  user_count?: number
}
