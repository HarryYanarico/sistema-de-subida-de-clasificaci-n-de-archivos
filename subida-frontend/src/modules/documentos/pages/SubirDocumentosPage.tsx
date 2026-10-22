import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@config/routes'
import { useAuth } from '@/contexts/AuthContext'
import { FileDropzone } from '../components/FileDropzone/FileDropzone'
import { UploadQueue } from '../components/UploadQueue/UploadQueue'
import { UploadProgress } from '../components/UploadProgress/UploadProgress'
import { UploadResultSummary } from '../components/UploadResultSummary/UploadResultSummary'
import { uploadBatchFile } from '../services/upload.service'
import {
  ResultadoBatch,
  ProgresoArchivo,
  DetalleArchivo,
  ErrorArchivo,
} from '../types/documentos.types'

export function SubirDocumentosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBatch | null>(null)
  const [nonPdfError, setNonPdfError] = useState<string | null>(null)

  // Estados para carga progresiva
  const [progresoLista, setProgresoLista] = useState<ProgresoArchivo[]>([])
  const [archivoActualIndex, setArchivoActualIndex] = useState<number>(-1)
  const [faseActual, setFaseActual] = useState<string>('')

  const addFiles = (newFiles: FileList | File[]) => {
    setNonPdfError(null)
    const arrayFiles = Array.from(newFiles)
    const invalidFiles = arrayFiles.filter(
      (file) => file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')
    )
    if (invalidFiles.length > 0) {
      setNonPdfError(
        `Se descartaron ${invalidFiles.length} archivo(s) porque solo se admiten documentos en formato PDF.`
      )
    }

    const pdfFiles = arrayFiles.filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    )
    setFiles((prev) => [...prev, ...pdfFiles])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
    setResultado(null)
    setProgresoLista([])
    setNonPdfError(null)
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setResultado(null)
    setNonPdfError(null)

    const listaInicial: ProgresoArchivo[] = files.map((f) => ({
      archivo: f.name,
      estado: 'pendiente',
    }))
    setProgresoLista(listaInicial)

    const userId = user?.id ? Number(user.id) : null

    let procesadosTotal = 0
    let paginasTotal = 0
    const detalles: DetalleArchivo[] = []
    const errores: ErrorArchivo[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setArchivoActualIndex(i)
      setFaseActual(`Procesando archivo ${i + 1} de ${files.length}: ${file.name}`)

      setProgresoLista((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, estado: 'procesando' } : item))
      )

      try {
        const data = await uploadBatchFile(file, userId)

        if (data.detalles && data.detalles.length > 0) {
          const det = data.detalles[0]
          procesadosTotal += 1
          paginasTotal += det.total_paginas || det.paginas || 0
          detalles.push(det)

          setProgresoLista((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    estado: 'completado',
                    lote_id: det.lote_id,
                    total_grupos: det.total_grupos,
                    paginas: det.total_paginas || det.paginas,
                    persona_codigo: det.persona_codigo,
                    persona_nombre: det.persona_nombre,
                    persona_id: det.persona_id,
                  }
                : item
            )
          )
        } else if (data.errores && data.errores.length > 0) {
          const err = data.errores[0]
          errores.push(err)
          setProgresoLista((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, estado: 'error', error: err.error } : item
            )
          )
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Error de conexión con el servidor'
        errores.push({ archivo: file.name, error: errorMsg })
        setProgresoLista((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, estado: 'error', error: errorMsg } : item
          )
        )
      }
    }

    setUploading(false)
    setArchivoActualIndex(-1)
    setFaseActual('')
    setFiles([])

    // Si se subió 1 solo archivo y se procesó exitosamente con su lote:
    // Redirigir de inmediato a la pantalla de agrupamiento de ese lote
    if (files.length === 1 && detalles.length === 1 && detalles[0].lote_id) {
      navigate(ROUTES.LOTES.AGRUPAR(detalles[0].lote_id))
      return
    }

    // Si se subieron varios archivos o hubo observaciones, mostrar resumen con accesos directos
    setResultado({
      success: errores.length === 0,
      total_archivos: files.length,
      procesados: procesadosTotal,
      total_paginas: paginasTotal,
      lote_id: detalles[0]?.lote_id || null,
      errores,
      detalles,
    })
  }

  const porcentajeProgreso =
    files.length > 0 && archivoActualIndex >= 0
      ? Math.round(((archivoActualIndex + 1) / files.length) * 100)
      : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subir Documentos</h1>
          <p className="text-muted-foreground mt-1">
            Sube archivos PDF para agrupar automáticamente sus páginas por similitud y asignarles su tipo.
          </p>
        </div>
        {files.length > 0 && !uploading && (
          <Button variant="outline" onClick={clearFiles}>
            Limpiar todo
          </Button>
        )}
      </div>

      {nonPdfError && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
          <span>{nonPdfError}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNonPdfError(null)}
            className="h-7 text-xs text-destructive hover:bg-destructive/20"
          >
            Cerrar
          </Button>
        </div>
      )}

      {/* Zona de arrastrar y soltar */}
      <FileDropzone onFilesAdded={addFiles} disabled={uploading} />

      {/* Barra y lista de progreso */}
      <UploadProgress
        progresoLista={progresoLista}
        porcentaje={porcentajeProgreso}
        faseActual={faseActual}
      />

      {/* Cola de archivos seleccionados */}
      <UploadQueue
        files={files}
        onRemoveFile={removeFile}
        uploading={uploading}
        onUpload={handleUpload}
      />

      {/* Resumen del procesamiento */}
      {resultado && (
        <UploadResultSummary resultado={resultado} onReset={clearFiles} />
      )}
    </div>
  )
}

// Alias export para retrocompatibilidad
export const SubirDocumentos = SubirDocumentosPage
