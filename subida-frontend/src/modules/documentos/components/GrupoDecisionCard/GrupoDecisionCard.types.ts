import { Grupo, Pagina } from '@app-types/documento.types'
import { TipoDocumento } from '@app-types/tipo-documento.types'
import { DecisionGrupo } from '../../hooks/useAgruparLote'
import { ItemPortapapeles } from '../PortapapelesFlotante/PortapapelesFlotante'

export interface GrupoDecisionCardProps {
  grupo: Grupo
  indexReal: number
  decision: DecisionGrupo
  tiposExistentes: TipoDocumento[]
  nombresEnEsteLote?: string[]
  puedeCopiarAlSiguiente?: boolean
  puedeVincularConSiguiente?: boolean
  siguienteNumeroGrupo?: number
  todosLosGrupos?: Grupo[]
  itemPortapapeles?: ItemPortapapeles | null
  onAceptarSugerido: (grupoId: number) => void
  onCambiarAOtroTipo: (grupoId: number) => void
  onCambiarANuevoTipo: (grupoId: number) => void
  onSeleccionarTipoExistente: (grupoId: number, tipoId: string) => void
  onTextoNuevoTipo: (grupoId: number, texto: string) => void
  onAplicarNombre?: (grupoId: number, nombre: string) => void
  onAnexarAnio?: (grupoId: number, anio: number | string) => void
  onCopiarAlSiguiente?: (grupoId: number) => void
  onToggleDobleCara?: (grupoId: number, checked: boolean) => void
  onCambiarFormatoCaras?: (grupoId: number, formato: 'anverso_reverso' | 'paginas_correlativas') => void
  onInvertirCaras?: (grupoId: number) => void
  onAnexarSiguientePagina?: (grupoId: number, comoLadoB?: boolean) => void
  onVincularReversoConSiguiente?: (grupoId: number) => void
  onRemoverPagina?: (grupoId: number, paginaId: number) => void
  onMoverPagina?: (grupoId: number, indexActual: number, direccion: 'izquierda' | 'derecha') => void
  onCambiarEtiquetaPagina?: (grupoId: number, paginaId: number, etiqueta: string) => void
  onMoverPaginaAGrupo?: (paginaId: number, grupoOrigenId: number, grupoDestinoId: number, slotDestino?: string) => void
  onTraerPaginaDeGrupo?: (grupoDestinoId: number, grupoOrigenId: number, paginaId: number, slotDestino?: string) => void
  onFusionarGrupos?: (grupoOrigenId: number, grupoDestinoId: number, comoLadoB?: boolean) => void
  onCambiarModoEstructura?: (grupoId: number, modo: 'INDEPENDIENTE' | 'ANVERSO_REVERSO' | 'MULTIPAGINA') => void
  onAbrirSelectorMoverPagina?: (pagina: Pagina, grupoId: number) => void
  onAbrirSelectorTraerPagina?: (grupoId: number) => void
  onAbrirSelectorFusionarGrupo?: (grupoId: number) => void
  onTomarPaginaEnPortapapeles?: (pagina: Pagina, grupoId: number, numeroGrupoVisible: number) => void
  onPegarPaginaDesdePortapapeles?: (grupoDestinoId: number, slotDestino?: string) => void
  onDesanexarUltimaPagina?: (grupoId: number) => void
  onSepararGrupo?: (grupoId: number) => void
  onVerTodasPaginas: (grupo: Grupo) => void
  autoFocus?: boolean
}
