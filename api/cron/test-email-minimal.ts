import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const to = req.query.to as string | undefined;
  if (!to) return res.status(400).json({ error: 'Falta "to"' });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Prode Mundial 2026 <notificaciones@prodemundial26.online>',
      to,
      subject: 'Test mínimo',
      html: '<p>Hola, esto es una prueba mínima.</p>',
    });
    return res.status(200).json({ ok: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
