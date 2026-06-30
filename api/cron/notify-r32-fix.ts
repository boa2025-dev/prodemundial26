import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { emailShell } from '../_lib/emailTemplates.js';

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

    const html = emailShell(
      '⚠️ Corrección en los Dieciseisavos',
      'Algunos cruces de Dieciseisavos mostraban equipos incorrectos debido a un error técnico. Ya están todos corregidos. Te pedimos que revises tus pronósticos en esa fase y los actualices si es necesario, especialmente si veías rivales que no te convencían.',
      `<div style="background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.2);border-radius:14px;padding:16px 18px;margin-bottom:16px;text-align:center;">
        <div style="font-size:15px;color:#f0f4f8;font-family:Montserrat,Arial,sans-serif;font-weight:700;margin-bottom:6px;">¿Qué pasó?</div>
        <div style="font-size:13px;color:#7a8898;line-height:1.6;">
          Un bug en el sistema de clasificación de terceros hizo que algunos cruces mostraran equipos que no correspondían. El error fue detectado y corregido manualmente. Los partidos y horarios son los mismos — solo cambiaron los rivales en algunos casos.
        </div>
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px 18px;margin-bottom:10px;text-align:center;">
        <div style="font-size:13px;color:#7a8898;line-height:1.6;">
          Entrá al prode, revisá la sección <strong style="color:#f0f4f8;">Dieciseisavos de Final</strong> y actualizá tus predicciones si lo considerás necesario. Los pronósticos que ya tenías cargados se mantienen.
        </div>
      </div>`
    );

    const dryRun = req.query.dryRun === '1';
    if (dryRun) {
      return res.status(200).json({ dryRun: true, recipients: emails.length, html });
    }

    if (emails.length === 0) return res.status(200).json({ sent: 0, note: 'no users' });

    const payload = emails.map(email => ({
      from: FROM,
      to: email,
      subject: '⚠️ Corrección en los cruces de Dieciseisavos — revisá tus pronósticos',
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
