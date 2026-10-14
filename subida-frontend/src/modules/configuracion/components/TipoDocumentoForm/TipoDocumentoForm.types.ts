import { FormEvent } from 'react'
import { TipoForm } from '../../types/configuracion.types'

export interface TipoDocumentoFormProps {
  form: TipoForm
  editingId: number | null
  onChange: (form: TipoForm) => void
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
  onPalabrasActualizadas: (nuevasPalabras: string) => void
}
