import { Persona } from '@app-types/index'

export type { Persona }

export interface PersonaFormData {
  codigo: string
  nombres: string
  apellidos: string
  ci?: string
  email?: string
  telefono?: string
}
