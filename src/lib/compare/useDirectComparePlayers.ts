"use client";

import { useEffect, useState } from "react";
import type { DirectComparePlayer } from "./types";

type Status = "idle" | "loading" | "success" | "error";

type UseDirectComparePlayersResult = {
  status: Status;
  players: DirectComparePlayer[];
  error: string | null;
};

export function useDirectComparePlayers(
  getIdToken: () => Promise<string | null>
): UseDirectComparePlayersResult {
  const [status, setStatus] = useState<Status>("idle");
  const [players, setPlayers] = useState<DirectComparePlayer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      setError(null);

      try {
        const token = await getIdToken();
        if (!token) {
          if (!cancelled) {
            setStatus("error");
            setError("Not authenticated");
          }
          return;
        }

        const res = await fetch("/api/compare/players", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg =
            body?.error || `Failed to load players (${res.status})`;
          if (!cancelled) {
            setStatus("error");
            setError(msg);
          }
          return;
        }

        const data = (await res.json()) as { players: DirectComparePlayer[] };

        if (!cancelled) {
          setPlayers(data.players || []);
          setStatus("success");
        }
      } catch (err) {
        console.error("Error loading compare players", err);
        if (!cancelled) {
          setStatus("error");
          setError("Unexpected error while loading players");
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  return { status, players, error };
}
