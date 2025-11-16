export type ResearchTrackingDoc = {
  id: string;
  name: string;
  category: string;
  currentLevel: number;
  maxLevel: number;
  inProgress: boolean;   // ← add this
  tracked: boolean;      // can keep for now or drop later
  trackStatus: boolean;
  priority: number | null;
  orderIndex: number | null;
};
