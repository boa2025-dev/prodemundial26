import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { Resend } from 'resend';
import { MATCHES, KNOCKOUT_ROUNDS } from '../_lib/matches.js';
import { TZ } from '../_lib/utils.js';
import { emailShell, matchRow, type CandidateMatch } from '../_lib/emailTemplates.js';

const FROM = process.env.RESEND_FROM_EMAIL || 'Prode Mundial 2026 <notificaciones@prodemundial26.online>';

// Remind users between 2h and 3h before kickoff (cron runs hourly)
const WINDOW_START_MS = 2 * 60 * 60 * 1000;
const WINDOW_END_MS = 3 * 60 * 60 * 1000;

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
    const auth = getAuth(app);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const now = Date.now();

    const [matchLocksSnap, bracketSnap, phasesSnap, groupsSnap, stateSnap] = await Promise.all([
      db.doc('results/matchLocks').get(),
      db.doc('knockout/bracket').get(),
      db.doc('knockout/phases').get(),
      db.collection('groups').get(),
      db.doc('notifications/state').get(),
    ]);
    const matchLocks: Record<string, boolean> = matchLocksSnap.exists ? matchLocksSnap.data()! : {};
    const bracket: Record<string, any> = bracketSnap.exists ? bracketSnap.data()! : {};
    const phases: Record<string, boolean> = phasesSnap.exists ? phasesSnap.data()! : {};
    const state = stateSnap.exists ? stateSnap.data()! : {};
    const remindedMatches: Record<string, string[]> = state.remindedMatches || {};
    const notifiedPhases: string[] = state.notifiedPhases || [];

    // Unique users across all groups
    const usersMap = new Map<string, string>(); // uid -> displayName
    groupsSnap.docs.forEach(d => {
      const members = (d.data().members || []) as { uid: string; displayName?: string }[];
      members.forEach(m => { if (m.uid) usersMap.set(m.uid, m.displayName || ''); });
    });
    const uids = Array.from(usersMap.keys());
    if (uids.length === 0) return res.status(200).json({ reminders: 0, phaseEmails: 0, note: 'no users' });

    // Predictions for all users
    const predsRefs = uids.map(uid => db.doc(`predictions/${uid}_global`));
    const predsSnaps = await db.getAll(...predsRefs);
    const predsByUid = new Map<string, any>();
    uids.forEach((uid, i) => predsByUid.set(uid, predsSnaps[i].exists ? predsSnaps[i].data() : {}));

    // ── 1) Upcoming matches starting in [2h, 3h) without manual lock ──
    const candidates: CandidateMatch[] = [];
    MATCHES.forEach(m => candidates.push({ id: m.id, local: m.local, visitante: m.visitante, kickoff: m.kickoff, label: 'Fase de Grupos' }));
    KNOCKOUT_ROUNDS.forEach(round => {
      for (let i = 1; i <= round.count; i++) {
        const id = `${round.id}-${i}`;
        const bm = bracket[id];
        const kickoff = toDate(bm?.kickoff);
        if (bm?.slot1?.n && bm?.slot2?.n && kickoff) {
          candidates.push({ id, local: bm.slot1, visitante: bm.slot2, kickoff, label: round.name });
        }
      }
    });

    const upcoming = candidates.filter(m => {
      const diff = m.kickoff.getTime() - now;
      if (diff < WINDOW_START_MS || diff >= WINDOW_END_MS) return false;
      return !matchLocks[m.id];
    });

    const matchReminderUpdates: Record<string, string[]> = {};
    const reminderByUid = new Map<string, CandidateMatch[]>();
    for (const m of upcoming) {
      for (const uid of uids) {
        if (remindedMatches[m.id]?.includes(uid)) continue;
        if (hasPrediction(predsByUid.get(uid), m.id)) continue;
        if (!reminderByUid.has(uid)) reminderByUid.set(uid, []);
        reminderByUid.get(uid)!.push(m);
        (matchReminderUpdates[m.id] ||= []).push(uid);
      }
    }

    // ── 2) Newly enabled knockout phases ──
    const newlyEnabled = KNOCKOUT_ROUNDS.filter(r => phases[r.id] && !notifiedPhases.includes(r.id));
    const phaseByUid = new Map<string, CandidateMatch[]>();
    const newlyNotifiedPhaseIds: string[] = [];

    for (const round of newlyEnabled) {
      const roundMatches: CandidateMatch[] = [];
      for (let i = 1; i <= round.count; i++) {
        const id = `${round.id}-${i}`;
        const bm = bracket[id];
        if (bm?.slot1?.n && bm?.slot2?.n) {
          roundMatches.push({ id, local: bm.slot1, visitante: bm.slot2, kickoff: toDate(bm.kickoff) || new Date(), label: round.name });
        }
      }
      if (roundMatches.length === 0) continue;
      newlyNotifiedPhaseIds.push(round.id);
      for (const uid of uids) {
        const missing = roundMatches.filter(m => !hasPrediction(predsByUid.get(uid), m.id));
        if (missing.length > 0) phaseByUid.set(uid, [...(phaseByUid.get(uid) || []), ...missing]);
      }
    }

    // ── Resolve emails for all involved users ──
    const involvedUids = Array.from(new Set([...reminderByUid.keys(), ...phaseByUid.keys()]));
    let reminders = 0, phaseEmails = 0;

    if (involvedUids.length > 0) {
      const { users } = await auth.getUsers(involvedUids.map(uid => ({ uid })));
      const emailByUid = new Map(users.filter(u => u.email).map(u => [u.uid, u.email!]));

      const jobs: Promise<any>[] = [];

      for (const [uid, matches] of reminderByUid) {
        const email = emailByUid.get(uid);
        if (!email) continue;
        const rows = matches.map(matchRow).join('');
        const html = emailShell(
          '⏰ ¡Partidos por arrancar!',
          `Estos partidos comienzan en menos de 3 horas (horario de ${TZ.split('/').pop()?.replace('_', ' ')}) y todavía no cargaste tu pronóstico:`,
          rows
        );
        jobs.push(resend.emails.send({ from: FROM, to: email, subject: '⏰ Tenés partidos sin pronosticar', html }));
        reminders++;
      }

      for (const [uid, matches] of phaseByUid) {
        const email = emailByUid.get(uid);
        if (!email) continue;
        const label = matches[0]?.label || 'una nueva fase';
        const rows = matches.map(matchRow).join('');
        const html = emailShell(
          `🏆 ¡${label} ya está disponible!`,
          `El administrador habilitó los pronósticos para ${label}. Completalos antes de que arranquen los partidos:`,
          rows
        );
        jobs.push(resend.emails.send({ from: FROM, to: email, subject: `🏆 Nueva fase disponible: ${label}`, html }));
        phaseEmails++;
      }

      await Promise.allSettled(jobs);
    }

    // ── Persist dedupe state ──
    const stateUpdate: Record<string, any> = {};
    for (const [matchId, newUids] of Object.entries(matchReminderUpdates)) {
      stateUpdate[`remindedMatches.${matchId}`] = FieldValue.arrayUnion(...newUids);
    }
    if (newlyNotifiedPhaseIds.length > 0) {
      stateUpdate.notifiedPhases = FieldValue.arrayUnion(...newlyNotifiedPhaseIds);
    }
    if (Object.keys(stateUpdate).length > 0) {
      await db.doc('notifications/state').set(stateUpdate, { merge: true });
    }

    return res.status(200).json({ reminders, phaseEmails, newlyNotifiedPhases: newlyNotifiedPhaseIds });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
