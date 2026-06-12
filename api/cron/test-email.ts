import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const SITE_URL = 'https://prodemundial26.online';
const FROM = process.env.RESEND_FROM_EMAIL || 'Prode Mundial 2026 <notificaciones@prodemundial26.online>';

function emailShell(title: string, intro: string, rows: string): string {
  return `
  <div style="background:#08090f;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#11141d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px;">
      <div style="font-family:Georgia,serif;font-weight:800;font-size:20px;color:#fff;margin-bottom:4px;">PRODE <span style="color:#c9a84c;">2026</span></div>
      <h1 style="font-size:17px;color:#fff;margin:18px 0 8px;">${title}</h1>
      <p style="color:#aaa;font-size:14px;line-height:1.5;margin:0 0 16px;">${intro}</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid rgba(255,255,255,.08);">
        ${rows}
      </table>
      <div style="text-align:center;margin-top:24px;">
        <a href="${SITE_URL}/dashboard?tab=prode" style="display:inline-block;background:#c9a84c;color:#08090f;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;">Completar pronóstico</a>
      </div>
    </div>
  </div>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const to = req.query.to as string | undefined;
  if (!to) return res.status(400).json({ error: 'Falta el parámetro "to" (email de destino)' });

  try {
    const row = `<tr>
      <td style="padding:6px 0;color:#fff;font-size:14px;">🇦🇷 Argentina <span style="color:#888;">vs</span> 🇲🇽 México</td>
      <td style="padding:6px 0 6px 12px;color:#c9a84c;font-size:13px;text-align:right;white-space:nowrap;">11 jun 21:00 hs</td>
    </tr>`;

    const html = emailShell(
      '⏰ ¡Partidos por arrancar!',
      'Estos partidos comienzan en menos de 3 horas y todavía no cargaste tu pronóstico (este es un email de prueba):',
      row
    );

    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from: FROM, to, subject: '⏰ [Prueba] Tenés partidos sin pronosticar', html });
    return res.status(200).json({ ok: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
