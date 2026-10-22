import { Grupo } from '@app-types/documento.types'
import { TipoDocumento } from '@app-types/tipo-documento.types'
import { DecisionGrupo } from '../../hooks/useAgruparLote'

export interface GrupoDecisionCardProps {
  grupo: Grupo
  indexReal: number
  decision: DecisionGrupo
  tiposExistentes: TipoDocumento[]
  nombresEnEsteLote?: string[]
  puedeCopiarAlSiguiente?: boolean
  puedeVincularConSiguiente?: boolean
  siguienteNumeroGrupo?: number
  onAceptarSugerido: (grupoId: number) => void
  onCambiarAOtroTipo: (grupoId: number) => void
  onCambiarANuevoTipo: (grupoId: number) => void
  onSeleccionarTipoExistente: (grupoId: number, tipoId: string) => void
  onTextoNuevoTipo: (grupoId: number, texto: string) => void
  onAplicarNombre?: (grupoId: number, nombre: string) => void
  onAnexarAnio?: (grupoId: number, anio: number | string) => void
  onCopiarAlSiguiente?: (grupoId: number) => void
  onToggleDobleCara: (grupoId: number, checked: boolean) => void
  onCambiarFormatoCaras?: (grupoId: number, formato: 'anverso_reverso' | 'paginas_correlativas') => void
  onInvertirCaras?: (grupoId: number) => void
  onAnexarSiguientePagina?: (grupoId: number, comoLadoB?: boolean) => void
  onVincularReversoConSiguiente?: (grupoId: number) => void
  onDesanexarUltimaPagina?: (grupoId: number) => void
  onSepararGrupo?: (grupoId: number) => void
  onVerTodasPaginas: (grupo: Grupo) => void
  autoFocus?: boolean
}


