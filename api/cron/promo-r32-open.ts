import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { KNOCKOUT_ROUNDS } from '../_lib/matches.js';
import { emailShell, matchRow, type CandidateMatch } from '../_lib/emailTemplates.js';

const FROM = process.env.RESEND_FROM_EMAIL || 'Prode Mundial 2026 <notificaciones@prodemundial26.online>';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
  return initializeApp({ credential: cert(serviceAccount) });
}

function toDate(v: any): Date | null {
  if (!v) return null;
  return v.toDate ? v.toDate() : new Date(v);
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

    const [groupsSnap, bracketSnap] = await Promise.all([
      db.collection('groups').get(),
      db.doc('knockout/bracket').get(),
    ]);

    const bracket: Record<string, any> = bracketSnap.exists ? bracketSnap.data()! : {};
    const round = KNOCKOUT_ROUNDS.find(r => r.id === 'R32')!;
    const matches: CandidateMatch[] = [];
    for (let i = 1; i <= round.count; i++) {
      const id = `R32-${i}`;
      const bm = bracket[id];
      const kickoff = toDate(bm?.kickoff);
      if (bm?.slot1?.n && bm?.slot2?.n && kickoff) {
        matches.push({ id, local: bm.slot1, visitante: bm.slot2, kickoff, label: round.name });
      }
    }
    matches.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

    const emailByUid = new Map<string, string>();
    groupsSnap.docs.forEach(d => {
      const members = (d.data().members || []) as { uid: string; email?: string }[];
      members.forEach(m => { if (m.uid && m.email) emailByUid.set(m.uid, m.email); });
    });
    const emails = Array.from(new Set(emailByUid.values()));

    const rows = matches.map(matchRow).join('');
    const html = emailShell(
      `🏆 ¡${round.name} ya está disponible!`,
      `Se definieron los cruces de ${round.name.toLowerCase()}. Ya podés cargar tu pronóstico para los ${matches.length} partidos antes de que arranquen:`,
      rows
    );

    const dryRun = req.query.dryRun === '1';
    if (dryRun) {
      return res.status(200).json({ dryRun: true, recipients: emails.length, matches: matches.length, html });
    }

    if (emails.length === 0) return res.status(200).json({ sent: 0, note: 'no users' });
    if (matches.length === 0) return res.status(200).json({ sent: 0, note: 'no bracket matches found' });

    const payload = emails.map(email => ({
      from: FROM,
      to: email,
      subject: `🏆 ¡${round.name} ya está disponible! Completá tu pronóstico`,
      html,
    }));

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.batch.send(payload as any);
    if (error) throw new Error(JSON.stringify(error));

    // Mark the phase as already notified so the recurring notify-cron
    // doesn't send a second "phase enabled" email for the same round.
    await db.doc('notifications/state').set(
      { notifiedPhases: FieldValue.arrayUnion('R32') },
      { merge: true }
    );

    return res.status(200).json({ sent: emails.length, matches: matches.length });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
