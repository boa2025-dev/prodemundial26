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

interface WonGroup {
  groupName: string;
  pts: number;
  exact: number;
  outcome: number;
  isTied: boolean;
  tiedWith: number;
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

    const resolvedGroupMatches = Object.keys(results).length;
    const resolvedKoMatches = Object.values(bracketData).filter(
      (m: any) => m?.home != null && m?.away != null
    ).length;

    if (resolvedGroupMatches === 0 && resolvedKoMatches === 0) {
      return res.status(200).json({ sent: 0, note: 'no results loaded yet' });
    }

    // uid → { name, email }
    const uidToInfo = new Map<string, { name: string; email: string }>();
    groupsSnap.docs.forEach(d => {
      const members = (d.data().members || []) as { uid: string; displayName?: string; email?: string }[];
      members.forEach(m => {
        if (m.uid && m.email) uidToInfo.set(m.uid, { name: m.displayName || m.uid, email: m.email });
      });
    });

    // Load predictions for every unique uid in one pass
    const allUids = Array.from(uidToInfo.keys());
    const predsMap = new Map<string, Record<string, any>>();
    await Promise.all(allUids.map(async uid => {
      try {
        const snap = await db.doc(`predictions/${uid}_global`).get();
        predsMap.set(uid, snap.exists ? (snap.data()?.matches || {}) : {});
      } catch {
        predsMap.set(uid, {});
      }
    }));

    function scoreUser(uid: string) {
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
      return { pts, exact, outcome };
    }

    // uid → WonGroup[]
    const winnerMap = new Map<string, WonGroup[]>();

    groupsSnap.docs.forEach(gDoc => {
      const gData = gDoc.data();
      const members = (gData.members || []) as { uid: string; displayName?: string; email?: string }[];
      const eligible = members.filter(m => m.uid && m.email);
      if (eligible.length < 2) return; // skip solo groups

      const scores = eligible.map(m => ({ uid: m.uid, ...scoreUser(m.uid) }));
      const maxPts = Math.max(...scores.map(s => s.pts));
      if (maxPts === 0) return; // nobody has earned points yet

      const topScorers = scores.filter(s => s.pts === maxPts);
      topScorers.forEach(s => {
        const list = winnerMap.get(s.uid) || [];
        list.push({
          groupName: gData.name,
          pts: s.pts,
          exact: s.exact,
          outcome: s.outcome,
          isTied: topScorers.length > 1,
          tiedWith: topScorers.length - 1,
        });
        winnerMap.set(s.uid, list);
      });
    });

    const dryRun = req.query.dryRun === '1';

    if (dryRun) {
      const winners = Array.from(winnerMap.entries()).map(([uid, groups]) => {
        const info = uidToInfo.get(uid) || { name: uid, email: '' };
        return { uid, name: info.name, email: info.email, groups };
      });
      const sampleName = winners[0]?.name.split(' ')[0] || 'Jugador';
      const sampleGroups: WonGroup[] = winners[0]?.groups || [
        { groupName: 'Los Cracks del Barrio', pts: 42, exact: 12, outcome: 6, isTied: false, tiedWith: 0 },
      ];
      return res.status(200).json({
        dryRun: true,
        totalWinners: winnerMap.size,
        resolvedGroupMatches,
        resolvedKoMatches,
        winners,
        sampleHtml: buildHtml(sampleName, sampleGroups),
      });
    }

    if (winnerMap.size === 0) {
      return res.status(200).json({ sent: 0, note: 'no groups with qualifying winners' });
    }

    const payload = Array.from(winnerMap.entries()).map(([uid, groups]) => {
      const info = uidToInfo.get(uid) || { name: uid, email: '' };
      const firstName = info.name.split(' ')[0];
      const subject =
        groups.length === 1
          ? `🏆 ¡Estás ganando el grupo "${groups[0].groupName}"!`
          : `🏆 ¡Estás ganando ${groups.length} grupos en el Prode!`;
      return {
        from: FROM,
        to: info.email,
        subject,
        html: buildHtml(firstName, groups),
      };
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.batch.send(payload as any);
    if (error) throw new Error(JSON.stringify(error));

    return res.status(200).json({ sent: winnerMap.size });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

function buildHtml(firstName: string, groups: WonGroup[]): string {
  const multi = groups.length > 1;

  const title = multi ? `🏆 ¡Estás ganando ${groups.length} grupos!` : `🏆 ¡Estás en primer lugar!`;

  const intro = multi
    ? `¡Felicitaciones, ${firstName}! Estás liderando ${groups.length} grupos en el Prode Mundial 2026. Así está tu puntaje:`
    : `¡Felicitaciones, ${firstName}! Estás en primer lugar${groups[0].isTied ? ` (empatado con ${groups[0].tiedWith} jugador${groups[0].tiedWith !== 1 ? 'es' : ''} más)` : ''} en tu grupo del Prode Mundial 2026.`;

  const groupCards = groups
    .map(
      g => `
  <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:14px;padding:16px 18px;margin-bottom:10px;">
    <div style="font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:15px;color:#f0f4f8;margin-bottom:12px;">
      ${g.groupName}${g.isTied ? ` <span style="font-size:11px;font-weight:600;color:#7a8898;">(empate)</span>` : ''}
    </div>
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="text-align:center;width:33%;">
          <div style="font-family:Montserrat,Arial,sans-serif;font-weight:900;font-size:26px;color:#c9a84c;">${g.pts}</div>
          <div style="font-size:10px;color:#7a8898;letter-spacing:.07em;font-weight:700;">PUNTOS</div>
        </td>
        <td style="text-align:center;width:33%;">
          <div style="font-family:Montserrat,Arial,sans-serif;font-weight:900;font-size:26px;color:#4ade80;">${g.exact}</div>
          <div style="font-size:10px;color:#7a8898;letter-spacing:.07em;font-weight:700;">EXACTOS</div>
        </td>
        <td style="text-align:center;width:33%;">
          <div style="font-family:Montserrat,Arial,sans-serif;font-weight:900;font-size:26px;color:#c9a84c;">${g.outcome}</div>
          <div style="font-size:10px;color:#7a8898;letter-spacing:.07em;font-weight:700;">RESULTADOS</div>
        </td>
      </tr>
    </table>
  </div>`
    )
    .join('');

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
        <h1 style="font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:800;color:#f0f4f8;margin:0 0 10px;text-align:center;">${title}</h1>
        <p style="color:#7a8898;font-size:14px;line-height:1.6;margin:0 0 20px;text-align:center;">${intro}</p>
        ${groupCards}
        <div style="text-align:center;margin-top:24px;">
          <a href="${SITE_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#f0c040,#c9a84c);color:#08090f;font-family:Montserrat,Arial,sans-serif;font-weight:800;text-decoration:none;padding:13px 32px;border-radius:50px;font-size:14px;letter-spacing:.02em;">Ver tabla de posiciones</a>
        </div>
        <div style="text-align:center;margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06);">
          <p style="color:#7a8898;font-size:11px;line-height:1.6;margin:0;">
            Recibís este mail porque participás de un grupo en PRODE 2026.<br>
            El torneo no terminó — ¡seguí pronosticando para mantener tu ventaja!
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
