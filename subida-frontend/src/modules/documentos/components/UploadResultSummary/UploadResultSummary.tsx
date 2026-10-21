import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, ArrowRight, Layers, Eye } from 'lucide-react'
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
                {resultado.success ? '¡Archivos Subidos y Lotes Creados!' : 'Procesamiento Finalizado con Observaciones'}
              </CardTitle>
              <CardDescription>
                {resultado.procesados} de {resultado.total_archivos} archivo{resultado.total_archivos !== 1 ? 's' : ''} procesados ({resultado.total_paginas} páginas extraídas y agrupadas)
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
              Lotes Listos para Revisión y Nombramiento
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {resultado.detalles.map((det, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between p-3 rounded-lg bg-background border text-xs gap-3"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-foreground">{det.archivo}</span>
                    <div className="text-muted-foreground mt-0.5 flex items-center gap-2">
                      {det.persona_codigo ? (
                        <span>Estudiante: {det.persona_nombre || det.persona_codigo}</span>
                      ) : (
                        <span>Lote a nivel de unidad</span>
                      )}
                      <span>·</span>
                      <span>{det.total_paginas || det.paginas} págs</span>
                      {det.total_grupos ? (
                        <>
                          <span>·</span>
                          <span className="text-primary font-medium">{det.total_grupos} grupos detectados</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {det.lote_id && (
                      <Link to={ROUTES.LOTES.AGRUPAR(det.lote_id)}>
                        <Button size="sm" className="h-8 text-xs px-3 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground">
                          <Layers className="h-3.5 w-3.5" />
                          Revisar Grupos y Nombrar Tipos
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                    {det.persona_id && (
                      <Link to={ROUTES.PERSONAS.CASILLERO(det.persona_id)}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground">
                          <Eye className="h-3 w-3" />
                          Casillero
                        </Button>
                      </Link>
                    )}
                  </div>
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
