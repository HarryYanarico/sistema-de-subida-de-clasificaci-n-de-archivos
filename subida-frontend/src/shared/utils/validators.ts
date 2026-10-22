/**
 * Funciones de validación para entradas del usuario, nombres de archivos y documentos.
 */
import { UPLOAD_LIMITS } from '@config/constants'

/**
 * Extrae el código de persona del nombre de un archivo PDF.
 * Prioriza el bloque numérico principal (4+ dígitos al inicio o tras prefijo tipo 'Documento_'),
 * ignorando números adicionales posteriores (como años 2024, tomos, etc.).
 *
 * Ejemplos:
 * - "216179920 - JUAN PEREZ 2024.pdf" -> "216179920"
 * - "216179920_JUAN_PEREZ_TOMO_1.pdf" -> "216179920"
 * - "Documento_310000010.pdf" -> "310000010"
 */
export function extraerCodigo(filename: string): string {
  const sinExtension = filename.replace(/\.pdf$/i, '').trim()

  // 1. Prioridad: bloque numérico de 4+ dígitos al inicio o con prefijo alfabético
  const matchInicio = sinExtension.match(/^(?:[A-Za-z]+[\s_\-\.]+)?(\d{4,})/)
  if (matchInicio) {
    return matchInicio[1]
  }

  // 2. Bloque numérico delimitado en el texto
  const matchDelimitado = sinExtension.match(/\b\d{4,}\b/)
  if (matchDelimitado) {
    return matchDelimitado[0]
  }

  // 3. Fallback: cualquier bloque continuo de 4+ dígitos
  const matchFallback = sinExtension.match(/\d{4,}/)
  return matchFallback ? matchFallback[0] : ''
}

/**
 * Verifica si un código de persona cumple con el estándar mínimo (4+ dígitos).
 */
export function esCodigoValido(codigo: string): boolean {
  return new RegExp(`^\\d{${UPLOAD_LIMITS.MIN_CODIGO_DIGITS},}$`).test(codigo)
}

/**
 * Valida un archivo antes de enviarlo: extensión PDF y tamaño máximo permitido.
 */
export function validarArchivoPDF(file: File): { valido: boolean; error?: string } {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return { valido: false, error: 'El archivo debe ser en formato PDF' }
  }

  if (file.size > UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES) {
    return {
      valido: false,
      error: `El archivo supera el tamaño máximo de ${UPLOAD_LIMITS.MAX_FILE_SIZE_MB}MB`,
    }
  }

  const codigo = extraerCodigo(file.name)
  if (!esCodigoValido(codigo)) {
    return {
      valido: false,
      error: `El nombre debe contener al menos ${UPLOAD_LIMITS.MIN_CODIGO_DIGITS} dígitos identificatorios`,
    }
  }

  return { valido: true }
}

/**
 * Sanitiza el nombre de un tipo de documento para evitar errores humanos:
 * - Convierte a MAYÚSCULAS en tiempo real.
 * - Permite solo letras mayúsculas con tildes (A-Z, Á, É, Í, Ó, Ú, Ñ, Ü), números (0-9),
 *   puntos (.) para abreviaciones (ej: 'CERT.', 'RES.') y espacios simples.
 * - Elimina saltos de línea y tabulaciones.
 * - Colapsa espacios consecutivos a un solo espacio.
 * - No permite espacios al inicio.
 */
export function sanitizarNombreTipoDocumento(input: string): string {
  if (!input) return ''
  return input
    .toUpperCase()
    // Reemplazar saltos de línea y tabulaciones por espacios
    .replace(/[\r\n\t]+/g, ' ')
    // Permitir solo letras mayúsculas con tildes/ñ/ü, números, puntos y espacios
    .replace(/[^A-ZÁÉÍÓÚÑÜ0-9\s.]/g, '')
    // Colapsar espacios consecutivos
    .replace(/\s+/g, ' ')
    // Evitar espacios al inicio
    .replace(/^\s+/, '')
}
