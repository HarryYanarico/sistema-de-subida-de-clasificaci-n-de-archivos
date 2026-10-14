import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDropzone } from '../components/FileDropzone/FileDropzone'
import { UploadQueue } from '../components/UploadQueue/UploadQueue'
import { UploadProgress } from '../components/UploadProgress/UploadProgress'
import { UploadResultSummary } from '../components/UploadResultSummary/UploadResultSummary'
import { extraerCodigo, esCodigoValido, uploadBatchFile } from '../services/upload.service'
import {
  ResultadoBatch,
  ProgresoArchivo,
  DetalleArchivo,
  ErrorArchivo,
} from '../types/documentos.types'

export function SubirDocumentosPage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBatch | null>(null)

  // Estados para carga progresiva
  const [progresoLista, setProgresoLista] = useState<ProgresoArchivo[]>([])
  const [archivoActualIndex, setArchivoActualIndex] = useState<number>(-1)
  const [faseActual, setFaseActual] = useState<string>('')

  const addFiles = (newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(
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
  }

  const archivosValidos = files.filter((file) => esCodigoValido(extraerCodigo(file.name)))
  const archivosInvalidos = files.filter((file) => !esCodigoValido(extraerCodigo(file.name)))
  const tieneInvalidos = archivosInvalidos.length > 0

  const handleUpload = async () => {
    if (archivosValidos.length === 0 || tieneInvalidos) return

    setUploading(true)
    setResultado(null)

    const listaInicial: ProgresoArchivo[] = archivosValidos.map((f) => ({
      archivo: f.name,
      estado: 'pendiente',
    }))
    setProgresoLista(listaInicial)

    const userStr = localStorage.getItem('user')
    const userId = userStr ? JSON.parse(userStr)?.id : null

    let procesadosTotal = 0
    let paginasTotal = 0
    const detalles: DetalleArchivo[] = []
    const errores: ErrorArchivo[] = []

    for (let i = 0; i < archivosValidos.length; i++) {
      const file = archivosValidos[i]
      setArchivoActualIndex(i)
      setFaseActual(`Procesando archivo ${i + 1} de ${archivosValidos.length}: ${file.name}`)

      setProgresoLista((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, estado: 'procesando' } : item))
      )

      try {
        const data = await uploadBatchFile(file, userId)

        if (data.detalles && data.detalles.length > 0) {
          const det = data.detalles[0]
          procesadosTotal += 1
          paginasTotal += det.paginas
          detalles.push(det)

          setProgresoLista((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    estado: 'completado',
                    paginas: det.paginas,
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

    setResultado({
      success: errores.length === 0,
      total_archivos: archivosValidos.length,
      procesados: procesadosTotal,
      total_paginas: paginasTotal,
      errores,
      detalles,
    })

    setUploading(false)
    setArchivoActualIndex(-1)
    setFaseActual('')
    setFiles([])
  }

  const porcentajeProgreso =
    archivosValidos.length > 0 && archivoActualIndex >= 0
      ? Math.round(((archivoActualIndex + 1) / archivosValidos.length) * 100)
      : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subir Documentos</h1>
          <p className="text-muted-foreground mt-1">
            Los folios se extraen, analizan y clasifican automáticamente a partir del código de persona.
          </p>
        </div>
        {files.length > 0 && !uploading && (
          <Button variant="outline" onClick={clearFiles}>
            Limpiar todo
          </Button>
        )}
      </div>

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
