import { gql } from '@apollo/client'

export const FRAGMENT_PERSONA_BASE = gql`
  fragment PersonaBase on PersonaType {
    id
    codigo
    nombres
    apellidos
    ci
    email
    telefono
    createdAt
  }
`
