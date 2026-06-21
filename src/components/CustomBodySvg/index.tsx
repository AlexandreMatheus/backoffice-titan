'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import React, { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { bodyPaths } from './bodyPaths';
import { backPaths } from './backPaths';
import { getMuscleGroupLabelForSvgGroup } from './groupIdLabels';
import {
  getPathHighlight,
  getPathHighlightByRole,
  getPathHighlightByRoleForBack,
  getPathHighlightByMuscleId,
  getPathHighlightByMuscleIdForBack,
  MUSCLE_ID_TO_GROUP_IDS,
  MUSCLE_ID_TO_GROUP_IDS_BACK,
} from './slugToPaths';

const VIEWBOX_WIDTH_FRONT = 918;
const VIEWBOX_HEIGHT_FRONT = 1781;
const VIEWBOX_WIDTH_BACK = 906;
const VIEWBOX_HEIGHT_BACK = 1777;

const HOVER_GRAY = { r: 156, g: 163, b: 175 };

function mixTowardGray(hex: string, amount = 0.38): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#9CA3AF';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const t = amount;
  const rr = Math.round(r * (1 - t) + HOVER_GRAY.r * t);
  const gg = Math.round(g * (1 - t) + HOVER_GRAY.g * t);
  const bb = Math.round(b * (1 - t) + HOVER_GRAY.b * t);
  return `#${((1 << 24) + (rr << 16) + (gg << 8) + bb).toString(16).slice(1)}`;
}

/** Finds which muscleId(s) map to a given SVG groupId, for a given side */
function muscleIdsForGroupId(groupId: string, side: 'front' | 'back'): string[] {
  const map = side === 'back' ? MUSCLE_ID_TO_GROUP_IDS_BACK : MUSCLE_ID_TO_GROUP_IDS;
  return Object.entries(map)
    .filter(([, gids]) => gids.includes(groupId))
    .map(([muscleId]) => muscleId)
    // prefer canonical IDs (no accents, no aliases)
    .filter((id, _i, arr) => {
      // If there are multiple IDs for the same group, prefer the shortest canonical one
      return arr.length === 1 || !id.includes('_femoral') || id === 'quadriceps_femural';
    });
}

export type CustomBodySvgProps = {
  data?: { slug: string; intensity: number }[];
  targetSlugs?: string[];
  synergistSlugs?: string[];
  stabilizerSlugs?: string[];
  targetMuscles?: string[];
  synergistMuscles?: string[];
  stabilizerMuscles?: string[];
  side?: 'front' | 'back';
  scale?: number;
  border?: string;
  colors?: [string, string];
  primaryColor?: string;
  secondaryColor?: string;
  targetColor?: string;
  synergistColor?: string;
  stabilizerColor?: string;
  /** If provided, clicking a muscle group calls this with the muscleId */
  onMuscleClick?: (muscleId: string, role: 'target' | 'synergist' | 'stabilizer') => void;
  /** Current painting role when onMuscleClick is used */
  paintRole?: 'target' | 'synergist' | 'stabilizer';
};

const DEFAULT_PRIMARY = '#4CAF50';
const DEFAULT_SECONDARY = '#66BB6A';
const DEFAULT_TARGET = '#EF4444';
const DEFAULT_SYNERGIST = '#FF6F59';
const DEFAULT_STABILIZER = '#FACC15';

const LEAVE_DELAY_MS = 45;

