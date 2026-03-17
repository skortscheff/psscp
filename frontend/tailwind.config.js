/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic theme colors — driven by CSS custom properties in index.css
        page:           'rgb(var(--page) / <alpha-value>)',
        surface:        'rgb(var(--surface) / <alpha-value>)',
        raised:         'rgb(var(--raised) / <alpha-value>)',
        sidebar:        'rgb(var(--sidebar) / <alpha-value>)',
        'sidebar-rim':  'rgb(var(--sidebar-rim) / <alpha-value>)',
        'sidebar-nav':  'rgb(var(--sidebar-nav) / <alpha-value>)',
        'sidebar-mute': 'rgb(var(--sidebar-mute) / <alpha-value>)',
        'sidebar-act':  'rgb(var(--sidebar-act) / <alpha-value>)',
        primary:        'rgb(var(--text-primary) / <alpha-value>)',
        secondary:      'rgb(var(--text-secondary) / <alpha-value>)',
        muted:          'rgb(var(--text-muted) / <alpha-value>)',
        line:           'rgb(var(--line) / <alpha-value>)',
        'input-b':      'rgb(var(--input-border) / <alpha-value>)',
        'input-bg':     'rgb(var(--input-bg) / <alpha-value>)',
        accent:         'rgb(var(--accent) / <alpha-value>)',
        'accent-dim':   'rgb(var(--accent-dim) / <alpha-value>)',
        'on-accent':    'rgb(var(--on-accent) / <alpha-value>)',
        'accent-faint': 'rgb(var(--accent-faint) / <alpha-value>)',
        'accent-text':  'rgb(var(--accent-text-color) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
