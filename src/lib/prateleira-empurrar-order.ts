/**
 * Ordem de exibição das prateleiras para execution_type Empurrar.
 * Manter em sync com treinos-app-personal/src/constants/prateleiraEmpurrarOrder.ts
 */
export const PRATELEIRA_ORDEM_EMPURRAR: Record<string, number> = {
  Supino: 1,
  'Flexão de braço': 2,
  Crucifixo: 3,
  Desenvolvimento: 4,
  'Elevações: Flexão / Abdução': 5,
  'Extensão de cotovelo': 6,
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

const RANK_BY_NORMALIZED = new Map<string, number>()
for (const [label, rank] of Object.entries(PRATELEIRA_ORDEM_EMPURRAR)) {
  RANK_BY_NORMALIZED.set(normKey(label), rank)
}

RANK_BY_NORMALIZED.set('flexao de braco', PRATELEIRA_ORDEM_EMPURRAR['Flexão de braço'])
RANK_BY_NORMALIZED.set('extensao de cotovelo', PRATELEIRA_ORDEM_EMPURRAR['Extensão de cotovelo'])
const r5 = PRATELEIRA_ORDEM_EMPURRAR['Elevações: Flexão / Abdução']
RANK_BY_NORMALIZED.set('elevações: flexão/abdução', r5)
RANK_BY_NORMALIZED.set('elevacao: flexao / abducao', r5)
RANK_BY_NORMALIZED.set('elevações: flexão  / abdução', r5)
RANK_BY_NORMALIZED.set('elevacoes: flexao / abducao', r5)
RANK_BY_NORMALIZED.set('elevações: flexão /  abdução', r5)

export function empurrarPrateleiraRank(shelfDisplayName: string, originalIndex: number): number {
  if (shelfDisplayName === 'Outros' || shelfDisplayName === 'Tradicional') return 900_000
  const known = RANK_BY_NORMALIZED.get(normKey(shelfDisplayName))
  if (known !== undefined) return known
  return 10_000 + originalIndex
}

export function sortEmpurrarShelfGroups<T extends { shelfName: string; exercises: unknown[] }>(
  groups: T[]
): T[] {
  return [...groups]
    .map((g, originalIndex) => ({ g, originalIndex }))
    .sort((a, b) => {
      const ra = empurrarPrateleiraRank(a.g.shelfName, a.originalIndex)
      const rb = empurrarPrateleiraRank(b.g.shelfName, b.originalIndex)
      if (ra !== rb) return ra - rb
      return a.originalIndex - b.originalIndex
    })
    .map(({ g }) => g)
}
