import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!getApps().length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
      initializeApp({ credential: cert(serviceAccount) });
    }
    const db = getFirestore();
    const snap = await db.doc('results/matchLocks').get();
    return res.status(200).json({ ok: true, exists: snap.exists });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
