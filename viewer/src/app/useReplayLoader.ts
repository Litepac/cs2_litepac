import type { ChangeEvent } from "react";
import { useState } from "react";

import { loadReplayFile, loadReplayURL } from "../replay/loader";
import type { Replay } from "../replay/types";

export function useReplayLoader() {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const loaded = await loadReplayFile(file);
      setReplay(loaded);
      setRoundIndex(0);
      setSelectedPlayerId(null);
      setError(null);
    } catch (loadError) {
      setReplay(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }

  async function onFixtureLoad(fileName: string) {
    try {
      const loaded = await loadReplayURL(`/fixtures/${fileName}`);
      setReplay(loaded);
      setRoundIndex(0);
      setSelectedPlayerId(null);
      setError(null);
    } catch (loadError) {
      setReplay(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }

  return {
    error,
    onFileChange,
    onFixtureLoad,
    replay,
    roundIndex,
    selectedPlayerId,
    setRoundIndex,
    setSelectedPlayerId,
  };
}
