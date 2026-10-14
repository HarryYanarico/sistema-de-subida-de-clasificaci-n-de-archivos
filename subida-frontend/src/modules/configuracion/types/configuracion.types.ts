import { TipoDocumento } from '@app-types/index'

export type { TipoDocumento }

export interface TipoForm {
  nombre: string
  palabrasClave: string[]
}

export interface SugerenciaKeywordItem {
  id: number
  palabra: string
  ratio: number | string
  frecuencia: number
}
