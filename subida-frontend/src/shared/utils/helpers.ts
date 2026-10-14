/**
 * Funciones de ayuda general, manejo de errores de conexión y acciones del navegador.
 */

/**
 * Extrae un mensaje de error legible a partir de un error de GraphQL, fetch o excepción genérica.
 */
export function extraerMensajeError(error: any, fallback: string = 'Ha ocurrido un error inesperado'): string {
  if (!error) return fallback

  if (typeof error === 'string') return error

  // GraphQL errors
  if (error.graphQLErrors && error.graphQLErrors.length > 0) {
    return error.graphQLErrors[0].message || fallback
  }

  // Network error
  if (error.networkError) {
    return error.networkError.message || 'Error de conexión con el servidor'
  }

  if (error.message) {
    return error.message
  }

  return fallback
}

/**
 * Abre el PDF de un documento en una nueva pestaña del navegador.
 */
export function abrirDocumentoNuevaPestana(documentoId: number): void {
  window.open(`/api/documents/${documentoId}/file/`, '_blank', 'noopener,noreferrer')
}

/**
 * Retorna la URL del archivo PDF en el backend.
 */
export function getDocumentFileUrl(documentoId: number): string {
  return `/api/documents/${documentoId}/file/`
}

/**
 * Retorna la URL para la miniatura de un folio renderizada por el backend.
 */
export function getDocumentThumbnailUrl(documentoId: number): string {
  return `/api/documents/${documentoId}/thumbnail/`
}

/**
 * Abre e invoca la impresión del documento.
 */
export function imprimirDocumento(documentoId: number): void {
  const printWindow = window.open(getDocumentFileUrl(documentoId), '_blank')
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}
