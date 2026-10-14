/**
 * Asigna peso por defecto (3) a palabras clave que no especifiquen un peso explícito 'palabra:peso'.
 */
export function autoAssignWeight(keywords: string[]): string[] {
  return keywords.map((k) => {
    if (k.includes(':')) return k
    return `${k}:3`
  })
}

/**
 * Parsea una cadena de palabras clave separadas por comas a un array limpio.
 */
export function parseKeywords(keywordsString?: string | null): string[] {
  if (!keywordsString) return []
  return keywordsString
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Prepara la cadena final de palabras clave para enviar al backend.
 */
export function formatKeywordsForPayload(keywords: string[]): string {
  return autoAssignWeight(keywords).join(', ')
}
