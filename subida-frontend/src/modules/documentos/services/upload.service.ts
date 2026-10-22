import { ResultadoBatch } from '../types/documentos.types'
import { env } from '@config/environment'

export { extraerCodigo, esCodigoValido, sanitizarNombreTipoDocumento } from '@/utils/validators'

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
 * Retorna la URL del archivo PDF de una página individual del lote.
 */
export function getPaginaPdfUrl(paginaId: number | string): string {
  return `/api/paginas/${paginaId}/file/`
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
 * Requiere credentials: 'include' para enviar la cookie HTTP-only de sesión (admincentral_access_token).
 */
export async function uploadBatchFile(
  file: File,
  userId?: number | string | null,
  personaId?: number | string | null
): Promise<ResultadoBatch> {
  const formData = new FormData()
  if (userId) {
    formData.append('user_id', userId.toString())
  }
  if (personaId) {
    formData.append('persona_id', personaId.toString())
  }
  formData.append('pdfs', file)

  const response = await fetch('/api/upload/batch/', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (response.status === 401) {
    const loginUrl = env.admincentralLoginUrl || '/login'
    if (window.location.pathname !== '/login' && !window.location.href.includes(loginUrl)) {
      window.location.href = loginUrl
    }
    throw new Error('Sesión expirada o no autenticado. Redirigiendo a inicio de sesión...')
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    const msg = errorData?.message || `Error en el servidor al procesar el archivo (${response.status})`
    throw new Error(msg)
  }

  return response.json()
}
