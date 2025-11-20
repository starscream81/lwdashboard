import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

type TeamKey = "team1Power" | "team2Power" | "team3Power" | "team4Power";

type AggregatedTeamStats = {
  average: number | null;
  count: number;
  values: number[];
};

type AggregatedStats = {
  teams: Record<TeamKey, AggregatedTeamStats>;
};

const TEAM_KEYS: TeamKey[] = [
  "team1Power",
  "team2Power",
  "team3Power",
  "team4Power",
];

function parsePower(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }
  if (value == null) return null;
  const num = parseFloat(String(value).trim());
  return Number.isNaN(num) ? null : num;
}

export async function GET(req: NextRequest) {
  try {
    // Require an auth token (same as Direct Compare)
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.slice("Bearer ".length);
    const auth = getAuth();
    // We do not use the uid here, only validate the token
    await auth.verifyIdToken(idToken);

    const db = adminDb;

    // Base structure for all team keys
    const aggregated: AggregatedStats = {
      teams: {
        team1Power: { average: null, count: 0, values: [] },
        team2Power: { average: null, count: 0, values: [] },
        team3Power: { average: null, count: 0, values: [] },
        team4Power: { average: null, count: 0, values: [] },
      },
    };

    // Load all users in this Firestore
    const usersSnap = await db.collection("users").get();
    console.log("🔹 [Aggregated] usersSnap size:", usersSnap.size);

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userRef = userDoc.ref;

      // teams doc: users/{uid}/dashboard_meta/teams
      const teamsRef = userRef.collection("dashboard_meta").doc("teams");
      const teamsSnap = await teamsRef.get();

      if (!teamsSnap.exists) {
        continue;
      }

      const teamsData = teamsSnap.data() as Record<string, unknown>;
      console.log("   👤 [Aggregated] user", uid, "teamsData:", teamsData);

      for (const key of TEAM_KEYS) {
        const raw = teamsData[key];
        const val = parsePower(raw);
        if (val == null) continue;

        const stats = aggregated.teams[key];
        stats.values.push(val);
        stats.count += 1;
      }
    }

    // Compute averages
    for (const key of TEAM_KEYS) {
      const stats = aggregated.teams[key];
      if (stats.values.length > 0) {
        const sum = stats.values.reduce((acc, v) => acc + v, 0);
        stats.average = sum / stats.values.length;
      } else {
        stats.average = null;
      }
    }

    console.log("🔹 [Aggregated] final aggregated:", aggregated);

    return NextResponse.json(aggregated);
  } catch (err: any) {
    console.error("Error in /api/compare/aggregated", err);
    const message = err?.message || "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
