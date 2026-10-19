/**
 * Funciones de formateo y presentación visual de datos.
 */
import { DOCUMENTO_ESTADOS } from '@config/constants'

/**
 * Formatea una fecha ISO a formato local legible en español.
 */
export function formatearFecha(
  fecha: string | number | Date | null | undefined,
  incluirHora: boolean = true
): string {
  if (!fecha) return '-'
  try {
    const d = new Date(fecha)
    if (isNaN(d.getTime())) return '-'

    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(incluirHora ? { hour: '2-digit', minute: '2-digit' } : {}),
    })
  } catch {
    return '-'
  }
}

/**
 * Formatea una cantidad de bytes a una unidad humana (KB, MB, GB).
 */
export function formatearTamanoBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Formatea un valor numérico a porcentaje.
 */
export function formatearPorcentaje(valor: number | null | undefined, decimales: number = 0): string {
  if (valor === null || valor === undefined || isNaN(valor)) return '0%'
  return `${valor.toFixed(decimales)}%`
}

/**
 * Devuelve la etiqueta amigable en español para un estado de documento.
 */
export function obtenerEtiquetaEstado(estado: string): string {
  switch (estado) {
    case DOCUMENTO_ESTADOS.VERIFICADO:
      return 'Verificado'
    case DOCUMENTO_ESTADOS.CLASIFICADO:
      return 'Clasificado'
    case DOCUMENTO_ESTADOS.DUDOSA:
      return 'Dudoso'
    case DOCUMENTO_ESTADOS.SIN_CLASIFICAR:
      return 'Sin clasificar'
    case DOCUMENTO_ESTADOS.DUPLICADO:
      return 'Duplicado'
    case DOCUMENTO_ESTADOS.DUPLICADA:
      return 'Duplicada'
    case DOCUMENTO_ESTADOS.PENDIENTE:
      return 'Pendiente'
    default:
      return estado || 'Desconocido'
  }
}

/**
 * Devuelve la variante de Badge (`default` | `success` | `warning` | `secondary` | `destructive` | `outline`) según el estado.
 */
export function obtenerVarianteEstado(
  estado: string
): 'default' | 'success' | 'warning' | 'secondary' | 'destructive' | 'outline' {
  switch (estado) {
    case DOCUMENTO_ESTADOS.VERIFICADO:
      return 'success'
    case DOCUMENTO_ESTADOS.CLASIFICADO:
      return 'default'
    case DOCUMENTO_ESTADOS.DUDOSA:
      return 'warning'
    case DOCUMENTO_ESTADOS.DUPLICADO:
    case DOCUMENTO_ESTADOS.DUPLICADA:
      return 'destructive'
    case DOCUMENTO_ESTADOS.SIN_CLASIFICAR:
    case DOCUMENTO_ESTADOS.PENDIENTE:
      return 'outline'
    default:
      return 'outline'
  }
}
