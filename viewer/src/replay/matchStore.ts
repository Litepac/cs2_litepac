import {
  createMatchLibraryEntry,
  type MatchLibraryEntry,
} from "./matchLibrary";
import {
  createStoredMatchCompetitionRecord,
  createStoredMatchRecord,
  type LegacyStoredMatchRecord,
  type StoredMatchCompetitionRecord,
  type StoredMatchRecord,
} from "./matchStorageRecord";
import { validateReplay } from "./schema";
import type { MatchCompetition } from "./matchLibrary";
import type { Replay } from "./types";

const DATABASE_NAME = "mastermind-local-matches";
const DATABASE_VERSION = 3;
const STORE_NAME = "matches";
const COMPETITION_STORE_NAME = "match-competition";

export async function listStoredMatches(): Promise<MatchLibraryEntry[]> {
  const database = await openMatchDatabase();
  if (database == null) {
    return [];
  }

  try {
    const transaction = database.transaction([STORE_NAME, COMPETITION_STORE_NAME], "readonly");
    const recordsPromise = requestToPromise<StoredMatchRecord[]>(transaction.objectStore(STORE_NAME).getAll());
    const competitionPromise = requestToPromise<StoredMatchCompetitionRecord[]>(
      transaction.objectStore(COMPETITION_STORE_NAME).getAll(),
    );
    const [records, competitionRecords] = await Promise.all([recordsPromise, competitionPromise]);
    await transactionComplete(transaction);
    const competitionByMatchId = new Map(
      competitionRecords.map((record) => [record.matchId, record.competition]),
    );
    return records
      .map((record) => {
        const competition = competitionByMatchId.get(record.id) ?? null;
        if ("replayArtifact" in record) {
          return {
            id: record.id,
            addedAt: record.addedAt,
            competition,
            fingerprint: record.fingerprint,
            mapId: record.mapId,
            replay: null,
            source: record.source,
            summary: record.summary,
          } satisfies MatchLibraryEntry;
        }

        const hydrated = createMatchLibraryEntry(record.replay, record.source, record.addedAt, competition);
        return { ...hydrated, id: record.id };
      })
      .sort((left, right) => right.addedAt.localeCompare(left.addedAt));
  } finally {
    database.close();
  }
}

export async function loadStoredMatch(id: string): Promise<Replay | null> {
  const database = await openMatchDatabase();
  if (database == null) {
    return null;
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const record = await requestToPromise<StoredMatchRecord | undefined>(store.get(id));
    await transactionComplete(transaction);
    if (record == null) {
      return null;
    }
    if ("replay" in record) {
      return record.replay;
    }

    const replay = JSON.parse(await record.replayArtifact.text()) as unknown;
    const result = validateReplay(replay);
    if (!result.ok) {
      throw new Error(`Stored replay validation failed: ${result.errors.join("; ")}`);
    }
    return result.replay;
  } finally {
    database.close();
  }
}

export async function saveStoredMatch(entry: MatchLibraryEntry, replayArtifact: Blob | null): Promise<void> {
  const database = await openMatchDatabase();
  if (database == null) {
    return;
  }

  try {
    const transaction = database.transaction([STORE_NAME, COMPETITION_STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    if (replayArtifact != null) {
      store.put(createStoredMatchRecord(entry, replayArtifact));
    } else if (entry.replay != null) {
      store.put({
        id: entry.id,
        addedAt: entry.addedAt,
        replay: entry.replay,
        source: entry.source,
      } satisfies LegacyStoredMatchRecord);
    } else {
      throw new Error("Replay artifact is unavailable for local storage.");
    }
    const competitionStore = transaction.objectStore(COMPETITION_STORE_NAME);
    if (entry.competition) {
      competitionStore.put(createStoredMatchCompetitionRecord(entry.id, entry.competition));
    } else {
      competitionStore.delete(entry.id);
    }
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function saveStoredMatchCompetition(
  id: string,
  competition: MatchCompetition | null,
): Promise<void> {
  const database = await openMatchDatabase();
  if (database == null) {
    return;
  }

  try {
    const transaction = database.transaction(COMPETITION_STORE_NAME, "readwrite");
    const store = transaction.objectStore(COMPETITION_STORE_NAME);
    if (competition) {
      store.put(createStoredMatchCompetitionRecord(id, competition));
    } else {
      store.delete(id);
    }
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function deleteStoredMatch(id: string): Promise<void> {
  const database = await openMatchDatabase();
  if (database == null) {
    return;
  }

  try {
    const transaction = database.transaction([STORE_NAME, COMPETITION_STORE_NAME], "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.objectStore(COMPETITION_STORE_NAME).delete(id);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

function openMatchDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(COMPETITION_STORE_NAME)) {
        database.createObjectStore(COMPETITION_STORE_NAME, { keyPath: "matchId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open local match storage."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}
