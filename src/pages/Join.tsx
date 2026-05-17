import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import './Join.css';

export default function Join() {
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const code = params.get('code')?.toUpperCase() || '';
  const groupNameParam = params.get('name') || '';

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(false);

  // Redirect if no code
  useEffect(() => {
    if (!code) navigate('/', { replace: true });
  }, [code, navigate]);

  // Auto-join as soon as auth resolves and user is logged in
  useEffect(() => {
    if (!authLoading && currentUser && code) {
      joinNow();
    }
  }, [authLoading, currentUser]);

  async function joinNow() {
    if (!currentUser || !code) return;
    setJoining(true);
    setJoinError(false);
    try {
      const snap = await getDoc(doc(db, 'groups', code));
      if (!snap.exists()) { setJoinError(true); setJoining(false); return; }
      const data = snap.data();
      // Already a member — go straight to dashboard
      if (data.memberUids?.includes(currentUser.uid)) {
        navigate('/dashboard', { replace: true });
        return;
      }
      await updateDoc(doc(db, 'groups', code), {
        memberUids: arrayUnion(currentUser.uid),
        members: arrayUnion({ uid: currentUser.uid, displayName: currentUser.displayName || currentUser.email }),
      });
      navigate('/dashboard', { replace: true });
    } catch {
      setJoinError(true);
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

  if (!code) return null;

  // Loading: auth resolving OR joining in progress
  if (authLoading || joining) {
    return (
      <div className="join-page">
        <div className="join-loading">
          <div className="spinner-lg" />
          {joining && <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 14 }}>Uniéndote al grupo...</p>}
        </div>
      </div>
    );
  }

  // Error during join (group not found or permission issue)
  if (joinError) {
    return (
      <div className="join-page">
        <div className="join-bg" />
        <div className="join-card">
          <div className="join-badge" style={{ fontSize: '2.5rem' }}>❌</div>
          <h1 className="join-title">Link inválido</h1>
          <p className="join-sub">Este grupo no existe o el link ya no es válido.</p>
          <Link to="/" className="join-btn-primary">Ir al inicio</Link>
        </div>
      </div>
    );
  }

  // Not logged in — show invite landing using name from URL (no Firestore needed)
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
        <h1 className="join-title">{groupNameParam || 'Grupo de Prode'}</h1>
        <p className="join-sub">
          Te invitaron a predecir el Mundial FIFA 2026.
          <br />
          <span style={{ color: 'var(--muted)', fontSize: '0.85em' }}>
            Registrate o iniciá sesión para unirte.
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
