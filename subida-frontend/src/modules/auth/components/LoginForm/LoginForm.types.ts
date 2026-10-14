import { LoginCredentials } from '../../types/auth.types'

export interface LoginFormProps {
  readonly onSubmit: (credentials: LoginCredentials) => Promise<void>
  readonly error?: string | null
  readonly loading?: boolean
}
