import type { ContextSector } from '../utils/instance-context-usage'

export function ContextUsagePie({ sectors, size = 32 }: { sectors: ContextSector[]; size?: number }) {
  return (
    <svg data-testid="instance-context-pie" aria-hidden="true" viewBox="0 0 40 40" width={size} height={size} className="shrink-0">
      <circle cx="20" cy="20" r="17" fill="currentColor" className="text-muted" />
      {sectors.map(({ key, color, share }, index) => {
        const offset = sectors.slice(0, index).reduce((sum, sector) => sum + sector.share, 0)
        const start = offset * Math.PI * 2
        const end = Math.min(1, offset + share) * Math.PI * 2
        const props = {
          fill: color || 'currentColor',
          className: color ? undefined : 'text-muted',
          'data-testid': `context-sector-${key}`,
          'data-share': share,
        }
        if (share >= 1) return <circle key={key} cx="20" cy="20" r="17" {...props} />
        const x = (angle: number) => (20 + 17 * Math.sin(angle)).toFixed(3)
        const y = (angle: number) => (20 - 17 * Math.cos(angle)).toFixed(3)
        return <path key={key} {...props}
          d={`M 20 20 L ${x(start)} ${y(start)} A 17 17 0 ${share > 0.5 ? 1 : 0} 1 ${x(end)} ${y(end)} Z`} />
      })}
      <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-border" />
    </svg>
  )
}