export interface UploadQueueProps {
  files: File[]
  onRemoveFile: (index: number) => void
  uploading: boolean
  onUpload: () => void
}
