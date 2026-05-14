import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import './Join.css';

interface GroupData {
  name: string;
  code: string;
  memberUids: string[];
  members?: { uid: string; displayName: string }[];
}

export default function Join() {
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const code = params.get('code')?.toUpperCase() || '';

  const [group, setGroup] = useState<GroupData | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!code) { navigate('/', { replace: true }); return; }
    loadGroup();
  }, [code]);

  useEffect(() => {
    if (!authLoading && currentUser && group) {
      if (group.memberUids?.includes(currentUser.uid)) {
        setAlreadyMember(true);
      } else {
        // Auto-join if logged in and arrived via invite link
        joinNow();
      }
    }
  }, [authLoading, currentUser, group]);

  async function loadGroup() {
    try {
      const snap = await getDoc(doc(db, 'groups', code));
      if (!snap.exists()) { setNotFound(true); setGroupLoading(false); return; }
      setGroup(snap.data() as GroupData);
    } catch {
      setNotFound(true);
    } finally {
      setGroupLoading(false);
    }
  }

  async function joinNow() {
    if (!currentUser || !group) return;
    if (group.memberUids?.includes(currentUser.uid)) {
      navigate('/dashboard', { replace: true });
      return;
    }
    setJoining(true);
    try {
      await updateDoc(doc(db, 'groups', code), {
        memberUids: arrayUnion(currentUser.uid),
        members: arrayUnion({ uid: currentUser.uid, displayName: currentUser.displayName || currentUser.email }),
      });
      navigate('/dashboard', { replace: true });
    } catch {
      setJoining(false);
    }
  }

  function goRegister() {
    localStorage.setItem('pendingInvite', code);
    navigate('/register');
  }

  function goLogin() {
    localStorage.setItem('pendingInvite', code);
    navigate('/login');
  }

  if (authLoading || groupLoading) {
    return (
      <div className="join-page">
        <div className="join-loading">
          <div className="spinner-lg" />
        </div>
      </div>
    );
  }

  if (notFound || !code) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-badge" style={{ fontSize: '2.5rem' }}>❌</div>
          <h1 className="join-title">Link inválido</h1>
          <p className="join-sub">Este link de invitación no existe o ya no es válido.</p>
          <Link to="/" className="join-btn-primary">Ir al inicio</Link>
        </div>
      </div>
    );
  }

  if (joining) {
    return (
      <div className="join-page">
        <div className="join-loading">
          <div className="spinner-lg" />
          <p style={{ color: 'var(--muted)', marginTop: 8 }}>Uniéndote al grupo...</p>
        </div>
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-badge">✅</div>
          <h1 className="join-title">Ya estás en este grupo</h1>
          <p className="join-sub">Ya sos miembro de <strong>{group?.name}</strong>.</p>
          <button className="join-btn-primary" onClick={() => navigate('/dashboard', { replace: true })}>
            Ir al dashboard →
          </button>
        </div>
      </div>
    );
  }

  // Not logged in — show invite landing
  return (
    <div className="join-page">
      <div className="join-bg" />
      <div className="join-card">
        <div className="join-logo">
          <img src="/logo.png" alt="Logo" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 12px var(--glow)' }} />
          <span>PRODE <span className="gold">2026</span></span>
        </div>

        <div className="join-badge">🏆</div>
        <p className="join-eyebrow">Invitación a grupo</p>
        <h1 className="join-title">{group?.name}</h1>
        <p className="join-sub">
          Te invitaron a predecir el Mundial FIFA 2026 con este grupo.
          <br />
          <span style={{ color: 'var(--muted)', fontSize: '0.85em' }}>
            {group?.memberUids?.length || 1} jugador{(group?.memberUids?.length || 1) !== 1 ? 'es' : ''} ya adentro
          </span>
        </p>

        <div className="join-code-pill">
          Código: <strong>{code}</strong>
        </div>

        <button className="join-btn-primary" onClick={goRegister}>
          Unirme gratis ⚽
        </button>
        <button className="join-btn-secondary" onClick={goLogin}>
          Ya tengo cuenta — iniciar sesión
        </button>

        <p className="join-disclaimer">Sin instalar · 100% gratis · 104 partidos</p>
      </div>
    </div>
  );
}
