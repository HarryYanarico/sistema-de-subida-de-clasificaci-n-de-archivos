import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CloudUpload } from 'lucide-react'
import { FileDropzoneProps } from './FileDropzone.types'

export function FileDropzone({ onFilesAdded, disabled }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!disabled && e.dataTransfer.files.length > 0) {
      onFilesAdded(e.dataTransfer.files)
    }
  }

  const handleClick = () => {
    if (!disabled) fileInputRef.current?.click()
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesAdded(e.target.files)
    }
  }

  return (
    <Card className="border-dashed border-2">
      <CardContent className="p-0">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`p-8 text-center cursor-pointer transition-colors ${
            isDragging ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
          />
          <CloudUpload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Arrastra tus archivos PDF aquí</p>
          <p className="text-sm text-muted-foreground mt-1">
            o haz clic para seleccionar archivos desde tu computadora
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            El nombre de cada PDF debe contener el código de persona (ej: <code>10001.pdf</code>)
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
