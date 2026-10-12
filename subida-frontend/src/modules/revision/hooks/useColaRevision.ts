import { useCallback, useMemo, useState } from 'react'
import { DocumentNode, useQuery } from '@apollo/client'

/** Paginas por tanda. Suficiente para revisar de a un lote sin cargar miles. */
export const TAMANO_PAGINA = 20

interface EstadoCola {
  documentos: any[]
  loading: boolean
  /** `true` cuando la consulta falla: el mensaje ya viene resuelto. */
  error: string | null
  /** Vuelve a pedir la cola desde cero. Tras confirmar un documento. */
  recargar: () => void
  /** Amplia la tanda actual. */
  cargarMas: () => void
  /** El backend devolvio una tanda completa: puede haber mas. */
  hayMas: boolean
}

/**
 * Paginado por ampliacion para las colas de revision.
 *
 * Se agranda `limit` en vez de acumular paginas con `fetchMore`. Estas colas
 * cambian mientras el revisor trabaja (el backend solo devuelve lo que sigue
 * sin resolver), asi que cachear paginas viejas terminaria mostrando
 * documentos ya confirmados. Pedir "los primeros N" siempre devuelve el estado
 * real.
 */
export function useColaRevision(query: DocumentNode): EstadoCola {
  const [limite, setLimite] = useState(TAMANO_PAGINA)

  const { data, loading, error, refetch } = useQuery(query, {
    variables: { limit: limite },
    notifyOnNetworkStatusChange: true,
  })

  const documentos = useMemo(() => {
    // La raiz de la respuesta es una unica query; se toma el primer valor.
    if (!data) return []
    return (Object.values(data)[0] as any[]) || []
  }, [data])

  const hayMas = documentos.length >= limite

  const recargar = useCallback(() => {
    setLimite(TAMANO_PAGINA)
    refetch()
  }, [refetch])

  const cargarMas = useCallback(() => {
    setLimite((prev) => prev + TAMANO_PAGINA)
  }, [])

  return {
    documentos,
    loading,
    error: error ? 'No se pudieron cargar los documentos' : null,
    recargar,
    cargarMas,
    hayMas,
  }
}
