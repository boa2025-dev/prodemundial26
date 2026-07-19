import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { SITE_URL } from '../_lib/emailTemplates.js';

const FROM = process.env.RESEND_FROM_EMAIL || 'Prode Mundial 2026 <notificaciones@prodemundial26.online>';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
  return initializeApp({ credential: cert(serviceAccount) });
}

function calcPts(pred: any, home: number, away: number): number {
  if (!pred || pred.home == null || pred.away == null) return 0;
  if (pred.home === home && pred.away === away) return 3;
  if (Math.sign(pred.home - pred.away) === Math.sign(home - away)) return 1;
  return 0;
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

    const [groupsSnap, resultsSnap, bracketSnap] = await Promise.all([
      db.collection('groups').get(),
      db.doc('results/matches').get(),
      db.doc('knockout/bracket').get(),
    ]);

    const results: Record<string, { home: number; away: number }> = resultsSnap.exists
      ? (resultsSnap.data()?.scores || {})
      : {};
    const bracketData: Record<string, any> = bracketSnap.exists ? bracketSnap.data()! : {};

    // uid → { name, email }
    const uidToInfo = new Map<string, { name: string; email: string }>();
    groupsSnap.docs.forEach(d => {
      const members = (d.data().members || []) as { uid: string; displayName?: string; email?: string }[];
      members.forEach(m => {
        if (m.uid && m.email) uidToInfo.set(m.uid, { name: m.displayName || m.uid, email: m.email });
      });
    });

    const allUids = Array.from(uidToInfo.keys());

    // Load all predictions in parallel
    const predsMap = new Map<string, Record<string, any>>();
    await Promise.all(allUids.map(async uid => {
      try {
        const snap = await db.doc(`predictions/${uid}_global`).get();
        predsMap.set(uid, snap.exists ? (snap.data()?.matches || {}) : {});
      } catch {
        predsMap.set(uid, {});
      }
    }));

    // Score each user globally
    const toNotify: { email: string; name: string; pts: number; exact: number; outcome: number }[] = [];

    for (const uid of allUids) {
      const info = uidToInfo.get(uid)!;
      const preds = predsMap.get(uid) || {};
      let pts = 0, exact = 0, outcome = 0;

      for (const [id, r] of Object.entries(results)) {
        const p = calcPts(preds[id], r.home, r.away);
        pts += p;
        if (p === 3) exact++;
        else if (p === 1) outcome++;
      }
      for (const [id, m] of Object.entries(bracketData)) {
        if (m?.home == null || m?.away == null) continue;
        const p = calcPts(preds[id], m.home, m.away);
        pts += p;
        if (p === 3) exact++;
        else if (p === 1) outcome++;
      }

      if (pts > 0) {
        toNotify.push({ email: info.email, name: info.name, pts, exact, outcome });
      }
    }

    const dryRun = req.query.dryRun === '1';

    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        totalUsers: allUids.length,
        usersToNotify: toNotify.length,
        skipped: allUids.length - toNotify.length,
        recipients: toNotify.map(u => ({ name: u.name, email: u.email, pts: u.pts, exact: u.exact, outcome: u.outcome })),
        sampleHtml: toNotify.length > 0 ? buildHtml(toNotify[0]) : buildHtml({ name: 'Jugador', email: '', pts: 42, exact: 12, outcome: 6 }),
      });
    }

    if (toNotify.length === 0) {
      return res.status(200).json({ sent: 0, note: 'no users with points yet' });
    }

    const payload = toNotify.map(u => ({
      from: FROM,
      to: u.email,
      subject: `🙌 ¡Gracias por participar en el Prode Mundial 2026!`,
      html: buildHtml(u),
    }));

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.batch.send(payload as any);
    if (error) throw new Error(JSON.stringify(error));

    return res.status(200).json({ sent: toNotify.length, skipped: allUids.length - toNotify.length });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

function buildHtml(u: { name: string; pts: number; exact: number; outcome: number }): string {
  const firstName = u.name.split(' ')[0];
  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background:#08090f;font-family:Inter,Arial,Helvetica,sans-serif;">
    <div style="background:#08090f;padding:32px 16px;">
      <div style="max-width:520px;margin:0 auto;background:#0c1220;border:1px solid rgba(201,168,76,.2);border-radius:20px;padding:32px 28px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${SITE_URL}/logo.png" alt="" width="44" height="44" style="border-radius:50%;display:block;margin:0 auto 10px;box-shadow:0 0 14px rgba(201,168,76,.35);" />
          <div style="font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:20px;letter-spacing:.04em;color:#f0f4f8;">
            PRODE <span style="color:#c9a84c;">2026</span>
          </div>
        </div>
        <h1 style="font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:800;color:#f0f4f8;margin:0 0 10px;text-align:center;">🙌 ¡Gracias por participar!</h1>
        <p style="color:#7a8898;font-size:14px;line-height:1.6;margin:0 0 24px;text-align:center;">
          ${firstName}, gracias por ser parte del Prode Mundial 2026. Tu participación hace que esto valga la pena. Así quedaste en el torneo:
        </p>

        <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:14px;padding:20px 18px;margin-bottom:20px;">
          <div style="font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:13px;color:#7a8898;letter-spacing:.07em;text-align:center;margin-bottom:14px;">TU PUNTAJE FINAL</div>
          <table role="presentation" width="100%" style="border-collapse:collapse;">
            <tr>
              <td style="text-align:center;width:33%;">
                <div style="font-family:Montserrat,Arial,sans-serif;font-weight:900;font-size:32px;color:#c9a84c;">${u.pts}</div>
                <div style="font-size:10px;color:#7a8898;letter-spacing:.07em;font-weight:700;">PUNTOS</div>
              </td>
              <td style="text-align:center;width:33%;">
                <div style="font-family:Montserrat,Arial,sans-serif;font-weight:900;font-size:32px;color:#4ade80;">${u.exact}</div>
                <div style="font-size:10px;color:#7a8898;letter-spacing:.07em;font-weight:700;">EXACTOS</div>
              </td>
              <td style="text-align:center;width:33%;">
                <div style="font-family:Montserrat,Arial,sans-serif;font-weight:900;font-size:32px;color:#c9a84c;">${u.outcome}</div>
                <div style="font-size:10px;color:#7a8898;letter-spacing:.07em;font-weight:700;">RESULTADOS</div>
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align:center;margin-top:8px;">
          <a href="${SITE_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#f0c040,#c9a84c);color:#08090f;font-family:Montserrat,Arial,sans-serif;font-weight:800;text-decoration:none;padding:13px 32px;border-radius:50px;font-size:14px;letter-spacing:.02em;">Ver tabla de posiciones</a>
        </div>

        <div style="text-align:center;margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06);">
          <p style="color:#7a8898;font-size:11px;line-height:1.6;margin:0;">
            Recibís este mail porque participás de un grupo en PRODE 2026.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
