import { useState, useCallback } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_PAGINAS_SIN_AGRUPAR } from '@graphql/queries/revision.queries'
import { GET_TIPOS_DOCUMENTO } from '@graphql/queries/tipo-documento.queries'
import {
  ASIGNAR_PAGINA_A_TIPO,
  CREAR_TIPO_Y_ASIGNAR,
  DESCARTAR_PAGINA,
} from '@graphql/mutations/documento.mutations'
import { Pagina } from '@app-types/documento.types'
import { TipoDocumento } from '@app-types/tipo-documento.types'

export type ModoAccionPagina = 'existente' | 'nuevo' | 'descartar'

export interface EstadoTarjetaPagina {
  modo: ModoAccionPagina
  tipoId?: string
  nombreNuevo?: string
}

const PAGE_SIZE = 50

export function useRevisionSinAgrupar() {
  const [offset, setOffset] = useState(0)
  const [paginasAcumuladas, setPaginasAcumuladas] = useState<Pagina[]>([])

  // Queries
  const { loading, error, refetch, data } = useQuery(GET_PAGINAS_SIN_AGRUPAR, {
    variables: { limit: PAGE_SIZE, offset },
    fetchPolicy: 'network-only',
    onCompleted: (res) => {
      const items: Pagina[] = res?.paginasSinAgrupar || []
      if (offset === 0) {
        setPaginasAcumuladas(items)
      } else {
        setPaginasAcumuladas((prev) => {
          const existentesIds = new Set(prev.map((p) => p.id))
          const nuevos = items.filter((p) => !existentesIds.has(p.id))
          return [...prev, ...nuevos]
        })
      }
    },
  })

  const { data: tiposData } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { activo: true },
    fetchPolicy: 'network-only',
  })
  const tipos: TipoDocumento[] = tiposData?.tiposDocumento || []

  // Mutaciones
  const [asignarPaginaMutation] = useMutation(ASIGNAR_PAGINA_A_TIPO)
  const [crearTipoYAsignarMutation] = useMutation(CREAR_TIPO_Y_ASIGNAR)
  const [descartarPaginaMutation] = useMutation(DESCARTAR_PAGINA)

  // Estados locales por tarjeta
  const [estados, setEstados] = useState<Record<number, EstadoTarjetaPagina>>({})
  const [guardandoId, setGuardandoId] = useState<number | null>(null)
  const [errorAccion, setErrorAccion] = useState<{ id: number; mensaje: string } | null>(null)

  const paginas =
    paginasAcumuladas.length > 0 ? paginasAcumuladas : (data?.paginasSinAgrupar || [])
  const hayMas = data?.paginasSinAgrupar?.length === PAGE_SIZE

  const getEstadoTarjeta = useCallback(
    (paginaId: number): EstadoTarjetaPagina => {
      return (
        estados[paginaId] || {
          modo: 'existente',
          tipoId: tipos.length > 0 ? String(tipos[0].id) : undefined,
          nombreNuevo: '',
        }
      )
    },
    [estados, tipos]
  )

  const setModo = useCallback((paginaId: number, modo: ModoAccionPagina) => {
    setEstados((prev) => ({
      ...prev,
      [paginaId]: {
        ...prev[paginaId],
        modo,
      },
    }))
    setErrorAccion((prev) => (prev?.id === paginaId ? null : prev))
  }, [])

  const setTipoId = useCallback((paginaId: number, tipoId: string) => {
    setEstados((prev) => ({
      ...prev,
      [paginaId]: {
        ...prev[paginaId],
        tipoId,
      },
    }))
    setErrorAccion((prev) => (prev?.id === paginaId ? null : prev))
  }, [])

  const setNombreNuevo = useCallback((paginaId: number, nombreNuevo: string) => {
    setEstados((prev) => ({
      ...prev,
      [paginaId]: {
        ...prev[paginaId],
        nombreNuevo,
      },
    }))
    setErrorAccion((prev) => (prev?.id === paginaId ? null : prev))
  }, [])

  const handleConfirmar = useCallback(
    async (pagina: Pagina) => {
      const config = getEstadoTarjeta(pagina.id)
      setErrorAccion(null)
      setGuardandoId(pagina.id)

      try {
        if (config.modo === 'existente') {
          const tid = config.tipoId || (tipos.length > 0 ? String(tipos[0].id) : null)
          if (!tid) {
            throw new Error('Selecciona un tipo de documento existente')
          }
          await asignarPaginaMutation({
            variables: {
              paginaId: String(pagina.id),
              tipoDocumentoId: String(tid),
            },
          })
        } else if (config.modo === 'nuevo') {
          const nombre = (config.nombreNuevo || '').trim()
          if (!nombre) {
            throw new Error('Ingresa el nombre del nuevo tipo de documento')
          }
          await crearTipoYAsignarMutation({
            variables: {
              paginaId: String(pagina.id),
              nombre,
            },
          })
        } else if (config.modo === 'descartar') {
          await descartarPaginaMutation({
            variables: {
              paginaId: String(pagina.id),
            },
          })
        }

        // Remover de la lista local
        setPaginasAcumuladas((prev) => prev.filter((p) => p.id !== pagina.id))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al procesar la página'
        setErrorAccion({ id: pagina.id, mensaje: msg })
        throw err
      } finally {
        setGuardandoId(null)
      }
    },
    [
      getEstadoTarjeta,
      tipos,
      asignarPaginaMutation,
      crearTipoYAsignarMutation,
      descartarPaginaMutation,
    ]
  )

  const cargarMas = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE)
  }, [])

  const recargarCola = useCallback(() => {
    setOffset(0)
    refetch({ limit: PAGE_SIZE, offset: 0 })
  }, [refetch])

  return {
    paginas,
    tipos,
    loading,
    error,
    guardandoId,
    errorAccion,
    hayMas,
    getEstadoTarjeta,
    setModo,
    setTipoId,
    setNombreNuevo,
    handleConfirmar,
    cargarMas,
    recargarCola,
  }
}
