import type { MatchLibraryEntry, MatchLibrarySource, MatchSummary } from "./matchLibrary";
import type { Replay } from "./types";

export type StoredMatchRecordV2 = {
  id: string;
  addedAt: string;
  fingerprint: string;
  mapId: string;
  replayArtifact: Blob;
  source: MatchLibrarySource;
  summary: MatchSummary;
};

export type LegacyStoredMatchRecord = {
  id: string;
  addedAt: string;
  replay: Replay;
  source: MatchLibrarySource;
};

export type StoredMatchRecord = StoredMatchRecordV2 | LegacyStoredMatchRecord;

export function createStoredMatchRecord(entry: MatchLibraryEntry, replayArtifact: Blob): StoredMatchRecordV2 {
  return {
    id: entry.id,
    addedAt: entry.addedAt,
    fingerprint: entry.fingerprint,
    mapId: entry.mapId,
    replayArtifact,
    source: entry.source,
    summary: entry.summary,
  };
}
