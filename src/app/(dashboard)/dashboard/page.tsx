'use client';

import React, { useEffect, useState } from 'react';
import { Dumbbell, Image as ImageIcon, Video, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';

interface Stats {
  total: number;
  withPhoto: number;
  withVideo: number;
  noMedia: number;
}

export default function DashboardPage() {
  const { accessToken, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };

        const [totalRes, photoRes, videoRes] = await Promise.all([
          fetch('/api/exercises/stats?count=total', { headers }),
          fetch('/api/exercises/stats?count=with_photo', { headers }),
          fetch('/api/exercises/stats?count=with_video', { headers }),
        ]);

        const [totalData, photoData, videoData] = await Promise.all([
          totalRes.json() as Promise<{ count: number }>,
          photoRes.json() as Promise<{ count: number }>,
          videoRes.json() as Promise<{ count: number }>,
        ]);

        const total = totalData.count ?? 0;
        const withPhoto = photoData.count ?? 0;
        const withVideo = videoData.count ?? 0;
        const noMedia = total - Math.max(withPhoto, withVideo);

        setStats({ total, withPhoto, withVideo, noMedia });
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    }

    void fetchStats();
  }, [accessToken]);

  const cards = [
    {
      title: 'Total de Exercícios do Sistema',
      value: stats?.total ?? 0,
      icon: Dumbbell,
      description: 'Exercícios com created_by IS NULL',
    },
    {
      title: 'Com Foto',
      value: stats?.withPhoto ?? 0,
      icon: ImageIcon,
      description: 'Exercícios com r2_photo_url preenchido',
    },
    {
      title: 'Com Vídeo',
      value: stats?.withVideo ?? 0,
      icon: Video,
      description: 'Exercícios com r2_video_url preenchido',
    },
    {
      title: 'Sem Mídia',
      value: stats?.noMedia ?? 0,
      icon: AlertCircle,
      description: 'Exercícios sem foto ou vídeo',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo, {user?.full_name || user?.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    card.value
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold">Acesso Rápido</h2>
        <p className="text-sm text-muted-foreground">
          Use o menu lateral para navegar para a gestão de exercícios. Você pode criar, editar
          e deletar exercícios do sistema (exercícios globais disponíveis para todos os
          usuários da plataforma Atlas).
        </p>
      </div>
    </div>
  );
}
