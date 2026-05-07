import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { genCode } from '../lib/utils';
import './Onboarding.css';

type Mode = 'none' | 'create' | 'join';

export default function Onboarding() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('none');
  const [pendingCode, setPendingCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ icon: string; title: string; sub: string } | null>(null);
  const [checkingGroups, setCheckingGroups] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    async function check() {
      try {
        const q = query(collection(db, 'groups'), where('memberUids', 'array-contains', currentUser!.uid));
        const snap = await getDocs(q);
        if (!snap.empty) { navigate('/dashboard', { replace: true }); return; }
      } catch { /* show onboarding normally */ }
      setCheckingGroups(false);
    }
    check();
  }, [currentUser, navigate]);

  function selectCreate() {
    const code = genCode();
    setPendingCode(code);
    setGroupName('');
    setCreateError('');
    setMode('create');
  }

  function selectJoin() {
    setJoinCode('');
    setJoinError('');
    setMode('join');
  }

  async function handleCreate() {
    setCreateError('');
    if (!groupName.trim()) { setCreateError('Poné un nombre al grupo.'); return; }
    setLoading(true);
    try {
      let code = pendingCode;
      const existing = await getDoc(doc(db, 'groups', code));
      if (existing.exists()) {
        code = genCode();
        setPendingCode(code);
      }
      await setDoc(doc(db, 'groups', code), {
        name: groupName.trim(),
        code,
        createdBy: currentUser!.uid,
        members: [{ uid: currentUser!.uid, displayName: currentUser!.displayName || currentUser!.email }],
        memberUids: [currentUser!.uid],
        createdAt: serverTimestamp(),
      });
      setSuccess({ icon: '🏆', title: `¡Grupo "${groupName.trim()}" creado!`, sub: `Código: ${code} · Redirigiendo...` });
      setTimeout(() => navigate('/dashboard', { replace: true }), 1800);
    } catch {
      setCreateError('Error al crear el grupo. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setJoinError('');
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setJoinError('El código debe tener exactamente 6 letras.'); return; }
    setLoading(true);
    try {
      const groupDoc = await getDoc(doc(db, 'groups', code));
      if (!groupDoc.exists()) { setJoinError('No existe ningún grupo con ese código.'); setLoading(false); return; }
      const data = groupDoc.data();
      if (!data.memberUids?.includes(currentUser!.uid)) {
        await updateDoc(doc(db, 'groups', code), {
          memberUids: arrayUnion(currentUser!.uid),
          members: arrayUnion({ uid: currentUser!.uid, displayName: currentUser!.displayName || currentUser!.email }),
        });
      }
      setSuccess({ icon: '🙌', title: `¡Te uniste a "${data.name}"!`, sub: 'Redirigiendo al dashboard...' });
      setTimeout(() => navigate('/dashboard', { replace: true }), 1800);
    } catch {
      setJoinError('Error al unirse. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(pendingCode);
  }

  if (checkingGroups) {
    return (
      <div className="ob-page">
        <div className="loading-state"><div className="spinner-lg" /></div>
      </div>
    );
  }

  const firstName = currentUser?.displayName?.split(' ')[0];

  return (
    <div className="ob-page">
      <div className="card">
        <div className="ob-logo">
          <img src="/logo.png" alt="Logo" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 14px var(--glow)' }} />
          <span>PRODE <span className="gold">2026</span></span>
        </div>

        <h1 className="ob-title">¡Bienvenido{firstName ? `, ${firstName}` : ''}!</h1>
        <p className="ob-sub">
          Para empezar, <strong>creá tu propio grupo</strong> de amigos o <strong>unite al de alguien</strong> con un código.
        </p>

        {!success && (
          <div className="ob-options">
            <button className={`ob-option create${mode === 'create' ? ' selected' : ''}`} onClick={selectCreate}>
              <div className="ob-option-icon">🏆</div>
              <div className="ob-option-text">
                <h3>Crear un grupo nuevo</h3>
                <p>Generá un código y compartilo con tus amigos para que se unan.</p>
              </div>
            </button>
            <button className={`ob-option join${mode === 'join' ? ' selected' : ''}`} onClick={selectJoin}>
              <div className="ob-option-icon">🔑</div>
              <div className="ob-option-text">
                <h3>Unirme a un grupo existente</h3>
                <p>Ingresá el código de 6 letras que te compartieron.</p>
              </div>
            </button>
          </div>
        )}

        {mode === 'create' && !success && (
          <div className="ob-form show">
            {createError && <div className="form-error show">{createError}</div>}
            <label className="form-label">Nombre del grupo</label>
            <input
              className="form-input"
              type="text"
              placeholder="Ej: Los Cracks del Barrio"
              maxLength={40}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <label className="form-label">Código de invitación</label>
            <div className="code-display">
              <span className="code-val">{pendingCode}</span>
              <button className="btn-copy" onClick={copyCode} type="button">Copiar</button>
            </div>
            <button className={`btn-primary${loading ? ' loading' : ''}`} onClick={handleCreate} disabled={loading}>
              <span className="btn-label">Crear grupo e ir al dashboard</span>
              <div className="btn-spinner" />
            </button>
          </div>
        )}

        {mode === 'join' && !success && (
          <div className="ob-form show">
            {joinError && <div className="form-error show">{joinError}</div>}
            <label className="form-label">Código del grupo</label>
            <input
              className="form-input"
              type="text"
              placeholder="XXXXXX"
              maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: '0.22em', fontSize: '1.1rem', fontFamily: "'Courier New', monospace" }}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            />
            <button className={`btn-primary${loading ? ' loading' : ''}`} onClick={handleJoin} disabled={loading}>
              <span className="btn-label">Unirme e ir al dashboard</span>
              <div className="btn-spinner" />
            </button>
          </div>
        )}

        {success && (
          <div className="ob-success show">
            <div className="success-icon">{success.icon}</div>
            <div className="success-title">{success.title}</div>
            <div className="success-sub">{success.sub}</div>
          </div>
        )}
      </div>
    </div>
  );
}
