'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, Image as ImageIcon, Video, Crop } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { ComboboxSingle } from '@/components/ui/combobox-single';
import { CustomBodySvg } from '@/components/CustomBodySvg';
import { ExercisePhoto } from '@/components/exercise-photo';
import { PhotoCropEditor } from '@/components/photo-crop-editor';
import { useAuth } from '@/contexts/auth-context';
import { useBodySvgScale } from '@/hooks/use-mobile';
import { useR2Photo } from '@/hooks/use-r2-photo';
import {
  PHOTO_INPUT_ACCEPT,
  VIDEO_INPUT_ACCEPT,
  validateMediaFile,
} from '@/lib/media-validation';
import { uploadExerciseMediaViaPresigned } from '@/lib/upload-exercise-media-client';
import { MediaUploadOverlay } from '@/components/media-upload-overlay';
import { ExerciseReferenceCode } from '@/components/exercise-reference-code';

export interface Exercise {
  id: string;
  reference_code?: string | null;
  name: string;
  subnome?: string;
  level?: string;
  muscle_group?: string;
  execution_type?: string;
  prateleira?: string;
  home_adaptable?: boolean;
  order_index?: number | null;
  video_url?: string | null;
  r2_photo_url?: string | null;
  r2_video_url?: string | null;
  created_by?: string | null;
  metadata?: {
    execution?: string | null;
    implemento?: string[];
    afastamento?: string | null;
    duration_sec?: number | null;
    musculo_alvo?: string[];
    peso_do_corpo?: boolean;
    musculos_sinergistas?: string[];
    musculos_estabilizadores?: string[];
  };
}

function sortOptionsByLabel<T extends { label: string }>(options: T[]): T[] {
  return [...options].sort((a, b) =>
    a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })
  );
}

function normalizeMuscleId(id: string): string {
  return id === 'isoquiotibiais' ? 'isquiotibiais' : id;
}

function normalizeMuscleIdList(ids: string[] | undefined): string[] {
  if (!ids?.length) return [];
  return ids.map(normalizeMuscleId);
}

const executionTypeOptions = sortOptionsByLabel([
  { value: 'Inferiores', label: 'Inferiores' },
  { value: 'Puxar', label: 'Puxar' },
  { value: 'Empurrar', label: 'Empurrar' },
  { value: 'Cardio', label: 'Cardio' },
]);

const executionModeOptions = sortOptionsByLabel([
  { value: 'none', label: 'Nenhum' },
  { value: 'bilateral', label: 'Bilateral' },
  { value: 'unilateral', label: 'Unilateral' },
  { value: 'alternado', label: 'Alternado' },
]);

const afastamentoOptions = sortOptionsByLabel([
  { value: 'Sumo', label: 'Sumo' },
  { value: 'Largo', label: 'Largo' },
  { value: 'Neutro', label: 'Neutro' },
  { value: 'Paralelo', label: 'Paralelo' },
]);

const equipmentOptions = sortOptionsByLabel([
  { value: 'barra', label: 'Barra' },
  { value: 'barra_guiada', label: 'Barra Guiada' },
  { value: 'barra_hexagonal', label: 'Barra Hexagonal' },
  { value: 'halter', label: 'Halter' },
  { value: 'halteres', label: 'Halteres' },
  { value: 'anilha', label: 'Anilha' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'cabo', label: 'Cabo' },
  { value: 'triangulo', label: 'Triângulo' },
  { value: 'alca', label: 'Alça' },
  { value: 'elastico', label: 'Elástico' },
  { value: 'caneleira', label: 'Caneleira' },
  { value: 'maquina', label: 'Máquina' },
  { value: 'step', label: 'Step' },
  { value: 'steps', label: 'Steps' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'banco', label: 'Banco' },
  { value: 'parede', label: 'Parede' },
  { value: 'bola_suica', label: 'Bola Suíça' },
  { value: 'bastao', label: 'Bastão' },
  { value: 'fita_suspensa', label: 'Fita Suspensa' },
  { value: 'cinta', label: 'Cinta' },
  { value: 'disco', label: 'Disco' },
  { value: 'disco_equilibrio', label: 'Disco Equilíbrio' },
  { value: 'rolo', label: 'Rolo' },
]);

