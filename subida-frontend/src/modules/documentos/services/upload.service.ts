import { ResultadoBatch } from '../types/documentos.types'
import { authService } from '@modules/auth/services/auth.service'

export { extraerCodigo, esCodigoValido } from '@/utils/validators'

/**
 * Retorna la URL del archivo PDF en el backend.
 */
export function getDocumentFileUrl(documentoId: number): string {
  return `/api/documents/${documentoId}/file/`
}

/**
 * Retorna la URL de la miniatura de una página individual del lote.
 */
export function getPaginaThumbnailUrl(paginaId: number | string): string {
  return `/api/paginas/${paginaId}/thumbnail/`
}

/**
 * Abre una ventana con el archivo PDF y dispara la acción de impresión.
 */
export function printDocument(documentoId: number): void {
  const printWindow = window.open(getDocumentFileUrl(documentoId), '_blank')
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

/**
 * Envía un archivo PDF al endpoint de subida por lote del backend.
 */
export async function uploadBatchFile(
  file: File,
  userId?: number | null,
  personaId?: number | null
): Promise<ResultadoBatch> {
  const formData = new FormData()
  if (userId) {
    formData.append('user_id', userId.toString())
  }
  if (personaId) {
    formData.append('persona_id', personaId.toString())
  }
  formData.append('pdfs', file)

  const headers: Record<string, string> = {}
  const token = authService.getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch('/api/upload/batch/', {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    const msg = errorData?.message || `Error en el servidor al procesar el archivo (${response.status})`
    throw new Error(msg)
  }

  return response.json()
}
