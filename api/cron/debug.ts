import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { MATCHES, KNOCKOUT_ROUNDS } from '../_lib/matches.js';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
  return initializeApp({ credential: cert(serviceAccount) });
}

function toDate(v: any): Date | null {
  if (!v) return null;
  return v.toDate ? v.toDate() : new Date(v);
}

function hasPrediction(preds: any, matchId: string): boolean {
  const p = preds?.matches?.[matchId];
  return !!p && p.home != null && p.away != null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    const now = Date.now();

    const [matchLocksSnap, bracketSnap, groupsSnap, stateSnap] = await Promise.all([
      db.doc('results/matchLocks').get(),
      db.doc('knockout/bracket').get(),
      db.collection('groups').get(),
      db.doc('notifications/state').get(),
    ]);
    const matchLocks: Record<string, boolean> = matchLocksSnap.exists ? matchLocksSnap.data()! : {};
    const bracket: Record<string, any> = bracketSnap.exists ? bracketSnap.data()! : {};
    const state = stateSnap.exists ? stateSnap.data()! : {};
    const remindedMatches: Record<string, string[]> = state.remindedMatches || {};

    const members: any[] = [];
    groupsSnap.docs.forEach(d => {
      const ms = (d.data().members || []) as any[];
      ms.forEach(m => members.push({ group: d.id, uid: m.uid, email: m.email, displayName: m.displayName }));
    });

    const uids = Array.from(new Set(members.filter(m => m.uid && m.email).map(m => m.uid)));
    const predsRefs = uids.map(uid => db.doc(`predictions/${uid}_global`));
    const predsSnaps = uids.length ? await db.getAll(...predsRefs) : [];
    const predsByUid = new Map<string, any>();
    uids.forEach((uid, i) => predsByUid.set(uid, predsSnaps[i].exists ? predsSnaps[i].data() : {}));

    type Cand = { id: string; kickoff: Date; label: string };
    const candidates: Cand[] = [];
    MATCHES.forEach(m => candidates.push({ id: m.id, kickoff: m.kickoff, label: 'Fase de Grupos' }));
    KNOCKOUT_ROUNDS.forEach(round => {
      for (let i = 1; i <= round.count; i++) {
        const id = `${round.id}-${i}`;
        const bm = bracket[id];
        const kickoff = toDate(bm?.kickoff);
        if (bm?.slot1?.n && bm?.slot2?.n && kickoff) {
          candidates.push({ id, kickoff, label: round.name });
        }
      }
    });

    const next6h = candidates
      .filter(m => {
        const diff = m.kickoff.getTime() - now;
        return diff > 0 && diff < 6 * 60 * 60 * 1000;
      })
      .map(m => {
        const diffH = (m.kickoff.getTime() - now) / 3600000;
        return {
          id: m.id,
          label: m.label,
          kickoff: m.kickoff.toISOString(),
          hoursUntilKickoff: Math.round(diffH * 100) / 100,
          inWindow: diffH >= 2 && diffH < 3,
          locked: !!matchLocks[m.id],
          remindedUids: remindedMatches[m.id] || [],
          predictionStatus: uids.map(uid => ({ uid, hasPrediction: hasPrediction(predsByUid.get(uid), m.id) })),
        };
      });

    return res.status(200).json({
      now: new Date(now).toISOString(),
      members,
      next6h,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
