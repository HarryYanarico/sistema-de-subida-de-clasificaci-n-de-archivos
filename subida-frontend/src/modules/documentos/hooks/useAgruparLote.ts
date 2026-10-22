import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_LOTE } from '@graphql/queries/lote.queries'
import { GET_TIPOS_DOCUMENTO } from '@graphql/queries/tipo-documento.queries'
import { CONFIRMAR_AGRUPAMIENTO } from '@graphql/mutations/lote.mutations'
import { Grupo } from '@app-types/documento.types'
import { TipoDocumento } from '@app-types/tipo-documento.types'
import { sanitizarNombreTipoDocumento } from '@/utils/validators'


export interface DecisionGrupo {
  modo: 'sugerido' | 'existente' | 'nuevo'
  tipoId?: number | null
  nombreNuevo?: string
  confirmado: boolean
  esDobleCara: boolean
  formatoCaras?: 'anverso_reverso' | 'paginas_correlativas'
  esMultipagina?: boolean
}


export function useAgruparLote(loteId?: string) {
  const storageKey = loteId ? `subida_agrupar_lote_${loteId}` : null

  // Queries
  const {
    data: loteData,
    loading: loadingLote,
    error: errorLote,
    refetch: refetchLote,
  } = useQuery(GET_LOTE, {
    variables: { id: loteId },
    fetchPolicy: 'network-only',
    skip: !loteId,
  })

  const { data: tiposData, loading: loadingTipos } = useQuery(GET_TIPOS_DOCUMENTO, {
    variables: { activo: true },
    fetchPolicy: 'network-only',
  })

  // Mutación
  const [confirmarAgrupamientoMutation, { loading: confirmando }] =
    useMutation(CONFIRMAR_AGRUPAMIENTO)

  // Lista local de grupos para soportar inversión de páginas, fusiones y separaciones
  const [gruposLocales, setGruposLocales] = useState<Grupo[]>([])

  // Decisiones de asignación por cada grupo (key = grupo.id)
  const [decisiones, setDecisiones] = useState<Record<number, DecisionGrupo>>(() => {
    if (storageKey) {
      try {
        const saved = sessionStorage.getItem(storageKey)
        if (saved) return JSON.parse(saved)
      } catch {
        // Fallback si sessionStorage falla
      }
    }
    return {}
  })

  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  const lote = loteData?.lote
  const tiposExistentes: TipoDocumento[] = tiposData?.tiposDocumento || []

  // Sincronizar grupos cuando cargan los datos del lote
  useEffect(() => {
    if (lote?.grupos && lote.grupos.length > 0) {
      setGruposLocales((prev) => {
        // Solo actualizar si estaba vacío para no sobreescribir mutaciones locales de fusión/inversión
        if (prev.length === 0) return lote.grupos
        return prev
      })
    }
  }, [lote?.grupos])

  const grupos: Grupo[] = gruposLocales.length > 0 ? gruposLocales : ((lote?.grupos as Grupo[]) || [])

  // Guardar en sessionStorage ante cada cambio de decisiones
  useEffect(() => {
    if (storageKey && Object.keys(decisiones).length > 0) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(decisiones))
      } catch {
        // Ignorar quota exceeded
      }
    }
  }, [decisiones, storageKey])

  // Inicializar decisiones cuando cargan los grupos y tipos
  useEffect(() => {
    if (!grupos.length) return

    setDecisiones((prev) => {
      let modificado = false
      const inicial: Record<number, DecisionGrupo> = { ...prev }

      for (const g of grupos) {
        if (inicial[g.id]) continue

        modificado = true
        const tieneDosPaginas = g.paginas && g.paginas.length === 2
        const tieneMasDeDos = g.paginas && g.paginas.length > 2

        const formatoInicial: 'anverso_reverso' | 'paginas_correlativas' = tieneDosPaginas
          ? 'anverso_reverso'
          : 'paginas_correlativas'

        if (tiposExistentes.length === 0) {
          inicial[g.id] = {
            modo: 'nuevo',
            nombreNuevo: '',
            confirmado: false,
            esDobleCara: Boolean(tieneDosPaginas),
            formatoCaras: formatoInicial,
            esMultipagina: Boolean(tieneMasDeDos),
          }
        } else if (g.tipoDocumentoSugerido) {
          inicial[g.id] = {
            modo: 'sugerido',
            tipoId: Number(g.tipoDocumentoSugerido.id),
            confirmado: false,
            esDobleCara: Boolean(tieneDosPaginas),
            formatoCaras: formatoInicial,
            esMultipagina: Boolean(tieneMasDeDos),
          }
        } else {
          inicial[g.id] = {
            modo: 'nuevo',
            nombreNuevo: '',
            confirmado: false,
            esDobleCara: Boolean(tieneDosPaginas),
            formatoCaras: formatoInicial,
            esMultipagina: Boolean(tieneMasDeDos),
          }
        }

      }

      return modificado ? inicial : prev
    })
  }, [grupos, tiposExistentes.length])

  // Pool dinámico de nombres ingresados en este lote (en mayúsculas y únicos)
  const nombresEnEsteLote = useMemo(() => {
    const nombres = new Set<string>()
    for (const dec of Object.values(decisiones)) {
      const nom = dec.nombreNuevo?.trim()
      if (nom && nom.length > 0) {
        nombres.add(nom)
      }
    }
    return Array.from(nombres)
  }, [decisiones])

  // Handlers básicos
  const handleAceptarSugerido = useCallback((grupoId: number) => {
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        confirmado: true,
      },
    }))
  }, [])

  const handleCambiarAOtroTipo = useCallback((grupoId: number) => {
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        modo: 'existente',
        tipoId: null,
        confirmado: false,
      },
    }))
  }, [])

  const handleCambiarANuevoTipo = useCallback((grupoId: number) => {
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        modo: 'nuevo',
        nombreNuevo: '',
        confirmado: false,
      },
    }))
  }, [])

  const handleSeleccionarTipoExistente = useCallback((grupoId: number, tipoIdStr: string) => {
    const tid = Number(tipoIdStr)
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        tipoId: tid,
        confirmado: true,
      },
    }))
  }, [])

  // Sanitización en tiempo real: Solo mayúsculas, puntos para abreviaciones y espacios simples
  const handleTextoNuevoTipo = useCallback((grupoId: number, texto: string) => {
    const textoSanitizado = sanitizarNombreTipoDocumento(texto)
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        nombreNuevo: textoSanitizado,
        confirmado: textoSanitizado.trim().length > 0,
      },
    }))
  }, [])

  // Aplicar un nombre ya usado con 1 solo clic
  const handleAplicarNombreAGrupo = useCallback((grupoId: number, nombre: string) => {
    const textoSanitizado = sanitizarNombreTipoDocumento(nombre)
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        modo: 'nuevo',
        nombreNuevo: textoSanitizado,
        confirmado: textoSanitizado.trim().length > 0,
      },
    }))
  }, [])

  // Anexar un año (ej: 2024) al nombre del grupo
  const handleAnexarAnioAGrupo = useCallback((grupoId: number, anio: string | number) => {
    setDecisiones((prev) => {
      const actual = prev[grupoId]?.nombreNuevo || ''
      const regexAnio = /\b(19\d{2}|20\d{2})\b$/
      let nuevo: string
      if (regexAnio.test(actual.trim())) {
        nuevo = actual.trim().replace(regexAnio, String(anio))
      } else {
        nuevo = `${actual.trim()} ${anio}`.trim()
      }
      nuevo = sanitizarNombreTipoDocumento(nuevo)
      return {
        ...prev,
        [grupoId]: {
          ...prev[grupoId],
          modo: 'nuevo',
          nombreNuevo: nuevo,
          confirmado: nuevo.trim().length > 0,
        },
      }
    })
  }, [])

  // Copiar nombre y modo al grupo siguiente
  const handleCopiarAlSiguiente = useCallback((grupoId: number) => {
    const idxActual = grupos.findIndex((g: Grupo) => g.id === grupoId)
    if (idxActual >= 0 && idxActual < grupos.length - 1) {

      const sigGrupo = grupos[idxActual + 1]
      const decActual = decisiones[grupoId]
      if (decActual) {
        setDecisiones((prev) => ({
          ...prev,
          [sigGrupo.id]: {
            ...prev[sigGrupo.id],
            modo: decActual.modo,
            tipoId: decActual.tipoId,
            nombreNuevo: decActual.nombreNuevo,
            confirmado: Boolean(decActual.nombreNuevo || decActual.tipoId),
          },
        }))
      }
    }
  }, [grupos, decisiones])

  const handleToggleDobleCara = useCallback((grupoId: number, checked: boolean) => {
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        esDobleCara: checked,
        formatoCaras: checked ? 'anverso_reverso' : 'paginas_correlativas',
      },
    }))
  }, [])

  // Cambiar entre Anverso/Reverso (Lado A/B) y Páginas correlativas (Pág 1, 2, 3...)
  const handleCambiarFormatoCaras = useCallback(
    (grupoId: number, formato: 'anverso_reverso' | 'paginas_correlativas') => {
      setDecisiones((prev) => ({
        ...prev,
        [grupoId]: {
          ...prev[grupoId],
          formatoCaras: formato,
          esDobleCara: formato === 'anverso_reverso',
        },
      }))
    },
    []
  )

  // Invertir páginas: Lado A pasa a ser Lado B y viceversa (o Pág. 1 pasa a ser Pág. 2)
  const handleInvertirCaras = useCallback((grupoId: number) => {
    setGruposLocales((prev) =>
      prev.map((g: Grupo) => {
        if (g.id !== grupoId) return g
        const pags = g.paginas || []
        if (pags.length < 2) return g
        const invertidas = [pags[1], pags[0], ...pags.slice(2)]
        return { ...g, paginas: invertidas }
      })
    )
  }, [])

  // Anexar la página del grupo siguiente a este grupo (soporta como Lado B o como Pág. 2, 3, 4...)
  const handleAnexarSiguientePagina = useCallback(
    (grupoId: number, comoLadoB?: boolean) => {
      setGruposLocales((prev) => {
        const idx = prev.findIndex((g: Grupo) => g.id === grupoId)
        if (idx < 0 || idx >= prev.length - 1) return prev
        const gActual = prev[idx]
        const gSiguiente = prev[idx + 1]
        const pagsActual = gActual.paginas || []
        const pagsSiguiente = gSiguiente.paginas || []

        const todasPaginas = [...pagsActual, ...pagsSiguiente]
        const grupoFusionado: Grupo = {
          ...gActual,
          paginas: todasPaginas,
          totalPaginas: todasPaginas.length,
        }

        const nuevoTotal = todasPaginas.length
        const esDos = nuevoTotal === 2
        const formato: 'anverso_reverso' | 'paginas_correlativas' =
          esDos && comoLadoB ? 'anverso_reverso' : 'paginas_correlativas'

        setDecisiones((prevDec) => ({
          ...prevDec,
          [gActual.id]: {
            ...prevDec[gActual.id],
            esDobleCara: formato === 'anverso_reverso',
            formatoCaras: formato,
            esMultipagina: nuevoTotal > 2,
          },
        }))

        // Eliminar el grupo siguiente absorbido
        return [...prev.slice(0, idx), grupoFusionado, ...prev.slice(idx + 2)]
      })
    },
    []
  )

  // Alias compatible para vincular reverso
  const handleVincularReversoConSiguiente = useCallback(
    (grupoId: number) => {
      handleAnexarSiguientePagina(grupoId, true)
    },
    [handleAnexarSiguientePagina]
  )

  // Desanexar la última página de este grupo para devolverla como un grupo independiente
  const handleDesanexarUltimaPagina = useCallback((grupoId: number) => {
    setGruposLocales((prev) => {
      const idx = prev.findIndex((g: Grupo) => g.id === grupoId)
      if (idx < 0) return prev
      const gActual = prev[idx]
      const pags = gActual.paginas || []
      if (pags.length <= 1) return prev

      const pagsRestantes = pags.slice(0, -1)
      const ultimaPagina = pags[pags.length - 1]

      const grupoModificado: Grupo = {
        ...gActual,
        paginas: pagsRestantes,
        totalPaginas: pagsRestantes.length,
      }

      const nuevoGrupo: Grupo = {
        id: Number(`${gActual.id}${Date.now() % 1000}`),
        loteId: gActual.loteId,
        totalPaginas: 1,
        tipoDocumentoSugerido: gActual.tipoDocumentoSugerido,
        estado: 'nuevo',
        paginas: [ultimaPagina],
      }

      setDecisiones((prevDec) => {
        const actualDec = prevDec[gActual.id]
        const nuevoTotal = pagsRestantes.length
        return {
          ...prevDec,
          [gActual.id]: {
            ...actualDec,
            esDobleCara: nuevoTotal === 2 && actualDec?.formatoCaras === 'anverso_reverso',
            esMultipagina: nuevoTotal > 2,
            formatoCaras:
              nuevoTotal === 2 && actualDec?.formatoCaras === 'anverso_reverso'
                ? 'anverso_reverso'
                : 'paginas_correlativas',
          },
          [nuevoGrupo.id]: {
            modo: 'nuevo',
            nombreNuevo: '',
            confirmado: false,
            esDobleCara: false,
            formatoCaras: 'paginas_correlativas',
          },
        }
      })

      return [...prev.slice(0, idx), grupoModificado, nuevoGrupo, ...prev.slice(idx + 1)]
    })
  }, [])


  // Separar páginas de un grupo en documentos individuales de 1 página
  const handleSepararGrupoEnPaginasIndividuales = useCallback((grupoId: number) => {
    setGruposLocales((prev) => {
      const idx = prev.findIndex((g) => g.id === grupoId)
      if (idx < 0) return prev
      const grupo = prev[idx]
      const pags = grupo.paginas || []
      if (pags.length <= 1) return prev

      const nuevosGrupos: Grupo[] = pags.map((p, pIdx) => ({
        id: Number(`${grupo.id}${pIdx + 1}`),
        loteId: grupo.loteId,
        totalPaginas: 1,
        tipoDocumentoSugerido: grupo.tipoDocumentoSugerido,
        estado: 'nuevo',
        paginas: [p],
      }))

      // Desactivar doble cara para las nuevas tarjetas
      setDecisiones((prevDec) => {
        const next = { ...prevDec }
        delete next[grupo.id]
        for (const ng of nuevosGrupos) {
          next[ng.id] = {
            modo: 'nuevo',
            nombreNuevo: prevDec[grupo.id]?.nombreNuevo || '',
            confirmado: Boolean(prevDec[grupo.id]?.nombreNuevo),
            esDobleCara: false,
          }
        }
        return next
      })

      return [...prev.slice(0, idx), ...nuevosGrupos, ...prev.slice(idx + 1)]
    })
  }, [])

  // Validación
  const totalGruposListos = useMemo(() => {
    if (!grupos.length) return 0
    return grupos.filter((g: Grupo) => {
      const dec = decisiones[g.id]
      if (!dec) return false
      if (dec.modo === 'sugerido') return dec.confirmado
      if (dec.modo === 'existente') return Boolean(dec.tipoId)
      if (dec.modo === 'nuevo') return Boolean(dec.nombreNuevo?.trim())
      return false
    }).length
  }, [grupos, decisiones])

  const todosGruposListos = totalGruposListos === grupos.length && grupos.length > 0

  // Confirmar y persistir
  const handleConfirmarAgrupamiento = useCallback(async () => {
    if (!todosGruposListos || !loteId) return null
    setErrorEnvio(null)

    const asignaciones = grupos.map((g: Grupo) => {
      const dec = decisiones[g.id]

      return {
        grupoId: String(g.id),
        tipoDocumentoId: dec?.modo !== 'nuevo' && dec?.tipoId ? dec.tipoId : null,
        nombreNuevoTipo: dec?.modo === 'nuevo' && dec?.nombreNuevo ? dec.nombreNuevo.trim() : null,
        esDobleCara: Boolean(dec?.esDobleCara),
      }
    })

    try {
      const res = await confirmarAgrupamientoMutation({
        variables: {
          loteId: String(loteId),
          asignaciones,
        },
      })

      if (storageKey) {
        try {
          sessionStorage.removeItem(storageKey)
        } catch {
          // No-op
        }
      }

      return res.data?.confirmarAgrupamiento || null
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al confirmar agrupamiento'
      setErrorEnvio(msg)
      throw err
    }
  }, [todosGruposListos, loteId, grupos, decisiones, confirmarAgrupamientoMutation, storageKey])

  return {
    lote,
    grupos,
    tiposExistentes,
    decisiones,
    nombresEnEsteLote,
    loadingLote,
    loadingTipos,
    errorLote,
    errorEnvio,
    confirmando,
    totalGruposListos,
    todosGruposListos,
    refetchLote,
    handleAceptarSugerido,
    handleCambiarAOtroTipo,
    handleCambiarANuevoTipo,
    handleSeleccionarTipoExistente,
    handleTextoNuevoTipo,
    handleAplicarNombreAGrupo,
    handleAnexarAnioAGrupo,
    handleCopiarAlSiguiente,
    handleToggleDobleCara,
    handleCambiarFormatoCaras,
    handleInvertirCaras,
    handleAnexarSiguientePagina,
    handleVincularReversoConSiguiente,
    handleDesanexarUltimaPagina,
    handleSepararGrupoEnPaginasIndividuales,
    handleConfirmarAgrupamiento,
  }
}

