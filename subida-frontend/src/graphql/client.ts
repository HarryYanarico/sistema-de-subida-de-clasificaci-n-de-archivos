import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { GRAPHQL_URL, STORAGE_KEYS } from '@config/constants'

const httpLink = createHttpLink({
  uri: GRAPHQL_URL,
})

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  }
})

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
})

// Alias export para compatibilidad con código existente
export const client = apolloClient
