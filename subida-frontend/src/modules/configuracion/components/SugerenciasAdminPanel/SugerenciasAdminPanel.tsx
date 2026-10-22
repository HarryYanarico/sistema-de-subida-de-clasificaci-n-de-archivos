import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_SUGERENCIAS_ADMIN } from '@graphql/queries/tipo-documento.queries'
import { GUARDAR_PALABRAS_ADMIN } from '@graphql/mutations/tipo-documento.mutations'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react'
import {
  PalabraSugerida,
  SugerenciasAdminPanelProps,
  SugerenciasAdminData,
} from './SugerenciasAdminPanel.types'

export function SugerenciasAdminPanel({
  tipoDocumentoId,
  onPalabrasActualizadas,
}: SugerenciasAdminPanelProps) {
  const { data, loading, error, refetch } = useQuery<{ sugerenciasAdmin: SugerenciasAdminData }>(
    GET_SUGERENCIAS_ADMIN,
    {
      variables: { tipoId: String(tipoDocumentoId) },
      fetchPolicy: 'network-only',
    }
  )

  const [guardarPalabrasAdminMutation, { loading: guardando }] =
    useMutation(GUARDAR_PALABRAS_ADMIN)

  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [obligatorias, setObligatorias] = useState<Set<string>>(new Set())
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [exitoGuardado, setExitoGuardado] = useState(false)

  const sugerencias = data?.sugerenciasAdmin

  // Inicializar estado cuando cargan las sugerencias
  useEffect(() => {
    if (!sugerencias || !sugerencias.suficientesEjemplos) return

    const nuevasSeleccionadas = new Set<string>()
    const nuevasObligatorias = new Set<string>()

    const procesarLista = (lista: PalabraSugerida[]) => {
      for (const item of lista) {
        if (item.seleccionada) {
          nuevasSeleccionadas.add(item.palabra)
        }
        if (item.esObligatoria) {
          nuevasObligatorias.add(item.palabra)
          nuevasSeleccionadas.add(item.palabra)
        }
      }
    }

    procesarLista(sugerencias.siempre)
    procesarLista(sugerencias.suelen)
    procesarLista(sugerencias.yaNoAparecen)

    setSeleccionadas(nuevasSeleccionadas)
    setObligatorias(nuevasObligatorias)
  }, [sugerencias])

  const toggleSeleccion = (palabra: string, checked: boolean) => {
    setExitoGuardado(false)
    setErrorGuardado(null)
    setSeleccionadas((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(palabra)
      } else {
        next.delete(palabra)
        // Si se desmarca, también remover el candado
        setObligatorias((prevObl) => {
          const nextObl = new Set(prevObl)
          nextObl.delete(palabra)
          return nextObl
        })
      }
      return next
    })
  }

  const toggleObligatoria = (palabra: string) => {
    setExitoGuardado(false)
    setErrorGuardado(null)
    setObligatorias((prev) => {
      const next = new Set(prev)
      if (next.has(palabra)) {
        next.delete(palabra)
      } else {
        next.add(palabra)
        // Si se activa el candado, automáticamente queda seleccionada
        setSeleccionadas((prevSel) => new Set(prevSel).add(palabra))
      }
      return next
    })
  }

  const handleGuardar = async () => {
    setErrorGuardado(null)
    setExitoGuardado(false)

    try {
      const res = await guardarPalabrasAdminMutation({
        variables: {
          tipoId: String(tipoDocumentoId),
          palabrasSeleccionadas: Array.from(seleccionadas),
          palabrasObligatorias: Array.from(obligatorias),
        },
      })

      const tipoActualizado = res.data?.guardarPalabrasAdmin
      if (tipoActualizado) {
        setExitoGuardado(true)
        if (onPalabrasActualizadas) {
          onPalabrasActualizadas(
            tipoActualizado.palabrasClave || '',
            tipoActualizado.keywordsObligatorias || []
          )
        }
        refetch()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar palabras sugeridas'
      setErrorGuardado(msg)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 border rounded-lg bg-muted/20 text-muted-foreground gap-2 text-xs">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>Calculando sugerencias en lenguaje natural...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{error.message}</span>
      </div>
    )
  }

  // Menos de 3 ejemplos: mensaje amigable sin jerga técnica
  if (!sugerencias || !sugerencias.suficientesEjemplos) {
    return (
      <div className="p-4 rounded-lg border border-dashed bg-muted/30 flex items-start gap-3">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Aún no hay suficientes documentos para sugerir palabras</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A medida que confirmes documentos de este tipo (al menos 3 páginas), el sistema analizará automáticamente
            sus patrones comunes para sugerirte palabras clave sin que tengas que configurarlas a mano.
          </p>
        </div>
      </div>
    )
  }

  const renderFilaPalabra = (item: PalabraSugerida, variante: 'siempre' | 'suelen' | 'quitar') => {
    const estaSeleccionada = seleccionadas.has(item.palabra)
    const esOblig = obligatorias.has(item.palabra)

    return (
      <div
        key={item.palabra}
        className={`flex items-center justify-between p-2 rounded-md border text-xs transition-colors ${
          estaSeleccionada
            ? 'bg-card border-border shadow-xs'
            : 'bg-muted/30 border-dashed border-muted text-muted-foreground'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Checkbox
            id={`chk-${item.palabra}`}
            checked={estaSeleccionada}
            onCheckedChange={(checked) => toggleSeleccion(item.palabra, Boolean(checked))}
          />
          <label
            htmlFor={`chk-${item.palabra}`}
            className="font-medium cursor-pointer select-none truncate text-foreground"
          >
            {item.palabra}
          </label>
        </div>

        {variante !== 'quitar' && (
          <Button
            type="button"
            variant={esOblig ? 'default' : 'ghost'}
            size="sm"
            onClick={() => toggleObligatoria(item.palabra)}
            className={`h-7 px-2 text-[11px] gap-1 font-normal ${
              esOblig
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={
              esOblig
                ? 'Palabra obligatoria: Sin esta palabra el documento no se clasificará como este tipo'
                : 'Hacer obligatoria: Exigir que esta palabra esté presente en el documento'
            }
          >
            {esOblig ? (
              <>
                <Lock className="h-3 w-3" />
                <span className="hidden sm:inline">Obligatoria</span>
              </>
            ) : (
              <>
                <Unlock className="h-3 w-3 opacity-60" />
                <span className="hidden sm:inline text-muted-foreground">Opcional</span>
              </>
            )}
          </Button>
        )}

        {variante === 'quitar' && (
          <span className="text-[11px] text-muted-foreground italic">
            ¿Quitar?
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border p-4 bg-muted/15">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Sugerencias Automáticas Inteligentes</h4>
            <p className="text-xs text-muted-foreground">
              Basadas en {sugerencias.totalEjemplos} documentos confirmados de este tipo (sin números ni fórmulas técnicas).
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-[11px] font-mono">
          {sugerencias.totalEjemplos} ejemplos
        </Badge>
      </div>

      {/* 1. Siempre aparecen (> 80%) */}
      {sugerencias.siempre.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <h5 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Siempre aparecen en este tipo (en más del 80% de los documentos)
            </h5>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sugerencias.siempre.map((item) => renderFilaPalabra(item, 'siempre'))}
          </div>
        </div>
      )}

      {/* 2. Suelen aparecer (30% - 80%) */}
      {sugerencias.suelen.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-dashed">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <h5 className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Suelen aparecer (en varios documentos de este tipo)
            </h5>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sugerencias.suelen.map((item) => renderFilaPalabra(item, 'suelen'))}
          </div>
        </div>
      )}

      {/* 3. Ya no aparecen (< 30%) */}
      {sugerencias.yaNoAparecen.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-dashed">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <h5 className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              Ya no aparecen en los documentos recientes
            </h5>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sugerencias.yaNoAparecen.map((item) => renderFilaPalabra(item, 'quitar'))}
          </div>
        </div>
      )}

      {/* Explicación del candado */}
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
        <Lock className="h-3 w-3 text-amber-600 shrink-0" />
        <span>
          <strong>Candado activo:</strong> Exige que esa palabra aparezca sí o sí en el documento para que sea considerado de este tipo.
        </span>
      </p>

      {/* Acciones y feedback */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t">
        <div className="flex items-center gap-2 text-xs">
          {exitoGuardado && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
              <CheckCircle2 className="h-4 w-4" /> Palabras aplicadas correctamente
            </span>
          )}
          {errorGuardado && (
            <span className="text-destructive font-medium">
              {errorGuardado}
            </span>
          )}
        </div>

        <Button
          type="button"
          onClick={handleGuardar}
          disabled={guardando}
          size="sm"
          className="text-xs gap-1.5 font-medium ml-auto shadow-sm"
        >
          {guardando ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Guardando sugerencias...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aplicar Palabras Sugeridas
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
