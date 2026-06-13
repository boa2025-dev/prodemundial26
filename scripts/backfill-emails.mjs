// One-time script: fills the "email" field for existing group members
// that joined before email was stored in groups/{code}.members.
//
// Run locally (NOT on Vercel) with:
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json completo>' node scripts/backfill-emails.mjs

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);
const auth = getAuth(app);

const groupsSnap = await db.collection('groups').get();

for (const doc of groupsSnap.docs) {
  const data = doc.data();
  const members = data.members || [];
  let changed = false;

  const updated = await Promise.all(members.map(async (m) => {
    if (m.email || !m.uid) return m;
    try {
      const user = await auth.getUser(m.uid);
      if (user.email) {
        changed = true;
        return { ...m, email: user.email };
      }
    } catch (err) {
      console.warn(`No se pudo resolver email para uid ${m.uid}:`, err.message);
    }
    return m;
  }));

  if (changed) {
    await doc.ref.update({ members: updated });
    console.log(`Grupo ${doc.id}: emails actualizados`);
  }
}

console.log('Listo.');
