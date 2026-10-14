export interface DetalleArchivo {
  archivo: string
  persona_id: number
  persona_codigo: string
  persona_nombre: string
  paginas: number
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
  errores: ErrorArchivo[]
  detalles: DetalleArchivo[]
}

export interface ProgresoArchivo {
  archivo: string
  estado: 'pendiente' | 'procesando' | 'completado' | 'error'
  paginas?: number
  persona_codigo?: string
  persona_nombre?: string
  persona_id?: number
  error?: string
}