const muscleGroupOptions = sortOptionsByLabel([
  { value: 'trapezio_superior', label: 'Trapézio Superior', color: '#EF4444' },
  { value: 'peitoral_maior', label: 'Peitoral Maior', color: '#EC4899' },
  { value: 'deltoide', label: 'Deltoide Anterior/Médio', color: '#14B8A6' },
  { value: 'serratil_anterior', label: 'Serrátil Anterior', color: '#F97316' },
  { value: 'biceps_braquial', label: 'Bíceps Braquial', color: '#EF4444' },
  { value: 'flexores_do_punho', label: 'Flexores do Punho', color: '#84CC16' },
  { value: 'reto_abdominal', label: 'Reto Abdominal', color: '#F59E0B' },
  { value: 'obliquo_externo', label: 'Oblíquo Externo', color: '#10B981' },
  { value: 'obliquo_interno', label: 'Oblíquo Interno', color: '#059669' },
  { value: 'adutor', label: 'Adutor', color: '#3B82F6' },
  { value: 'quadriceps_femural', label: 'Quadríceps Femoral', color: '#8B5CF6' },
  { value: 'tibia_anterior', label: 'Tíbia Anterior', color: '#06B6D4' },
  { value: 'gastrocnemio', label: 'Gastrocnêmio', color: '#A855F7' },
  { value: 'deltoide_posterior', label: 'Deltoide Posterior', color: '#0EA5E9' },
  { value: 'infraespinhal', label: 'Infraespinhal', color: '#64748B' },
  { value: 'grande_dorsal', label: 'Grande Dorsal', color: '#DC2626' },
  { value: 'eretores_espinha', label: 'Eretores da Espinha', color: '#F43F5E' },
  { value: 'gluteo_maximo', label: 'Glúteo Máximo', color: '#0891B2' },
  { value: 'gluteo_medio', label: 'Glúteo Médio', color: '#059669' },
  { value: 'redondo_maior', label: 'Redondo Maior', color: '#7C3AED' },
  { value: 'triceps', label: 'Tríceps', color: '#F59E0B' },
  { value: 'extensores_punho', label: 'Extensores de Punho', color: '#DB2777' },
  { value: 'isquiotibiais', label: 'Isquiotibiais', color: '#0D9488' },
]);

type PaintRole = 'target' | 'synergist' | 'stabilizer';

interface ExerciseFormProps {
  exercise?: Exercise | null;
  onSaved: (exercise: Exercise) => void;
  onCancel: () => void;
  onMediaUpdated?: (patch: Pick<Exercise, 'r2_photo_url' | 'r2_video_url'>) => void;
}

function MediaVideoPreview({ r2VideoUrl }: { r2VideoUrl: string }) {
  const { resolvedUrl, loading } = useR2Photo(r2VideoUrl);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
        Vídeo salvo no R2
      </div>
    );
  }

  return <video src={resolvedUrl} controls className="h-full w-full object-cover" />;
}

