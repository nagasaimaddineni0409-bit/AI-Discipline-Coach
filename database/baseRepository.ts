import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  QueryConstraint,
  DocumentData,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirestoreDb } from '../firebase/config';

export function toIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

export class FirestoreRepository {
  protected db = getFirestoreDb();

  protected col(path: string) {
    return collection(this.db, path);
  }

  protected docRef(path: string, id: string) {
    return doc(this.db, path, id);
  }

  async set<T extends DocumentData>(path: string, id: string, data: T): Promise<void> {
    await setDoc(this.docRef(path, id), stripUndefined(data as Record<string, unknown>), {
      merge: true,
    });
  }

  async get<T>(path: string, id: string): Promise<T | null> {
    const snap = await getDoc(this.docRef(path, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as T;
  }

  async update(path: string, id: string, data: Partial<DocumentData>): Promise<void> {
    await updateDoc(this.docRef(path, id), stripUndefined(data as Record<string, unknown>));
  }

  async remove(path: string, id: string): Promise<void> {
    await deleteDoc(this.docRef(path, id));
  }

  async list<T>(
    path: string,
    constraints: QueryConstraint[] = [],
  ): Promise<T[]> {
    const q = query(this.col(path), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  }

  subscribe<T>(
    path: string,
    constraints: QueryConstraint[],
    onData: (items: T[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(this.col(path), ...constraints);
    return onSnapshot(
      q,
      (snap) => {
        onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
      },
      (err) => onError?.(err),
    );
  }

  async batchWrite(
    writes: { path: string; id: string; data: DocumentData; merge?: boolean }[],
  ): Promise<void> {
    const batch = writeBatch(this.db);
    for (const w of writes) {
      batch.set(this.docRef(w.path, w.id), stripUndefined(w.data), { merge: w.merge ?? true });
    }
    await batch.commit();
  }
}

export { where, orderBy, limit, Timestamp };
