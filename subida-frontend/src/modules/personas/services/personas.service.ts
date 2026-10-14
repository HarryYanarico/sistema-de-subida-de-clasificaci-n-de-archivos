/**
 * Retorna las iniciales en mayúsculas de una persona.
 */
export function getPersonaInitials(nombres?: string | null, apellidos?: string | null): string {
  const n = nombres?.trim()?.[0] || ''
  const a = apellidos?.trim()?.[0] || ''
  return `${n}${a}`.toUpperCase()
}

/**
 * Retorna el nombre completo formateado.
 */
export function formatPersonaFullName(nombres?: string | null, apellidos?: string | null): string {
  return `${nombres || ''} ${apellidos || ''}`.trim() || 'Sin nombre'
}
