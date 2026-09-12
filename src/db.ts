import Dexie, { type Table } from "dexie";

/** Oficjalny ładunek zdarzenia w formacie ARiMR/IRZplus. */
export interface ArimrPayload {
  kodZdarzenia: "WYC" | "ZUZ" | "PRZY" | "UBO" | "SPRZ";
  nrZwierzecia: string;
  nrMatki?: string;
  dataZdarzenia: string; // YYYY-MM-DD
  płeć?: "XX" | "XY";
}

export interface SyncDoc {
  id?: number; // auto-increment
  payload: ArimrPayload;
  status: "pending" | "sent" | "failed";
  createdAt: number;
  sentAt?: number;
  error?: string;
  refNo?: string; // numer referencyjny nadany przez IRZplus
}

export class AgroSyncDB extends Dexie {
  syncQueue!: Table<SyncDoc, number>;

  constructor() {
    super("agrosync-db");
    this.version(1).stores({
      syncQueue: "++id, status, createdAt, payload.kodZdarzenia",
    });
  }
}

export const db = new AgroSyncDB();
