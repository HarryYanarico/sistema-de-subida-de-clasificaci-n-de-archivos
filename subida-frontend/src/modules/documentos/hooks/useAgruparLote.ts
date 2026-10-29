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
import {
  descartarPaginaLote,
  fusionarGruposLote,
  guardarEstructuraGrupo,
} from '../services/upload.service'

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
  ordenPaginas?: Record<number, number>
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

  // Inicializar decisiones de grupos: por defecto SIN concatenación (las páginas de un grupo son ejemplares similares independientes)
  useEffect(() => {
    if (!grupos.length) return

    setDecisiones((prev) => {
      let modificado = false
      const inicial: Record<number, DecisionGrupo> = { ...prev }

      for (const g of grupos) {
        if (inicial[g.id]) continue

        modificado = true
        const modoEstructura: ModoEstructura = 'INDEPENDIENTE'

        const modoInicial =
          tiposExistentes.length > 0 && g.tipoDocumentoSugerido ? 'sugerido' : 'nuevo'
        const tipoIdInicial =
          modoInicial === 'sugerido' && g.tipoDocumentoSugerido
            ? Number(g.tipoDocumentoSugerido.id)
            : null

        inicial[g.id] = {
          modo: modoInicial,
          tipoId: tipoIdInicial,
          nombreNuevo: '',
          confirmado: false,
          esDobleCara: false,
          formatoCaras: 'paginas_correlativas',
          esMultipagina: false,
          modoEstructura,
          slotsEsperados: 1,
          etiquetasPaginas: {},
          slotsPaginas: {},
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

  // RF-14: Detectar nombres duplicados entre grupos del mismo lote
  const gruposConNombreDuplicado = useMemo(() => {
    const conteoPorNombre = new Map<string, number[]>()

    for (const g of grupos) {
      const dec = decisiones[g.id]
      if (!dec) continue

      let nombreResuelto = ''
      if (dec.modo === 'nuevo' && dec.nombreNuevo?.trim()) {
        nombreResuelto = dec.nombreNuevo.trim().toUpperCase()
      } else if (dec.modo === 'existente' && dec.tipoId) {
        const tipo = tiposExistentes.find((t) => Number(t.id) === Number(dec.tipoId))
        if (tipo?.nombre) nombreResuelto = tipo.nombre.trim().toUpperCase()
      } else if (dec.modo === 'sugerido' && dec.confirmado && g.tipoDocumentoSugerido?.nombre) {
        nombreResuelto = g.tipoDocumentoSugerido.nombre.trim().toUpperCase()
      }

      if (nombreResuelto) {
        const lista = conteoPorNombre.get(nombreResuelto) || []
        lista.push(g.id)
        conteoPorNombre.set(nombreResuelto, lista)
      }
    }

    const duplicados = new Set<number>()
    for (const ids of conteoPorNombre.values()) {
      if (ids.length > 1) {
        ids.forEach((id) => duplicados.add(id))
      }
    }
    return duplicados
  }, [grupos, decisiones, tiposExistentes])

  const tieneNombresDuplicados = gruposConNombreDuplicado.size > 0

  // Helper para persistir la estructura interna en el backend (RT-05, RF-28)
  const sincronizarEstructuraGrupo = useCallback(
    (
      grupoId: number,
      pags: Pagina[],
      modo: ModoEstructura,
      slotsPaginas?: Record<number, string>,
      ordenPaginas?: Record<number, number>
    ) => {
      if (!pags || pags.length === 0) return

      const documentosPayload: { es_doble_cara: boolean; pagina_ids: number[] }[] = []

      // Verificar si existen bloques de concatenación por rol de página (Página 1, Página 2, etc.)
      const bloquesMap = new Map<number, Pagina[]>()
      if (ordenPaginas && Object.keys(ordenPaginas).length > 0 && modo !== 'INDEPENDIENTE') {
        pags.forEach((p) => {
          const ord = ordenPaginas[p.id] || 1
          const lista = bloquesMap.get(ord) || []
          lista.push(p)
          bloquesMap.set(ord, lista)
        })
      }

      if (bloquesMap.size >= 2) {
        const ordenesOrdenados = Array.from(bloquesMap.keys()).sort((a, b) => a - b)
        const bloquesCopia = ordenesOrdenados.map((ord) =>
          [...(bloquesMap.get(ord) || [])].sort(
            (a, b) => (a.nroPaginaEnPdf || 0) - (b.nroPaginaEnPdf || 0)
          )
        )
        const usados = new Set<number>()

        // 1. Emparejar primero por mismo pdfOrigen
        const bloque1 = bloquesCopia[0] || []
        for (const p1 of bloque1) {
          if (!p1.pdfOrigen) continue
          const tupla: Pagina[] = [p1]
          for (let bIdx = 1; bIdx < bloquesCopia.length; bIdx++) {
            const candidato = bloquesCopia[bIdx].find(
              (cand) => !usados.has(cand.id) && cand.pdfOrigen === p1.pdfOrigen
            )
            if (candidato) {
              tupla.push(candidato)
            }
          }
          if (tupla.length === bloquesCopia.length) {
            tupla.forEach((t) => usados.add(t.id))
            documentosPayload.push({
              es_doble_cara: modo === 'ANVERSO_REVERSO' && tupla.length === 2,
              pagina_ids: tupla.map((t) => t.id),
            })
          }
        }

        // 2. Emparejar páginas restantes posicionalmente entre bloques
        const restantesPorBloque = bloquesCopia.map((lista) =>
          lista.filter((p) => !usados.has(p.id))
        )
        const maxRestantes = Math.max(0, ...restantesPorBloque.map((l) => l.length))
        for (let i = 0; i < maxRestantes; i++) {
          const tupla: Pagina[] = []
          for (let bIdx = 0; bIdx < restantesPorBloque.length; bIdx++) {
            if (i < restantesPorBloque[bIdx].length) {
              tupla.push(restantesPorBloque[bIdx][i])
            }
          }
          if (tupla.length > 0) {
            documentosPayload.push({
              es_doble_cara: modo === 'ANVERSO_REVERSO' && tupla.length === 2,
              pagina_ids: tupla.map((t) => t.id),
            })
          }
        }
      } else if (modo === 'ANVERSO_REVERSO') {
        for (let i = 0; i < pags.length; i += 2) {
          const par = pags.slice(i, i + 2)
          documentosPayload.push({
            es_doble_cara: par.length === 2,
            pagina_ids: par.map((p) => p.id),
          })
        }
      } else if (modo === 'MIXTA') {
        let i = 0
        while (i < pags.length) {
          const p = pags[i]
          const pSig = i + 1 < pags.length ? pags[i + 1] : null
          const slotSig = pSig ? (slotsPaginas?.[pSig.id] || '').toUpperCase() : ''
          const formaParConSiguiente =
            slotSig.includes('REVERSO') || slotSig.includes('LADO B')
          if (formaParConSiguiente && pSig) {
            documentosPayload.push({
              es_doble_cara: true,
              pagina_ids: [p.id, pSig.id],
            })
            i += 2
          } else {
            documentosPayload.push({
              es_doble_cara: false,
              pagina_ids: [p.id],
            })
            i += 1
          }
        }
      } else if (modo === 'MULTIPAGINA') {
        documentosPayload.push({
          es_doble_cara: false,
          pagina_ids: pags.map((p) => p.id),
        })
      } else {
        // SECUENCIAL sin bloques / INDEPENDIENTE
        pags.forEach((p) => {
          documentosPayload.push({
            es_doble_cara: false,
            pagina_ids: [p.id],
          })
        })
      }

      guardarEstructuraGrupo(grupoId, {
        modo,
        pagina_ids: pags.map((p) => p.id),
        documentos: documentosPayload,
      }).catch(() => {
        // Error silencioso si es un grupo temporal aún no sincronizado
      })
    },
    []
  )

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

  // Alternar modo de estructura y doble cara (RF-27, RF-28, RT-05)
  const handleCambiarModoEstructura = useCallback(
    (grupoId: number, modo: ModoEstructura) => {
      const g = grupos.find((item) => item.id === grupoId)
      const pags = g?.paginas || []
      const decPrev = decisiones[grupoId]
      const ordenPrevio = decPrev?.ordenPaginas || {}
      const bloquesUnicosPrevios = new Set(Object.values(ordenPrevio))
      const tieneBloquesConcatenados = bloquesUnicosPrevios.size >= 2

      const slots: Record<number, string> = {}
      const etiquetas: Record<number, string> = {}
      const ordenPaginas: Record<number, number> = {}

      if (modo === 'INDEPENDIENTE') {
        if (tieneBloquesConcatenados) {
          // Si había grupos concatenados (Bloque 2, Bloque 3...), devolver cada bloque concatenado a su propio grupo independiente
          const bloquesOrdenados = Array.from(bloquesUnicosPrevios).sort((a, b) => a - b)
          const primerBloque = bloquesOrdenados[0] || 1
          const pagsPrimerBloque = pags.filter((p) => (ordenPrevio[p.id] || 1) === primerBloque)
          const otrosBloques = bloquesOrdenados.slice(1)

          if (pagsPrimerBloque.length > 0 && otrosBloques.length > 0) {
            const gruposRestaurados: Grupo[] = []
            otrosBloques.forEach((ordBloque, idxB) => {
              const pagsBloque = pags.filter((p) => (ordenPrevio[p.id] || 1) === ordBloque)
              if (pagsBloque.length > 0 && g) {
                gruposRestaurados.push({
                  id: Number(`${Date.now() % 1000000}${idxB + 1}${Math.floor(Math.random() * 100)}`),
                  loteId: g.loteId,
                  totalPaginas: pagsBloque.length,
                  tipoDocumentoSugerido: null,
                  estado: 'nuevo',
                  paginas: pagsBloque,
                })
              }
            })

            setGruposLocales((prevGrupos) => {
              const idxG = prevGrupos.findIndex((item) => item.id === grupoId)
              if (idxG < 0) return prevGrupos
              const gModificado: Grupo = {
                ...prevGrupos[idxG],
                paginas: pagsPrimerBloque,
                totalPaginas: pagsPrimerBloque.length,
              }
              return [
                ...prevGrupos.slice(0, idxG),
                gModificado,
                ...gruposRestaurados,
                ...prevGrupos.slice(idxG + 1),
              ]
            })

            setDecisiones((prev) => {
              const dec = prev[grupoId] || {
                modo: 'nuevo',
                confirmado: false,
                esDobleCara: false,
              }
              const next: Record<number, DecisionGrupo> = {
                ...prev,
                [grupoId]: {
                  ...dec,
                  modoEstructura: 'INDEPENDIENTE',
                  esDobleCara: false,
                  formatoCaras: 'paginas_correlativas',
                  esMultipagina: false,
                  slotsEsperados: 1,
                  ordenPaginas: {},
                  slotsPaginas: {},
                  etiquetasPaginas: {},
                },
              }
              gruposRestaurados.forEach((gr) => {
                next[gr.id] = {
                  modo: 'nuevo',
                  nombreNuevo: '',
                  confirmado: false,
                  esDobleCara: false,
                  formatoCaras: 'paginas_correlativas',
                  modoEstructura: 'INDEPENDIENTE',
                  slotsEsperados: 1,
                  ordenPaginas: {},
                  slotsPaginas: {},
                  etiquetasPaginas: {},
                }
              })
              return next
            })

            sincronizarEstructuraGrupo(grupoId, pagsPrimerBloque, 'INDEPENDIENTE', {}, {})
            return
          }
        }

        // Volver a estado sin concatenación: cada página es independiente (Página 1 de su propio documento)
        pags.forEach((p) => {
          ordenPaginas[p.id] = 1
          slots[p.id] = 'Página 1'
          etiquetas[p.id] = 'Muestra'
        })
      } else if (tieneBloquesConcatenados) {
        // Preservar los bloques (Grupo 1 = Página 1, Grupo 2 = Página 2, etc.)
        const totalBloques = bloquesUnicosPrevios.size
        pags.forEach((p) => {
          const ord = ordenPrevio[p.id] || 1
          ordenPaginas[p.id] = ord
          if (modo === 'ANVERSO_REVERSO' && totalBloques === 2) {
            slots[p.id] = `Página ${ord}`
            etiquetas[p.id] = ord === 1 ? 'Página 1 (Anverso)' : 'Página 2 (Reverso)'
          } else {
            slots[p.id] = `Página ${ord}`
            etiquetas[p.id] = `Página ${ord}`
          }
        })
      } else {
        // Grupo individual aún sin otro grupo concatenado: todas sus N páginas similares actúan como Bloque Página 1
        pags.forEach((p) => {
          ordenPaginas[p.id] = 1
          slots[p.id] = 'Página 1'
          etiquetas[p.id] =
            modo === 'ANVERSO_REVERSO' ? 'Página 1 (Anverso)' : 'Página 1'
        })
      }

      const numBloques = new Set(Object.values(ordenPaginas)).size || 1

      setDecisiones((prev) => {
        const dec = prev[grupoId] || {
          modo: 'nuevo',
          confirmado: false,
          esDobleCara: false,
        }

        return {
          ...prev,
          [grupoId]: {
            ...dec,
            modoEstructura: modo,
            esDobleCara: modo === 'ANVERSO_REVERSO',
            formatoCaras:
              modo === 'ANVERSO_REVERSO'
                ? 'anverso_reverso'
                : modo === 'MIXTA'
                  ? 'mixto'
                  : 'paginas_correlativas',
            esMultipagina: modo === 'MULTIPAGINA' || numBloques > 2,
            slotsEsperados: modo === 'INDEPENDIENTE' ? 1 : Math.max(2, numBloques),
            ordenPaginas: modo === 'INDEPENDIENTE' ? {} : ordenPaginas,
            slotsPaginas: modo === 'INDEPENDIENTE' ? {} : slots,
            etiquetasPaginas: modo === 'INDEPENDIENTE' ? {} : etiquetas,
          },
        }
      })

      sincronizarEstructuraGrupo(
        grupoId,
        pags,
        modo,
        modo === 'INDEPENDIENTE' ? {} : slots,
        modo === 'INDEPENDIENTE' ? {} : ordenPaginas
      )
    },
    [grupos, decisiones, sincronizarEstructuraGrupo]
  )

  // Alternar par Anverso/Reverso entre página actual y la siguiente en modo MIXTA (RF-27)
  const handleToggleParMixto = useCallback(
    (grupoId: number, indexPagina: number) => {
      const g = grupos.find((item) => item.id === grupoId)
      const pags = g?.paginas || []
      if (indexPagina < 0 || indexPagina >= pags.length - 1) return

      const pagActual = pags[indexPagina]
      const pagSiguiente = pags[indexPagina + 1]

      setDecisiones((prev) => {
        const dec = prev[grupoId]
        if (!dec) return prev
        const slots = { ...(dec.slotsPaginas || {}) }
        const etiquetas = { ...(dec.etiquetasPaginas || {}) }

        const yaEsPar =
          (slots[pagSiguiente.id] || '').toUpperCase().includes('REVERSO')

        if (yaEsPar) {
          slots[pagActual.id] = `Simple (${indexPagina + 1})`
          etiquetas[pagActual.id] = `Simple (${indexPagina + 1})`
          slots[pagSiguiente.id] = `Simple (${indexPagina + 2})`
          etiquetas[pagSiguiente.id] = `Simple (${indexPagina + 2})`
        } else {
          slots[pagActual.id] = 'Anverso'
          etiquetas[pagActual.id] = 'Lado A (Anverso)'
          slots[pagSiguiente.id] = 'Reverso'
          etiquetas[pagSiguiente.id] = 'Lado B (Reverso)'
        }

        sincronizarEstructuraGrupo(grupoId, pags, 'MIXTA', slots)

        return {
          ...prev,
          [grupoId]: {
            ...dec,
            modoEstructura: 'MIXTA',
            formatoCaras: 'mixto',
            slotsPaginas: slots,
            etiquetasPaginas: etiquetas,
          },
        }
      })
    },
    [grupos, sincronizarEstructuraGrupo]
  )

  const handleToggleDobleCara = useCallback(
    (grupoId: number, checked: boolean) => {
      handleCambiarModoEstructura(grupoId, checked ? 'ANVERSO_REVERSO' : 'SECUENCIAL')
    },
    [handleCambiarModoEstructura]
  )

  const handleCambiarFormatoCaras = useCallback(
    (grupoId: number, formato: 'anverso_reverso' | 'paginas_correlativas') => {
      handleCambiarModoEstructura(
        grupoId,
        formato === 'anverso_reverso' ? 'ANVERSO_REVERSO' : 'SECUENCIAL'
      )
    },
    [handleCambiarModoEstructura]
  )

  const handleInvertirCaras = useCallback(
    (grupoId: number) => {
      const decActual = decisiones[grupoId]
      const ordenPrevio = decActual?.ordenPaginas || {}
      const bloquesUnicos = Array.from(new Set(Object.values(ordenPrevio))).sort((a, b) => a - b)

      let pagsNuevas: Pagina[] = []
      const nuevoOrdenPaginas: Record<number, number> = {}
      const nuevosSlots: Record<number, string> = {}
      const nuevasEtiquetas: Record<number, string> = {}

      setGruposLocales((prev) =>
        prev.map((g) => {
          if (g.id !== grupoId) return g
          const pags = [...(g.paginas || [])]
          if (pags.length < 2) return g

          if (bloquesUnicos.length >= 2) {
            // Invertir bloques completos (ej. Bloque Página 1 <-> Bloque Página 2) manteniendo el orden interno de cada bloque
            const mapaInvertido = new Map<number, number>()
            bloquesUnicos.forEach((ord, idx) => {
              mapaInvertido.set(ord, bloquesUnicos[bloquesUnicos.length - 1 - idx])
            })

            const modoActual = decActual?.modoEstructura || 'SECUENCIAL'
            pags.forEach((p) => {
              const ordAnt = ordenPrevio[p.id] || 1
              const ordNuevo = mapaInvertido.get(ordAnt) || 1
              nuevoOrdenPaginas[p.id] = ordNuevo
              nuevosSlots[p.id] = `Página ${ordNuevo}`
              nuevasEtiquetas[p.id] =
                modoActual === 'ANVERSO_REVERSO' && bloquesUnicos.length === 2
                  ? ordNuevo === 1
                    ? 'Página 1 (Anverso)'
                    : 'Página 2 (Reverso)'
                  : `Página ${ordNuevo}`
            })

            pags.sort((a, b) => (nuevoOrdenPaginas[a.id] || 1) - (nuevoOrdenPaginas[b.id] || 1))
          } else {
            pags.reverse()
          }

          pagsNuevas = pags
          return { ...g, paginas: pags }
        })
      )

      setDecisiones((prev) => {
        const dec = prev[grupoId]
        if (!dec) return prev
        if (bloquesUnicos.length >= 2) {
          return {
            ...prev,
            [grupoId]: {
              ...dec,
              ordenPaginas: nuevoOrdenPaginas,
              slotsPaginas: nuevosSlots,
              etiquetasPaginas: nuevasEtiquetas,
            },
          }
        }
        const etiqActuales = dec.etiquetasPaginas || {}
        const keys = Object.keys(etiqActuales).map(Number)
        if (keys.length === 2) {
          const [k1, k2] = keys
          return {
            ...prev,
            [grupoId]: {
              ...dec,
              etiquetasPaginas: {
                [k1]: etiqActuales[k2],
                [k2]: etiqActuales[k1],
              },
            },
          }
        }
        return prev
      })

      if (pagsNuevas.length >= 2) {
        const dec = decisiones[grupoId]
        sincronizarEstructuraGrupo(
          grupoId,
          pagsNuevas,
          dec?.modoEstructura || 'ANVERSO_REVERSO',
          bloquesUnicos.length >= 2 ? nuevosSlots : dec?.slotsPaginas,
          bloquesUnicos.length >= 2 ? nuevoOrdenPaginas : dec?.ordenPaginas
        )
      }
    },
    [decisiones, sincronizarEstructuraGrupo]
  )

  // Mover página a la izquierda o derecha en la tira de páginas
  const handleMoverPagina = useCallback(
    (grupoId: number, indexActual: number, direccion: 'izquierda' | 'derecha') => {
      let pagsActualizadas: Pagina[] = []
      setGruposLocales((prev) =>
        prev.map((g: Grupo) => {
          if (g.id !== grupoId) return g
          const pags = [...(g.paginas || [])]
          const indexDestino = direccion === 'izquierda' ? indexActual - 1 : indexActual + 1
          if (indexDestino < 0 || indexDestino >= pags.length) return g

          const [movida] = pags.splice(indexActual, 1)
          pags.splice(indexDestino, 0, movida)
          pagsActualizadas = pags
          return { ...g, paginas: pags }
        })
      )

      if (pagsActualizadas.length > 0) {
        const dec = decisiones[grupoId]
        sincronizarEstructuraGrupo(
          grupoId,
          pagsActualizadas,
          dec?.modoEstructura || 'SECUENCIAL',
          dec?.slotsPaginas
        )
      }
    },
    [decisiones, sincronizarEstructuraGrupo]
  )

  // RF-29: Reordenar páginas dentro del grupo arrastrando (drag and drop)
  const handleReordenarPaginas = useCallback(
    (grupoId: number, indexOrigen: number, indexDestino: number) => {
      if (indexOrigen === indexDestino) return
      let pagsActualizadas: Pagina[] = []

      setGruposLocales((prev) =>
        prev.map((g: Grupo) => {
          if (g.id !== grupoId) return g
          const pags = [...(g.paginas || [])]
          if (
            indexOrigen < 0 ||
            indexOrigen >= pags.length ||
            indexDestino < 0 ||
            indexDestino >= pags.length
          ) {
            return g
          }

          const [movida] = pags.splice(indexOrigen, 1)
          pags.splice(indexDestino, 0, movida)
          pagsActualizadas = pags
          return { ...g, paginas: pags }
        })
      )

      if (pagsActualizadas.length > 0) {
        const dec = decisiones[grupoId]
        sincronizarEstructuraGrupo(
          grupoId,
          pagsActualizadas,
          dec?.modoEstructura || 'SECUENCIAL',
          dec?.slotsPaginas
        )
      }
    },
    [decisiones, sincronizarEstructuraGrupo]
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
            const ordenOrigen = { ...(decOrigen.ordenPaginas || {}) }
            delete etiqOrigen[paginaId]
            delete slotsOrigen[paginaId]
            delete ordenOrigen[paginaId]
            next[grupoOrigenId] = {
              ...decOrigen,
              ordenPaginas: ordenOrigen,
              etiquetasPaginas: etiqOrigen,
              slotsPaginas: slotsOrigen,
              esDobleCara: pagsOrigenRestantes.length === 2 && Boolean(decOrigen.esDobleCara),
              esMultipagina: Boolean(decOrigen.esMultipagina) && pagsOrigenRestantes.length > 2,
            }
          }

          if (pagsOrigenRestantes.length === 0) {
            delete next[grupoOrigenId]
          }

          if (decDestino) {
            const modoDest = decDestino.modoEstructura || 'INDEPENDIENTE'
            const etiqDestino = { ...(decDestino.etiquetasPaginas || {}) }
            const slotsDestino = { ...(decDestino.slotsPaginas || {}) }
            const ordenDestinoMap = { ...(decDestino.ordenPaginas || {}) }

            const matchBloque = slotDestino?.match(/(\d+)/)
            const esLadoB =
              slotDestino?.toLowerCase().includes('reverso') ||
              slotDestino?.toLowerCase().includes('lado b')

            if (modoDest === 'INDEPENDIENTE' && !esLadoB && !matchBloque) {
              // Agregar como página similar del grupo sin activar concatenación secuencial
              next[grupoDestinoId] = {
                ...decDestino,
                modoEstructura: 'INDEPENDIENTE',
                esDobleCara: false,
                esMultipagina: false,
              }
            } else {
              const bloqueNum = matchBloque ? Number(matchBloque[1]) : esLadoB ? 2 : 1
              const slotNombre = `Página ${bloqueNum}`
              ordenDestinoMap[paginaId] = bloqueNum
              slotsDestino[paginaId] = slotNombre
              etiqDestino[paginaId] =
                (modoDest === 'ANVERSO_REVERSO' || esLadoB) && bloqueNum === 2
                  ? 'Página 2 (Reverso)'
                  : slotNombre

              const nuevoModo: ModoEstructura =
                modoDest === 'INDEPENDIENTE'
                  ? esLadoB
                    ? 'ANVERSO_REVERSO'
                    : 'SECUENCIAL'
                  : modoDest

              next[grupoDestinoId] = {
                ...decDestino,
                modoEstructura: nuevoModo,
                ordenPaginas: ordenDestinoMap,
                etiquetasPaginas: etiqDestino,
                slotsPaginas: slotsDestino,
                esDobleCara: nuevoModo === 'ANVERSO_REVERSO',
                esMultipagina: nuevoModo === 'MULTIPAGINA',
              }
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

  // RF-22, RF-24, RF-25, RF-26, RT-04, RT-10: Fusionar múltiples grupos en el grupo destino con persistencia en backend
  const ejecutarFusionMultiplesGrupos = useCallback(
    async (gruposOrigenIds: number[], grupoDestinoId: number, comoLadoB?: boolean) => {
      const idsLimpiados = gruposOrigenIds.filter((id) => id !== grupoDestinoId)
      if (idsLimpiados.length === 0) return

      if (loteId) {
        try {
          await fusionarGruposLote(loteId, grupoDestinoId, idsLimpiados)
        } catch {
          // Si falla la llamada de red o son IDs temporales, continuar actualización local y borrador
        }
      }

      setGruposLocales((prev) => {
        const gDest = prev.find((g) => g.id === grupoDestinoId)
        if (!gDest) return prev

        const setOrigen = new Set(idsLimpiados)
        const gruposOrigenEncontrados: Grupo[] = []
        const pagsExtra: Pagina[] = []
        for (const idOrig of idsLimpiados) {
          const gOrig = prev.find((g) => g.id === idOrig)
          if (gOrig?.paginas && gOrig.paginas.length > 0) {
            gruposOrigenEncontrados.push(gOrig)
            pagsExtra.push(...gOrig.paginas)
          }
        }

        if (pagsExtra.length === 0) return prev

        const pagsDest = gDest.paginas || []
        const pagsNuevas = [...pagsDest, ...pagsExtra]
        const gDestModificado: Grupo = {
          ...gDest,
          paginas: pagsNuevas,
          totalPaginas: pagsNuevas.length,
        }

        const nuevosGrupos = prev
          .filter((g) => !setOrigen.has(g.id))
          .map((g) => (g.id === grupoDestinoId ? gDestModificado : g))

        setDecisiones((prevDec) => {
          const decDest = prevDec[grupoDestinoId]
          const next = { ...prevDec }

          const ordenPaginas: Record<number, number> = {}
          const slotsPaginas: Record<number, string> = {}
          const etiquetasPaginas: Record<number, string> = {}

          // 1. Todas las páginas del grupo destino mantienen su bloque previo o reciben bloque 1 (Página 1)
          const ordenPrevDest = decDest?.ordenPaginas || {}
          let maxOrdenActual = 1
          pagsDest.forEach((p) => {
            const ord = ordenPrevDest[p.id] || 1
            ordenPaginas[p.id] = ord
            if (ord > maxOrdenActual) maxOrdenActual = ord
          })

          // 2. Cada grupo origen recibe el siguiente bloque de página (ej. todas las páginas del Grupo 2 son Página 2)
          gruposOrigenEncontrados.forEach((gOrig) => {
            const decOrig = prevDec[gOrig.id]
            const ordenPrevOrig = decOrig?.ordenPaginas || {}
            const bloquesOrig = Array.from(
              new Set((gOrig.paginas || []).map((p) => ordenPrevOrig[p.id] || 1))
            ).sort((a, b) => a - b)

            ;(gOrig.paginas || []).forEach((p) => {
              const relIdx = Math.max(0, bloquesOrig.indexOf(ordenPrevOrig[p.id] || 1))
              ordenPaginas[p.id] = maxOrdenActual + 1 + relIdx
            })
            maxOrdenActual += Math.max(1, bloquesOrig.length)
          })

          idsLimpiados.forEach((id) => delete next[id])

          const totalBloques = new Set(Object.values(ordenPaginas)).size || 2
          const nuevoModo: ModoEstructura =
            comoLadoB
              ? 'ANVERSO_REVERSO'
              : totalBloques > 2
                ? 'MULTIPAGINA'
                : !decDest?.modoEstructura || decDest.modoEstructura === 'INDEPENDIENTE'
                  ? 'SECUENCIAL'
                  : decDest.modoEstructura

          pagsNuevas.forEach((p) => {
            const ord = ordenPaginas[p.id] || 1
            slotsPaginas[p.id] = `Página ${ord}`
            if (nuevoModo === 'ANVERSO_REVERSO' && totalBloques === 2) {
              etiquetasPaginas[p.id] = ord === 1 ? 'Página 1 (Anverso)' : 'Página 2 (Reverso)'
            } else {
              etiquetasPaginas[p.id] = `Página ${ord}`
            }
          })

          next[grupoDestinoId] = {
            ...(decDest || {
              modo: 'nuevo',
              confirmado: false,
              esDobleCara: false,
            }),
            modoEstructura: nuevoModo,
            esDobleCara: nuevoModo === 'ANVERSO_REVERSO',
            esMultipagina: nuevoModo === 'MULTIPAGINA' || totalBloques > 2,
            slotsEsperados: totalBloques,
            ordenPaginas,
            slotsPaginas,
            etiquetasPaginas,
          }

          sincronizarEstructuraGrupo(
            grupoDestinoId,
            pagsNuevas,
            nuevoModo,
            slotsPaginas,
            ordenPaginas
          )

          return next
        })

        return nuevosGrupos
      })
    },
    [loteId, sincronizarEstructuraGrupo]
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
        void ejecutarFusionMultiplesGrupos([grupoOrigenId], grupoDestinoId, comoLadoB)
      }

      // Validar origen de la primera página del grupo
      verificarOrigenYProceder(pagsOrigen[0], gDestino, accion)
    },
    [grupos, verificarOrigenYProceder, ejecutarFusionMultiplesGrupos]
  )

  // Fusionar múltiples grupos seleccionados hacia el grupo destino (RF-26)
  const handleFusionarMultiplesGrupos = useCallback(
    (gruposOrigenIds: number[], grupoDestinoId: number) => {
      void ejecutarFusionMultiplesGrupos(gruposOrigenIds, grupoDestinoId, false)
    },
    [ejecutarFusionMultiplesGrupos]
  )

  // RF-16, RF-17, RF-18, RT-03, RT-09: Mover página al grupo "Descartadas" al final del lote
  const handleDescartarPagina = useCallback(
    async (grupoOrigenId: number, paginaId: number) => {
      let grupoDescartadasBackendId: number | null = null
      if (loteId) {
        try {
          const resp = await descartarPaginaLote(loteId, paginaId)
          grupoDescartadasBackendId = resp.grupo_descartadas_id
        } catch {
          // Si falla la red, mover localmente al grupo Descartadas
        }
      }

      setGruposLocales((prev) => {
        const gOrigen = prev.find((g) => g.id === grupoOrigenId)
        if (!gOrigen) return prev

        const pagsOrigen = gOrigen.paginas || []
        const pagina = pagsOrigen.find((p) => p.id === paginaId)
        if (!pagina) return prev

        const pagsRestantes = pagsOrigen.filter((p) => p.id !== paginaId)

        // Buscar si ya existe el grupo Descartadas
        const existenteDescartadas = prev.find((g) => g.estado === 'descartadas')
        const idDescartadas =
          existenteDescartadas?.id ||
          grupoDescartadasBackendId ||
          Number(`999${loteId || 1}`)

        const grupoDescartadasActualizado: Grupo = existenteDescartadas
          ? {
              ...existenteDescartadas,
              id: idDescartadas,
              paginas: [...(existenteDescartadas.paginas || []), pagina],
              totalPaginas: (existenteDescartadas.paginas?.length || 0) + 1,
            }
          : {
              id: idDescartadas,
              loteId: gOrigen.loteId,
              totalPaginas: 1,
              tipoDocumentoSugerido: null,
              estado: 'descartadas',
              paginas: [pagina],
            }

        const sinDescartadas = prev
          .filter((g) => g.estado !== 'descartadas')
          .map((g) => {
            if (g.id !== grupoOrigenId) return g
            return {
              ...g,
              paginas: pagsRestantes,
              totalPaginas: pagsRestantes.length,
            }
          })
          .filter((g) => (g.paginas?.length || 0) > 0)

        setDecisiones((prevDec) => {
          const next = { ...prevDec }
          if (pagsRestantes.length === 0) {
            delete next[grupoOrigenId]
          }
          if (!next[idDescartadas]) {
            next[idDescartadas] = {
              modo: 'nuevo',
              nombreNuevo: '',
              confirmado: false,
              esDobleCara: false,
              formatoCaras: 'paginas_correlativas',
              modoEstructura: 'SECUENCIAL',
              slotsEsperados: grupoDescartadasActualizado.totalPaginas,
              etiquetasPaginas: {},
              slotsPaginas: {},
            }
          }
          return next
        })

        // Siempre poner el grupo "Descartadas" al final del lote (RF-17, RF-18)
        return [...sinDescartadas, grupoDescartadasActualizado]
      })
    },
    [loteId]
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

  // Quitar la concatenación del último grupo absorbido (ej. separar el bloque Página K de vuelta a un grupo independiente)
  const handleDesconcatenarUltimoGrupo = useCallback(
    (grupoId: number) => {
      setGruposLocales((prev) => {
        const idx = prev.findIndex((g: Grupo) => g.id === grupoId)
        if (idx < 0) return prev
        const gActual = prev[idx]
        const pags = gActual.paginas || []
        const decActual = decisiones[grupoId]
        const ordenMap = decActual?.ordenPaginas || {}

        const bloquesUnicos = Array.from(
          new Set(pags.map((p) => ordenMap[p.id] || 1))
        ).sort((a, b) => a - b)

        // Si no hay múltiples bloques concatenados, simplemente desactivar el modo de concatenación interna
        if (bloquesUnicos.length < 2) {
          setDecisiones((prevDec) => {
            const dec = prevDec[grupoId]
            if (!dec) return prevDec
            return {
              ...prevDec,
              [grupoId]: {
                ...dec,
                modoEstructura: 'INDEPENDIENTE',
                esDobleCara: false,
                esMultipagina: false,
                slotsEsperados: 1,
                ordenPaginas: {},
                slotsPaginas: {},
                etiquetasPaginas: {},
              },
            }
          })
          return prev
        }

        const ultimoOrden = bloquesUnicos[bloquesUnicos.length - 1]
        const pagsUltimoBloque = pags.filter((p) => (ordenMap[p.id] || 1) === ultimoOrden)
        const pagsRestantes = pags.filter((p) => (ordenMap[p.id] || 1) !== ultimoOrden)

        if (pagsUltimoBloque.length === 0 || pagsRestantes.length === 0) {
          return prev
        }

        const grupoModificado: Grupo = {
          ...gActual,
          paginas: pagsRestantes,
          totalPaginas: pagsRestantes.length,
        }

        const nuevoGrupoId = Number(
          `${Date.now() % 1000000}${Math.floor(Math.random() * 1000)}`
        )
        const nuevoGrupo: Grupo = {
          id: nuevoGrupoId,
          loteId: gActual.loteId,
          totalPaginas: pagsUltimoBloque.length,
          tipoDocumentoSugerido: null,
          estado: 'nuevo',
          paginas: pagsUltimoBloque,
        }

        const bloquesRestantes = bloquesUnicos.length - 1

        setDecisiones((prevDec) => {
          const dec = prevDec[grupoId]
          const next = { ...prevDec }

          if (dec) {
            if (bloquesRestantes <= 1) {
              // Si solo queda el bloque Página 1, el grupo vuelve a su estado normal independiente
              next[grupoId] = {
                ...dec,
                modoEstructura: 'INDEPENDIENTE',
                esDobleCara: false,
                esMultipagina: false,
                slotsEsperados: 1,
                ordenPaginas: {},
                slotsPaginas: {},
                etiquetasPaginas: {},
              }
            } else {
              const nuevoOrden: Record<number, number> = {}
              const nuevosSlots: Record<number, string> = {}
              const nuevasEtiquetas: Record<number, string> = {}
              pagsRestantes.forEach((p) => {
                const ord = ordenMap[p.id] || 1
                nuevoOrden[p.id] = ord
                nuevosSlots[p.id] = `Página ${ord}`
                nuevasEtiquetas[p.id] =
                  dec.modoEstructura === 'ANVERSO_REVERSO' && bloquesRestantes === 2
                    ? ord === 1
                      ? 'Página 1 (Anverso)'
                      : 'Página 2 (Reverso)'
                    : `Página ${ord}`
              })

              const modoRestante: ModoEstructura =
                bloquesRestantes > 2
                  ? 'MULTIPAGINA'
                  : dec.modoEstructura === 'ANVERSO_REVERSO'
                    ? 'ANVERSO_REVERSO'
                    : 'SECUENCIAL'

              next[grupoId] = {
                ...dec,
                modoEstructura: modoRestante,
                esDobleCara: modoRestante === 'ANVERSO_REVERSO',
                esMultipagina: bloquesRestantes > 2,
                slotsEsperados: bloquesRestantes,
                ordenPaginas: nuevoOrden,
                slotsPaginas: nuevosSlots,
                etiquetasPaginas: nuevasEtiquetas,
              }
            }
          }

          next[nuevoGrupoId] = {
            modo: 'nuevo',
            nombreNuevo: '',
            confirmado: false,
            esDobleCara: false,
            formatoCaras: 'paginas_correlativas',
            modoEstructura: 'INDEPENDIENTE',
            slotsEsperados: 1,
            ordenPaginas: {},
            etiquetasPaginas: {},
            slotsPaginas: {},
          }

          return next
        })

        return [...prev.slice(0, idx), grupoModificado, nuevoGrupo, ...prev.slice(idx + 1)]
      })
    },
    [decisiones]
  )

  // Desanexar última página o último bloque concatenado
  const handleDesanexarUltimaPagina = useCallback(
    (grupoId: number) => {
      const dec = decisiones[grupoId]
      const bloquesUnicos = new Set(Object.values(dec?.ordenPaginas || {}))
      if (bloquesUnicos.size >= 2) {
        handleDesconcatenarUltimoGrupo(grupoId)
        return
      }
      const g = grupos.find((item) => item.id === grupoId)
      const pags = g?.paginas || []
      if (pags.length <= 1) return
      const ultima = pags[pags.length - 1]
      handleRemoverPagina(grupoId, ultima.id)
    },
    [grupos, decisiones, handleRemoverPagina, handleDesconcatenarUltimoGrupo]
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
        const ordenPaginas: Record<number, number> = {}
        const slots: Record<number, string> = {}
        const etiquetas: Record<number, string> = {}

        // Cada grupo elegido aporta sus N páginas como el bloque Página (idxGrupo + 1)
        gruposElegidos.forEach((g, idxGrupo) => {
          const nroBloque = idxGrupo + 1
          const slot = `Página ${nroBloque}`
          ;(g.paginas || []).forEach((p) => {
            todasPaginas.push(p)
            ordenPaginas[p.id] = nroBloque
            slots[p.id] = slot
            etiquetas[p.id] = slot
          })
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

          next[primerGrupo.id] = {
            modo: tipoIdSeleccionado ? 'existente' : 'nuevo',
            tipoId: tipoIdSeleccionado,
            nombreNuevo: nombreNuevoTipo,
            confirmado: Boolean(tipoIdSeleccionado || nombreNuevoTipo),
            esDobleCara: false,
            formatoCaras: 'paginas_correlativas',
            esMultipagina: true,
            modoEstructura: gruposElegidos.length > 2 ? 'MULTIPAGINA' : 'SECUENCIAL',
            slotsEsperados: gruposElegidos.length,
            ordenPaginas,
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

  // Validación de estado listo (RF-14: sin nombres duplicados; RF-19: grupo "Descartadas" puede quedar sin tipo)
  const totalGruposListos = useMemo(() => {
    if (!grupos.length) return 0
    return grupos.filter((g: Grupo) => {
      if (g.estado === 'descartadas') return true
      const dec = decisiones[g.id]
      if (!dec) return false
      if (dec.modo === 'sugerido') return dec.confirmado
      if (dec.modo === 'existente') return Boolean(dec.tipoId)
      if (dec.modo === 'nuevo') return Boolean(dec.nombreNuevo?.trim())
      return false
    }).length
  }, [grupos, decisiones])

  const todosGruposListos =
    totalGruposListos === grupos.length && grupos.length > 0 && !tieneNombresDuplicados

  // Confirmar y persistir final (Punto D & G)
  const handleConfirmarAgrupamiento = useCallback(async () => {
    if (!todosGruposListos || !loteId) return null
    setErrorEnvio(null)

    const asignaciones = grupos.map((g: Grupo) => {
      const dec = decisiones[g.id]
      const pags = g.paginas || []
      const etiquetas = dec?.etiquetasPaginas || {}
      const slots = dec?.slotsPaginas || {}
      const ordenes = dec?.ordenPaginas || {}
      const pids = pags.map((p) => String(p.id))

      const modoEfectivo: ModoEstructura = dec?.modoEstructura || 'INDEPENDIENTE'

      const estructura = pags.map((p, idx) => {
        const ordenBloque =
          modoEfectivo === 'INDEPENDIENTE'
            ? 1
            : ordenes[p.id] ||
              (modoEfectivo === 'ANVERSO_REVERSO' ? (idx % 2) + 1 : idx + 1)

        let defaultSlot = 'Muestra'
        if (modoEfectivo === 'ANVERSO_REVERSO') {
          defaultSlot = `Página ${ordenBloque}`
        } else if (modoEfectivo === 'SECUENCIAL' || modoEfectivo === 'MULTIPAGINA') {
          defaultSlot = `Página ${ordenBloque}`
        }
        const slotNombre = slots[p.id] || defaultSlot
        const defaultEti =
          modoEfectivo === 'ANVERSO_REVERSO'
            ? ordenBloque === 1
              ? 'Página 1 (Anverso)'
              : `Página ${ordenBloque} (Reverso)`
            : slotNombre

        return {
          pagina_id: p.id,
          orden: ordenBloque,
          nro_pdf: p.nroPaginaEnPdf,
          slot: slotNombre,
          etiqueta: etiquetas[p.id] || defaultEti,
        }
      })

      const tieneLadoB =
        modoEfectivo !== 'INDEPENDIENTE' &&
        estructura.some(
          (e) =>
            e.etiqueta.toLowerCase().includes('lado b') ||
            e.etiqueta.toLowerCase().includes('reverso') ||
            e.slot.toLowerCase().includes('reverso')
        )

      const bloquesDistintos = new Set(estructura.map((e) => e.orden)).size
      const slotsEsperados =
        modoEfectivo === 'INDEPENDIENTE'
          ? 1
          : dec?.slotsEsperados || Math.max(2, bloquesDistintos)

      const estaIncompleto = modoEfectivo !== 'INDEPENDIENTE' && pags.length < slotsEsperados

      return {
        grupoId: String(g.id),
        tipoDocumentoId: dec?.modo !== 'nuevo' && dec?.tipoId ? dec.tipoId : null,
        nombreNuevoTipo:
          dec?.modo === 'nuevo' && dec?.nombreNuevo ? dec.nombreNuevo.trim() : null,
        esDobleCara: Boolean(modoEfectivo === 'ANVERSO_REVERSO' || tieneLadoB),
        paginaIds: pids,
        estructuraPaginas: estructura,
        modoEstructura: modoEfectivo,
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
    gruposConNombreDuplicado,
    tieneNombresDuplicados,
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
    handleToggleParMixto,
    handleInvertirCaras,
    handleAnexarSiguientePagina,
    handleVincularReversoConSiguiente,
    handleRemoverPagina,
    handleDescartarPagina,
    handleMoverPagina,
    handleReordenarPaginas,
    handleCambiarEtiquetaPagina,
    handleMoverPaginaAGrupo,
    handleTraerPaginaDeGrupo,
    handleFusionarGrupos,
    handleFusionarMultiplesGrupos,
    handleCrearTipoMultipagina,
    handleDesconcatenarUltimoGrupo,
    handleDesanexarUltimaPagina,
    handleSepararGrupoEnPaginasIndividuales,
    handleConfirmarAgrupamiento,
    handleConfirmarAlertaOrigen,
    handleCancelarAlertaOrigen,
  }
}
