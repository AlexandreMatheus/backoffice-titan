/**
 * Ordem de exibição das prateleiras para execution_type Inferiores.
 * Manter em sync com treinos-app-personal/src/constants/prateleiraInferioresOrder.ts
 */
export const PRATELEIRA_ORDEM_INFERIORES: Record<string, number> = {
  Agachamento: 1,
  'Leg Press': 2,
  'Levantamento Terra': 3,
  'Quadril: Extenção /  Abdução': 4,
  'Quadril: Adução / Flexão': 5,
  'Avanço / Afundo': 6,
  'Joelho: Flexão / Extensão': 7,
  'Tornozelo  / Subtalar': 8,
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

const RANK_BY_NORMALIZED = new Map<string, number>()
for (const [label, rank] of Object.entries(PRATELEIRA_ORDEM_INFERIORES)) {
  RANK_BY_NORMALIZED.set(normKey(label), rank)
}

/**
 * Rank para ordenar prateleiras de inferiores: conhecidas (1–8), depois desconhecidas (por ordem de chegada), Tradicional por último.
 */
export function inferioresPrateleiraRank(shelfDisplayName: string, originalIndex: number): number {
  if (shelfDisplayName === 'Outros' || shelfDisplayName === 'Tradicional') return 900_000
  const known = RANK_BY_NORMALIZED.get(normKey(shelfDisplayName))
  if (known !== undefined) return known
  return 10_000 + originalIndex
}

/**
 * Ordena grupos de prateleira quando o filtro é Inferiores. Dentro de cada grupo, ordene exercícios por order_index separadamente.
 */
export function sortInferioresShelfGroups<T extends { shelfName: string; exercises: unknown[] }>(
  groups: T[]
): T[] {
  return [...groups]
    .map((g, originalIndex) => ({ g, originalIndex }))
    .sort((a, b) => {
      const ra = inferioresPrateleiraRank(a.g.shelfName, a.originalIndex)
      const rb = inferioresPrateleiraRank(b.g.shelfName, b.originalIndex)
      if (ra !== rb) return ra - rb
      return a.originalIndex - b.originalIndex
    })
    .map(({ g }) => g)
}
