import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, X, CheckCircle, AlertCircle, CloudUpload } from 'lucide-react'
import { useUnidad } from '@/contexts/UnidadContext'

interface DetalleArchivo {
  archivo: string
  persona_id: number
  persona_codigo: string
  persona_nombre: string
  paginas: number
}

interface ErrorArchivo {
  archivo: string
  error: string
}

interface ResultadoBatch {
  success: boolean
  total_archivos: number
  procesados: number
  total_paginas: number
  errores: ErrorArchivo[]
  detalles: DetalleArchivo[]
}

function extraerCodigo(filename: string): string {
  return filename.replace(/\.pdf$/i, '').trim()
}

function esCodigoValido(codigo: string): boolean {
  return /^\d{5,}$/.test(codigo)
}

export function SubirDocumentos() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBatch | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { unidadActiva } = useUnidad()

  const addFiles = (newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(
      (file) => file.type === 'application/pdf'
    )
    setFiles((prev) => [...prev, ...pdfFiles])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
    setResultado(null)
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    if (!unidadActiva) return

    setUploading(true)
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('unidad_id', unidadActiva.id.toString())
      files.forEach((file) => {
        formData.append('pdfs', file)
      })

      const response = await fetch('/api/upload/batch/', {
        method: 'POST',
        body: formData,
      })

      const data: ResultadoBatch = await response.json()
      setResultado(data)
      setFiles([])
    } catch {
      setResultado({
        success: false,
        total_archivos: 0,
        procesados: 0,
        total_paginas: 0,
        errores: [{ archivo: '-', error: 'Error de conexión con el servidor' }],
        detalles: [],
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subir Documentos</h1>
          <p className="text-muted-foreground mt-1">
            Cargue múltiples PDFs. El código del estudiante se extrae del nombre del archivo.
          </p>
        </div>
        {files.length > 0 && (
          <Button variant="outline" onClick={clearFiles}>
            Limpiar todo
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Archivos PDF</CardTitle>
          <CardDescription>
            Cada archivo debe llamarse con el código de registro del estudiante (5+ dígitos, ej: 12345678.pdf)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 scale-[1.01]'
                : 'border-muted-foreground/30 bg-muted/50 hover:bg-muted hover:border-muted-foreground/50'
            }`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <CloudUpload
                className={`h-12 w-12 mb-3 transition-colors ${
                  isDragging ? 'text-blue-500' : 'text-muted-foreground'
                }`}
              />
              {isDragging ? (
                <p className="text-sm font-semibold text-blue-600">
                  Suelta los archivos aquí
                </p>
              ) : (
                <>
                  <p className="mb-1 text-sm text-muted-foreground">
                    <span className="font-semibold">Arrastra archivos PDF aquí</span>
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    o haz click para seleccionar
                  </p>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Nombre del archivo: código de 5+ dígitos (ej: 12345678.pdf)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf"
              onChange={handleFileChange}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{files.length} archivo(s) seleccionado(s):</p>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {files.map((file, index) => {
                  const codigo = extraerCodigo(file.name)
                  const valido = esCodigoValido(codigo)
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{file.name}</span>
                        {valido ? (
                          <Badge variant="outline" className="text-xs">
                            Código: {codigo}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Nombre inválido
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader>
            <CardTitle>Resultado del Procesamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-secondary/50 rounded-lg">
                <p className="text-2xl font-bold">{resultado.total_archivos}</p>
                <p className="text-sm text-muted-foreground">Archivos enviados</p>
              </div>
              <div className="text-center p-4 bg-secondary/50 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-2xl font-bold">{resultado.procesados}</p>
                  <Badge variant="success" className="text-xs">OK</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Procesados</p>
              </div>
              <div className="text-center p-4 bg-secondary/50 rounded-lg">
                <p className="text-2xl font-bold">{resultado.total_paginas}</p>
                <p className="text-sm text-muted-foreground">Páginas totales</p>
              </div>
            </div>

            {resultado.detalles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Archivos procesados correctamente:</p>
                <div className="space-y-1">
                  {resultado.detalles.map((det, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-md transition-colors hover:bg-secondary/50">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium">{det.archivo}</span>
                      <Badge variant="secondary" className="text-xs">{det.persona_codigo}</Badge>
                      <span className="text-sm text-muted-foreground hidden sm:inline">→ {det.persona_nombre}</span>
                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">{det.paginas} páginas</span>
                      <Link to={`/personas/${det.persona_id}`}>
                        <Button variant="outline" size="sm" className="h-6 text-xs">Ver casillero</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultado.errores.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Archivos con errores:</p>
                <div className="space-y-1">
                  {resultado.errores.map((err, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-destructive/5 rounded-md">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <span className="text-sm font-medium">{err.archivo}</span>
                      <span className="text-sm text-muted-foreground">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading || !unidadActiva}
          size="lg"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Procesando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Subir y Procesar
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
