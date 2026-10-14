import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, Eye, ArrowRight } from 'lucide-react'
import { ROUTES } from '@config/routes'
import { UploadResultSummaryProps } from './UploadResultSummary.types'

export function UploadResultSummary({
  resultado,
  onReset,
}: UploadResultSummaryProps) {
  return (
    <Card className={resultado.success ? 'border-green-500/50 bg-green-50/20 dark:bg-green-950/10' : 'border-amber-500/50'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {resultado.success ? (
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
            )}
            <div>
              <CardTitle className="text-lg">
                {resultado.success ? '¡Procesamiento Completado!' : 'Procesamiento Finalizado con Observaciones'}
              </CardTitle>
              <CardDescription>
                {resultado.procesados} de {resultado.total_archivos} archivo{resultado.total_archivos !== 1 ? 's' : ''} procesados ({resultado.total_paginas} páginas extraídas y clasificadas)
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onReset}>
            Subir más archivos
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {resultado.detalles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Archivos Procesados Exitosamente
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {resultado.detalles.map((det, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-md bg-background border text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{det.archivo}</span>
                    <span className="text-muted-foreground ml-2">
                      → {det.persona_nombre} ({det.persona_codigo}) · {det.paginas} pág{det.paginas !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <Link to={ROUTES.PERSONAS.CASILLERO(det.persona_id)}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1 text-primary">
                      <Eye className="h-3 w-3" />
                      Ver Casillero
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {resultado.errores.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive">
              Errores Detectados
            </h4>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {resultado.errores.map((err, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive"
                >
                  <span className="font-medium">{err.archivo}</span>
                  <span>{err.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
