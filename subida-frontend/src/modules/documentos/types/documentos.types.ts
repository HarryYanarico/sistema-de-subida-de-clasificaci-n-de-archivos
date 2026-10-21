export interface DetalleArchivo {
  archivo: string
  lote_id?: number
  total_paginas?: number
  total_grupos?: number
  persona_id?: number | null
  persona_codigo?: string | null
  persona_nombre?: string | null
  paginas?: number
}

export interface ErrorArchivo {
  archivo: string
  error: string
}

export interface ResultadoBatch {
  success: boolean
  total_archivos: number
  procesados: number
  total_paginas: number
  lote_id?: number | null
  errores: ErrorArchivo[]
  detalles: DetalleArchivo[]
}

export interface ProgresoArchivo {
  archivo: string
  estado: 'pendiente' | 'procesando' | 'completado' | 'error'
  lote_id?: number
  total_grupos?: number
  paginas?: number
  persona_codigo?: string | null
  persona_nombre?: string | null
  persona_id?: number | null
  error?: string
}
