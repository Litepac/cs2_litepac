import { createMatchLibraryEntry, type MatchLibraryEntry, type MatchLibrarySource } from "./matchLibrary";
import type { Replay } from "./types";

const DATABASE_NAME = "mastermind-local-matches";
const DATABASE_VERSION = 1;
const STORE_NAME = "matches";

type StoredMatchRecord = {
  id: string;
  addedAt: string;
  replay: Replay;
  source: MatchLibrarySource;
};

export async function listStoredMatches(): Promise<MatchLibraryEntry[]> {
  const database = await openMatchDatabase();
  if (database == null) {
    return [];
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const records = await requestToPromise<StoredMatchRecord[]>(store.getAll());
    await transactionComplete(transaction);
    return records
      .map((record) => createMatchLibraryEntry(record.replay, record.source, record.addedAt))
      .sort((left, right) => right.addedAt.localeCompare(left.addedAt));
  } finally {
    database.close();
  }
}

export async function saveStoredMatch(entry: MatchLibraryEntry): Promise<void> {
  const database = await openMatchDatabase();
  if (database == null) {
    return;
  }

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put({
      id: entry.id,
      addedAt: entry.addedAt,
      replay: entry.replay,
      source: entry.source,
    } satisfies StoredMatchRecord);
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
