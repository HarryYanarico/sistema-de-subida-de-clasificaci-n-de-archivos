export interface KeywordItemUI {
  palabra: string
  esObligatoria: boolean
  activa: boolean
}

/**
 * Parsea una cadena de palabras clave 'palabra:peso' o 'palabra' y lista de obligatorias a objetos de UI amigables.
 */
export function parseKeywordsToUI(
  keywordsString?: string | null,
  obligatorias?: string[] | null
): KeywordItemUI[] {
  if (!keywordsString) return []
  const obligSet = new Set((obligatorias || []).map((s) => s.toLowerCase().trim()))
  return keywordsString
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split(':')
      const word = parts[0].trim()
      const weight = parts[1] ? Number(parts[1]) : 3
      const esOblig = obligSet.has(word.toLowerCase()) || weight >= 5
      return {
        palabra: word,
        esObligatoria: esOblig,
        activa: true,
      }
    })
}

/**
 * Convierte los ítems de UI al formato 'palabra:peso' esperado por el backend sin exponer pesos al usuario.
 */
export function formatKeywordsFromUI(items: KeywordItemUI[]): string {
  return items
    .filter((i) => i.activa && i.palabra.trim().length > 0)
    .map((i) => `${i.palabra.trim()}:${i.esObligatoria ? 5 : 3}`)
    .join(', ')
}

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
