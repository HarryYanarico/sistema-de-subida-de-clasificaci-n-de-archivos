import { ResultadoBatch } from '../../types/documentos.types'

export interface UploadResultSummaryProps {
  resultado: ResultadoBatch
  onReset: () => void
}
