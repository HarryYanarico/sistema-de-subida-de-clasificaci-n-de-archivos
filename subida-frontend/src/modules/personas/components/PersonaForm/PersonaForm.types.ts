import { FormEvent } from 'react'
import { PersonaFormData } from '../../types/personas.types'

export interface PersonaFormProps {
  form: PersonaFormData
  error?: string | null
  loading: boolean
  onChange: (field: keyof PersonaFormData, value: string) => void
  onSubmit: (e: FormEvent) => void
}
