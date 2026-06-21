/**
 * Ordem de exibição das prateleiras para execution_type Puxar.
 * Manter em sync com treinos-app-personal/src/constants/prateleiraPuxarOrder.ts
 */
export const PRATELEIRA_ORDEM_PUXAR: Record<string, number> = {
  Puxador: 1,
  'Barra fixa': 2,
  Remada: 3,
  Isolados: 4,
  'Flexão de cotovelo': 5,
  Antebraço: 6,
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

const RANK_BY_NORMALIZED = new Map<string, number>()
for (const [label, rank] of Object.entries(PRATELEIRA_ORDEM_PUXAR)) {
  RANK_BY_NORMALIZED.set(normKey(label), rank)
}

/** Sem acento em "Flexão" (dados legados / digitação). */
RANK_BY_NORMALIZED.set('flexao de cotovelo', PRATELEIRA_ORDEM_PUXAR['Flexão de cotovelo'])

export function puxarPrateleiraRank(shelfDisplayName: string, originalIndex: number): number {
  if (shelfDisplayName === 'Outros' || shelfDisplayName === 'Tradicional') return 900_000
  const known = RANK_BY_NORMALIZED.get(normKey(shelfDisplayName))
  if (known !== undefined) return known
  return 10_000 + originalIndex
}

export function sortPuxarShelfGroups<T extends { shelfName: string; exercises: unknown[] }>(
  groups: T[]
): T[] {
  return [...groups]
    .map((g, originalIndex) => ({ g, originalIndex }))
    .sort((a, b) => {
      const ra = puxarPrateleiraRank(a.g.shelfName, a.originalIndex)
      const rb = puxarPrateleiraRank(b.g.shelfName, b.originalIndex)
      if (ra !== rb) return ra - rb
      return a.originalIndex - b.originalIndex
    })
    .map(({ g }) => g)
}
