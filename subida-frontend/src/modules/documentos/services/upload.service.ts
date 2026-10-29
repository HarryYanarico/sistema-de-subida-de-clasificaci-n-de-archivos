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
 * Envía múltiples archivos PDF al endpoint de subida por lote del backend en una sola petición.
 * Requiere credentials: 'include' para enviar la cookie HTTP-only de sesión (admincentral_access_token).
 */
export async function uploadBatchFiles(
  files: File[],
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
  for (const file of files) {
    formData.append('pdfs', file)
  }

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

export interface ProgresoProgreso2D {
  archivoActual: number
  totalArchivos: number
  nombreArchivoActual: string
  paginasProcesadas: number
  fase: 'subiendo' | 'ocr' | 'agrupando' | 'completado'
  porcentaje: number
}

/**
 * Sube múltiples archivos PDF de forma secuencial al lote, actualizando el progreso en tiempo real
 * en dos dimensiones (archivos y páginas procesadas) y ejecutando el agrupamiento final.
 */
export async function uploadSequentialBatch(
  files: File[],
  userId?: number | string | null,
  personaId?: number | string | null,
  onProgress?: (progreso: ProgresoProgreso2D) => void
): Promise<ResultadoBatch> {
  const formInit = new FormData()
  if (userId) formInit.append('user_id', userId.toString())
  if (personaId) formInit.append('persona_id', personaId.toString())

  const resInit = await fetch('/api/upload/iniciar-lote/', {
    method: 'POST',
    credentials: 'include',
    body: formInit,
  })

  if (!resInit.ok) {
    return uploadBatchFiles(files, userId, personaId)
  }

  const { lote_id } = await resInit.json()
  let paginasAcumuladas = 0

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const pct = Math.round((i / files.length) * 85)

    onProgress?.({
      archivoActual: i + 1,
      totalArchivos: files.length,
      nombreArchivoActual: file.name,
      paginasProcesadas: paginasAcumuladas,
      fase: 'subiendo',
      porcentaje: pct,
    })

    const formPdf = new FormData()
    formPdf.append('pdf', file)

    const resPdf = await fetch(`/api/upload/lote/${lote_id}/pdf/`, {
      method: 'POST',
      credentials: 'include',
      body: formPdf,
    })

    if (!resPdf.ok) {
      const err = await resPdf.json().catch(() => null)
      throw new Error(err?.message || `Error al procesar ${file.name}`)
    }

    const dataPdf = await resPdf.json()
    paginasAcumuladas = dataPdf.total_paginas_lote || (paginasAcumuladas + (dataPdf.paginas_en_pdf || 1))

    onProgress?.({
      archivoActual: i + 1,
      totalArchivos: files.length,
      nombreArchivoActual: file.name,
      paginasProcesadas: paginasAcumuladas,
      fase: 'ocr',
      porcentaje: Math.round(((i + 1) / files.length) * 85),
    })
  }

  onProgress?.({
    archivoActual: files.length,
    totalArchivos: files.length,
    nombreArchivoActual: '',
    paginasProcesadas: paginasAcumuladas,
    fase: 'agrupando',
    porcentaje: 92,
  })

  const resAgrupar = await fetch(`/api/upload/lote/${lote_id}/agrupar/`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!resAgrupar.ok) {
    const err = await resAgrupar.json().catch(() => null)
    throw new Error(err?.message || 'Error al agrupar páginas del lote')
  }

  const dataAgrupar = await resAgrupar.json()

  onProgress?.({
    archivoActual: files.length,
    totalArchivos: files.length,
    nombreArchivoActual: '',
    paginasProcesadas: paginasAcumuladas,
    fase: 'completado',
    porcentaje: 100,
  })

  return {
    success: true,
    total_archivos: files.length,
    procesados: files.length,
    total_paginas: dataAgrupar.total_paginas,
    total_grupos: dataAgrupar.total_grupos,
    lote_id: dataAgrupar.lote_id,
    detalles: [],
    errores: [],
  }
}

/**
 * Envía un archivo PDF individual al endpoint de subida por lote del backend.
 */
export async function uploadBatchFile(
  file: File,
  userId?: number | string | null,
  personaId?: number | string | null
): Promise<ResultadoBatch> {
  return uploadBatchFiles([file], userId, personaId)
}

/**
 * Formatea la etiqueta de origen de una página como `pdf_XX.pdf, pág N` (RF-12, RF-15).
 */
export function formatearOrigenPagina(
  pdfOrigen?: string | null,
  nroPaginaEnPdf?: number | null
): string {
  const nro = nroPaginaEnPdf ?? 1
  if (!pdfOrigen) return `pág ${nro}`
  const partes = pdfOrigen.replace(/\\/g, '/').split('/')
  const nombreArchivo = partes[partes.length - 1] || pdfOrigen
  return `${nombreArchivo}, pág ${nro}`
}

/**
 * Extrae únicamente el nombre del archivo PDF sin prefijos de carpeta en MinIO.
 */
export function extraerNombreArchivoPdf(pdfOrigen?: string | null): string {
  if (!pdfOrigen) return ''
  const partes = pdfOrigen.replace(/\\/g, '/').split('/')
  return partes[partes.length - 1] || pdfOrigen
}

/**
 * RT-03 / RT-09: Mueve una página al grupo especial "Descartadas" al final del lote.
 */
export async function descartarPaginaLote(
  loteId: number | string,
  paginaId: number | string
): Promise<{
  success: boolean
  pagina_id: number
  grupo_origen_id: number | null
  grupo_descartadas_id: number
  total_descartadas: number
  total_grupos: number
}> {
  const res = await fetch(`/api/upload/lote/${loteId}/descartar-pagina/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pagina_id: Number(paginaId) }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message || 'Error al descartar la página')
  }
  return res.json()
}

/**
 * RT-04 / RT-10: Fusiona uno o más grupos origen dentro de un grupo destino en el backend.
 */
export async function fusionarGruposLote(
  loteId: number | string,
  grupoDestinoId: number | string,
  grupoOrigenIds: (number | string)[]
): Promise<{
  success: boolean
  grupo_destino_id: number
  grupos_fusionados: number[]
  total_paginas: number
  total_grupos: number
}> {
  const res = await fetch(`/api/upload/lote/${loteId}/fusionar-grupos/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grupo_destino_id: Number(grupoDestinoId),
      grupo_origen_ids: grupoOrigenIds.map(Number),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message || 'Error al fusionar los grupos')
  }
  return res.json()
}

/**
 * RT-05 / RT-11: Persiste la estructura interna del grupo (orden de páginas + relación anverso/reverso)
 * en la base de datos (`documentos.grupo_id` y `documentos_paginas.orden`).
 */
export async function guardarEstructuraGrupo(
  grupoId: number | string,
  payload: {
    modo?: string
    pagina_ids?: number[]
    documentos?: { es_doble_cara: boolean; pagina_ids: number[] }[]
  }
): Promise<{
  success: boolean
  grupo_id: number
  total_documentos: number
}> {
  const res = await fetch(`/api/upload/grupo/${grupoId}/estructura/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message || 'Error al persistir la estructura del grupo')
  }
  return res.json()
}
