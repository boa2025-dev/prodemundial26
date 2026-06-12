import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { emailShell, matchRow, type CandidateMatch } from '../../src/lib/emailTemplates';

const FROM = process.env.RESEND_FROM_EMAIL || 'Prode Mundial 2026 <notificaciones@prodemundial26.online>';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const to = req.query.to as string | undefined;
  if (!to) return res.status(400).json({ error: 'Falta el parámetro "to" (email de destino)' });

  const sample: CandidateMatch = {
    id: 'TEST',
    local: { n: 'Argentina', f: '🇦🇷' },
    visitante: { n: 'México', f: '🇲🇽' },
    kickoff: new Date(Date.now() + 2.5 * 60 * 60 * 1000),
    label: 'Fase de Grupos',
  };

  const html = emailShell(
    '⏰ ¡Partidos por arrancar!',
    'Estos partidos comienzan en menos de 3 horas y todavía no cargaste tu pronóstico (este es un email de prueba):',
    matchRow(sample)
  );

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from: FROM, to, subject: '⏰ [Prueba] Tenés partidos sin pronosticar', html });
    return res.status(200).json({ ok: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
