import { ResultadoBatch } from '../types/documentos.types'

export { extraerCodigo, esCodigoValido } from '@/utils/validators'

/**
 * Retorna la URL del archivo PDF en el backend.
 */
export function getDocumentFileUrl(documentoId: number): string {
  return `/api/documents/${documentoId}/file/`
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
  userId?: number | null
): Promise<ResultadoBatch> {
  const formData = new FormData()
  if (userId) {
    formData.append('user_id', userId.toString())
  }
  formData.append('pdfs', file)

  const response = await fetch('/api/upload/batch/', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Error en el servidor al procesar el archivo (${response.status})`)
  }

  return response.json()
}
