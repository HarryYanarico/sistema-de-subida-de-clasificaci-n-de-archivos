import { env } from '@config/environment'
import { FooterProps } from './Layout.types'

export function Footer({ className = '' }: FooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer className={`border-t py-4 px-6 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2 bg-card/50 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-foreground/80">{env.appTitle}</span>
        <span>·</span>
        <span>© {currentYear}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Sistema Operativo
        </span>
        <span>·</span>
        <span className="font-mono text-[11px]">v1.0.0</span>
      </div>
    </footer>
  )
}
