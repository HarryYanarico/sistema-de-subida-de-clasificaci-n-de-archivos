import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useQuery } from '@apollo/client'
import { GET_UNIDADES } from '@/graphql/queries/unidades'
import { Unidad } from '../types'

interface UnidadContextType {
  unidadActiva: Unidad | null
  setUnidadActiva: (unidad: Unidad) => void
  unidades: Unidad[]
  loading: boolean
  refetch: () => void
}

const UnidadContext = createContext<UnidadContextType | undefined>(undefined)

const STORAGE_KEY = 'unidadActiva'

function loadStoredUnidad(): Unidad | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    // ignore
  }
  return null
}

export function UnidadProvider({ children }: { children: ReactNode }) {
  const { data, loading, refetch } = useQuery(GET_UNIDADES, {
    variables: { activo: true },
  })

  const unidades: Unidad[] = data?.unidades || []

  const [unidadActiva, setUnidadActivaState] = useState<Unidad | null>(loadStoredUnidad)

  useEffect(() => {
    if (unidades.length === 0) return

    if (!unidadActiva) {
      const saved = loadStoredUnidad()
      if (saved) {
        const found = unidades.find((u) => u.id === saved.id)
        if (found) {
          setUnidadActivaState(found)
          return
        }
      }
      setUnidadActivaState(unidades[0])
    } else {
      const found = unidades.find((u) => u.id === unidadActiva.id)
      if (found && JSON.stringify(found) !== JSON.stringify(unidadActiva)) {
        setUnidadActivaState(found)
      } else if (!found) {
        setUnidadActivaState(unidades[0])
      }
    }
  }, [unidades])

  const setUnidadActiva = (unidad: Unidad) => {
    setUnidadActivaState(unidad)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unidad))
  }

  return (
    <UnidadContext.Provider value={{ unidadActiva, setUnidadActiva, unidades, loading, refetch }}>
      {children}
    </UnidadContext.Provider>
  )
}

export function useUnidad() {
  const context = useContext(UnidadContext)
  if (!context) {
    throw new Error('useUnidad debe usarse dentro de UnidadProvider')
  }
  return context
}
