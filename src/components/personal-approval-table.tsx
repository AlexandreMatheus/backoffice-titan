'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/auth-context';
import { CONFEF_REGISTRADOS_URL } from '@/lib/personals';

export type PendingPersonal = {
  id: string;
  full_name: string | null;
  email: string | null;
  cref: string | null;
  cpf: string | null;
  phone: string | null;
  role: string | null;
  status: string;
  created_at: string;
};

type ApiResponse = {
  data: PendingPersonal[];
  count: number;
};

const ROLE_LABELS: Record<string, string> = {
  personal_trainer: 'Personal',
  educador_fisico: 'Educador físico',
  nutricionista: 'Nutricionista',
  trainer: 'Trainer',
};

function formatDate(iso: string) {
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
}

export function PersonalApprovalTable() {
  const { accessToken, isLoading: isAuthLoading } = useAuth();
  const [personals, setPersonals] = useState<PendingPersonal[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingPersonal | null>(null);

  const fetchPending = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/personals/pending?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Falha ao carregar lista');
      }

      const json = (await res.json()) as ApiResponse;
      setPersonals(json.data ?? []);
      setTotalCount(json.count ?? 0);
    } catch (error) {
      toast.error('Erro ao carregar personais', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, search]);

  useEffect(() => {
    if (isAuthLoading || !accessToken) return;

    const timer = setTimeout(() => {
      void fetchPending();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPending, search, isAuthLoading, accessToken]);

  const updateStatus = async (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/personals/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const json = (await res.json().catch(() => ({}))) as { error?: string; data?: PendingPersonal };

      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível atualizar o cadastro');
      }

      setPersonals((prev) => prev.filter((p) => p.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));

      toast.success(
        action === 'approve' ? 'Personal liberado' : 'Cadastro rejeitado',
        {
          description:
            action === 'approve'
              ? `${json.data?.full_name || 'O personal'} já pode acessar a plataforma.`
              : 'O usuário permanece bloqueado até nova análise.',
        }
      );
    } catch (error) {
      toast.error('Erro na operação', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    } finally {
      setProcessingId(null);
      setRejectTarget(null);
    }
  };

  const openConfef = () => {
    window.open(CONFEF_REGISTRADOS_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou CREF..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-amber-400 border-amber-500/40 bg-amber-500/10">
            {isLoading ? '…' : `${totalCount} pendente${totalCount === 1 ? '' : 's'}`}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void fetchPending()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-4 py-3 text-left font-medium text-zinc-300">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-300">CREF</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-300">E-mail</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-300">Cadastro</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : personals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    <UserCheck className="mx-auto mb-3 h-8 w-8 opacity-40" />
                    Nenhum personal aguardando liberação
                  </td>
                </tr>
              ) : (
                personals.map((personal) => {
                  const isProcessing = processingId === personal.id;
                  return (
                    <tr
                      key={personal.id}
                      className="border-b border-zinc-800/80 last:border-0 hover:bg-zinc-900/40"
                    >
                      <td className="px-4 py-4">
                        <p className="font-medium text-zinc-100">
                          {personal.full_name || '—'}
                        </p>
                        {personal.role ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {ROLE_LABELS[personal.role] ?? personal.role}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        {personal.cref ? (
                          <span className="font-mono text-sm text-orange-300">{personal.cref}</span>
                        ) : (
                          <span className="text-muted-foreground">Não informado</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {personal.email || '—'}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(personal.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={openConfef}
                            disabled={isProcessing}
                            title="Abrir consulta de registrados no CONFEF"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Validar CREF
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            disabled={isProcessing}
                            onClick={() => void updateStatus(personal.id, 'approve')}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Liberar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                            disabled={isProcessing}
                            onClick={() => setRejectTarget(personal)}
                          >
                            <XCircle className="h-4 w-4" />
                            Rejeitar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Valide o CREF manualmente no site do CONFEF e, em seguida, libere o acesso. Cadastros
        aprovados saem desta lista automaticamente.
      </p>

      <Dialog open={rejectTarget != null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar cadastro</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `Confirma a rejeição de ${rejectTarget.full_name || rejectTarget.email}? O personal não poderá acessar a plataforma.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectTarget || processingId === rejectTarget.id}
              onClick={() => rejectTarget && void updateStatus(rejectTarget.id, 'reject')}
            >
              {rejectTarget && processingId === rejectTarget.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Rejeitar cadastro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
