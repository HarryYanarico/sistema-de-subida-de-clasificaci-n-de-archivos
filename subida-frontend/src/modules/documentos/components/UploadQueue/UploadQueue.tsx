import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, X, Upload, CheckCircle2, FolderInput } from 'lucide-react'
import { extraerCodigo, esCodigoValido } from '../../services/upload.service'
import { UploadQueueProps } from './UploadQueue.types'

export function UploadQueue({
  files,
  onRemoveFile,
  uploading,
  onUpload,
}: UploadQueueProps) {
  if (files.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle>Archivos Seleccionados ({files.length})</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cada archivo se procesará y se generarán grupos de páginas para su revisión y nombramiento.
          </p>
        </div>
        <Button
          onClick={onUpload}
          disabled={uploading || files.length === 0}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Subir y Agrupar {files.length} PDF{files.length !== 1 ? 's' : ''}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {files.map((file, index) => {
            const codigo = extraerCodigo(file.name)
            const tieneCodigo = esCodigoValido(codigo)

            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border text-sm transition-colors bg-card border-border hover:border-primary/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4 shrink-0" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      {tieneCodigo ? (
                        <Badge variant="outline" className="text-[11px] gap-1 px-1.5 py-0 border-green-500/40 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          Código detectado: {codigo}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[11px] gap-1 px-1.5 py-0 text-muted-foreground">
                          <FolderInput className="h-3 w-3" />
                          Lote general
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
