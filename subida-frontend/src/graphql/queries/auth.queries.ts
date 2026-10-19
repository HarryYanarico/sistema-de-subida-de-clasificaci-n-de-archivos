import { gql } from '@apollo/client'

export const ME_QUERY = gql`
  query Me {
    me {
      id
      username
      email
      firstName
      lastName
      role
      rolSlug
      codEmpleado
      telefono
      unidad {
        id
        codigo
        nombre
        activa
      }
    }
  }
`
