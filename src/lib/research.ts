import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ResearchTrackingDoc } from "@/types/research";

export function subscribeToResearch(
  uid: string,
  callback: (rows: ResearchTrackingDoc[]) => void
) {
  const colRef = collection(db, "users", uid, "research_tracking");
  const q = query(colRef);

  const unsubscribe = onSnapshot(q, (snap) => {
    const rows: ResearchTrackingDoc[] = snap.docs.map((d) => {
      const data = d.data() as any;

      const row: ResearchTrackingDoc = {
        id: d.id,
        name: data.name ?? "",
        category: data.category ?? "Other",
        currentLevel: Number(data.currentLevel ?? 0),
        maxLevel: Number(data.maxLevel ?? 0),
        inProgress: data.inProgress ?? false,
        tracked: data.tracked ?? false,
        trackStatus: data.trackStatus ?? false,
        priority:
          typeof data.priority === "number" ? data.priority : null,
        orderIndex:
          typeof data.orderIndex === "number" ? data.orderIndex : null,
      };

      return row;
    });

    callback(rows);
  });

  return unsubscribe;
}

export async function updateResearch(
  uid: string,
  id: string,
  partial: Partial<Omit<ResearchTrackingDoc, "id">>
) {
  const ref = doc(db, "users", uid, "research_tracking", id);
  await updateDoc(ref, partial as any);
}

export async function seedResearchForUser(uid: string) {
  const catalogSnap = await getDocs(collection(db, "research_catalog"));
  if (catalogSnap.empty) return;

  const userCol = collection(db, "users", uid, "research_tracking");
  const writes: Promise<void>[] = [];

  catalogSnap.forEach((catalogDoc) => {
    const data = catalogDoc.data() as any;

    const ref = doc(userCol, catalogDoc.id);
    writes.push(
      setDoc(ref, {
        name: data.name ?? "",
        category: data.category ?? "Other",
        currentLevel: 0,
        maxLevel: Number(data.maxLevel ?? 0),
        inProgress: false,
        tracked: false,
        trackStatus: false,
        priority: null,
        orderIndex:
          typeof data.orderIndex === "number"
            ? data.orderIndex
            : null,
      })
    );
  });

  await Promise.all(writes);
}