export function CustomBodySvg({
  data = [],
  targetSlugs,
  synergistSlugs,
  stabilizerSlugs,
  targetMuscles,
  synergistMuscles,
  stabilizerMuscles,
  side = 'front',
  scale = 1.5,
  border,
  colors,
  primaryColor,
  secondaryColor,
  targetColor,
  synergistColor,
  stabilizerColor,
  onMuscleClick,
  paintRole = 'target',
}: CustomBodySvgProps) {
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGroupEnter = useCallback((groupId: string) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setHoveredGroupId(groupId);
  }, []);

  const handleGroupLeave = useCallback(() => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setHoveredGroupId(null);
      leaveTimerRef.current = null;
    }, LEAVE_DELAY_MS);
  }, []);

  const handleGroupClick = useCallback((groupId: string) => {
    if (!onMuscleClick) return;
    const muscleIds = muscleIdsForGroupId(groupId, side);
    if (muscleIds.length === 0) return;
    // Use the first / most canonical muscleId
    const muscleId = muscleIds[0];
    onMuscleClick(muscleId, paintRole);
  }, [onMuscleClick, side, paintRole]);

  const useMuscleIds =
    targetMuscles !== undefined || synergistMuscles !== undefined || stabilizerMuscles !== undefined;
  const useRoleColors =
    useMuscleIds || targetSlugs !== undefined || synergistSlugs !== undefined || stabilizerSlugs !== undefined;

  const paths = side === 'back' ? backPaths : bodyPaths;
  const roleHighlight = useRoleColors
    ? useMuscleIds
      ? side === 'back'
        ? getPathHighlightByMuscleIdForBack({
            targetMuscles: targetMuscles ?? [],
            synergistMuscles: synergistMuscles ?? [],
            stabilizerMuscles: stabilizerMuscles ?? [],
          })
        : getPathHighlightByMuscleId({
            targetMuscles: targetMuscles ?? [],
            synergistMuscles: synergistMuscles ?? [],
            stabilizerMuscles: stabilizerMuscles ?? [],
          })
      : side === 'back'
        ? getPathHighlightByRoleForBack({
            targetSlugs: targetSlugs ?? [],
            synergistSlugs: synergistSlugs ?? [],
            stabilizerSlugs: stabilizerSlugs ?? [],
          })
        : getPathHighlightByRole({
            targetSlugs: targetSlugs ?? [],
            synergistSlugs: synergistSlugs ?? [],
            stabilizerSlugs: stabilizerSlugs ?? [],
          })
    : null;

  const primary = primaryColor ?? colors?.[0] ?? DEFAULT_PRIMARY;
  const secondary = secondaryColor ?? colors?.[1] ?? DEFAULT_SECONDARY;
  const highlight = useRoleColors ? null : getPathHighlight(data);

  const target = targetColor ?? DEFAULT_TARGET;
  const synergist = synergistColor ?? DEFAULT_SYNERGIST;
  const stabilizer = stabilizerColor ?? DEFAULT_STABILIZER;

  const viewW = side === 'back' ? VIEWBOX_WIDTH_BACK : VIEWBOX_WIDTH_FRONT;
  const viewH = side === 'back' ? VIEWBOX_HEIGHT_BACK : VIEWBOX_HEIGHT_FRONT;
  const width = viewW * scale;
  const height = viewH * scale;

  const clickable = Boolean(onMuscleClick);

  return (
    <div style={{ width: `${width}px`, height: `${height}px` }}>
      <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0} disableHoverableContent>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${viewW} ${viewH}`}
          fill="none"
          style={{ width: '100%', height: '100%' }}
        >
          {paths.map((item, index) => {
            let fill = item.fill;
            if (roleHighlight) {
              const role = roleHighlight.get(index);
              if (role === 'target') fill = target;
              else if (role === 'synergist') fill = synergist;
              else if (role === 'stabilizer') fill = stabilizer;
            } else if (highlight) {
              const kind = highlight.get(index);
              if (kind === 'primary') fill = primary;
              else if (kind === 'secondary') fill = secondary;
            }

            const gid = item.groupId;
            const tooltipLabel = getMuscleGroupLabelForSvgGroup(gid);
            const interactive = Boolean(gid && tooltipLabel);
            const isHoverGroup = Boolean(interactive && hoveredGroupId === gid);
            const displayFill = isHoverGroup ? mixTowardGray(fill) : fill;

            if (!interactive) {
              return (
                <path
                  key={item.id}
                  d={item.d}
                  fill={displayFill}
                  stroke={border}
                  strokeWidth={border ? 1 : 0}
                  pointerEvents="none"
                />
              );
            }

            return (
              <TooltipPrimitive.Root key={item.id} delayDuration={0}>
                <TooltipPrimitive.Trigger asChild>
                  <g
                    onMouseEnter={() => handleGroupEnter(gid!)}
                    onMouseLeave={handleGroupLeave}
                    onClick={clickable ? () => handleGroupClick(gid!) : undefined}
                    style={{ cursor: clickable ? 'pointer' : 'default' }}
                  >
                    <path
                      d={item.d}
                      fill={displayFill}
                      stroke={border}
                      strokeWidth={border ? 1 : 0}
                      pointerEvents="auto"
                    />
                  </g>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content
                    side="top"
                    sideOffset={8}
                    className={cn(
                      'z-[200] max-w-[min(90vw,280px)] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md',
                      'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
                    )}
                  >
                    {tooltipLabel}
                    <TooltipPrimitive.Arrow className="z-[200] fill-popover" />
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>
            );
          })}
        </svg>
      </TooltipPrimitive.Provider>
    </div>
  );
}

export default CustomBodySvg;
