import { createContext, useContext, useEffect, useRef, useState } from 'react'

export type Theme = 'default' | 'shodan'
export type Mode = 'light' | 'dark'

export interface ShodanPalette {
  accent: string      // primary action color
  sidebarNav: string  // sidebar nav text
  textPrimary: string // body text
  pageBg: string      // darkest background
}

export const SHODAN_PRESETS: Record<string, ShodanPalette & { label: string }> = {
  classic: { label: 'Classic',   accent: '#c10000', sidebarNav: '#8b0000', textPrimary: '#d4d4d4', pageBg: '#060606' },
  matrix:  { label: 'Matrix',    accent: '#00b800', sidebarNav: '#005000', textPrimary: '#00e000', pageBg: '#000400' },
  amber:   { label: 'Amber',     accent: '#c06000', sidebarNav: '#804000', textPrimary: '#ffb347', pageBg: '#060200' },
  ice:     { label: 'Ice',       accent: '#0080c8', sidebarNav: '#004888', textPrimary: '#b0d8ff', pageBg: '#000508' },
  purple:  { label: 'Purple',    accent: '#8800cc', sidebarNav: '#500080', textPrimary: '#d4b0ff', pageBg: '#060008' },
}

const DEFAULT_PALETTE: ShodanPalette = SHODAN_PRESETS.classic

interface ThemeContextValue {
  theme: Theme
  mode: Mode
  setTheme: (t: Theme) => void
  toggleMode: () => void
  shodanPalette: ShodanPalette
  setShodanPalette: (p: ShodanPalette) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'default',
  mode: 'light',
  setTheme: () => {},
  toggleMode: () => {},
  shodanPalette: DEFAULT_PALETTE,
  setShodanPalette: () => {},
})

// --- color math helpers ---

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

function scale(hex: string, factor: number): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor))
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor))
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor))
  return `${r} ${g} ${b}`
}

function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  return `${r} ${g} ${b}`
}

function applyPaletteToDOM(palette: ShodanPalette) {
  const el = document.documentElement
  // Accent family
  el.style.setProperty('--accent',            hexToRgb(palette.accent))
  el.style.setProperty('--accent-dim',        scale(palette.accent, 0.72))
  el.style.setProperty('--accent-faint',      scale(palette.accent, 0.12))
  el.style.setProperty('--accent-text-color', scale(palette.accent, 1.35))
  el.style.setProperty('--on-accent',         '255 255 255')
  el.style.setProperty('--sidebar-act',       scale(palette.accent, 0.10))
  el.style.setProperty('--sidebar-rim',       scale(palette.accent, 0.07))
  el.style.setProperty('--input-border',      scale(palette.accent, 0.25))
  // Sidebar nav
  el.style.setProperty('--sidebar-nav',       hexToRgb(palette.sidebarNav))
  el.style.setProperty('--sidebar-mute',      scale(palette.sidebarNav, 0.50))
  // Text
  el.style.setProperty('--text-primary',      hexToRgb(palette.textPrimary))
  el.style.setProperty('--text-secondary',    scale(palette.textPrimary, 0.58))
  el.style.setProperty('--text-muted',        scale(palette.textPrimary, 0.34))
  // Backgrounds
  el.style.setProperty('--page',              hexToRgb(palette.pageBg))
  el.style.setProperty('--surface',           lighten(palette.pageBg, 6))
  el.style.setProperty('--raised',            lighten(palette.pageBg, 14))
  el.style.setProperty('--line',              lighten(palette.pageBg, 22))
  el.style.setProperty('--input-bg',          lighten(palette.pageBg, 10))
  el.style.setProperty('--sidebar',           '0 0 0')
}

function clearPaletteOverrides() {
  const el = document.documentElement
  ;['--accent', '--accent-dim', '--accent-faint', '--accent-text-color', '--on-accent',
    '--sidebar-act', '--sidebar-rim', '--input-border', '--sidebar-nav', '--sidebar-mute',
    '--text-primary', '--text-secondary', '--text-muted',
    '--page', '--surface', '--raised', '--line', '--input-bg', '--sidebar',
  ].forEach(p => el.style.removeProperty(p))
}

function applyToDOM(theme: Theme, mode: Mode) {
  const el = document.documentElement
  el.classList.remove('theme-default', 'theme-shodan', 'dark')
  el.classList.add(`theme-${theme}`)
  if (theme === 'shodan' || mode === 'dark') el.classList.add('dark')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    (localStorage.getItem('theme') as Theme) ?? 'default'
  )
  const [mode, setModeState] = useState<Mode>(() =>
    (localStorage.getItem('mode') as Mode) ?? 'light'
  )
  const [shodanPalette, setShodanPaletteState] = useState<ShodanPalette>(() => {
    try {
      const saved = localStorage.getItem('shodanPalette')
      return saved ? JSON.parse(saved) : DEFAULT_PALETTE
    } catch { return DEFAULT_PALETTE }
  })

  // Keep a ref so applyAll can read current theme without re-triggering
  const themeRef = useRef(theme)
  themeRef.current = theme

  useEffect(() => {
    applyToDOM(theme, mode)
    if (theme === 'shodan') {
      applyPaletteToDOM(shodanPalette)
    } else {
      clearPaletteOverrides()
    }
  }, [theme, mode, shodanPalette])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
  }

  const toggleMode = () => {
    const next: Mode = mode === 'light' ? 'dark' : 'light'
    setModeState(next)
    localStorage.setItem('mode', next)
  }

  const setShodanPalette = (p: ShodanPalette) => {
    setShodanPaletteState(p)
    localStorage.setItem('shodanPalette', JSON.stringify(p))
  }

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, toggleMode, shodanPalette, setShodanPalette }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
