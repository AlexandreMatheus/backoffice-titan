/**
 * Rótulos para tooltip (SVG groupId nos paths). Só entra tooltip se existir aqui.
 * Chaves = groupId exato no bodyPaths/backPaths.
 */
export const GROUP_ID_LABELS: Record<string, string> = {
  quadriceps_femoral: 'Quadríceps femoral',
  obliquo_externo: 'Oblíquo externo',
  obliquo_interno: 'Oblíquo interno',
  serratil_anterior: 'Serrátil anterior',
  peitoral_maior: 'Peitoral maior',
  deltoide: 'Deltoide anterior/médio',
  biceps_braquial: 'Bíceps braquial',
  Flexores_do_punho: 'Flexores do punho',
  reto_abdominal: 'Reto abdominal',
  adutor: 'Adutor',
  tibial_anterior: 'Tíbia anterior',
  gastrocnemio: 'Gastrocnêmio',
  trapezio_superior: 'Trapézio superior',
  // Costas
  gluteo_maximo: 'Glúteo máximo',
  gluteo_medio: 'Glúteo médio',
  /** groupId real nos paths de costas */
  isoquiotibiais: 'Isquiotibiais',
  isquiotibiais: 'Isquiotibiais',
  eretores_espinha: 'Eretores da espinha',
  grande_dorsal: 'Grande dorsal',
  redondo_maior: 'Redondo maior',
  infraespinhal: 'Infraespinhal',
  deltoide_posterior: 'Deltoide posterior',
  triceps: 'Tríceps',
  extensores_punho: 'Extensores do punho',
}

export function getMuscleGroupLabelForSvgGroup(groupId: string | undefined): string | undefined {
  if (!groupId) return undefined
  return GROUP_ID_LABELS[groupId]
}
