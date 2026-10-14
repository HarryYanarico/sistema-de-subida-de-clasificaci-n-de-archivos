import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_SUGERENCIAS_KEYWORD } from '@graphql/queries/tipo-documento.queries'
import { ACEPTAR_SUGERENCIA, DESCARTAR_SUGERENCIA } from '@graphql/mutations/tipo-documento.mutations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, Check, X, Loader2, AlertCircle } from 'lucide-react'
import { SugerenciasKeywordPanelProps } from './SugerenciasKeywordPanel.types'
import { SugerenciaKeywordItem } from '../../types/configuracion.types'

export function SugerenciasKeywordPanel({
  tipoDocumentoId,
  onPalabrasActualizadas,
}: SugerenciasKeywordPanelProps) {
  const { data, loading, error, refetch } = useQuery(GET_SUGERENCIAS_KEYWORD, {
    variables: { tipoDocumentoId },
    fetchPolicy: 'network-only',
  })
  const [aceptarSugerencia] = useMutation(ACEPTAR_SUGERENCIA)
  const [descartarSugerencia] = useMutation(DESCARTAR_SUGERENCIA)

  const [pesos, setPesos] = useState<Record<number, number>>({})
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const sugerencias: SugerenciaKeywordItem[] = data?.sugerenciasKeyword || []

  const handleAceptar = async (sugId: number) => {
    setProcesandoId(sugId)
    setErrorAccion(null)
    const peso = pesos[sugId] ?? 1
    try {
      const res = await aceptarSugerencia({
        variables: { id: Number(sugId), peso: Number(peso) },
      })
      if (res.data?.aceptarSugerencia?.success) {
        if (res.data.aceptarSugerencia.tipoDocumento?.palabrasClave) {
          onPalabrasActualizadas(res.data.aceptarSugerencia.tipoDocumento.palabrasClave)
        }
        await refetch()
      } else {
        setErrorAccion(res.data?.aceptarSugerencia?.message || 'Error al aceptar sugerencia')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de comunicación'
      setErrorAccion(message)
    } finally {
      setProcesandoId(null)
    }
  }

  const handleDescartar = async (sugId: number) => {
    setProcesandoId(sugId)
    setErrorAccion(null)
    try {
      const res = await descartarSugerencia({
        variables: { id: Number(sugId) },
      })
      if (res.data?.descartarSugerencia?.success) {
        await refetch()
      } else {
        setErrorAccion(res.data?.descartarSugerencia?.message || 'Error al descartar sugerencia')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de comunicación'
      setErrorAccion(message)
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h4 className="text-sm font-semibold">Sugerencias Automáticas de Keywords</h4>
        </div>
        {sugerencias.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {sugerencias.length} pendiente{sugerencias.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Palabras detectadas estadísticamente en documentos verificados que no figuran aún en este tipo.
      </p>

      {errorAccion && (
        <div className="flex items-center gap-2 p-2 text-xs text-destructive bg-destructive/10 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorAccion}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Consultando sugerencias...</span>
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">Error al cargar sugerencias: {error.message}</p>
      ) : sugerencias.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 italic">
          No hay sugerencias pendientes para este tipo de documento.
        </p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {sugerencias.map((sug) => {
            const currentPeso = pesos[sug.id] ?? 1
            const isProcessing = procesandoId === sug.id
            return (
              <div
                key={sug.id}
                className="flex items-center justify-between p-2.5 rounded-md border bg-background text-xs gap-2"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">{sug.palabra}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      ratio {Number(sug.ratio).toFixed(2)}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Apariciones: <span className="font-medium text-foreground">{sug.frecuencia}</span> docs
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">Peso:</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={currentPeso}
                      disabled={isProcessing}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(5, Number(e.target.value) || 1))
                        setPesos((prev) => ({ ...prev, [sug.id]: val }))
                      }}
                      className="w-12 h-7 px-1.5 text-center text-xs border rounded bg-background"
                    />
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isProcessing}
                    onClick={() => handleAceptar(sug.id)}
                    title="Aceptar sugerencia y agregar a palabras clave"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Aceptar
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    disabled={isProcessing}
                    onClick={() => handleDescartar(sug.id)}
                    title="Descartar sugerencia"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Descartar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
