/**
 * Tipos auxiliares de respuestas de operaciones GraphQL.
 */

export interface EstadisticasDigitalizacion {
  totalDocumentos: number
  totalClasificados: number
  totalVerificados: number
  totalDudosos: number
  totalSinClasificar: number
  totalDuplicados: number
  totalPendientes: number
  tasaEfectividad: number
  sugerenciasPendientes: number
}

export interface DocumentoRecienteGraphQL {
  id: number
  paginaNumero: number
  estado: string
  score: number | null
  createdAt: string
  persona: {
    id: number
    codigo: string
    nombres: string
    apellidos: string
  } | null
  tipoDocumento: {
    id: number
    nombre: string
  } | null
}

export interface DashboardMetricasResponse {
  estadisticasDigitalizacion: EstadisticasDigitalizacion
  documentosRecientes: DocumentoRecienteGraphQL[]
}

export interface GenerarSugerenciasKeywordsResponse {
  generarSugerenciasKeywords: {
    success: boolean
    message?: string
    totalGeneradas: number
    totalVerificados: number
  }
}