export function ExerciseForm({ exercise, onSaved, onCancel, onMediaUpdated }: ExerciseFormProps) {
  const { accessToken } = useAuth();
  const bodySvgScale = useBodySvgScale(0.38);
  const [activeTab, setActiveTab] = useState<'info' | 'media'>('info');
  const [isSaving, setIsSaving] = useState(false);
  const [paintRole, setPaintRole] = useState<PaintRole>('target');

  const videoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<{ photo?: string; video?: string }>({});
  const [mediaUrls, setMediaUrls] = useState({
    r2_photo_url: exercise?.r2_photo_url ?? null,
    r2_video_url: exercise?.r2_video_url ?? null,
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteConfirmKind, setDeleteConfirmKind] = useState<'photo' | 'video' | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [cropEditor, setCropEditor] = useState<{ src: string; ownedBlob?: boolean } | null>(null);
  const { resolvedUrl: resolvedPhotoUrl } = useR2Photo(mediaUrls.r2_photo_url);

  useEffect(() => {
    setMediaUrls({
      r2_photo_url: exercise?.r2_photo_url ?? null,
      r2_video_url: exercise?.r2_video_url ?? null,
    });
    setLocalPreview({});
  }, [exercise?.id, exercise?.r2_photo_url, exercise?.r2_video_url]);

  const [formData, setFormData] = useState(() => {
    const meta = exercise?.metadata ?? {};
    return {
      name: exercise?.name ?? '',
      subnome: exercise?.subnome ?? '',
      execution_type: exercise?.execution_type ?? '',
      prateleira: exercise?.prateleira ?? '',
      home_adaptable: exercise?.home_adaptable ?? false,
      order_index: exercise?.order_index ?? null as number | null,
      execution: meta.execution ?? null as string | null,
      implementos: meta.implemento ?? [] as string[],
      afastamento: meta.afastamento ?? '',
      duration_sec: meta.duration_sec ?? null as number | null,
      musculo_alvo: normalizeMuscleIdList(meta.musculo_alvo),
      peso_do_corpo: meta.peso_do_corpo ?? false,
      musculos_sinergistas: normalizeMuscleIdList(meta.musculos_sinergistas),
      musculos_estabilizadores: normalizeMuscleIdList(meta.musculos_estabilizadores),
    };
  });

  const handleMuscleClick = useCallback((muscleId: string, role: PaintRole) => {
    setFormData((prev) => {
      const field =
        role === 'target'
          ? 'musculo_alvo'
          : role === 'synergist'
            ? 'musculos_sinergistas'
            : 'musculos_estabilizadores';
      const current = prev[field] as string[];
      const next = current.includes(muscleId)
        ? current.filter((m) => m !== muscleId)
        : [...current, muscleId];
      return { ...prev, [field]: next };
    });
  }, []);

  const uploadMedia = useCallback(
    async (file: File, kind: 'photo' | 'video') => {
      if (!exercise?.id) {
        toast.error('Salve o exercício antes de enviar mídia.');
        return;
      }

      const validationError = validateMediaFile(file, kind);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      const setUploading = kind === 'photo' ? setIsUploadingPhoto : setIsUploadingVideo;
      const previewKey = kind === 'photo' ? 'photo' : 'video';
      const previewUrl = URL.createObjectURL(file);

      uploadAbortRef.current?.abort();
      const abortController = new AbortController();
      uploadAbortRef.current = abortController;

      setUploading(true);
      setUploadProgress(0);
      setLocalPreview((prev) => ({ ...prev, [previewKey]: previewUrl }));

      try {
        const result = await uploadExerciseMediaViaPresigned({
          exerciseId: exercise.id,
          file,
          kind,
          accessToken: accessToken ?? '',
          onProgress: setUploadProgress,
          signal: abortController.signal,
        });

        const field = kind === 'photo' ? 'r2_photo_url' : 'r2_video_url';
        const storageUrl =
          result.storageUrl ??
          result.exercise?.[field] ??
          null;

        if (!storageUrl) {
          throw new Error('Upload concluído, mas URL da mídia não retornou');
        }

        setMediaUrls((prev) => ({ ...prev, [field]: storageUrl }));
        onMediaUpdated?.({ [field]: storageUrl });
        toast.success(
          kind === 'photo' ? 'Foto enviada e salva!' : 'Vídeo enviado e salvo!'
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          toast.message('Envio cancelado');
        } else {
          const message = err instanceof Error ? err.message : 'Erro ao enviar mídia';
          console.error('[ExerciseForm] upload error', { kind, message });
          toast.error(message);
        }
      } finally {
        if (uploadAbortRef.current === abortController) {
          uploadAbortRef.current = null;
        }
        URL.revokeObjectURL(previewUrl);
        setLocalPreview((prev) => {
          const next = { ...prev };
          delete next[previewKey];
          return next;
        });
        setUploadProgress(0);
        setUploading(false);
      }
    },
    [accessToken, exercise?.id, onMediaUpdated]
  );

  const cancelUpload = useCallback(() => {
    uploadAbortRef.current?.abort();
  }, []);

  const deleteMedia = useCallback(
    async (kind: 'photo' | 'video') => {
      if (!exercise?.id || !accessToken) {
        toast.error('Salve o exercício antes de remover mídia.');
        return;
      }

      const label = kind === 'photo' ? 'foto' : 'vídeo';
      const setDeleting = kind === 'photo' ? setIsDeletingPhoto : setIsDeletingVideo;
      setDeleting(true);
      console.info('[ExerciseForm] delete media', { exerciseId: exercise.id, kind });
      try {
        const res = await fetch(`/api/exercises/${exercise.id}/media?kind=${kind}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          console.error('[ExerciseForm] delete failed', { status: res.status, error: data.error });
          throw new Error(data.error ?? `Erro ao excluir ${label}`);
        }
        const field = kind === 'photo' ? 'r2_photo_url' : 'r2_video_url';
        setMediaUrls((prev) => ({ ...prev, [field]: null }));
        onMediaUpdated?.({ [field]: null });
        toast.success(kind === 'photo' ? 'Foto excluída!' : 'Vídeo excluído!');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Erro ao excluir ${label}`);
      } finally {
        setDeleting(false);
        setDeleteConfirmKind(null);
      }
    },
    [accessToken, exercise?.id, onMediaUpdated]
  );

  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validationError = validateMediaFile(file, 'photo');
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const src = URL.createObjectURL(file);
    setCropEditor({ src, ownedBlob: true });
  };

  const handleResizePhoto = () => {
    if (!mediaUrls.r2_photo_url) {
      toast.error('Envie uma foto antes de redimensionar.');
      return;
    }
    if (!resolvedPhotoUrl) {
      toast.error('Aguarde o carregamento da foto ou tente novamente.');
      return;
    }
    setCropEditor({ src: resolvedPhotoUrl });
  };

  const handleCropCancel = () => {
    if (cropEditor?.ownedBlob && cropEditor.src.startsWith('blob:')) {
      URL.revokeObjectURL(cropEditor.src);
    }
    setCropEditor(null);
  };

  const handleCropConfirm = (file: File) => {
    if (cropEditor?.ownedBlob && cropEditor.src.startsWith('blob:')) {
      URL.revokeObjectURL(cropEditor.src);
    }
    setCropEditor(null);
    void uploadMedia(file, 'photo');
  };

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void uploadMedia(file, 'video');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('O nome do exercício é obrigatório.');
      return;
    }
    setIsSaving(true);
    try {
      const url = exercise ? `/api/exercises/${exercise.id}` : '/api/exercises';
      const method = exercise ? 'PUT' : 'POST';
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        execution_type: formData.execution_type || null,
        subnome: formData.subnome?.trim() || null,
        prateleira: formData.prateleira?.trim() || 'Tradicional',
        home_adaptable: formData.home_adaptable || false,
        order_index: formData.order_index ?? null,
        metadata: {
          execution: formData.execution || null,
          implemento: formData.implementos || [],
          afastamento: formData.afastamento || null,
          duration_sec: formData.duration_sec || null,
          musculo_alvo: formData.musculo_alvo || [],
          peso_do_corpo: formData.peso_do_corpo || false,
          musculos_sinergistas: formData.musculos_sinergistas || [],
          musculos_estabilizadores: formData.musculos_estabilizadores || [],
        },
      };
      if (!exercise) payload.created_by = null;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Erro ao salvar exercício');
      }
      const data = await res.json();
      const saved: Exercise = data.exercise ?? data;
      toast.success(exercise ? 'Exercício atualizado!' : 'Exercício criado!');
      onSaved(saved);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar exercício');
    } finally {
      setIsSaving(false);
    }
  };

  const paintRoleOptions: { value: PaintRole; label: string; color: string }[] = [
    { value: 'target', label: 'Alvo', color: '#EF4444' },
    { value: 'synergist', label: 'Sinergista', color: '#FF6F59' },
    { value: 'stabilizer', label: 'Estabilizador', color: '#FACC15' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border px-4 pt-1">
        <Button
          type="button"
          variant={activeTab === 'info' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('info')}
          className="px-4 py-2"
        >
          Informações
        </Button>
        <Button
          type="button"
          variant={activeTab === 'media' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('media')}
          className="px-4 py-2"
        >
          Mídia
        </Button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Left column — main fields */}
            <div className="xl:col-span-3 space-y-3">
              {exercise?.reference_code ? (
                <div className="space-y-2">
                  <Label>Código de referência</Label>
                  <ExerciseReferenceCode code={exercise.reference_code} size="md" />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Agachamento, Supino..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subnome">Subnome (opcional)</Label>
                <Input
                  id="subnome"
                  value={formData.subnome}
                  onChange={(e) => setFormData({ ...formData, subnome: e.target.value })}
                  placeholder="Ex: Variação A, Execução completa..."
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Exercício</Label>
                <ComboboxSingle
                  options={executionTypeOptions}
                  value={formData.execution_type}
                  onValueChange={(v) => setFormData({ ...formData, execution_type: v })}
                  placeholder="Selecione o tipo..."
                  allowEmpty
                />
              </div>

              <div className="space-y-2">
                <Label>Modo de Execução</Label>
                <ComboboxSingle
                  options={executionModeOptions}
                  value={formData.execution === null ? 'none' : (formData.execution || 'none')}
                  onValueChange={(v) => setFormData({ ...formData, execution: v === 'none' ? null : v })}
                  placeholder="Selecione..."
                />
              </div>

              <div className="space-y-2">
                <Label>Músculos Alvo</Label>
                <Combobox
                  options={muscleGroupOptions}
                  selectedValues={formData.musculo_alvo}
                  onSelect={(v) => setFormData({ ...formData, musculo_alvo: [...formData.musculo_alvo, v] })}
                  onRemove={(v) => setFormData({ ...formData, musculo_alvo: formData.musculo_alvo.filter((m) => m !== v) })}
                  placeholder="Selecione músculos..."
                  searchPlaceholder="Buscar músculos..."
                  badgeColor="#EF4444"
                />
              </div>

              <div className="space-y-2">
                <Label>Músculos Sinergistas</Label>
                <Combobox
                  options={muscleGroupOptions}
                  selectedValues={formData.musculos_sinergistas}
                  onSelect={(v) => setFormData({ ...formData, musculos_sinergistas: [...formData.musculos_sinergistas, v] })}
                  onRemove={(v) => setFormData({ ...formData, musculos_sinergistas: formData.musculos_sinergistas.filter((m) => m !== v) })}
                  placeholder="Selecione músculos..."
                  searchPlaceholder="Buscar músculos..."
                  badgeColor="#FF6F59"
                />
              </div>

              <div className="space-y-2">
                <Label>Músculos Estabilizadores</Label>
                <Combobox
                  options={muscleGroupOptions}
                  selectedValues={formData.musculos_estabilizadores}
                  onSelect={(v) => setFormData({ ...formData, musculos_estabilizadores: [...formData.musculos_estabilizadores, v] })}
                  onRemove={(v) => setFormData({ ...formData, musculos_estabilizadores: formData.musculos_estabilizadores.filter((m) => m !== v) })}
                  placeholder="Selecione músculos..."
                  searchPlaceholder="Buscar músculos..."
                  badgeColor="#FACC15"
                />
              </div>
            </div>

            {/* Center — SVG visualization with click-to-paint */}
            <div className="xl:col-span-6 border-t xl:border-t-0 xl:border-l border-border pt-4 xl:pt-0 xl:pl-3 flex flex-col items-center gap-3">
              <div className="flex flex-col items-center gap-2 w-full">
                <h3 className="text-sm font-semibold text-center">Visualização muscular</h3>

                {/* Paint role selector */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                  <span className="w-full text-center text-xs text-muted-foreground sm:w-auto">Pintar como:</span>
                  {paintRoleOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaintRole(opt.value)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium border transition-all sm:gap-1.5 sm:px-2.5 sm:text-xs"
                      style={{
                        borderColor: paintRole === opt.value ? opt.color : 'transparent',
                        background: paintRole === opt.value ? `${opt.color}20` : 'transparent',
                        color: paintRole === opt.value ? opt.color : '#a1a1aa',
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: opt.color }}
                      />
                      {opt.label}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Clique nos músculos do boneco para pintar, ou use os seletores acima
                </p>
              </div>

              <div className="flex w-full max-w-full flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center sm:gap-2">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs text-muted-foreground font-medium">Frente</p>
                  <CustomBodySvg
                    targetMuscles={formData.musculo_alvo}
                    synergistMuscles={formData.musculos_sinergistas}
                    stabilizerMuscles={formData.musculos_estabilizadores}
                    side="front"
                    scale={bodySvgScale}
                    targetColor="#EF4444"
                    synergistColor="#FF6F59"
                    stabilizerColor="#FACC15"
                    onMuscleClick={handleMuscleClick}
                    paintRole={paintRole}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs text-muted-foreground font-medium">Trás</p>
                  <CustomBodySvg
                    targetMuscles={formData.musculo_alvo}
                    synergistMuscles={formData.musculos_sinergistas}
                    stabilizerMuscles={formData.musculos_estabilizadores}
                    side="back"
                    scale={bodySvgScale}
                    targetColor="#EF4444"
                    synergistColor="#FF6F59"
                    stabilizerColor="#FACC15"
                    onMuscleClick={handleMuscleClick}
                    paintRole={paintRole}
                  />
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-3 text-[10px] text-muted-foreground sm:gap-4">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Alvo</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full inline-block" style={{ background: '#FF6F59' }} />Sinergista</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />Estabilizador</span>
              </div>
            </div>

            {/* Right column — equipment & config */}
            <div className="xl:col-span-3 border-t xl:border-t-0 xl:border-l border-border pt-4 xl:pt-0 xl:pl-3 space-y-5">
              {/* Equipment & Positioning */}
              <div className="space-y-4 pb-4 border-b border-border">
                <h3 className="text-sm font-semibold">Equipamentos & Posicionamento</h3>

                <div className="space-y-2">
                  <Label>Implementos</Label>
                  <Combobox
                    options={equipmentOptions}
                    selectedValues={formData.implementos}
                    onSelect={(v) => setFormData({ ...formData, implementos: [...formData.implementos, v] })}
                    onRemove={(v) => setFormData({ ...formData, implementos: formData.implementos.filter((e) => e !== v) })}
                    placeholder="Selecione implementos..."
                    searchPlaceholder="Buscar implementos..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Afastamento</Label>
                  <ComboboxSingle
                    options={afastamentoOptions}
                    value={formData.afastamento}
                    onValueChange={(v) => setFormData({ ...formData, afastamento: v })}
                    placeholder="Selecione o afastamento..."
                    allowEmpty
                  />
                </div>

                <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <input
                    type="checkbox"
                    id="peso_do_corpo"
                    checked={formData.peso_do_corpo}
                    onChange={(e) => setFormData({ ...formData, peso_do_corpo: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <Label htmlFor="peso_do_corpo" className="flex-1 cursor-pointer m-0">
                    Peso do corpo
                  </Label>
                </div>
              </div>

              {/* Config */}
              <div className="space-y-4 pb-4 border-b border-border">
                <h3 className="text-sm font-semibold">Configuração</h3>

                <div className="space-y-2">
                  <Label htmlFor="duration_sec">Duração (segundos)</Label>
                  <Input
                    id="duration_sec"
                    type="number"
                    min="1"
                    value={formData.duration_sec ?? ''}
                    onChange={(e) => setFormData({ ...formData, duration_sec: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Ex: 30, 45, 60..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="order_index">Ordem de Exibição</Label>
                  <Input
                    id="order_index"
                    type="number"
                    min="0"
                    value={formData.order_index ?? ''}
                    onChange={(e) => setFormData({ ...formData, order_index: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Ex: 1, 2, 3..."
                  />
                </div>
              </div>

              {/* Categorization */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Categorização</h3>

                <div className="space-y-2">
                  <Label htmlFor="prateleira">Prateleira / Categoria</Label>
                  <Input
                    id="prateleira"
                    value={formData.prateleira}
                    onChange={(e) => setFormData({ ...formData, prateleira: e.target.value })}
                    placeholder="Ex: Tradicional, Iniciante..."
                  />
                </div>

                <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <input
                    type="checkbox"
                    id="home_adaptable"
                    checked={formData.home_adaptable}
                    onChange={(e) => setFormData({ ...formData, home_adaptable: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <Label htmlFor="home_adaptable" className="flex-1 cursor-pointer m-0">
                    Adaptável para treino em casa
                  </Label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="max-w-2xl space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Photo */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Foto</h4>
                <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-lg border border-border bg-zinc-900">
                  {isUploadingPhoto && localPreview.photo ? (
                    <>
                      <img
                        src={localPreview.photo}
                        alt="Enviando foto"
                        className="h-full w-full object-cover opacity-70"
                      />
                      <MediaUploadOverlay
                        label="Enviando foto..."
                        progress={uploadProgress}
                        onCancel={cancelUpload}
                      />
                    </>
                  ) : mediaUrls.r2_photo_url ? (
                    <ExercisePhoto
                      r2PhotoUrl={mediaUrls.r2_photo_url}
                      name={formData.name || 'Exercício'}
                      fill
                      fit="contain"
                      className="bg-white"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border transition-all hover:border-orange-500/50 hover:bg-zinc-800"
                      disabled={!exercise?.id || isUploadingPhoto}
                    >
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {exercise?.id ? 'Clique para enviar foto' : 'Salve o exercício primeiro'}
                      </p>
                    </button>
                  )}
                </div>
                {mediaUrls.r2_photo_url ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-orange-500 text-white hover:bg-orange-600"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhoto || isDeletingPhoto}
                    >
                      Substituir
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleResizePhoto}
                      disabled={isUploadingPhoto || isDeletingPhoto || !resolvedPhotoUrl}
                    >
                      <Crop className="mr-1 h-4 w-4" />
                      Redimensionar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteConfirmKind('photo')}
                      disabled={isUploadingPhoto || isDeletingPhoto}
                    >
                      {isDeletingPhoto ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : null}
                      Excluir
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* Video */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Vídeo</h4>
                <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-lg border border-border bg-zinc-900">
                  {isUploadingVideo && localPreview.video ? (
                    <>
                      <video
                        src={localPreview.video}
                        className="h-full w-full object-cover opacity-70"
                      />
                      <MediaUploadOverlay
                        label="Enviando vídeo..."
                        progress={uploadProgress}
                        onCancel={cancelUpload}
                      />
                    </>
                  ) : mediaUrls.r2_video_url ? (
                    <MediaVideoPreview r2VideoUrl={mediaUrls.r2_video_url} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border transition-all hover:border-orange-500/50 hover:bg-zinc-800"
                      disabled={!exercise?.id || isUploadingVideo}
                    >
                      <Video className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {exercise?.id ? 'Clique para enviar vídeo' : 'Salve o exercício primeiro'}
                      </p>
                    </button>
                  )}
                </div>
                {mediaUrls.r2_video_url ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-orange-500 text-white hover:bg-orange-600"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={isUploadingVideo || isDeletingVideo}
                    >
                      Substituir
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteConfirmKind('video')}
                      disabled={isUploadingVideo || isDeletingVideo}
                    >
                      {isDeletingVideo ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : null}
                      Excluir
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {mediaUrls.r2_photo_url ? (
              <div className="space-y-2 border-t border-border pt-4">
                <h4 className="text-sm font-medium">Preview no card do app</h4>
                <p className="text-xs text-muted-foreground">
                  Mesma proporção do card da biblioteca (50% da tela × 130px).
                </p>
                <div className="mx-auto w-[195px] overflow-hidden rounded-lg border border-border bg-zinc-900">
                  <div className="relative h-[130px] w-full bg-white">
                    <ExercisePhoto
                      r2PhotoUrl={mediaUrls.r2_photo_url}
                      name={formData.name || 'Exercício'}
                      fill
                      fit="contain"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {!exercise && (
              <p className="text-xs text-muted-foreground">
                Salve o exercício na aba Informações antes de enviar fotos e vídeos.
              </p>
            )}

            <input
              ref={photoInputRef}
              type="file"
              accept={PHOTO_INPUT_ACCEPT}
              className="hidden"
              onChange={handlePhotoFileSelect}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept={VIDEO_INPUT_ACCEPT}
              className="hidden"
              onChange={handleVideoFileSelect}
            />

            <PhotoCropEditor
              open={!!cropEditor}
              photoSrc={cropEditor?.src ?? ''}
              onConfirm={handleCropConfirm}
              onCancel={handleCropCancel}
            />

            <Dialog
              open={deleteConfirmKind != null}
              onOpenChange={(open) => {
                if (!open) setDeleteConfirmKind(null);
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Excluir {deleteConfirmKind === 'photo' ? 'foto' : 'vídeo'}?
                  </DialogTitle>
                  <DialogDescription>
                    Esta ação remove o arquivo do armazenamento e a referência no exercício.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteConfirmKind(null)}
                    disabled={isDeletingPhoto || isDeletingVideo}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (deleteConfirmKind) void deleteMedia(deleteConfirmKind);
                    }}
                    disabled={isDeletingPhoto || isDeletingVideo}
                  >
                    {(deleteConfirmKind === 'photo' && isDeletingPhoto) ||
                    (deleteConfirmKind === 'video' && isDeletingVideo) ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : null}
                    Excluir
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </form>

      {/* Footer */}
      <DialogFooter className="flex-shrink-0 px-4 py-3 border-t border-border pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving} onClick={handleSubmit}>
          {isSaving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
          ) : exercise ? (
            'Atualizar'
          ) : (
            'Criar'
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}
