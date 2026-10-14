/**
 * Genera la URL para la miniatura de un folio renderizada por el backend.
 */
export function getDocumentThumbnailUrl(documentoId: number): string {
  return `/api/documents/${documentoId}/thumbnail/`
}
