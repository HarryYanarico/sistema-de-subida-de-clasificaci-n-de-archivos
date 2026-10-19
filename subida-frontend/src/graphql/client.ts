import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import { GRAPHQL_URL } from '@config/constants'
import { env } from '@config/environment'

const httpLink = createHttpLink({
  uri: GRAPHQL_URL,
  credentials: 'include',
})

const errorLink = onError(({ graphQLErrors, networkError }) => {
  let is401 = false

  if (networkError && 'statusCode' in networkError && networkError.statusCode === 401) {
    is401 = true
  }

  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const code = err.extensions?.code
      if (
        code === 'UNAUTHENTICATED' ||
        err.message?.includes('401') ||
        err.message?.toLowerCase().includes('no autenticado') ||
        err.message?.toLowerCase().includes('permissiondenied')
      ) {
        is401 = true
        break
      }
    }
  }

  if (is401) {
    const loginUrl = env.admincentralLoginUrl || '/login'
    // Prevenir bucle infinito si ya estamos en la página de login
    const currentPath = window.location.pathname
    if (!window.location.href.includes(loginUrl) && currentPath !== '/login') {
      if (loginUrl.startsWith('http://') || loginUrl.startsWith('https://')) {
        window.location.href = loginUrl
      } else {
        window.location.href = loginUrl
      }
    }
  }
})

export const apolloClient = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
})

// Alias export para compatibilidad con código existente
export const client = apolloClient

