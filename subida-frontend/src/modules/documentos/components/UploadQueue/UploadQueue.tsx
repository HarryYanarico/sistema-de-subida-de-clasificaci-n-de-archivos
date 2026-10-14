import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, X, AlertCircle, Upload, CheckCircle } from 'lucide-react'
import { extraerCodigo, esCodigoValido } from '../../services/upload.service'
import { UploadQueueProps } from './UploadQueue.types'

export function UploadQueue({
  files,
  onRemoveFile,
  uploading,
  onUpload,
}: UploadQueueProps) {
  if (files.length === 0) return null

  const archivosValidos = files.filter((file) => esCodigoValido(extraerCodigo(file.name)))
  const archivosInvalidos = files.filter((file) => !esCodigoValido(extraerCodigo(file.name)))
  const tieneInvalidos = archivosInvalidos.length > 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Archivos Seleccionados ({files.length})</CardTitle>
          {tieneInvalidos && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              Hay archivos con nombre inválido. Corríjalos antes de procesar.
            </p>
          )}
        </div>
        <Button
          onClick={onUpload}
          disabled={uploading || archivosValidos.length === 0 || tieneInvalidos}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Procesar {archivosValidos.length} PDF{archivosValidos.length !== 1 ? 's' : ''}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {files.map((file, index) => {
            const codigo = extraerCodigo(file.name)
            const valido = esCodigoValido(codigo)

            return (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-colors ${
                  valido
                    ? 'bg-card border-border'
                    : 'bg-destructive/5 border-destructive/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-md ${
                      valido ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      {valido ? (
                        <Badge variant="outline" className="text-[11px] gap-1 px-1.5 py-0 border-green-500/40 text-green-700 dark:text-green-400">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Código: {codigo}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[11px] gap-1 px-1.5 py-0">
                          <AlertCircle className="h-3 w-3" />
                          Código inválido
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {!uploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveFile(index)}
                    title="Quitar archivo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
