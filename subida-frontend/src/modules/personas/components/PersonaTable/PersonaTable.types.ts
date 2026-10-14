import { Persona } from '@app-types/index'

export interface PersonaTableProps {
  personas: Persona[]
  loading: boolean
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}
