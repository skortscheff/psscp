import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { AuthGuard } from './components/AuthGuard'
import { AdminGuard } from './components/AdminGuard'
import { Login } from './pages/Login'
import { Setup } from './pages/Setup'
import { Dashboard } from './pages/Dashboard'
import { VMs } from './pages/VMs'
import { VMDetail } from './pages/VMDetail'
import { Jobs } from './pages/Jobs'
import { Profile } from './pages/Profile'
import { AdminClusters } from './pages/admin/Clusters'
import { AdminClusterDetail } from './pages/admin/ClusterDetail'
import { AdminFlavors } from './pages/admin/Flavors'
import { AdminNetworks } from './pages/admin/Networks'
import { AdminUsers } from './pages/admin/Users'
import { AdminConfig } from './pages/admin/Config'

export function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<Login />} />

        <Route element={<AuthGuard />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vms" element={<VMs />} />
          <Route path="/vms/:id" element={<VMDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/profile" element={<Profile />} />

          <Route element={<AdminGuard />}>
            <Route path="/admin/clusters" element={<AdminClusters />} />
            <Route path="/admin/clusters/:id" element={<AdminClusterDetail />} />
            <Route path="/admin/flavors" element={<AdminFlavors />} />
            <Route path="/admin/networks" element={<AdminNetworks />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/config" element={<AdminConfig />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
    </ThemeProvider>
  )
}
