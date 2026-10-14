import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { CREATE_PERSONA } from '@graphql/mutations/persona.mutations'
import { ROUTES } from '@config/routes'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PersonaForm } from '../components/PersonaForm/PersonaForm'
import { PersonaFormData } from '../types/personas.types'

const emptyForm: PersonaFormData = {
  codigo: '',
  nombres: '',
  apellidos: '',
  ci: '',
  email: '',
  telefono: '',
}

export function RegistrarPersonaPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<PersonaFormData>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [createPersona, { loading }] = useMutation(CREATE_PERSONA)

  const handleChange = (field: keyof PersonaFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      const { data } = await createPersona({
        variables: {
          codigo: form.codigo,
          nombres: form.nombres,
          apellidos: form.apellidos,
          ci: form.ci || undefined,
          email: form.email || undefined,
          telefono: form.telefono || undefined,
        },
      })

      if (data?.createPersona?.success) {
        navigate(ROUTES.PERSONAS.ROOT)
      } else {
        setError(data?.createPersona?.message || 'Error al crear la persona')
      }
    } catch {
      setError('Error al conectar con el servidor')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={ROUTES.PERSONAS.ROOT}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Registrar Persona</h1>
      </div>

      <PersonaForm
        form={form}
        error={error}
        loading={loading}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

// Alias export para retrocompatibilidad
export const RegistrarPersona = RegistrarPersonaPage
