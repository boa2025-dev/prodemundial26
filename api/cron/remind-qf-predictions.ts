import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { emailShell, matchRow, type CandidateMatch } from '../_lib/emailTemplates.js';

const FROM = process.env.RESEND_FROM_EMAIL || 'Prode Mundial 2026 <notificaciones@prodemundial26.online>';
const QF_IDS = ['QF-1', 'QF-2', 'QF-3', 'QF-4'];

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

    // Build QF matches that are configured in Firestore
    const qfMatches: CandidateMatch[] = [];
    for (const id of QF_IDS) {
      const bm = bracket[id];
      const kickoff = toDate(bm?.kickoff);
      if (bm?.slot1?.n && bm?.slot2?.n && kickoff) {
        qfMatches.push({ id, local: bm.slot1, visitante: bm.slot2, kickoff, label: 'Cuartos de Final' });
      }
    }
    qfMatches.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

    if (qfMatches.length === 0) {
      return res.status(200).json({ sent: 0, note: 'no QF matches configured in bracket yet' });
    }

    // Collect users: uid → email
    const userMap = new Map<string, string>(); // uid → email
    groupsSnap.docs.forEach(d => {
      const members = (d.data().members || []) as { uid: string; email?: string }[];
      members.forEach(m => { if (m.uid && m.email) userMap.set(m.uid, m.email); });
    });

    if (userMap.size === 0) {
      return res.status(200).json({ sent: 0, note: 'no users' });
    }

    // Load each user's predictions and find who is missing ≥1 QF prediction
    const qfIdSet = new Set(QF_IDS);
    const toNotify: { email: string; missingMatches: CandidateMatch[] }[] = [];

    await Promise.all(
      Array.from(userMap.entries()).map(async ([uid, email]) => {
        try {
          const predSnap = await db.doc(`predictions/${uid}_global`).get();
          const preds: Record<string, any> = predSnap.exists ? (predSnap.data()?.matches || {}) : {};
          const missingMatches = qfMatches.filter(m => {
            const p = preds[m.id];
            return !p || p.home == null || p.away == null;
          });
          if (missingMatches.length > 0) {
            toNotify.push({ email, missingMatches });
          }
        } catch {
          // If we can't read their predictions, assume all missing
          toNotify.push({ email, missingMatches: qfMatches });
        }
      })
    );

    const dryRun = req.query.dryRun === '1';
    if (dryRun) {
      // Show a sample email (first recipient's missing matches, or all QF if none yet)
      const sample = toNotify[0] ?? { email: 'preview', missingMatches: qfMatches };
      const html = buildHtml(sample.missingMatches, qfMatches.length);
      return res.status(200).json({
        dryRun: true,
        totalUsers: userMap.size,
        usersToNotify: toNotify.length,
        skipped: userMap.size - toNotify.length,
        matches: qfMatches.length,
        html,
      });
    }

    if (toNotify.length === 0) {
      return res.status(200).json({ sent: 0, note: 'all users already completed QF predictions' });
    }

    const payload = toNotify.map(({ email, missingMatches }) => ({
      from: FROM,
      to: email,
      subject: `⚽ Faltan tus pronósticos de Cuartos de Final — no te quedes afuera`,
      html: buildHtml(missingMatches, qfMatches.length),
    }));

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.batch.send(payload as any);
    if (error) throw new Error(JSON.stringify(error));

    return res.status(200).json({
      sent: toNotify.length,
      skipped: userMap.size - toNotify.length,
      matches: qfMatches.length,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

function buildHtml(missingMatches: CandidateMatch[], totalQf: number): string {
  const allMissing = missingMatches.length === totalQf;
  const intro = allMissing
    ? `Los Cuartos de Final ya están disponibles y todavía no cargaste ningún pronóstico. Son solo ${totalQf} partidos — no te quedes sin puntaje:`
    : `Ya cargaste algunos pronósticos de Cuartos de Final, pero te falt${missingMatches.length === 1 ? 'a' : 'an'} ${missingMatches.length} de ${totalQf}. Completalos antes de que arranquen:`;
  const rows = missingMatches.map(matchRow).join('');
  return emailShell('⚽ ¡Completá tus Cuartos de Final!', intro, rows);
}
