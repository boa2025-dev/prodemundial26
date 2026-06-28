import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
  return initializeApp({ credential: cert(serviceAccount) });
}

interface Team { n: string; f: string; }

// Real Round of 32 matchups + correct kickoff (UTC) and venue, cross-checked
// against FIFA's official fixtures page and converted from the ET times
// reported there. Keyed by the bracket slot id (R32-1..R32-16) defined in
// src/data/matches.ts — those static BRACKET_MAP entries had wrong kickoff
// times (off by 2-18h in several cases), which also made matches auto-lock
// at the wrong moment since locking is based on `now >= kickoff`.
const R32_DATA: Record<string, { slot1: Team; slot2: Team; kickoff: string; sede: string }> = {
  'R32-1':  { slot1: { n: 'Sudáfrica', f: '🇿🇦' },      slot2: { n: 'Canadá', f: '🇨🇦' },        kickoff: '2026-06-28T19:00Z', sede: 'SoFi Stadium, Los Ángeles' },
  'R32-2':  { slot1: { n: 'Alemania', f: '🇩🇪' },       slot2: { n: 'Paraguay', f: '🇵🇾' },      kickoff: '2026-06-29T20:30Z', sede: 'Gillette Stadium, Boston' },
  'R32-3':  { slot1: { n: 'Países Bajos', f: '🇳🇱' },   slot2: { n: 'Marruecos', f: '🇲🇦' },     kickoff: '2026-06-30T01:00Z', sede: 'Estadio BBVA, Guadalupe' },
  'R32-4':  { slot1: { n: 'Brasil', f: '🇧🇷' },         slot2: { n: 'Japón', f: '🇯🇵' },         kickoff: '2026-06-29T17:00Z', sede: 'NRG Stadium, Houston' },
  'R32-5':  { slot1: { n: 'Francia', f: '🇫🇷' },        slot2: { n: 'Suecia', f: '🇸🇪' },        kickoff: '2026-06-30T21:00Z', sede: 'MetLife Stadium, Nueva York' },
  'R32-6':  { slot1: { n: 'Costa de Marfil', f: '🇨🇮' }, slot2: { n: 'Noruega', f: '🇳🇴' },       kickoff: '2026-06-30T17:00Z', sede: 'AT&T Stadium, Dallas' },
  'R32-7':  { slot1: { n: 'México', f: '🇲🇽' },         slot2: { n: 'Ecuador', f: '🇪🇨' },       kickoff: '2026-07-01T01:00Z', sede: 'Estadio Azteca, Ciudad de México' },
  'R32-8':  { slot1: { n: 'Inglaterra', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },    slot2: { n: 'R.D. Congo', f: '🇨🇩' },    kickoff: '2026-07-01T16:00Z', sede: 'Mercedes-Benz Stadium, Atlanta' },
  'R32-9':  { slot1: { n: 'EE.UU.', f: '🇺🇸' },         slot2: { n: 'Bosnia y Herz.', f: '🇧🇦' }, kickoff: '2026-07-02T00:00Z', sede: "Levi's Stadium, San Francisco" },
  'R32-10': { slot1: { n: 'Bélgica', f: '🇧🇪' },        slot2: { n: 'Senegal', f: '🇸🇳' },       kickoff: '2026-07-01T20:00Z', sede: 'Lumen Field, Seattle' },
  'R32-11': { slot1: { n: 'Portugal', f: '🇵🇹' },       slot2: { n: 'Croacia', f: '🇭🇷' },       kickoff: '2026-07-02T23:00Z', sede: 'BMO Field, Toronto' },
  'R32-12': { slot1: { n: 'España', f: '🇪🇸' },         slot2: { n: 'Austria', f: '🇦🇹' },       kickoff: '2026-07-02T19:00Z', sede: 'SoFi Stadium, Los Ángeles' },
  'R32-13': { slot1: { n: 'Suiza', f: '🇨🇭' },          slot2: { n: 'Argelia', f: '🇩🇿' },       kickoff: '2026-07-03T03:00Z', sede: 'BC Place, Vancouver' },
  'R32-14': { slot1: { n: 'Argentina', f: '🇦🇷' },      slot2: { n: 'Cabo Verde', f: '🇨🇻' },    kickoff: '2026-07-03T22:00Z', sede: 'Hard Rock Stadium, Miami' },
  'R32-15': { slot1: { n: 'Colombia', f: '🇨🇴' },       slot2: { n: 'Ghana', f: '🇬🇭' },         kickoff: '2026-07-04T01:30Z', sede: 'Arrowhead Stadium, Kansas City' },
  'R32-16': { slot1: { n: 'Australia', f: '🇦🇺' },      slot2: { n: 'Egipto', f: '🇪🇬' },        kickoff: '2026-07-03T18:00Z', sede: 'AT&T Stadium, Dallas' },
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

    for (const [matchId, data] of Object.entries(R32_DATA)) {
      const existing = current[matchId] || {};
      const next = {
        ...existing,
        slot1: data.slot1,
        slot2: data.slot2,
        kickoff: new Date(data.kickoff),
        sede: data.sede,
      };
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
