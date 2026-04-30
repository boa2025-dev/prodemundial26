import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyBJeBpq7_9R23rtr_fGoUQf8fXKgcBib-E",
  authDomain:        "prode-mundial-2026-4b023.firebaseapp.com",
  projectId:         "prode-mundial-2026-4b023",
  storageBucket:     "prode-mundial-2026-4b023.firebasestorage.app",
  messagingSenderId: "503197700056",
  appId:             "1:503197700056:web:e13e6e00445b059c716cad",
  measurementId:     "G-XML10VTN4S"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { app, auth, db };
