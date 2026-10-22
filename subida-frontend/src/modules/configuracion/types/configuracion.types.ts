import { TipoDocumento } from '@app-types/index'

export type { TipoDocumento }

import { KeywordItemUI } from '../services/tipos-documento.service'

export interface TipoForm {
  nombre: string
  palabrasClave: string[]
  keywordsItems?: KeywordItemUI[]
}

export interface SugerenciaKeywordItem {
  id: number
  palabra: string
  ratio: number | string
  frecuencia: number
}
