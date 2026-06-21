/**
 * Mapeamento muscleId -> groupIds do SVG boneco (frente) e costas (back).
 * Suporta destaque por papel: alvo (vermelho), sinergistas (salmão vivo), estabilizadores (amarelo).
 */
import { bodyPaths } from './bodyPaths';
import { backPaths } from './backPaths';

/** IDs de API/UI podem vir com espaços; o mapa usa chaves exatas. */
function groupIdsForMuscleId(
  muscleId: string,
  map: Record<string, string[]>,
): string[] | undefined {
  const k = muscleId.trim();
  if (!k) return undefined;
  return map[k];
}

/** muscleId -> ids dos grupos do SVG frente */
export const MUSCLE_ID_TO_GROUP_IDS: Record<string, string[]> = {
  trapezio_superior: ['trapezio_superior'],
  peitoral_maior: ['peitoral_maior'],
  deltoide: ['deltoide'],
  serratil_anterior: ['serratil_anterior'],
  biceps_braquial: ['biceps_braquial'],
  flexores_do_punho: ['Flexores_do_punho'], // Note: com F maiúscula no SVG
  reto_abdominal: ['reto_abdominal'],
  obliquo_externo: ['obliquo_externo'],
  /** Só na vista de costas (SVG costas); frente não tem paths separados */
  obliquo_interno: [],
  adutor: ['adutor'],
  /** ID canónico no editor; paths SVG usam groupId `quadriceps_femoral` (sem "u" em femural) */
  quadriceps_femural: ['quadriceps_femoral'],
  /** Alias: mesmo grupo no SVG (dados/API que repetem o id do path) */
  quadriceps_femoral: ['quadriceps_femoral'],
  tibia_anterior: ['tibial_anterior'], // Note: 'tibial' no SVG
  gastrocnemio: ['gastrocnemio'],
  // Costas (não aparecem na frente)
  deltoide_posterior: [],
  infraespinhal: [],
  grande_dorsal: [], // Não existe no SVG de costas
  eretores_espinha: [], // Não existe no SVG de costas
  gluteo_maximo: [],
  gluteo_medio: [],
  redondo_maior: [],
  triceps: [],
  extensores_punho: [],
  /** SVG costas usa groupId `isoquiotibiais`; API/banco costuma usar `isquiotibiais` */
  isoquiotibiais: [],
  isquiotibiais: [],
  /** Isquiotibiais — aliases usados em clientes legados / app mobile */
  biceps_femoral: [],
  'bíceps_femoral': [],
  semitendineo: [],
  semitendines_o: [],
};

/** muscleId -> ids dos grupos do SVG costas */
export const MUSCLE_ID_TO_GROUP_IDS_BACK: Record<string, string[]> = {
  // Frente (não aparecem nas costas)
  /** Vector 214 / 214_2 no SVG de costas. */
  trapezio_superior: ['trapezio_superior'],
  peitoral_maior: [],
  deltoide: [],
  serratil_anterior: [],
  biceps_braquial: [],
  flexores_do_punho: [],
  reto_abdominal: [],
  obliquo_externo: ['obliquo_externo'],
  obliquo_interno: ['obliquo_interno'],
  adutor: ['adutor'], // Aparece nas costas também
  quadriceps_femural: [],
  quadriceps_femoral: [],
  tibia_anterior: [],
  gastrocnemio: ['gastrocnemio'], // Aparece nas costas também
  // Costas
  deltoide_posterior: ['deltoide_posterior'],
  infraespinhal: ['infraespinhal'],
  grande_dorsal: ['grande_dorsal'],
  eretores_espinha: ['eretores_espinha'],
  gluteo_maximo: ['gluteo_maximo'],
  gluteo_medio: ['gluteo_medio'],
  redondo_maior: ['redondo_maior'],
  triceps: ['triceps'],
  extensores_punho: ['extensores_punho'],
  isoquiotibiais: ['isoquiotibiais'],
  isquiotibiais: ['isoquiotibiais'],
  biceps_femoral: ['isoquiotibiais'],
  'bíceps_femoral': ['isoquiotibiais'],
  semitendineo: ['isoquiotibiais'],
  semitendines_o: ['isoquiotibiais'],
};

