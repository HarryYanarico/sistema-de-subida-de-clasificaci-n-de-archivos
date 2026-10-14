import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertCircle, Layers } from 'lucide-react'
import { UploadProgressProps } from './UploadProgress.types'

export function UploadProgress({
  progresoLista,
  porcentaje,
  faseActual,
}: UploadProgressProps) {
  if (progresoLista.length === 0) return null

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Digitalizando y Clasificando Documentos...
          </CardTitle>
          <span className="text-sm font-semibold">{porcentaje}%</span>
        </div>
        <Progress value={porcentaje} className="h-2 mt-2" />
        {faseActual && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{faseActual}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {progresoLista.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-md bg-background/80 border text-xs gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.estado === 'procesando' && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                )}
                {item.estado === 'completado' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                )}
                {item.estado === 'error' && (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                )}
                {item.estado === 'pendiente' && (
                  <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                )}
                <span className="font-medium truncate">{item.archivo}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.estado === 'completado' && (
                  <>
                    <span className="text-muted-foreground">{item.persona_nombre}</span>
                    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                      <Layers className="h-3 w-3" />
                      {item.paginas} pág.
                    </Badge>
                  </>
                )}
                {item.estado === 'error' && (
                  <span className="text-destructive font-medium">{item.error}</span>
                )}
                {item.estado === 'procesando' && (
                  <span className="text-primary font-medium animate-pulse">Procesando...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
