import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TeamKey = "team1Power" | "team2Power" | "team3Power" | "team4Power";

type TeamAggregate = {
  sum: number;
  count: number;
  values: number[];
};

type AggregatedResponse = {
  teams: Record<
    TeamKey,
    {
      average: number | null;
      count: number;
      values: number[];
    }
  >;
};

const TEAM_KEYS: TeamKey[] = [
  "team1Power",
  "team2Power",
  "team3Power",
  "team4Power",
];

export async function GET() {
  try {
    const snapshot = await adminDb.collectionGroup("dashboard_meta").get();

    const aggregates: Record<TeamKey, TeamAggregate> = {
      team1Power: { sum: 0, count: 0, values: [] },
      team2Power: { sum: 0, count: 0, values: [] },
      team3Power: { sum: 0, count: 0, values: [] },
      team4Power: { sum: 0, count: 0, values: [] },
    };

    snapshot.forEach((docSnap) => {
      if (docSnap.id !== "teams") return;

      const data = docSnap.data() as Record<string, unknown>;

      TEAM_KEYS.forEach((key) => {
        if (!(key in data)) return;

        const raw = data[key];
        const num =
          typeof raw === "number" ? raw : parseFloat(String(raw).trim());

        if (Number.isNaN(num)) return;

        aggregates[key].sum += num;
        aggregates[key].count += 1;
        aggregates[key].values.push(num);
      });
    });

    const result: AggregatedResponse = {
      teams: {
        team1Power: {
          average:
            aggregates.team1Power.count > 0
              ? aggregates.team1Power.sum / aggregates.team1Power.count
              : null,
          count: aggregates.team1Power.count,
          values: aggregates.team1Power.values,
        },
        team2Power: {
          average:
            aggregates.team2Power.count > 0
              ? aggregates.team2Power.sum / aggregates.team2Power.count
              : null,
          count: aggregates.team2Power.count,
          values: aggregates.team2Power.values,
        },
        team3Power: {
          average:
            aggregates.team3Power.count > 0
              ? aggregates.team3Power.sum / aggregates.team3Power.count
              : null,
          count: aggregates.team3Power.count,
          values: aggregates.team3Power.values,
        },
        team4Power: {
          average:
            aggregates.team4Power.count > 0
              ? aggregates.team4Power.sum / aggregates.team4Power.count
              : null,
          count: aggregates.team4Power.count,
          values: aggregates.team4Power.values,
        },
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error in aggregated compare", err);
    return NextResponse.json(
      { error: "Failed to compute aggregated compare" },
      { status: 500 }
    );
  }
}