// Legacy slug mapping para compatibilidade
/** slug -> ids dos grupos do SVG frente (compatibilidade com código antigo) */
export const SLUG_TO_GROUP_IDS: Record<string, string[]> = {
  chest: ['peitoral_maior', 'serratil_anterior'],
  abs: ['reto_abdominal'],
  obliques: ['obliquo_externo'],
  // groupId real no bodyPaths é `quadriceps_femoral` (não `quadriceps_femural`)
  quadriceps: ['quadriceps_femoral'],
  // IDs reais no bodyPaths: gastrocnemio, tibial_anterior (não "tibia_anterior")
  calves: ['gastrocnemio', 'tibial_anterior'],
  adductors: ['adutor'],
  deltoids: ['deltoide'],
  biceps: ['biceps_braquial'],
  forearm: ['flexores_do_punho'],
  trapezius: ['trapezio_superior'],
  'upper-back': [],
  'lower-back': [],
  hamstring: [],
  gluteal: [],
  triceps: [],
};

/** slug -> ids dos grupos do SVG costas (compatibilidade com código antigo) */
export const SLUG_TO_GROUP_IDS_BACK: Record<string, string[]> = {
  chest: [],
  abs: [],
  obliques: ['obliquo_externo', 'obliquo_interno'],
  quadriceps: [],
  calves: ['gastrocnemio'],
  adductors: ['adutor'],
  deltoids: ['deltoide_posterior'],
  biceps: [],
  forearm: ['extensores_punho'],
  trapezius: ['trapezio_superior'],

  hamstring: ['isoquiotibiais'],
  gluteal: ['gluteo_maximo', 'gluteo_medio'],
  triceps: ['triceps'],
};

const PRIMARY_THRESHOLD = 0.7;

export type PathRole = 'target' | 'synergist' | 'stabilizer';

export function getPathHighlightByRole(roles: {
  targetSlugs: string[];
  synergistSlugs: string[];
  stabilizerSlugs: string[];
}): Map<number, PathRole> {
  const result = new Map<number, PathRole>();
  const { targetSlugs, synergistSlugs, stabilizerSlugs } = roles;
  for (let i = 0; i < bodyPaths.length; i++) {
    const g = bodyPaths[i].groupId;
    if (!g) continue;
    for (const slug of targetSlugs) {
      const groupIds = SLUG_TO_GROUP_IDS[slug];
      if (groupIds?.includes(g)) {
        result.set(i, 'target');
        break;
      }
    }
    if (result.has(i)) continue;
    for (const slug of synergistSlugs) {
      const groupIds = SLUG_TO_GROUP_IDS[slug];
      if (groupIds?.includes(g)) {
        result.set(i, 'synergist');
        break;
      }
    }
    if (result.has(i)) continue;
    for (const slug of stabilizerSlugs) {
      const groupIds = SLUG_TO_GROUP_IDS[slug];
      if (groupIds?.includes(g)) {
        result.set(i, 'stabilizer');
        break;
      }
    }
  }
  return result;
}

export function getPathHighlightByRoleForBack(roles: {
  targetSlugs: string[];
  synergistSlugs: string[];
  stabilizerSlugs: string[];
}): Map<number, PathRole> {
  const result = new Map<number, PathRole>();
  const { targetSlugs, synergistSlugs, stabilizerSlugs } = roles;
  for (let i = 0; i < backPaths.length; i++) {
    const g = backPaths[i].groupId;
    if (!g) continue;
    for (const slug of targetSlugs) {
      const groupIds = SLUG_TO_GROUP_IDS_BACK[slug];
      if (groupIds?.includes(g)) {
        result.set(i, 'target');
        break;
      }
    }
    if (result.has(i)) continue;
    for (const slug of synergistSlugs) {
      const groupIds = SLUG_TO_GROUP_IDS_BACK[slug];
      if (groupIds?.includes(g)) {
        result.set(i, 'synergist');
        break;
      }
    }
    if (result.has(i)) continue;
    for (const slug of stabilizerSlugs) {
      const groupIds = SLUG_TO_GROUP_IDS_BACK[slug];
      if (groupIds?.includes(g)) {
        result.set(i, 'stabilizer');
        break;
      }
    }
  }
  return result;
}

