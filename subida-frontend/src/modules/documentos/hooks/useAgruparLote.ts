import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_LOTE } from '@graphql/queries/lote.queries'
import { GET_TIPOS_DOCUMENTO } from '@graphql/queries/tipo-documento.queries'
import {
  CONFIRMAR_AGRUPAMIENTO,
  GUARDAR_BORRADOR_AGRUPAMIENTO,
} from '@graphql/mutations/lote.mutations'
import { Grupo, Pagina, ModoEstructura } from '@app-types/documento.types'
import { TipoDocumento } from '@app-types/tipo-documento.types'
import { sanitizarNombreTipoDocumento } from '@/utils/validators'
import { ItemPortapapeles } from '../components/PortapapelesFlotante/PortapapelesFlotante'

export interface DecisionGrupo {
  modo: 'sugerido' | 'existente' | 'nuevo'
  tipoId?: number | null
  nombreNuevo?: string
  confirmado: boolean
  esDobleCara: boolean
  formatoCaras?: 'anverso_reverso' | 'paginas_correlativas' | 'mixto'
  esMultipagina?: boolean
  modoEstructura?: ModoEstructura
  slotsEsperados?: number
  etiquetasPaginas?: Record<number, string>
  slotsPaginas?: Record<number, string>
  alertaOrigenMixto?: boolean
}

export interface AlertaOrigenState {
  open: boolean
  origenPagina: string
  origenDestino: string
  accionPendiente: (() => void) | null
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

  // Mutaciones
  const [confirmarAgrupamientoMutation, { loading: confirmando }] =
    useMutation(CONFIRMAR_AGRUPAMIENTO)
  const [guardarBorradorMutation] = useMutation(GUARDAR_BORRADOR_AGRUPAMIENTO)

  // Lista local de grupos para soportar fusiones, separaciones y reordenamientos
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

  // Estado del modal de advertencia de origen PDF mixto
  const [alertaOrigen, setAlertaOrigen] = useState<AlertaOrigenState>({
    open: false,
    origenPagina: '',
    origenDestino: '',
    accionPendiente: null,
  })

  // Portapapeles flotante para cortar y mover páginas libremente entre grupos
  const [portapapeles, setPortapapeles] = useState<ItemPortapapeles | null>(null)

  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const inicializadoDesdeBackendRef = useRef(false)

  const lote = loteData?.lote
  const tiposExistentes: TipoDocumento[] = tiposData?.tiposDocumento || []

  // Sincronizar grupos y borrador inicial cuando cargan los datos del lote
  useEffect(() => {
    if (lote && !inicializadoDesdeBackendRef.current) {
      const borradorBackend = lote.borradorAgrupamiento
      if (borradorBackend && Object.keys(borradorBackend).length > 0) {
        if (borradorBackend.gruposLocales && borradorBackend.gruposLocales.length > 0) {
          setGruposLocales(borradorBackend.gruposLocales)
        } else if (lote.grupos && lote.grupos.length > 0) {
          setGruposLocales(lote.grupos)
        }
        if (borradorBackend.decisiones && Object.keys(borradorBackend.decisiones).length > 0) {
          setDecisiones((prev) => ({ ...borradorBackend.decisiones, ...prev }))
        }
        inicializadoDesdeBackendRef.current = true
      } else if (lote.grupos && lote.grupos.length > 0) {
        setGruposLocales((prev) => (prev.length === 0 ? lote.grupos : prev))
        inicializadoDesdeBackendRef.current = true
      }
    }
  }, [lote])

  const grupos: Grupo[] =
    gruposLocales.length > 0 ? gruposLocales : ((lote?.grupos as Grupo[]) || [])

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

  // Persistir en backend con debounce automático (Punto A)
  useEffect(() => {
    if (!loteId || Object.keys(decisiones).length === 0) return

    const timer = setTimeout(() => {
      guardarBorradorMutation({
        variables: {
          loteId: String(loteId),
          borrador: {
            decisiones,
            gruposLocales: gruposLocales.length > 0 ? gruposLocales : grupos,
          },
        },
      }).catch(() => {
        // Ignorar errores transitorios en auto-save
      })
    }, 1200)

    return () => clearTimeout(timer)
  }, [decisiones, gruposLocales, loteId, guardarBorradorMutation, grupos])

