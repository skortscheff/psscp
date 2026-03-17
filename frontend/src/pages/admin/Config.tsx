import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { systemApi } from '../../api/resources'
import { Layout } from '../../components/Layout'
import { InfoBox, FieldHint } from '../../components/InfoBox'

const inputCls = 'w-full border border-input-b bg-input-bg text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

export function AdminConfig() {
  const queryClient = useQueryClient()
  const { data: config, isLoading } = useQuery({ queryKey: ['system-config'], queryFn: systemApi.getConfig })
  const [form, setForm] = useState({ vm_name_prefix: '', max_vms_per_user: 10, allow_self_registration: false })
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (config) setForm({ vm_name_prefix: config.vm_name_prefix, max_vms_per_user: config.max_vms_per_user, allow_self_registration: config.allow_self_registration })
  }, [config])

  const mutation = useMutation({
    mutationFn: () => systemApi.updateConfig(form),
    onSuccess: () => { setSuccess(true); queryClient.invalidateQueries({ queryKey: ['system-config'] }) },
  })

  return (
    <Layout>
      <div className="p-6 max-w-lg">
        <h1 className="text-2xl font-bold text-primary mb-4">System Configuration</h1>

        <InfoBox title="Global Settings">
          <p>These settings apply across all clusters and users. Changes take effect immediately — no restart required.</p>
        </InfoBox>

        {isLoading ? <div className="text-secondary">Loading...</div> : (
          <div className="bg-surface rounded-lg shadow border border-line p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">VM Name Prefix</label>
              <input className={inputCls} placeholder="e.g. psscp- or vm-" value={form.vm_name_prefix} onChange={e => setForm(f => ({ ...f, vm_name_prefix: e.target.value }))} />
              <FieldHint>Prepended to every VM name in Proxmox. Leave blank to use the user-provided name as-is.</FieldHint>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Max VMs per User</label>
              <input type="number" min={1} max={1000} className={inputCls} value={form.max_vms_per_user} onChange={e => setForm(f => ({ ...f, max_vms_per_user: +e.target.value }))} />
              <FieldHint>Maximum VMs a single user can have running at once. Admins are not subject to this limit.</FieldHint>
            </div>

            <div>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={form.allow_self_registration} onChange={e => setForm(f => ({ ...f, allow_self_registration: e.target.checked }))} />
                <span>
                  <span className="font-medium text-primary">Allow self-registration</span>
                  <p className="text-xs text-muted mt-0.5">When enabled, anyone who can reach the login page can create their own account. Recommended: <strong>disabled</strong> for private deployments.</p>
                </span>
              </label>
            </div>

            {success && <p className="text-green-500 text-sm font-medium">Settings saved.</p>}

            <button
              onClick={() => { setSuccess(false); mutation.mutate() }}
              disabled={mutation.isPending}
              className="w-full bg-accent text-on-accent rounded py-2 text-sm hover:bg-accent-dim disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
