import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { MATCHES } from '../_lib/matches.js';
import { emailShell, matchRow } from '../_lib/emailTemplates.js';

const FROM = process.env.RESEND_FROM_EMAIL || 'Prode Mundial 2026 <notificaciones@prodemundial26.online>';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
  return initializeApp({ credential: cert(serviceAccount) });
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

    const groupsSnap = await db.collection('groups').get();
    const emailByUid = new Map<string, string>();
    groupsSnap.docs.forEach(d => {
      const members = (d.data().members || []) as { uid: string; email?: string }[];
      members.forEach(m => { if (m.uid && m.email) emailByUid.set(m.uid, m.email); });
    });
    const emails = Array.from(new Set(emailByUid.values()));

    const match = MATCHES.find(m => m.id === 'J1')!;
    const row = matchRow({ id: match.id, local: match.local, visitante: match.visitante, kickoff: match.kickoff, label: 'Fase de Grupos · Grupo J' });
    const html = emailShell(
      '🇦🇷 ¡HOY debuta la Scaloneta!',
      'El esperado debut de Argentina en el Mundial 2026 es HOY. La Albiceleste se enfrenta a Argelia a las 22hs (hora Argentina). Cargá tu pronóstico antes de que empiece ⚽🔥',
      row
    );

    const dryRun = req.query.dryRun === '1';
    if (dryRun) {
      return res.status(200).json({ dryRun: true, recipients: emails.length, html });
    }

    if (emails.length === 0) return res.status(200).json({ sent: 0, note: 'no users' });

    const payload = emails.map(email => ({
      from: FROM,
      to: email,
      subject: '🇦🇷 ¡HOY juega Argentina! La Scaloneta debuta a las 22hs',
      html,
    }));

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.batch.send(payload as any);
    if (error) throw new Error(JSON.stringify(error));

    return res.status(200).json({ sent: emails.length });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
