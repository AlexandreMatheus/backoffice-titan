/**
 * Filtro por tipo (Inferiores, Puxar, Empurrar, Core, Corpo inteiro) e agrupamento por prateleira.
 * Replicável: mesma lógica do app de referência.
 */

import { sortInferioresShelfGroups } from '@/lib/prateleira-inferiores-order'
import { sortPuxarShelfGroups } from '@/lib/prateleira-puxar-order'
import { sortEmpurrarShelfGroups } from '@/lib/prateleira-empurrar-order'

export type ShelfCategory = 'inferiores' | 'puxar' | 'empurrar' | 'cardio'

export interface ExerciseForShelf {
  id: string
  reference_code?: string | null
  name: string
  execution_type?: string | null
  prateleira?: string | null
  order_index?: number | null
  thumbnail_url?: string | null
  r2_photo_url?: string | null
  subnome?: string | null
  metadata?: {
    musculo_alvo?: string[]
    thumbnail_url?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

const TERMS: Record<Exclude<ShelfCategory, 'nao_classificado'>, string[]> = {
  inferiores: ['inferiores', 'inferior', 'quadriceps', 'quadríceps', 'glúteo', 'gluteo', 'isquiotibiais', 'panturrilha', 'gastrocnêmio', 'sóleo'],
  puxar: ['puxar', 'puxada'],
  empurrar: ['empurrar'],
  cardio: ['cardio', 'cardíaco', 'aeróbico', 'corrida', 'esteira', 'bicicleta', 'ellíptico'],
}

function normalize(str: string | null | undefined): string {
  if (str == null) return ''
  return String(str).trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Retorna true se o tipo de execução do exercício pertence à lista de termos (igual ou contém). */
export function belongsToCategory(exercise: ExerciseForShelf, terms: string[]): boolean {
  const executionType = normalize(exercise.execution_type)
  if (!executionType) return false
  for (const term of terms) {
    const t = term.toLowerCase()
    if (executionType === t || executionType.includes(t)) return true
  }
  return false
}

/** Verifica se o exercício é do tipo Inferiores. */
function isInferiores(exercise: ExerciseForShelf): boolean {
  return belongsToCategory(exercise, TERMS.inferiores)
}

export function filterByCategory(exercises: ExerciseForShelf[], category: ShelfCategory): ExerciseForShelf[] {
  if (category === 'inferiores') {
    return exercises.filter(isInferiores)
  }
  return exercises.filter((ex) => belongsToCategory(ex, TERMS[category]))
}

/**
 * Meus exercícios: sem execution_type aparecem em todas as abas (paridade com app personal).
 */
export function filterPersonalByCategory(
  exercises: ExerciseForShelf[],
  category: ShelfCategory
): ExerciseForShelf[] {
  return exercises.filter((ex) => {
    if (!ex.execution_type || !String(ex.execution_type).trim()) return true
    if (category === 'inferiores') return isInferiores(ex)
    return belongsToCategory(ex, TERMS[category])
  })
}

/** Normaliza nome da prateleira para chave (evitar duplicar por espaço/caixa). */
function normalizePrateleiraKey(prateleira: string | null | undefined): string {
  const s = normalize(prateleira)
  return s || '__tradicional__'
}

/** Agrupa exercícios por prateleira mantendo a ordem de primeiro aparecimento.
 * Prateleira vazia/null vira grupo "Tradicional" no final.
 * Exercícios dentro de cada prateleira são ordenados por order_index.
 * Com `category === 'inferiores'`, a ordem das prateleiras segue PRATELEIRA_ORDEM_INFERIORES.
 * Com `category === 'puxar'`, segue PRATELEIRA_ORDEM_PUXAR.
 * Com `category === 'empurrar'`, segue PRATELEIRA_ORDEM_EMPURRAR. */
export function groupByPrateleira(
  exercises: ExerciseForShelf[],
  category?: ShelfCategory
): { shelfName: string; exercises: ExerciseForShelf[] }[] {
  const map = new Map<string, { displayName: string; exercises: ExerciseForShelf[]; firstIndex: number }>()
  let insertionOrder = 0

  for (const ex of exercises) {
    const raw = ex.prateleira != null ? String(ex.prateleira).trim() : ''
    const key = normalizePrateleiraKey(raw)
    const displayName = raw || 'Tradicional'

    if (!map.has(key)) {
      map.set(key, { displayName, exercises: [], firstIndex: insertionOrder++ })
    }
    map.get(key)!.exercises.push(ex)
  }

  // Separar "Tradicional" e ordenar rest by order of first appearance (não alfabeticamente)
  const others = map.get('__tradicional__')
  const rest = [...map.entries()]
    .filter(([k]) => k !== '__tradicional__')
    .sort((a, b) => a[1].firstIndex - b[1].firstIndex)

  // Ordenar exercícios dentro de cada prateleira por order_index
  const result: { shelfName: string; exercises: ExerciseForShelf[] }[] = rest.map(([, v]) => ({
    shelfName: v.displayName,
    exercises: v.exercises.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
  }))

  // Adicionar "Tradicional" no final, também ordenado por order_index
  if (others && others.exercises.length > 0) {
    result.push({
      shelfName: 'Tradicional',
      exercises: others.exercises.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    })
  }

  if (category === 'inferiores') {
    return sortInferioresShelfGroups(result)
  }
  if (category === 'puxar') {
    return sortPuxarShelfGroups(result)
  }
  if (category === 'empurrar') {
    return sortEmpurrarShelfGroups(result)
  }
  return result
}

export type ExerciseCatalogKind = 'system' | 'personal'

/** Filtra por categoria e agrupa por prateleira. */
export function getShelvesForCategory(
  exercises: ExerciseForShelf[],
  category: ShelfCategory,
  catalog: ExerciseCatalogKind = 'system'
): { shelfName: string; exercises: ExerciseForShelf[] }[] {
  const filtered =
    catalog === 'personal'
      ? filterPersonalByCategory(exercises, category)
      : filterByCategory(exercises, category)
  return groupByPrateleira(filtered, category)
}

export const SHELF_CATEGORY_LABELS: Record<ShelfCategory, string> = {
  inferiores: 'Inferiores',
  puxar: 'Puxar',
  empurrar: 'Empurrar',
  cardio: 'Cardio',
}
