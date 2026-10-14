import { ProgresoArchivo } from '../../types/documentos.types'

export interface UploadProgressProps {
  progresoLista: ProgresoArchivo[]
  porcentaje: number
  faseActual: string
}
