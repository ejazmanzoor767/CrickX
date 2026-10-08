'use client';

import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '../lib/api';

const normalizeText = (value: unknown) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  marginTop: 5,
  padding: '4px 8px',
  borderRadius: 999,
  border: '1px solid rgba(155,255,71,.5)',
  background: 'rgba(155,255,71,.12)',
  color: '#bfff91',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '.08em',
  lineHeight: 1,
};

function markPlayingXI(teams: any[]) {
  const official = teams.flatMap((team: any) => {
    const teamName = normalizeText(team?.name ?? team?.short_code ?? team?.code);
    return (Array.isArray(team?.players) ? team.players : [])
      .filter((player: any) => Boolean(player?.isPlayingXI))
      .map((player: any) => ({
        name: normalizeText(player?.fullname ?? player?.name),
        teamName,
      }));
  });

  const rows = Array.from(document.querySelectorAll<HTMLButtonElement>('button.card'));
  for (const row of rows) {
    if (row.dataset.playingXiMarked === 'true') continue;
    const strong = row.querySelector('strong');
    const name = normalizeText(strong?.textContent);
    if (!name) continue;
    const rowText = normalizeText(row.textContent);
    const match = official.find((player) => player.name === name && (!player.teamName || rowText.includes(player.teamName)));
    if (!match) continue;

    row.dataset.playingXiMarked = 'true';
    row.style.borderColor = 'rgba(155,255,71,.62)';
    row.style.background = 'rgba(155,255,71,.10)';

    const textContainer = strong.parentElement;
    if (!textContainer || textContainer.querySelector('[data-playing-xi-badge="true"]')) continue;
    const badge = document.createElement('span');
    badge.dataset.playingXiBadge = 'true';
    badge.textContent = '✓ PLAYING XI';
    Object.assign(badge.style, badgeStyle);
    textContainer.appendChild(badge);
  }
}

export default function PlayingXIMarker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/fantasy') return;

    const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const fixtureId = Number(search?.get('fixtureId'));
    if (!Number.isFinite(fixtureId) || fixtureId <= 0) return;

    let disposed = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const sync = async () => {
      try {
        const result = await api.fixtureSquads(fixtureId);
        const data = (result && typeof result === 'object' && 'data' in result)
          ? (result as { data?: any }).data
          : result;
        if (disposed || !data?.announcementComplete || !Array.isArray(data?.teams)) return;
        markPlayingXI(data.teams);
      } catch {
        // The fantasy list remains usable when the lineup endpoint is temporarily unavailable.
      }
    };

    const observer = new MutationObserver(() => {
      void sync();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    void sync();
    timer = setInterval(() => {
      if (!disposed) void sync();
    }, 15000);

    return () => {
      disposed = true;
      observer.disconnect();
      if (timer) clearInterval(timer);
    };
  }, [pathname]);

  return null;
}
