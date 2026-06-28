import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
  return initializeApp({ credential: cert(serviceAccount) });
}

interface Team { n: string; f: string; }

// Real Round of 32 matchups, sourced from FIFA's official scores & fixtures page.
// Keyed by the existing bracket slot id (R32-1..R32-16) defined in src/data/matches.ts.
const R32_TEAMS: Record<string, { slot1: Team; slot2: Team }> = {
  'R32-1':  { slot1: { n: 'Sudáfrica', f: '🇿🇦' },      slot2: { n: 'Canadá', f: '🇨🇦' } },
  'R32-2':  { slot1: { n: 'Alemania', f: '🇩🇪' },       slot2: { n: 'Paraguay', f: '🇵🇾' } },
  'R32-3':  { slot1: { n: 'Países Bajos', f: '🇳🇱' },   slot2: { n: 'Marruecos', f: '🇲🇦' } },
  'R32-4':  { slot1: { n: 'Brasil', f: '🇧🇷' },         slot2: { n: 'Japón', f: '🇯🇵' } },
  'R32-5':  { slot1: { n: 'Francia', f: '🇫🇷' },        slot2: { n: 'Suecia', f: '🇸🇪' } },
  'R32-6':  { slot1: { n: 'Costa de Marfil', f: '🇨🇮' }, slot2: { n: 'Noruega', f: '🇳🇴' } },
  'R32-7':  { slot1: { n: 'México', f: '🇲🇽' },         slot2: { n: 'Ecuador', f: '🇪🇨' } },
  'R32-8':  { slot1: { n: 'Inglaterra', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },    slot2: { n: 'R.D. Congo', f: '🇨🇩' } },
  'R32-9':  { slot1: { n: 'EE.UU.', f: '🇺🇸' },         slot2: { n: 'Bosnia y Herz.', f: '🇧🇦' } },
  'R32-10': { slot1: { n: 'Bélgica', f: '🇧🇪' },        slot2: { n: 'Senegal', f: '🇸🇳' } },
  'R32-11': { slot1: { n: 'Portugal', f: '🇵🇹' },       slot2: { n: 'Croacia', f: '🇭🇷' } },
  'R32-12': { slot1: { n: 'España', f: '🇪🇸' },         slot2: { n: 'Austria', f: '🇦🇹' } },
  'R32-13': { slot1: { n: 'Suiza', f: '🇨🇭' },          slot2: { n: 'Argelia', f: '🇩🇿' } },
  'R32-14': { slot1: { n: 'Argentina', f: '🇦🇷' },      slot2: { n: 'Cabo Verde', f: '🇨🇻' } },
  'R32-15': { slot1: { n: 'Colombia', f: '🇨🇴' },       slot2: { n: 'Ghana', f: '🇬🇭' } },
  'R32-16': { slot1: { n: 'Australia', f: '🇦🇺' },      slot2: { n: 'Egipto', f: '🇪🇬' } },
};

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
    const ref = db.doc('knockout/bracket');
    const snap = await ref.get();
    const current = snap.exists ? (snap.data() as Record<string, any>) : {};

    const dryRun = req.query.dryRun === '1';
    const preview: Record<string, any> = {};
    const payload: Record<string, any> = {};

    for (const [matchId, teams] of Object.entries(R32_TEAMS)) {
      const existing = current[matchId] || {};
      const next = { ...existing, slot1: teams.slot1, slot2: teams.slot2 };
      preview[matchId] = next;
      payload[matchId] = next;
    }

    if (dryRun) {
      return res.status(200).json({ dryRun: true, preview });
    }

    await ref.set(payload, { merge: true });
    return res.status(200).json({ updated: Object.keys(payload).length });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
