import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

type DirectComparePlayer = {
  uid: string;
  displayName: string;
  serverId?: string | number;
};

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.slice("Bearer ".length);
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const currentUid = decoded.uid;

    const db = adminDb;

    // 1. Load ALL users from this Firestore
    const usersSnap = await db.collection("users").get();
    console.log("🔹 usersSnap size:", usersSnap.size);

    const players: DirectComparePlayer[] = [];

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userRef = userDoc.ref;

      console.log("   👤 checking user", uid);

      // 2. Read this user's privacy doc: users/{uid}/dashboard_meta/privacy
      const privacyRef = userRef.collection("dashboard_meta").doc("privacy");
      const privacySnap = await privacyRef.get();

      if (!privacySnap.exists) {
        console.log("      ⚪ no privacy doc");
        continue;
      }

      const privacyData = privacySnap.data() as { canCompare?: boolean } | undefined;
      console.log("      🔍 privacyData:", privacyData);

      if (!privacyData?.canCompare) {
        console.log("      ❌ canCompare is not true, skipping");
        continue;
      }

      // 3. Skip the current user for the picker
      if (uid === currentUid) {
        console.log("      🚫 skipping current user");
        continue;
      }

      // 4. Try to read a profile doc for display name / server
      let displayName = `Player ${uid.slice(0, 6)}`;
      let serverId: string | number | undefined = undefined;

      try {
        const profilesSnap = await userRef.collection("profiles").limit(1).get();
        if (!profilesSnap.empty) {
          const pdata = profilesSnap.docs[0].data() as any;
          displayName =
            pdata.displayName ||
            pdata.name ||
            `Player ${uid.slice(0, 6)}`;
          serverId = pdata.serverId ?? pdata.server;
        }
      } catch (err) {
        console.warn(`Profile lookup failed for user ${uid}`, err);
      }

      players.push({ uid, displayName, serverId });
    }

    console.log("🔹 players to return:", players);

    // 5. Sort for nicer display
    players.sort((a, b) => {
      const sA = String(a.serverId ?? "");
      const sB = String(b.serverId ?? "");
      if (sA !== sB) return sA.localeCompare(sB);
      return a.displayName.localeCompare(b.displayName);
    });

    return NextResponse.json({ players });
  } catch (err: any) {
    console.error("Error in /api/compare/players", err);
    const message = err?.message || "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
