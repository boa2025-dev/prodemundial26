import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { mapFirebaseError } from '../lib/utils';
import './Login.css';

export default function Login() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const ballsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) navigate('/dashboard', { replace: true });
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!ballsRef.current) return;
    const balls = ['⚽', '⚽', '⚽', '🏆', '⭐', '⚽'];
    balls.forEach((b) => {
      const el = document.createElement('div');
      el.className = 'bg-ball';
      el.textContent = b;
      el.style.cssText = `
        --sz:${2 + Math.random() * 3}rem;
        --dur:${10 + Math.random() * 12}s;
        --del:${Math.random() * 8}s;
        --ty:${-30 - Math.random() * 60}px;
        --rot:${120 + Math.random() * 240}deg;
        left:${Math.random() * 95}%;
        top:${Math.random() * 90}%;
      `;
      ballsRef.current!.appendChild(el);
    });
  }, []);

  function clearErrors() {
    setAuthError('');
    setEmailError('');
    setPasswordError('');
    setSuccessMsg('');
  }

  function validate() {
    let valid = true;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Ingresá un email válido.');
      valid = false;
    }
    if (!password) {
      setPasswordError('Ingresá tu contraseña.');
      valid = false;
    }
    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();
    if (!validate()) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setAuthError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    clearErrors();
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setAuthError(mapFirebaseError(err.code));
    }
  }

  async function handleForgot(e: React.MouseEvent) {
    e.preventDefault();
    clearErrors();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Ingresá tu email para recuperar la contraseña.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg('Te mandamos un email para recuperar tu contraseña.');
    } catch (err: any) {
      setAuthError(mapFirebaseError(err.code));
    }
  }

  return (
    <div className="login-page">
      <div className="page-bg" />
      <div className="bg-balls" ref={ballsRef} />

      <nav className="auth-nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <img src="/logo.png" alt="Logo" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 12px var(--glow)' }} />
            <span>PRODE <span className="gold">2026</span></span>
          </Link>
          <Link to="/register" className="nav-link">
            ¿No tenés cuenta? <strong style={{ color: 'var(--gold)' }}>Registrate</strong>
          </Link>
        </div>
      </nav>

      <main>
        <div className="auth-card">
          <div className="card-badge">🏆</div>
          <h1 className="card-title">Bienvenido de vuelta</h1>
          <p className="card-sub">Iniciá sesión para acceder a tu prode.</p>

          {(authError || successMsg) && (
            <div className={`auth-error show${successMsg ? ' success-msg' : ''}`}>
              {authError || successMsg}
            </div>
          )}

          <button className="btn-google" onClick={handleGoogle} type="button">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continuar con Google
          </button>

          <div className="divider-row"><span>o con tu email</span></div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <div className="input-wrap">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  className={`form-input auth-input${emailError ? ' error' : ''}`}
                  type="email"
                  id="email"
                  placeholder="tu@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {emailError && <span className="field-error show">{emailError}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Contraseña</label>
              <div className="input-wrap">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  className={`form-input auth-input${passwordError ? ' error' : ''}`}
                  type={showPwd ? 'text' : 'password'}
                  id="password"
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="pwd-toggle" onClick={() => setShowPwd(!showPwd)} aria-label="Ver contraseña">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
              {passwordError && <span className="field-error show">{passwordError}</span>}
            </div>

            <div className="forgot-row">
              <a href="#" className="forgot-link" onClick={handleForgot}>¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" className={`btn-submit${loading ? ' loading' : ''}`} disabled={loading}>
              <span className="btn-text">Iniciar sesión</span>
              <div className="btn-spinner" />
            </button>
          </form>

          <div className="card-footer">
            ¿No tenés cuenta? <Link to="/register">Registrate gratis</Link>
          </div>

          <div className="card-pitch-line" />
        </div>
      </main>
    </div>
  );
}
