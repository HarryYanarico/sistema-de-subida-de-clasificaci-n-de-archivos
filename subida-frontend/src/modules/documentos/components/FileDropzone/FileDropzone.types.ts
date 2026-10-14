export interface FileDropzoneProps {
  onFilesAdded: (files: FileList | File[]) => void
  disabled?: boolean
}