  // Inicializar decisiones semánticas de grupos (slots y modos)
  useEffect(() => {
    if (!grupos.length) return

    setDecisiones((prev) => {
      let modificado = false
      const inicial: Record<number, DecisionGrupo> = { ...prev }

      for (const g of grupos) {
        if (inicial[g.id]) continue

        modificado = true
        const tieneParejaSugerida = Boolean(g.parejasSugeridas && g.parejasSugeridas.length > 0)
        const pags = g.paginas || []
        const totalPags = pags.length

        let modoEstructura: ModoEstructura = 'INDEPENDIENTE'
        if (tieneParejaSugerida || totalPags === 2) {
          modoEstructura = 'ANVERSO_REVERSO'
        } else if (totalPags > 2) {
          modoEstructura = 'MULTIPAGINA'
        }

        const modoInicial =
          tiposExistentes.length > 0 && g.tipoDocumentoSugerido ? 'sugerido' : 'nuevo'
        const tipoIdInicial =
          modoInicial === 'sugerido' && g.tipoDocumentoSugerido
            ? Number(g.tipoDocumentoSugerido.id)
            : null

        const slotsIniciales: Record<number, string> = {}
        const etiquetasIniciales: Record<number, string> = {}

        pags.forEach((p, idx) => {
          if (modoEstructura === 'ANVERSO_REVERSO') {
            const slot = idx === 0 ? 'Anverso' : 'Reverso'
            slotsIniciales[p.id] = slot
            etiquetasIniciales[p.id] = idx === 0 ? 'Lado A (Anverso)' : 'Lado B (Reverso)'
          } else {
            const slot = `Pág. ${idx + 1}`
            slotsIniciales[p.id] = slot
            etiquetasIniciales[p.id] = slot
          }
        })

        inicial[g.id] = {
          modo: modoInicial,
          tipoId: tipoIdInicial,
          nombreNuevo: '',
          confirmado: false,
          esDobleCara: modoEstructura === 'ANVERSO_REVERSO',
          formatoCaras:
            modoEstructura === 'ANVERSO_REVERSO' ? 'anverso_reverso' : 'paginas_correlativas',
          esMultipagina: modoEstructura === 'MULTIPAGINA',
          modoEstructura,
          slotsEsperados: modoEstructura === 'ANVERSO_REVERSO' ? 2 : totalPags || 1,
          etiquetasPaginas: etiquetasIniciales,
          slotsPaginas: slotsIniciales,
          alertaOrigenMixto: false,
        }
      }

      return modificado ? inicial : prev
    })
  }, [grupos, tiposExistentes.length])

  // Pool de nombres de tipo ya usados en este lote
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

  // Validación de origen PDF (Punto C)
  const verificarOrigenYProceder = useCallback(
    (pagina: Pagina, grupoDestino: Grupo, accion: () => void) => {
      const pagsDest = grupoDestino.paginas || []
      const origenDistinto = pagsDest.find(
        (p) => p.pdfOrigen && pagina.pdfOrigen && p.pdfOrigen !== pagina.pdfOrigen
      )

      if (origenDistinto) {
        setAlertaOrigen({
          open: true,
          origenPagina: pagina.pdfOrigen || 'Desconocido',
          origenDestino: origenDistinto.pdfOrigen || 'Desconocido',
          accionPendiente: accion,
        })
      } else {
        accion()
      }
    },
    []
  )

  const handleConfirmarAlertaOrigen = useCallback(() => {
    if (alertaOrigen.accionPendiente) {
      alertaOrigen.accionPendiente()
    }
    setAlertaOrigen({
      open: false,
      origenPagina: '',
      origenDestino: '',
      accionPendiente: null,
    })
  }, [alertaOrigen])

  const handleCancelarAlertaOrigen = useCallback(() => {
    setAlertaOrigen({
      open: false,
      origenPagina: '',
      origenDestino: '',
      accionPendiente: null,
    })
  }, [])

  // Handlers básicos de tipo y nombre
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

