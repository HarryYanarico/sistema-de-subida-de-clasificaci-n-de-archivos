import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@config/routes'
import { useAuth } from '@/contexts/AuthContext'
import { FileDropzone } from '../components/FileDropzone/FileDropzone'
import { UploadQueue } from '../components/UploadQueue/UploadQueue'
import { UploadProgress } from '../components/UploadProgress/UploadProgress'
import { UploadResultSummary } from '../components/UploadResultSummary/UploadResultSummary'
import { uploadSequentialBatch } from '../services/upload.service'
import {
  ResultadoBatch,
  ProgresoArchivo,
} from '../types/documentos.types'

export function SubirDocumentosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBatch | null>(null)
  const [nonPdfError, setNonPdfError] = useState<string | null>(null)

  // Estados para carga progresiva en 2 dimensiones
  const [progresoLista, setProgresoLista] = useState<ProgresoArchivo[]>([])
  const [faseActual, setFaseActual] = useState<string>('')
  const [porcentajeProgreso, setPorcentajeProgreso] = useState<number>(0)

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
    setFaseActual('')
    setPorcentajeProgreso(0)
    setNonPdfError(null)
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setResultado(null)
    setNonPdfError(null)

    const listaInicial: ProgresoArchivo[] = files.map((f, idx) => ({
      archivo: f.name,
      estado: idx === 0 ? 'procesando' : 'pendiente',
    }))
    setProgresoLista(listaInicial)
    setPorcentajeProgreso(5)
    setFaseActual(`Iniciando digitalización de ${files.length} archivo(s)...`)

    const userId = user?.id ? Number(user.id) : null

    try {
      const data = await uploadSequentialBatch(files, userId, null, (prog) => {
        setPorcentajeProgreso(prog.porcentaje)

        if (prog.fase === 'subiendo') {
          setFaseActual(`Subiendo archivo ${prog.archivoActual} de ${prog.totalArchivos}: ${prog.nombreArchivoActual}`)
          setProgresoLista((prev) =>
            prev.map((item, idx) => {
              if (idx < prog.archivoActual - 1) return { ...item, estado: 'completado' }
              if (idx === prog.archivoActual - 1) return { ...item, estado: 'procesando' }
              return item
            })
          )
        } else if (prog.fase === 'ocr') {
          setFaseActual(`Procesando página ${prog.paginasProcesadas} (Archivo ${prog.archivoActual}/${prog.totalArchivos})...`)
          setProgresoLista((prev) =>
            prev.map((item, idx) => {
              if (idx === prog.archivoActual - 1) return { ...item, estado: 'completado', paginas: prog.paginasProcesadas }
              return item
            })
          )
        } else if (prog.fase === 'agrupando') {
          setFaseActual(`Agrupando páginas por similitud entre todos los PDFs...`)
          setProgresoLista((prev) => prev.map((item) => ({ ...item, estado: 'completado' })))
        } else if (prog.fase === 'completado') {
          setFaseActual(`¡Digitalización completada! Redirigiendo a revisión...`)
        }
      })

      setUploading(false)
      setFaseActual('')
      setFiles([])

      // Redirigir de inmediato a la pantalla de agrupamiento de este lote
      if (data.lote_id) {
        navigate(ROUTES.LOTES.AGRUPAR(data.lote_id))
        return
      }

      setResultado(data)
    } catch (err: unknown) {
      setUploading(false)
      setFaseActual('')
      const errorMsg = err instanceof Error ? err.message : 'Error al procesar el lote'
      setResultado({
        success: false,
        total_archivos: files.length,
        procesados: 0,
        total_paginas: 0,
        lote_id: null,
        errores: [{ archivo: 'Lote completo', error: errorMsg }],
        detalles: [],
      })
    }
  }

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
