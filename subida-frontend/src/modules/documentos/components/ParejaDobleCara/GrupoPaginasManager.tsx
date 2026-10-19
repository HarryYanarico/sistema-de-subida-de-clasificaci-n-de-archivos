import { useState, useMemo } from 'react'
import { useMutation } from '@apollo/client'
import { Button } from '@/components/ui/button'
import { ParejaDobleCaraCard } from './ParejaDobleCaraCard'
import { DocumentoBorrador } from './ParejaDobleCaraCard.types'
import { Pagina, ParejaSugerida } from '@app-types/documento.types'
import { CREAR_DOCUMENTO_CON_PAGINAS } from '@graphql/mutations/documento.mutations'
import { CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react'

export interface GrupoPaginasManagerProps {
  loteId: number | string
  grupoId?: number | string
  paginas: Pagina[]
  parejasSugeridas?: ParejaSugerida[]
  tipoDocumentoId?: number | null
  onDocumentosCreados?: () => void
}

export function GrupoPaginasManager({
  loteId,
  paginas,
  parejasSugeridas = [],
  tipoDocumentoId,
  onDocumentosCreados,
}: GrupoPaginasManagerProps) {
  // Construcción inicial de documentos borradores a partir de páginas y parejas sugeridas
  const [documentos, setDocumentos] = useState<DocumentoBorrador[]>(() => {
    const ordenadas = [...paginas].sort((a, b) => a.nroPaginaEnPdf - b.nroPaginaEnPdf)
    const paresSet = new Set<string>()
    for (const pareja of parejasSugeridas) {
      paresSet.add(`${pareja.paginaAnversoId}-${pareja.paginaReversoId}`)
    }

    const resultado: DocumentoBorrador[] = []
    const visitadas = new Set<number>()

    for (let i = 0; i < ordenadas.length; i++) {
      const pActual = ordenadas[i]
      if (visitadas.has(pActual.id)) continue

      const pSiguiente = ordenadas[i + 1]
      const esParejaSugerida =
        pSiguiente &&
        !visitadas.has(pSiguiente.id) &&
        (paresSet.has(`${pActual.id}-${pSiguiente.id}`) ||
          (pSiguiente.nroPaginaEnPdf === pActual.nroPaginaEnPdf + 1 &&
            (pActual.textoOcr.length < 200 || pSiguiente.textoOcr.length < 200)))

      if (esParejaSugerida) {
        resultado.push({
          id: `doc-${pActual.id}-${pSiguiente.id}`,
          nombre: `Documento doble cara (Págs. ${pActual.nroPaginaEnPdf}-${pSiguiente.nroPaginaEnPdf})`,
          esDobleCara: true,
          paginas: [pActual, pSiguiente],
        })
        visitadas.add(pActual.id)
        visitadas.add(pSiguiente.id)
      } else {
        resultado.push({
          id: `doc-${pActual.id}`,
          nombre: `Página ${pActual.nroPaginaEnPdf}`,
          esDobleCara: false,
          paginas: [pActual],
        })
        visitadas.add(pActual.id)
      }
    }

    return resultado
  })

  const [guardando, setGuardando] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)
  const [crearDocumentoConPaginasMutation] = useMutation(CREAR_DOCUMENTO_CON_PAGINAS)

  // Desmarcar checkbox: separa las 2 páginas en documentos individuales independientes
  const handleToggleDobleCara = (docId: string, checked: boolean) => {
    setDocumentos((prev) => {
      const docIndex = prev.findIndex((d) => d.id === docId)
      if (docIndex === -1) return prev

      const doc = prev[docIndex]
      if (!checked && doc.paginas.length === 2) {
        // Separar en 2 documentos individuales
        const [p1, p2] = doc.paginas
        const nuevos = [
          ...prev.slice(0, docIndex),
          {
            id: `doc-${p1.id}`,
            nombre: `Página ${p1.nroPaginaEnPdf}`,
            esDobleCara: false,
            paginas: [p1],
          },
          {
            id: `doc-${p2.id}`,
            nombre: `Página ${p2.nroPaginaEnPdf}`,
            esDobleCara: false,
            paginas: [p2],
          },
          ...prev.slice(docIndex + 1),
        ]
        return nuevos
      }

      // Si se re-marca
      return prev.map((d) => (d.id === docId ? { ...d, esDobleCara: checked } : d))
    })
  }

  // Agregar manualmente una página a un documento existente
  const handleAgregarPagina = (docId: string, paginaId: number) => {
    const pagObj = paginas.find((p) => p.id === paginaId)
    if (!pagObj) return

    setDocumentos((prev) => {
      // 1. Remover la página de donde estuviera asignada
      const sinLaPagina = prev
        .map((d) => {
          if (d.id === docId) return d
          return {
            ...d,
            paginas: d.paginas.filter((p) => p.id !== paginaId),
          }
        })
        .filter((d) => d.paginas.length > 0)

      // 2. Insertarla en el documento destino
      return sinLaPagina.map((d) => {
        if (d.id !== docId) return d
        const nuevasPags = [...d.paginas, pagObj].sort((a, b) => a.nroPaginaEnPdf - b.nroPaginaEnPdf)
        return {
          ...d,
          paginas: nuevasPags,
          esDobleCara: nuevasPags.length >= 2,
        }
      })
    })
  }

  // Quitar página de un documento
  const handleQuitarPagina = (docId: string, paginaId: number) => {
    const pagObj = paginas.find((p) => p.id === paginaId)
    if (!pagObj) return

    setDocumentos((prev) => {
      const docIndex = prev.findIndex((d) => d.id === docId)
      if (docIndex === -1) return prev

      const doc = prev[docIndex]
      const restantes = doc.paginas.filter((p) => p.id !== paginaId)

      // Documento con páginas restantes
      const docActualizado: DocumentoBorrador = {
        ...doc,
        paginas: restantes,
        esDobleCara: restantes.length === 2,
      }

      // La página extraída pasa a ser un documento individual nuevo
      const docNuevo: DocumentoBorrador = {
        id: `doc-${pagObj.id}`,
        nombre: `Página ${pagObj.nroPaginaEnPdf}`,
        esDobleCara: false,
        paginas: [pagObj],
      }

      return [
        ...prev.slice(0, docIndex),
        docActualizado,
        docNuevo,
        ...prev.slice(docIndex + 1),
      ]
    })
  }

  // Páginas disponibles que no han sido agrupadas o están sueltas
  const paginasDisponibles = useMemo(() => {
    return paginas
  }, [paginas])

  // Confirmar y persistir todos los documentos armados en el backend
  const handleGuardarTodos = async () => {
    setGuardando(true)
    setErrorGlobal(null)

    try {
      for (const doc of documentos) {
        const res = await crearDocumentoConPaginasMutation({
          variables: {
            loteId: String(loteId),
            paginaIds: doc.paginas.map((p) => String(p.id)),
            tipoDocumentoId: tipoDocumentoId || null,
            nombreFinal: doc.nombre,
            esDobleCara: doc.esDobleCara,
          },
        })

        const data = res.data?.crearDocumentoConPaginas
        if (data && !data.success) {
          throw new Error(data.message || 'Error al guardar el documento')
        }
      }

      onDocumentosCreados?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al guardar'
      setErrorGlobal(msg)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumen de detección de doble cara */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-semibold">Organizador de Documentos y Doble Cara</div>
            <div className="text-xs text-muted-foreground">
              {documentos.filter((d) => d.esDobleCara).length} pareja(s) de doble cara detectada(s) ·{' '}
              {documentos.length} documento(s) resultante(s) de {paginas.length} páginas.
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGuardarTodos}
          disabled={guardando || documentos.length === 0}
          className="gap-2 text-xs"
          id="btn-guardar-documentos-doble-cara"
        >
          {guardando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Confirmar asignación de páginas
            </>
          )}
        </Button>
      </div>

      {errorGlobal && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorGlobal}</span>
        </div>
      )}

      {/* Lista de tarjetas de documentos / parejas */}
      <div className="space-y-3">
        {documentos.map((doc) => (
          <ParejaDobleCaraCard
            key={doc.id}
            documento={doc}
            onToggleDobleCara={handleToggleDobleCara}
            onAgregarPagina={handleAgregarPagina}
            onQuitarPagina={handleQuitarPagina}
            paginasDisponibles={paginasDisponibles}
            disabled={guardando}
          />
        ))}
      </div>
    </div>
  )
}
