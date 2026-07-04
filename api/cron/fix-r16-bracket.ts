import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
  return initializeApp({ credential: cert(serviceAccount) });
}

interface Team { n: string; f: string; }

// Round of 16 matchups — verified against FIFA fixtures page and beIN Sports.
// All times UTC; converted from ET (EDT = UTC-4) as published on the official schedule.
// Venues confirmed against FIFA.com. ART = UTC-3, no DST.
const R16_DATA: Record<string, { slot1: Team; slot2: Team; kickoff: string; sede: string }> = {
  'R16-1': { slot1: { n: 'Paraguay',  f: '🇵🇾' }, slot2: { n: 'Francia',    f: '🇫🇷' }, kickoff: '2026-07-04T21:00Z', sede: 'Lincoln Financial Field, Filadelfia' }, // 5 PM ET → 18:00 ART
  'R16-2': { slot1: { n: 'Canadá',    f: '🇨🇦' }, slot2: { n: 'Marruecos',  f: '🇲🇦' }, kickoff: '2026-07-04T17:00Z', sede: 'NRG Stadium, Houston' },                  // 1 PM ET → 14:00 ART
  'R16-3': { slot1: { n: 'Brasil',    f: '🇧🇷' }, slot2: { n: 'Noruega',    f: '🇳🇴' }, kickoff: '2026-07-05T20:00Z', sede: 'MetLife Stadium, Nueva York' },             // 4 PM ET → 17:00 ART
  'R16-4': { slot1: { n: 'México',    f: '🇲🇽' }, slot2: { n: 'Inglaterra', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' }, kickoff: '2026-07-06T00:00Z', sede: 'Estadio Azteca, Ciudad de México' },    // 8 PM ET Jul 5 → 21:00 ART Jul 5
  'R16-5': { slot1: { n: 'Portugal',  f: '🇵🇹' }, slot2: { n: 'España',     f: '🇪🇸' }, kickoff: '2026-07-06T19:00Z', sede: 'AT&T Stadium, Dallas' },                   // 3 PM ET → 16:00 ART
  'R16-6': { slot1: { n: 'EE.UU.',    f: '🇺🇸' }, slot2: { n: 'Bélgica',    f: '🇧🇪' }, kickoff: '2026-07-07T00:00Z', sede: 'Lumen Field, Seattle' },                   // 8 PM ET Jul 6 → 21:00 ART Jul 6
  'R16-7': { slot1: { n: 'Argentina', f: '🇦🇷' }, slot2: { n: 'Egipto',     f: '🇪🇬' }, kickoff: '2026-07-07T16:00Z', sede: 'Mercedes-Benz Stadium, Atlanta' },         // 12 PM ET → 13:00 ART
  'R16-8': { slot1: { n: 'Suiza',     f: '🇨🇭' }, slot2: { n: 'Colombia',   f: '🇨🇴' }, kickoff: '2026-07-07T20:00Z', sede: 'BC Place, Vancouver' },                    // 4 PM ET → 17:00 ART
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

    for (const [matchId, data] of Object.entries(R16_DATA)) {
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