  const handleSeleccionarTipoExistente = useCallback((grupoId: number, tipoId: string) => {
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        tipoId: Number(tipoId),
        confirmado: true,
      },
    }))
  }, [])

  const handleTextoNuevoTipo = useCallback((grupoId: number, texto: string) => {
    const sanitizado = sanitizarNombreTipoDocumento(texto)
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        nombreNuevo: sanitizado,
        confirmado: sanitizado.trim().length > 0,
      },
    }))
  }, [])

  const handleAplicarNombreAGrupo = useCallback((grupoId: number, nombre: string) => {
    const sanitizado = sanitizarNombreTipoDocumento(nombre)
    setDecisiones((prev) => ({
      ...prev,
      [grupoId]: {
        ...prev[grupoId],
        modo: 'nuevo',
        nombreNuevo: sanitizado,
        confirmado: true,
      },
    }))
  }, [])

  const handleAnexarAnioAGrupo = useCallback((grupoId: number, anio: number | string) => {
    setDecisiones((prev) => {
      const decActual = prev[grupoId]
      const actual = decActual?.nombreNuevo?.trim() || ''
      const regexAnio = /\b(19\d\d|20\d\d)\b$/
      let nuevoNombre = actual

      if (regexAnio.test(actual)) {
        nuevoNombre = actual.replace(regexAnio, String(anio))
      } else if (actual) {
        nuevoNombre = `${actual} ${anio}`
      } else {
        nuevoNombre = `DOCUMENTO ${anio}`
      }

      const sanitizado = sanitizarNombreTipoDocumento(nuevoNombre)
      return {
        ...prev,
        [grupoId]: {
          ...decActual,
          modo: 'nuevo',
          nombreNuevo: sanitizado,
          confirmado: true,
        },
      }
    })
  }, [])

  const handleCopiarAlSiguiente = useCallback(
    (grupoIdOrigen: number) => {
      const idxOrigen = grupos.findIndex((g) => g.id === grupoIdOrigen)
      if (idxOrigen < 0 || idxOrigen >= grupos.length - 1) return

      const grupoDestino = grupos[idxOrigen + 1]
      const decisionOrigen = decisiones[grupoIdOrigen]
      if (!decisionOrigen) return

      setDecisiones((prev) => ({
        ...prev,
        [grupoDestino.id]: {
          ...prev[grupoDestino.id],
          modo: decisionOrigen.modo,
          tipoId: decisionOrigen.tipoId,
          nombreNuevo: decisionOrigen.nombreNuevo,
          confirmado: Boolean(decisionOrigen.nombreNuevo || decisionOrigen.tipoId),
        },
      }))
    },
    [grupos, decisiones]
  )

  // Alternar modo de estructura y doble cara (Punto A)
  const handleCambiarModoEstructura = useCallback(
    (grupoId: number, modo: ModoEstructura) => {
      setDecisiones((prev) => {
        const dec = prev[grupoId]
        if (!dec) return prev
        const g = grupos.find((item) => item.id === grupoId)
        const pags = g?.paginas || []

        const slots: Record<number, string> = {}
        const etiquetas: Record<number, string> = {}

        pags.forEach((p, idx) => {
          if (modo === 'ANVERSO_REVERSO') {
            const slot = idx === 0 ? 'Anverso' : 'Reverso'
            slots[p.id] = slot
            etiquetas[p.id] = idx === 0 ? 'Lado A (Anverso)' : 'Lado B (Reverso)'
          } else {
            const slot = `Pág. ${idx + 1}`
            slots[p.id] = slot
            etiquetas[p.id] = slot
          }
        })

        return {
          ...prev,
          [grupoId]: {
            ...dec,
            modoEstructura: modo,
            esDobleCara: modo === 'ANVERSO_REVERSO',
            formatoCaras: modo === 'ANVERSO_REVERSO' ? 'anverso_reverso' : 'paginas_correlativas',
            esMultipagina: modo === 'MULTIPAGINA',
            slotsEsperados: modo === 'ANVERSO_REVERSO' ? 2 : pags.length || 1,
            slotsPaginas: slots,
            etiquetasPaginas: etiquetas,
          },
        }
      })
    },
    [grupos]
  )

  const handleToggleDobleCara = useCallback(
    (grupoId: number, checked: boolean) => {
      handleCambiarModoEstructura(grupoId, checked ? 'ANVERSO_REVERSO' : 'MULTIPAGINA')
    },
    [handleCambiarModoEstructura]
  )

  const handleCambiarFormatoCaras = useCallback(
    (grupoId: number, formato: 'anverso_reverso' | 'paginas_correlativas') => {
      handleCambiarModoEstructura(
        grupoId,
        formato === 'anverso_reverso' ? 'ANVERSO_REVERSO' : 'MULTIPAGINA'
      )
    },
    [handleCambiarModoEstructura]
  )

  const handleInvertirCaras = useCallback((grupoId: number) => {
    setGruposLocales((prev) =>
      prev.map((g) => {
        if (g.id !== grupoId) return g
        const pags = [...(g.paginas || [])]
        if (pags.length < 2) return g
        pags.reverse()
        return { ...g, paginas: pags }
      })
    )

    setDecisiones((prev) => {
      const decActual = prev[grupoId]
      if (!decActual) return prev
      const etiqActuales = decActual.etiquetasPaginas || {}
      const keys = Object.keys(etiqActuales).map(Number)
      if (keys.length === 2) {
        const [k1, k2] = keys
        return {
          ...prev,
          [grupoId]: {
            ...decActual,
            etiquetasPaginas: {
              [k1]: etiqActuales[k2],
              [k2]: etiqActuales[k1],
            },
          },
        }
      }
      return prev
    })
  }, [])

  // Mover página a la izquierda o derecha en la tira de páginas
  const handleMoverPagina = useCallback(
    (grupoId: number, indexActual: number, direccion: 'izquierda' | 'derecha') => {
      setGruposLocales((prev) =>
        prev.map((g: Grupo) => {
          if (g.id !== grupoId) return g
          const pags = [...(g.paginas || [])]
          const indexDestino = direccion === 'izquierda' ? indexActual - 1 : indexActual + 1
          if (indexDestino < 0 || indexDestino >= pags.length) return g

          const [movida] = pags.splice(indexActual, 1)
          pags.splice(indexDestino, 0, movida)
          return { ...g, paginas: pags }
        })
      )
    },
    []
  )

  // Cambiar etiqueta o slot de una página
  const handleCambiarEtiquetaPagina = useCallback(
    (grupoId: number, paginaId: number, etiqueta: string) => {
      setDecisiones((prev) => {
        const decActual = prev[grupoId] || {
          modo: 'nuevo',
          confirmado: false,
          esDobleCara: false,
        }
        const etiquetas = { ...(decActual.etiquetasPaginas || {}), [paginaId]: etiqueta }
        const tieneLadoB = Object.values(etiquetas).some(
          (val) =>
            val.toLowerCase().includes('lado b') || val.toLowerCase().includes('reverso')
        )

        return {
          ...prev,
          [grupoId]: {
            ...decActual,
            etiquetasPaginas: etiquetas,
            esDobleCara: decActual.esDobleCara || tieneLadoB,
          },
        }
      })
    },
    []
  )

  // Mover una página de un grupo a otro grupo existente (Push & Pull - Punto E)
  const ejecutarMoverPaginaAGrupo = useCallback(
    (paginaId: number, grupoOrigenId: number, grupoDestinoId: number, slotDestino?: string) => {
      if (grupoOrigenId === grupoDestinoId) return

      setGruposLocales((prev) => {
        const idxOrigen = prev.findIndex((g) => g.id === grupoOrigenId)
        const idxDestino = prev.findIndex((g) => g.id === grupoDestinoId)
        if (idxOrigen < 0 || idxDestino < 0) return prev

        const gOrigen = prev[idxOrigen]
        const gDestino = prev[idxDestino]
        const pagsOrigen = gOrigen.paginas || []
        const pagina = pagsOrigen.find((p) => p.id === paginaId)
        if (!pagina) return prev

        const pagsOrigenRestantes = pagsOrigen.filter((p) => p.id !== paginaId)
        const pagsDestinoNuevas = [...(gDestino.paginas || []), pagina]

        const gDestinoModificado: Grupo = {
          ...gDestino,
          paginas: pagsDestinoNuevas,
          totalPaginas: pagsDestinoNuevas.length,
        }

        let nuevosGrupos = prev.map((g) => {
          if (g.id === grupoDestinoId) return gDestinoModificado
          if (g.id === grupoOrigenId) {
            return {
              ...gOrigen,
              paginas: pagsOrigenRestantes,
              totalPaginas: pagsOrigenRestantes.length,
            }
          }
          return g
        })

        // Si el grupo de origen se quedó sin páginas, se elimina limpiamente (Punto F)
        if (pagsOrigenRestantes.length === 0) {
          nuevosGrupos = nuevosGrupos.filter((g) => g.id !== grupoOrigenId)
        }

        setDecisiones((prevDec) => {
          const decOrigen = prevDec[grupoOrigenId]
          const decDestino = prevDec[grupoDestinoId]
          const next = { ...prevDec }

          if (decOrigen) {
            const etiqOrigen = { ...(decOrigen.etiquetasPaginas || {}) }
            const slotsOrigen = { ...(decOrigen.slotsPaginas || {}) }
            delete etiqOrigen[paginaId]
            delete slotsOrigen[paginaId]
            next[grupoOrigenId] = {
              ...decOrigen,
              etiquetasPaginas: etiqOrigen,
              slotsPaginas: slotsOrigen,
              esDobleCara: pagsOrigenRestantes.length === 2 && Boolean(decOrigen.esDobleCara),
              esMultipagina: pagsOrigenRestantes.length > 2,
            }
          }

          if (pagsOrigenRestantes.length === 0) {
            delete next[grupoOrigenId]
          }

          if (decDestino) {
            const etiqDestino = { ...(decDestino.etiquetasPaginas || {}) }
            const slotsDestino = { ...(decDestino.slotsPaginas || {}) }
            const esLadoB =
              slotDestino?.toLowerCase().includes('reverso') ||
              slotDestino?.toLowerCase().includes('lado b')

            const slotNombre = slotDestino || `Pág. ${pagsDestinoNuevas.length}`
            slotsDestino[paginaId] = slotNombre
            etiqDestino[paginaId] = esLadoB ? 'Lado B (Reverso)' : slotNombre

            next[grupoDestinoId] = {
              ...decDestino,
              etiquetasPaginas: etiqDestino,
              slotsPaginas: slotsDestino,
              esDobleCara:
                pagsDestinoNuevas.length === 2 &&
                (Boolean(decDestino.esDobleCara) || Boolean(esLadoB)),
              esMultipagina: pagsDestinoNuevas.length > 2,
            }
          }

          return next
        })

        return nuevosGrupos
      })
    },
    []
  )

  // Mover página con chequeo de origen PDF
  const handleMoverPaginaAGrupo = useCallback(
    (
      paginaId: number,
      grupoOrigenId: number,
      grupoDestinoId: number,
      slotDestino?: string,
      forzarSinAdvertencia?: boolean
    ) => {
      const gOrigen = grupos.find((g) => g.id === grupoOrigenId)
      const gDestino = grupos.find((g) => g.id === grupoDestinoId)
      const pag = gOrigen?.paginas?.find((p) => p.id === paginaId)

      if (!pag || !gDestino) return

      const accion = () =>
        ejecutarMoverPaginaAGrupo(paginaId, grupoOrigenId, grupoDestinoId, slotDestino)

      if (forzarSinAdvertencia) {
        accion()
      } else {
        verificarOrigenYProceder(pag, gDestino, accion)
      }
    },
    [grupos, ejecutarMoverPaginaAGrupo, verificarOrigenYProceder]
  )

  // Traer página de otro grupo hacia este grupo (Pull - Punto E)
  const handleTraerPaginaDeGrupo = useCallback(
    (
      grupoDestinoId: number,
      grupoOrigenId: number,
      paginaId: number,
      slotDestino?: string,
      forzarSinAdvertencia?: boolean
    ) => {
      handleMoverPaginaAGrupo(
        paginaId,
        grupoOrigenId,
        grupoDestinoId,
        slotDestino,
        forzarSinAdvertencia
      )
    },
    [handleMoverPaginaAGrupo]
  )

  // Operaciones de portapapeles (Tomar / Pegar / Cancelar)
  const handleTomarPaginaEnPortapapeles = useCallback(
    (pagina: Pagina, grupoOrigenId: number, numeroGrupoOrigenVisible: number) => {
      setPortapapeles({
        pagina,
        grupoOrigenId,
        numeroGrupoOrigenVisible,
      })
    },
    []
  )

  const handleCancelarPortapapeles = useCallback(() => {
    setPortapapeles(null)
  }, [])

  const handlePegarPaginaDesdePortapapeles = useCallback(
    (grupoDestinoId: number, slotDestino?: string) => {
      if (!portapapeles) return
      handleMoverPaginaAGrupo(
        portapapeles.pagina.id,
        portapapeles.grupoOrigenId,
        grupoDestinoId,
        slotDestino
      )
      setPortapapeles(null)
    },
    [portapapeles, handleMoverPaginaAGrupo]
  )

  // Fusionar un grupo entero dentro de otro grupo
  const handleFusionarGrupos = useCallback(
    (grupoOrigenId: number, grupoDestinoId: number, comoLadoB?: boolean) => {
      if (grupoOrigenId === grupoDestinoId) return

      const gOrigen = grupos.find((g) => g.id === grupoOrigenId)
      const gDestino = grupos.find((g) => g.id === grupoDestinoId)
      if (!gOrigen || !gDestino) return

      const pagsOrigen = gOrigen.paginas || []
      if (pagsOrigen.length === 0) return

      const accion = () => {
        setGruposLocales((prev) => {
          const gOrig = prev.find((g) => g.id === grupoOrigenId)
          const gDest = prev.find((g) => g.id === grupoDestinoId)
          if (!gOrig || !gDest) return prev

          const pagsNuevas = [...(gDest.paginas || []), ...(gOrig.paginas || [])]
          const gDestModificado: Grupo = {
            ...gDest,
            paginas: pagsNuevas,
            totalPaginas: pagsNuevas.length,
          }

          const nuevosGrupos = prev
            .filter((g) => g.id !== grupoOrigenId)
            .map((g) => (g.id === grupoDestinoId ? gDestModificado : g))

          setDecisiones((prevDec) => {
            const decDest = prevDec[grupoDestinoId]
            const next = { ...prevDec }
            delete next[grupoOrigenId]

            if (decDest) {
              next[grupoDestinoId] = {
                ...decDest,
                esDobleCara: pagsNuevas.length === 2 && Boolean(comoLadoB || decDest.esDobleCara),
                esMultipagina: pagsNuevas.length > 2,
              }
            }

            return next
          })

          return nuevosGrupos
        })
      }

      // Validar origen de la primera página del grupo
      verificarOrigenYProceder(pagsOrigen[0], gDestino, accion)
    },
    [grupos, verificarOrigenYProceder]
  )

  // Anexar la página del grupo inmediatamente siguiente
  const handleAnexarSiguientePagina = useCallback(
    (grupoIdActual: number, comoLadoB = false) => {
      const idx = grupos.findIndex((g) => g.id === grupoIdActual)
      if (idx < 0 || idx >= grupos.length - 1) return

      const gSiguiente = grupos[idx + 1]
      const pagsSiguiente = gSiguiente.paginas || []
      if (pagsSiguiente.length === 0) return

      const paginaSiguiente = pagsSiguiente[0]
      handleMoverPaginaAGrupo(
        paginaSiguiente.id,
        gSiguiente.id,
        grupoIdActual,
        comoLadoB ? 'Reverso' : undefined
      )
    },
    [grupos, handleMoverPaginaAGrupo]
  )

  const handleVincularReversoConSiguiente = useCallback(
    (grupoIdActual: number) => {
      handleAnexarSiguientePagina(grupoIdActual, true)
    },
    [handleAnexarSiguientePagina]
  )

  // Quitar una página específica de un grupo y crear un nuevo grupo independiente
  const handleRemoverPagina = useCallback((grupoId: number, paginaId: number) => {
    setGruposLocales((prev) => {
      const idx = prev.findIndex((g: Grupo) => g.id === grupoId)
      if (idx < 0) return prev
      const gActual = prev[idx]
      const pags = gActual.paginas || []
      if (pags.length <= 1) return prev

      const paginaARemover = pags.find((p) => p.id === paginaId)
      if (!paginaARemover) return prev

      const pagsRestantes = pags.filter((p) => p.id !== paginaId)
      const grupoModificado: Grupo = {
        ...gActual,
        paginas: pagsRestantes,
        totalPaginas: pagsRestantes.length,
      }

      const nuevoGrupoId = Number(`${Date.now() % 1000000}${Math.floor(Math.random() * 1000)}`)
      const nuevoGrupo: Grupo = {
        id: nuevoGrupoId,
        loteId: gActual.loteId,
        totalPaginas: 1,
        tipoDocumentoSugerido: gActual.tipoDocumentoSugerido,
        estado: 'nuevo',
        paginas: [paginaARemover],
      }

      setDecisiones((prevDec) => {
        const actualDec = prevDec[gActual.id]
        const nuevoTotal = pagsRestantes.length
        const prevEtiquetas = { ...(actualDec?.etiquetasPaginas || {}) }
        const prevSlots = { ...(actualDec?.slotsPaginas || {}) }
        delete prevEtiquetas[paginaId]
        delete prevSlots[paginaId]

        return {
          ...prevDec,
          [gActual.id]: {
            ...actualDec,
            esDobleCara: nuevoTotal === 2 && Boolean(actualDec?.esDobleCara),
            esMultipagina: nuevoTotal > 2,
            etiquetasPaginas: prevEtiquetas,
            slotsPaginas: prevSlots,
          },
          [nuevoGrupo.id]: {
            modo: 'nuevo',
            nombreNuevo: '',
            confirmado: false,
            esDobleCara: false,
            formatoCaras: 'paginas_correlativas',
            modoEstructura: 'INDEPENDIENTE',
            slotsEsperados: 1,
            etiquetasPaginas: { [paginaARemover.id]: 'Pág. 1' },
            slotsPaginas: { [paginaARemover.id]: 'Pág. 1' },
          },
        }
      })

      return [...prev.slice(0, idx), grupoModificado, nuevoGrupo, ...prev.slice(idx + 1)]
    })
  }, [])

  // Desanexar última página
  const handleDesanexarUltimaPagina = useCallback(
    (grupoId: number) => {
      const g = grupos.find((item) => item.id === grupoId)
      const pags = g?.paginas || []
      if (pags.length <= 1) return
      const ultima = pags[pags.length - 1]
      handleRemoverPagina(grupoId, ultima.id)
    },
    [grupos, handleRemoverPagina]
  )

  // Separar páginas de un grupo en documentos individuales
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

      setDecisiones((prevDec) => {
        const next = { ...prevDec }
        delete next[grupo.id]
        for (const ng of nuevosGrupos) {
          const pid = ng.paginas![0].id
          next[ng.id] = {
            modo: 'nuevo',
            nombreNuevo: prevDec[grupo.id]?.nombreNuevo || '',
            confirmado: Boolean(prevDec[grupo.id]?.nombreNuevo),
            esDobleCara: false,
            formatoCaras: 'paginas_correlativas',
            modoEstructura: 'INDEPENDIENTE',
            slotsEsperados: 1,
            etiquetasPaginas: { [pid]: 'Pág. 1' },
            slotsPaginas: { [pid]: 'Pág. 1' },
          }
        }
        return next
      })

      return [...prev.slice(0, idx), ...nuevosGrupos, ...prev.slice(idx + 1)]
    })
  }, [])

  // Asistente para armar tipo multi-página (Punto B)
  const handleCrearTipoMultipagina = useCallback(
    (grupoIdsOrdenados: number[], tipoIdSeleccionado: number | null, nombreNuevoTipo: string) => {
      if (grupoIdsOrdenados.length < 2) return

      setGruposLocales((prev) => {
        const gruposElegidos = grupoIdsOrdenados
          .map((id) => prev.find((g) => g.id === id))
          .filter(Boolean) as Grupo[]

        if (gruposElegidos.length < 2) return prev

        const todasPaginas: Pagina[] = []
        gruposElegidos.forEach((g) => {
          todasPaginas.push(...(g.paginas || []))
        })

        const primerGrupo = gruposElegidos[0]
        const grupoUnificado: Grupo = {
          ...primerGrupo,
          paginas: todasPaginas,
          totalPaginas: todasPaginas.length,
          estado: 'nuevo',
        }

        const otrosIds = new Set(grupoIdsOrdenados.slice(1))
        const nuevosGrupos = prev
          .filter((g) => !otrosIds.has(g.id))
          .map((g) => (g.id === primerGrupo.id ? grupoUnificado : g))

        setDecisiones((prevDec) => {
          const next = { ...prevDec }
          otrosIds.forEach((id) => delete next[id])

          const slots: Record<number, string> = {}
          const etiquetas: Record<number, string> = {}

          todasPaginas.forEach((p, idx) => {
            const slot = `Pág. ${idx + 1}`
            slots[p.id] = slot
            etiquetas[p.id] = slot
          })

          next[primerGrupo.id] = {
            modo: tipoIdSeleccionado ? 'existente' : 'nuevo',
            tipoId: tipoIdSeleccionado,
            nombreNuevo: nombreNuevoTipo,
            confirmado: Boolean(tipoIdSeleccionado || nombreNuevoTipo),
            esDobleCara: false,
            formatoCaras: 'paginas_correlativas',
            esMultipagina: true,
            modoEstructura: 'MULTIPAGINA',
            slotsEsperados: todasPaginas.length,
            slotsPaginas: slots,
            etiquetasPaginas: etiquetas,
          }

          return next
        })

        return nuevosGrupos
      })
    },
    []
  )

  // Validación de estado listo
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

  // Confirmar y persistir final (Punto D & G)
  const handleConfirmarAgrupamiento = useCallback(async () => {
    if (!todosGruposListos || !loteId) return null
    setErrorEnvio(null)

    const asignaciones = grupos.map((g: Grupo) => {
      const dec = decisiones[g.id]
      const pags = g.paginas || []
      const etiquetas = dec?.etiquetasPaginas || {}
      const slots = dec?.slotsPaginas || {}
      const pids = pags.map((p) => String(p.id))

      const estructura = pags.map((p, idx) => {
        let defaultSlot = `Pág. ${idx + 1}`
        if (
          dec?.modoEstructura === 'ANVERSO_REVERSO' ||
          (pags.length === 2 && dec?.esDobleCara)
        ) {
          defaultSlot = idx === 0 ? 'Anverso' : 'Reverso'
        }
        const slotNombre = slots[p.id] || defaultSlot
        const defaultEti =
          slotNombre === 'Anverso'
            ? 'Lado A (Anverso)'
            : slotNombre === 'Reverso'
              ? 'Lado B (Reverso)'
              : `Pág. ${idx + 1}`

        return {
          pagina_id: p.id,
          orden: idx + 1,
          nro_pdf: p.nroPaginaEnPdf,
          slot: slotNombre,
          etiqueta: etiquetas[p.id] || defaultEti,
        }
      })

      const tieneLadoB = estructura.some(
        (e) =>
          e.etiqueta.toLowerCase().includes('lado b') ||
          e.etiqueta.toLowerCase().includes('reverso') ||
          e.slot.toLowerCase().includes('reverso')
      )

      const slotsEsperados =
        dec?.slotsEsperados ||
        (dec?.modoEstructura === 'ANVERSO_REVERSO' ? 2 : pags.length)

      const estaIncompleto = pags.length < slotsEsperados

      return {
        grupoId: String(g.id),
        tipoDocumentoId: dec?.modo !== 'nuevo' && dec?.tipoId ? dec.tipoId : null,
        nombreNuevoTipo:
          dec?.modo === 'nuevo' && dec?.nombreNuevo ? dec.nombreNuevo.trim() : null,
        esDobleCara: Boolean(dec?.esDobleCara || tieneLadoB),
        paginaIds: pids,
        estructuraPaginas: estructura,
        modoEstructura:
          dec?.modoEstructura ||
          (pags.length === 2
            ? 'ANVERSO_REVERSO'
            : pags.length > 2
              ? 'MULTIPAGINA'
              : 'INDEPENDIENTE'),
        slotsEsperados,
        estaIncompleto,
        alertaOrigenMixto: Boolean(dec?.alertaOrigenMixto),
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

      const hayIncompletos = asignaciones.some((a) => a.estaIncompleto)

      return {
        id: res.data?.confirmarAgrupamiento?.id,
        incompletos: hayIncompletos,
        lote: res.data?.confirmarAgrupamiento,
      }
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
    alertaOrigen,
    portapapeles,
    loadingLote,
    loadingTipos,
    errorLote,
    errorEnvio,
    confirmando,
    totalGruposListos,
    todosGruposListos,
    refetchLote,
    handleTomarPaginaEnPortapapeles,
    handlePegarPaginaDesdePortapapeles,
    handleCancelarPortapapeles,
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
    handleCambiarModoEstructura,
    handleInvertirCaras,
    handleAnexarSiguientePagina,
    handleVincularReversoConSiguiente,
    handleRemoverPagina,
    handleMoverPagina,
    handleCambiarEtiquetaPagina,
    handleMoverPaginaAGrupo,
    handleTraerPaginaDeGrupo,
    handleFusionarGrupos,
    handleCrearTipoMultipagina,
    handleDesanexarUltimaPagina,
    handleSepararGrupoEnPaginasIndividuales,
    handleConfirmarAgrupamiento,
    handleConfirmarAlertaOrigen,
    handleCancelarAlertaOrigen,
  }
}