/** Novo: destaque por papel usando muscleIds (para editor de exercício) */
export function getPathHighlightByMuscleId(roles: {
  targetMuscles: string[];
  synergistMuscles: string[];
  stabilizerMuscles: string[];
}): Map<number, PathRole> {
  const result = new Map<number, PathRole>();
  const { targetMuscles, synergistMuscles, stabilizerMuscles } = roles;
  for (let i = 0; i < bodyPaths.length; i++) {
    const g = bodyPaths[i].groupId;
    if (!g) continue;
    for (const muscleId of targetMuscles) {
      const groupIds = groupIdsForMuscleId(muscleId, MUSCLE_ID_TO_GROUP_IDS);
      if (groupIds?.includes(g)) {
        result.set(i, 'target');
        break;
      }
    }
    if (result.has(i)) continue;
    for (const muscleId of synergistMuscles) {
      const groupIds = groupIdsForMuscleId(muscleId, MUSCLE_ID_TO_GROUP_IDS);
      if (groupIds?.includes(g)) {
        result.set(i, 'synergist');
        break;
      }
    }
    if (result.has(i)) continue;
    for (const muscleId of stabilizerMuscles) {
      const groupIds = groupIdsForMuscleId(muscleId, MUSCLE_ID_TO_GROUP_IDS);
      if (groupIds?.includes(g)) {
        result.set(i, 'stabilizer');
        break;
      }
    }
  }
  return result;
}

/** Novo: destaque por papel usando muscleIds para costas */
export function getPathHighlightByMuscleIdForBack(roles: {
  targetMuscles: string[];
  synergistMuscles: string[];
  stabilizerMuscles: string[];
}): Map<number, PathRole> {
  const result = new Map<number, PathRole>();
  const { targetMuscles, synergistMuscles, stabilizerMuscles } = roles;
  for (let i = 0; i < backPaths.length; i++) {
    const g = backPaths[i].groupId;
    if (!g) continue;
    for (const muscleId of targetMuscles) {
      const groupIds = groupIdsForMuscleId(muscleId, MUSCLE_ID_TO_GROUP_IDS_BACK);
      if (groupIds?.includes(g)) {
        result.set(i, 'target');
        break;
      }
    }
    if (result.has(i)) continue;
    for (const muscleId of synergistMuscles) {
      const groupIds = groupIdsForMuscleId(muscleId, MUSCLE_ID_TO_GROUP_IDS_BACK);
      if (groupIds?.includes(g)) {
        result.set(i, 'synergist');
        break;
      }
    }
    if (result.has(i)) continue;
    for (const muscleId of stabilizerMuscles) {
      const groupIds = groupIdsForMuscleId(muscleId, MUSCLE_ID_TO_GROUP_IDS_BACK);
      if (groupIds?.includes(g)) {
        result.set(i, 'stabilizer');
        break;
      }
    }
  }
  return result;
}

export function getPathHighlight(
  data: { slug: string; intensity: number }[],
): Map<number, 'primary' | 'secondary'> {
  const maxIntensity = new Map<number, number>();
  for (const { slug, intensity } of data) {
    const groupIds = SLUG_TO_GROUP_IDS[slug];
    if (!groupIds || groupIds.length === 0) continue;
    for (let i = 0; i < bodyPaths.length; i++) {
      const g = bodyPaths[i].groupId;
      if (g && groupIds.includes(g)) {
        const current = maxIntensity.get(i) ?? 0;
        maxIntensity.set(i, Math.max(current, intensity));
      }
    }
  }
  const result = new Map<number, 'primary' | 'secondary'>();
  maxIntensity.forEach((intensity, i) => {
    result.set(i, intensity >= PRIMARY_THRESHOLD ? 'primary' : 'secondary');
  });
  return result;
}
