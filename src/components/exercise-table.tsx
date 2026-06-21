'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, LayoutList, LayoutGrid, ZoomIn } from 'lucide-react';
import { ExercisePhoto } from '@/components/exercise-photo';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExerciseForm, type Exercise } from '@/components/exercise-form';
import { useAuth } from '@/contexts/auth-context';
import {
  getShelvesForCategory,
  SHELF_CATEGORY_LABELS,
  type ShelfCategory,
} from '@/lib/exercise-shelves';

const DRAG_THRESHOLD = 5;
const SHELF_SCROLL_STEP = 320;

const LEVEL_LABELS: Record<string, string> = {
  adaptacao: 'Adaptação',
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

const PAGE_SIZE = 20;

interface ApiResponse {
  data: Exercise[];
  count: number;
  limit: number;
  offset: number;
}

export function ExerciseTable() {
  const { accessToken } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPrateleira, setFilterPrateleira] = useState('all');
  const [filterMuscleGroup, setFilterMuscleGroup] = useState('all');
  const [page, setPage] = useState(0);

  const [viewMode, setViewMode] = useState<'lista' | 'cards'>('lista');
  const [shelfCategory, setShelfCategory] = useState<ShelfCategory>('inferiores');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const shelfRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const shelfScrollRef = useRef<HTMLDivElement | null>(null);
  const shelfStartX = useRef(0);
  const shelfStartScroll = useRef(0);
  const shelfHasDragged = useRef(false);
  const shelfPointerId = useRef<number | null>(null);

  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const shelves = useMemo(
    () => getShelvesForCategory(exercises as Parameters<typeof getShelvesForCategory>[0], shelfCategory),
    [exercises, shelfCategory]
  );

  const handleRowPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    shelfScrollRef.current = el;
    shelfStartX.current = e.clientX;
    shelfStartScroll.current = el.scrollLeft;
    shelfHasDragged.current = false;
    shelfPointerId.current = e.pointerId;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== shelfPointerId.current || !shelfScrollRef.current) return;
      ev.preventDefault();
      const dx = shelfStartX.current - ev.clientX;
      if (Math.abs(dx) > DRAG_THRESHOLD) shelfHasDragged.current = true;
      shelfScrollRef.current.scrollLeft = shelfStartScroll.current + dx;
    };
    const onUp = () => {
      el.releasePointerCapture(shelfPointerId.current!);
      shelfScrollRef.current = null;
      shelfPointerId.current = null;
      el.removeEventListener('pointermove', onMove as EventListener);
      el.removeEventListener('pointerup', onUp);
    };
    el.addEventListener('pointermove', onMove as EventListener, { passive: false });
    el.addEventListener('pointerup', onUp);
  }, []);

  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const fetchExercises = useCallback(async () => {
    setIsLoading(true);
    try {
      const isShelfMode = viewMode === 'cards';
      const params = new URLSearchParams(
        isShelfMode
          ? { limit: '5000', offset: '0' }
          : { limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) }
      );
      if (search) params.set('search', search);
      if (!isShelfMode) {
        if (filterPrateleira && filterPrateleira !== 'all') params.set('prateleira', filterPrateleira);
        if (filterMuscleGroup && filterMuscleGroup !== 'all') params.set('muscle_group', filterMuscleGroup);
      }

      const res = await fetch(`/api/exercises?${params.toString()}`, {
        headers: authHeader,
      });

      if (!res.ok) throw new Error('Erro ao buscar exercícios');
      const data: ApiResponse = await res.json();
      setExercises(data.data);
      setTotalCount(data.count);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar exercícios');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterPrateleira, filterMuscleGroup, page, accessToken, viewMode]);

  useEffect(() => {
    void fetchExercises();
  }, [fetchExercises]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, filterPrateleira, filterMuscleGroup]);

  async function handleDelete(exercise: Exercise) {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/exercises/${exercise.id}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (!res.ok) throw new Error('Erro ao deletar exercício');
      toast.success('Exercício deletado!');
      setDeleteTarget(null);
      void fetchExercises();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar');
    } finally {
      setIsDeleting(false);
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterPrateleira} onValueChange={setFilterPrateleira}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Prateleira" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas', 'Glúteos', 'Abdômen', 'Cardio', 'Funcional', 'Mobilidade'].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterMuscleGroup} onValueChange={setFilterMuscleGroup}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Grupo Muscular" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {['Peitoral', 'Dorsal', 'Deltóide', 'Bíceps', 'Tríceps', 'Quadríceps', 'Posterior', 'Glúteo', 'Core'].map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center rounded-md border">
          <Button
            variant={viewMode === 'lista' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-r-none border-r"
            onClick={() => setViewMode('lista')}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-l-none"
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={() => setDialogMode('create')}>
          <Plus className="h-4 w-4" />
          Novo Exercício
        </Button>
      </div>

      {/* Cards view — shelf-based browser */}
      {viewMode === 'cards' && (
        <div className="space-y-2">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SHELF_CATEGORY_LABELS) as ShelfCategory[]).map((cat) => (
              <Badge
                key={cat}
                variant={shelfCategory === cat ? 'default' : 'outline'}
                className="cursor-pointer text-xs transition-colors"
                onClick={() => setShelfCategory(cat)}
              >
                {SHELF_CATEGORY_LABELS[cat]}
              </Badge>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shelves.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              Nenhum exercício nesta categoria. Verifique o tipo de execução e a prateleira nos cadastros.
            </p>
          ) : (
            <div className="space-y-6">
              {shelves.map(({ shelfName, exercises: shelfExercises }) => (
                <section
                  key={shelfName}
                  className="rounded-2xl border border-orange-500/25 bg-card/50 shadow-sm overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-orange-500/20 bg-orange-500/10">
                    <h3 className="text-sm font-semibold text-orange-400 tracking-tight">{shelfName}</h3>
                  </div>
                  <div className="flex items-stretch">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-none text-orange-400 hover:bg-orange-500/15 h-auto self-center"
                      onClick={() => {
                        const el = shelfRowRefs.current[shelfName];
                        if (el) el.scrollBy({ left: -SHELF_SCROLL_STEP, behavior: 'smooth' });
                      }}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <div
                      ref={(el) => { shelfRowRefs.current[shelfName] = el; }}
                      className="flex flex-1 min-w-0 cursor-grab select-none gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-2 py-4 [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
                      onPointerDown={handleRowPointerDown}
                    >
                      {shelfExercises.map((ex) => (
                        <div
                          key={ex.id}
                          className="group flex flex-col shrink-0 w-36 rounded-xl border-2 border-border overflow-hidden bg-card hover:border-orange-500/40 hover:bg-muted/50 transition-all"
                        >
                          {/* Thumbnail */}
                          <div className="relative aspect-square w-full bg-muted/70 overflow-hidden">
                            <ExercisePhoto
                              r2PhotoUrl={typeof ex.r2_photo_url === 'string' ? ex.r2_photo_url : null}
                              name={ex.name}
                              fill
                              className="object-cover object-[70%_center]"
                            />
                            {/* Zoom */}
                            <button
                              type="button"
                              className="absolute bottom-1 left-1 rounded-full bg-black/50 text-white p-1 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (shelfHasDragged.current) return;
                                // open photo preview — handled below
                              }}
                            >
                              <ZoomIn className="h-3 w-3" />
                            </button>
                            {/* Actions overlay */}
                            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-7 w-7"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => {
                                  setSelectedExercise(ex as Exercise);
                                  setDialogMode('edit');
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-7 w-7"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => {
                                  setDeleteTarget(ex as Exercise);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {(ex as Exercise).r2_video_url && (
                              <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white pointer-events-none">▶</span>
                            )}
                          </div>
                          {/* Info */}
                          <div className="p-2.5">
                            <span className="text-xs font-medium line-clamp-2 text-foreground block">{ex.name}</span>
                            {ex.subnome && (
                              <span className="text-[11px] line-clamp-1 text-muted-foreground block">{ex.subnome}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-none text-orange-400 hover:bg-orange-500/15 h-auto self-center"
                      onClick={() => {
                        const el = shelfRowRefs.current[shelfName];
                        if (el) el.scrollBy({ left: SHELF_SCROLL_STEP, behavior: 'smooth' });
                      }}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image preview */}
      {imagePreviewUrl && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setImagePreviewUrl(null)}
        >
          <img
            src={imagePreviewUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Table view */}
      {viewMode === 'lista' && (
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Foto</th>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Prateleira</th>
                <th className="px-4 py-3 text-left font-medium">Grupo Muscular</th>
                <th className="px-4 py-3 text-left font-medium">Nível</th>
                <th className="px-4 py-3 text-left font-medium">Execução</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : exercises.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    Nenhum exercício encontrado
                  </td>
                </tr>
              ) : (
                exercises.map((exercise) => (
                  <tr key={exercise.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="h-10 w-10 overflow-hidden rounded-md border">
                        <ExercisePhoto
                          r2PhotoUrl={exercise.r2_photo_url}
                          name={exercise.name}
                          className="h-10 w-10 rounded-md"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{exercise.name}</p>
                        {exercise.subnome && (
                          <p className="text-xs text-muted-foreground">{exercise.subnome}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {exercise.prateleira ? (
                        <Badge variant="secondary">{exercise.prateleira}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {exercise.muscle_group || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {exercise.level ? (
                        <Badge variant="outline">
                          {LEVEL_LABELS[exercise.level] || exercise.level}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {exercise.execution_type || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedExercise(exercise);
                            setDialogMode('edit');
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(exercise)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de{' '}
              {totalCount} exercícios
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      )}

      {/* Create / Edit dialog — full screen like treinos-web */}
      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null);
            setSelectedExercise(null);
          }
        }}
      >
        <DialogContent className="!w-[98vw] !max-w-[98vw] !h-[98vh] !max-h-[98vh] !p-0 !gap-0 flex flex-col">
          <DialogHeader className="px-4 pt-5 pb-3 border-b border-border">
            <DialogTitle>
              {dialogMode === 'create' ? 'Novo Exercício' : 'Editar Exercício'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Preencha os dados do novo exercício do sistema.'
                : 'Atualize os dados do exercício.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <ExerciseForm
              exercise={dialogMode === 'edit' ? selectedExercise : null}
              onSaved={() => {
                setDialogMode(null);
                setSelectedExercise(null);
                void fetchExercises();
              }}
              onCancel={() => {
                setDialogMode(null);
                setSelectedExercise(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o exercício{' '}
              <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deletando...
                </>
              ) : (
                'Excluir'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
