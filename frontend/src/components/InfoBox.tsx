interface Props {
  title: string
  children: React.ReactNode
  variant?: 'info' | 'warning'
}

export function InfoBox({ title, children, variant = 'info' }: Props) {
  const colors = variant === 'warning'
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
    : 'bg-accent-faint border-accent/20 text-primary'
  const titleColor = variant === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-accent-text'

  return (
    <div className={`border rounded-lg p-4 mb-6 ${colors}`}>
      <p className={`text-sm font-semibold mb-1 ${titleColor}`}>{title}</p>
      <div className="text-sm space-y-1 text-secondary">{children}</div>
    </div>
  )
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted mt-1">{children}</p>
}
