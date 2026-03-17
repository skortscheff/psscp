import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, SHODAN_PRESETS, type ShodanPalette } from '../context/ThemeContext'
import { logout } from '../api/auth'
import { clsx } from 'clsx'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/vms', label: 'VMs' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/profile', label: 'Profile' },
]

const adminItems = [
  { to: '/admin/clusters', label: 'Clusters' },
  { to: '/admin/flavors', label: 'Flavors' },
  { to: '/admin/networks', label: 'Networks' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/config', label: 'Config' },
]

function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z" />
    </svg>
  )
}

const COLOR_LABELS: Record<keyof ShodanPalette, string> = {
  accent:      'Accent',
  sidebarNav:  'Sidebar text',
  textPrimary: 'Body text',
  pageBg:      'Background',
}

function ShodanPalettePanel({ onClose }: { onClose: () => void }) {
  const { shodanPalette, setShodanPalette } = useTheme()
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const updateColor = (key: keyof ShodanPalette, value: string) => {
    setShodanPalette({ ...shodanPalette, [key]: value })
  }

  const applyPreset = (key: string) => {
    const { label: _l, ...colors } = SHODAN_PRESETS[key]
    setShodanPalette(colors)
  }

  const isActivePreset = (key: string) => {
    const { label: _l, ...colors } = SHODAN_PRESETS[key]
    return (Object.keys(colors) as (keyof ShodanPalette)[]).every(k => colors[k] === shodanPalette[k])
  }

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-1 w-72 bg-surface border border-line rounded-lg shadow-xl z-50 p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">Shodan Palette</h3>
        <button onClick={onClose} className="text-secondary hover:text-primary text-lg leading-none">×</button>
      </div>

      {/* Preset swatches */}
      <div>
        <p className="text-xs text-muted uppercase tracking-wide mb-2">Presets</p>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(SHODAN_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              title={preset.label}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors',
                isActivePreset(key)
                  ? 'border-accent bg-accent-faint text-accent-text'
                  : 'border-line text-secondary hover:text-primary hover:bg-raised'
              )}
            >
              {/* Color dot */}
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: preset.accent }}
              />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Individual color pickers */}
      <div>
        <p className="text-xs text-muted uppercase tracking-wide mb-2">Custom</p>
        <div className="space-y-2">
          {(Object.keys(COLOR_LABELS) as (keyof ShodanPalette)[]).map(key => (
            <div key={key} className="flex items-center gap-3">
              <label className="text-xs text-secondary w-24 shrink-0">{COLOR_LABELS[key]}</label>
              <div className="flex items-center gap-2 flex-1">
                {/* Native color picker */}
                <div className="relative shrink-0">
                  <input
                    type="color"
                    value={shodanPalette[key]}
                    onChange={e => updateColor(key, e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border border-line p-0 bg-transparent"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                {/* Hex text input */}
                <input
                  type="text"
                  value={shodanPalette[key].toUpperCase()}
                  onChange={e => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updateColor(key, v.length === 7 ? v : shodanPalette[key])
                  }}
                  className="flex-1 min-w-0 border border-input-b bg-input-bg text-primary rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  maxLength={7}
                />
                {/* Live swatch */}
                <span
                  className="w-5 h-5 rounded border border-line shrink-0"
                  style={{ backgroundColor: shodanPalette[key] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => applyPreset('classic')}
        className="w-full text-xs text-secondary hover:text-primary border border-line rounded py-1.5 hover:bg-raised transition-colors"
      >
        Reset to Classic
      </button>
    </div>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, refetch } = useAuth()
  const { theme, mode, setTheme, toggleMode } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const isShodan = theme === 'shodan'
  const [showPalette, setShowPalette] = useState(false)

  const handleLogout = async () => {
    try { await logout() } catch {}
    refetch()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-page flex">
      {/* Sidebar */}
      <aside className="w-56 bg-sidebar flex flex-col border-r border-sidebar-rim">
        <div className={clsx(
          'px-4 py-5 border-b border-sidebar-rim font-bold text-lg',
          isShodan ? 'font-mono text-red-600 tracking-widest' : 'text-white'
        )}>
          {isShodan ? '> PSSCP_' : 'PSSCP'}
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                location.pathname.startsWith(item.to)
                  ? isShodan ? 'bg-sidebar-act text-red-400 font-semibold' : 'bg-sidebar-act text-white'
                  : isShodan ? 'text-sidebar-nav hover:bg-sidebar-act hover:text-red-400' : 'text-sidebar-nav hover:bg-sidebar-act hover:text-white'
              )}
            >
              {item.label}
            </Link>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-1 px-3 text-xs font-semibold text-sidebar-mute uppercase tracking-wider">
                {isShodan ? '// admin' : 'Admin'}
              </div>
              {adminItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={clsx(
                    'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    location.pathname.startsWith(item.to)
                      ? isShodan ? 'bg-sidebar-act text-red-400 font-semibold' : 'bg-sidebar-act text-white'
                      : isShodan ? 'text-sidebar-nav hover:bg-sidebar-act hover:text-red-400' : 'text-sidebar-nav hover:bg-sidebar-act hover:text-white'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="px-4 py-4 border-t border-sidebar-rim">
          <div className="text-sm text-sidebar-mute truncate mb-2">{user?.email}</div>
          <button onClick={handleLogout} className="text-sm text-sidebar-nav hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-surface border-b border-line flex items-center justify-end gap-2 px-4 py-1.5 shrink-0">
          {/* Dark/light toggle — hidden for Shodan */}
          {!isShodan && (
            <button
              onClick={toggleMode}
              title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 rounded text-secondary hover:text-primary hover:bg-raised transition-colors"
            >
              {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          )}

          {/* Palette button — Shodan only */}
          {isShodan && (
            <div className="relative">
              <button
                onClick={() => setShowPalette(v => !v)}
                title="Color palette"
                className={clsx(
                  'p-1.5 rounded transition-colors',
                  showPalette ? 'bg-accent-faint text-accent-text' : 'text-secondary hover:text-primary hover:bg-raised'
                )}
              >
                <PaletteIcon />
              </button>
              {showPalette && <ShodanPalettePanel onClose={() => setShowPalette(false)} />}
            </div>
          )}

          {/* Theme selector */}
          <div className="flex items-center rounded border border-line overflow-hidden text-xs">
            {(['default', 'shodan'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={clsx(
                  'px-2.5 py-1 font-medium transition-colors',
                  theme === t
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface text-secondary hover:text-primary hover:bg-raised'
                )}
              >
                {t === 'default' ? 'Default' : 'Shodan'}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-page">
          {children}
        </main>
      </div>
    </div>
  )
}
