export interface PalabraSugerida {
  palabra: string
  esObligatoria: boolean
  seleccionada: boolean
}

export interface SugerenciasAdminData {
  suficientesEjemplos: boolean
  totalEjemplos: number
  mensaje?: string | null
  siempre: PalabraSugerida[]
  suelen: PalabraSugerida[]
  yaNoAparecen: PalabraSugerida[]
}

export interface SugerenciasAdminPanelProps {
  tipoDocumentoId: number
  onPalabrasActualizadas?: (palabrasClave: string, keywordsObligatorias?: string[]) => void
}
