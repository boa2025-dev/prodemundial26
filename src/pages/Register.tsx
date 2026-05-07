import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { mapFirebaseError } from '../lib/utils';
import './Login.css';
import './Register.css';

export default function Register() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [termsError, setTermsError] = useState('');
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
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmError('');
    setTermsError('');
  }

  function validate() {
    let valid = true;
    if (!name.trim()) { setNameError('Ingresá tu nombre.'); valid = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Ingresá un email válido.'); valid = false; }
    if (!password || password.length < 6) { setPasswordError('La contraseña debe tener al menos 6 caracteres.'); valid = false; }
    if (password !== confirm) { setConfirmError('Las contraseñas no coinciden.'); valid = false; }
    if (!terms) { setTermsError('Debés aceptar los términos.'); valid = false; }
    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();
    if (!validate()) return;
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
      navigate('/onboarding', { replace: true });
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
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      setAuthError(mapFirebaseError(err.code));
    }
  }

  const pwdStrength = password.length === 0 ? 0
    : password.length < 6 ? 25
    : password.length < 8 ? 50
    : password.length < 12 ? 75
    : 100;

  const pwdStrengthLabel = ['', 'Muy débil', 'Débil', 'Buena', 'Fuerte'][Math.ceil(pwdStrength / 25)] || '';
  const pwdStrengthColor = ['', '#e63946', '#f0a030', '#c9a84c', '#4cc94c'][Math.ceil(pwdStrength / 25)] || '';

  return (
    <div className="login-page register-page">
      <div className="page-bg reg-bg" />
      <div className="bg-balls" ref={ballsRef} />

      <nav className="auth-nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <img src="/logo.png" alt="Logo" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 12px var(--glow)' }} />
            <span>PRODE <span className="gold">2026</span></span>
          </Link>
          <Link to="/login" className="nav-link">
            ¿Ya tenés cuenta? <strong style={{ color: 'var(--gold)' }}>Iniciá sesión</strong>
          </Link>
        </div>
      </nav>

      <main>
        <div className="auth-card" style={{ maxWidth: 440 }}>
          <div className="step-indicator">
            <div className="step-dot active" />
            <div className="step-dot" />
          </div>
          <div className="card-badge">⚽</div>
          <h1 className="card-title">Crear cuenta gratis</h1>
          <p className="card-sub">Registrate y empezá a predecir el Mundial 2026.</p>

          {authError && <div className="auth-error show">{authError}</div>}

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
              <label className="form-label" htmlFor="name">Nombre</label>
              <div className="input-wrap">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input className={`form-input auth-input${nameError ? ' error' : ''}`} type="text" id="name" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {nameError && <span className="field-error show">{nameError}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <div className="input-wrap">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input className={`form-input auth-input${emailError ? ' error' : ''}`} type="email" id="email" placeholder="tu@email.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
                <input className={`form-input auth-input${passwordError ? ' error' : ''}`} type={showPwd ? 'text' : 'password'} id="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="pwd-toggle" onClick={() => setShowPwd(!showPwd)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
              {password && (
                <div className="pwd-strength">
                  <div className="pwd-strength-bar">
                    <div className="pwd-strength-fill" style={{ width: `${pwdStrength}%`, background: pwdStrengthColor }} />
                  </div>
                  <span className="pwd-strength-label" style={{ color: pwdStrengthColor }}>{pwdStrengthLabel}</span>
                </div>
              )}
              {passwordError && <span className="field-error show">{passwordError}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm">Confirmar contraseña</label>
              <div className="input-wrap">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <input className={`form-input auth-input${confirmError ? ' error' : ''}`} type={showPwd ? 'text' : 'password'} id="confirm" placeholder="Repetí tu contraseña" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              {confirmError && <span className="field-error show">{confirmError}</span>}
            </div>

            <div className="terms-row">
              <input className="terms-check" type="checkbox" id="terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <label className="terms-label" htmlFor="terms">
                Acepto los <Link to="/privacidad">Términos de uso</Link> y la <Link to="/privacidad">Política de privacidad</Link>
              </label>
            </div>
            {termsError && <span className="field-error show" style={{ display: 'block', marginTop: '-0.8rem', marginBottom: '0.8rem' }}>{termsError}</span>}

            <button type="submit" className={`btn-submit${loading ? ' loading' : ''}`} disabled={loading}>
              <span className="btn-text">Crear cuenta gratis</span>
              <div className="btn-spinner" />
            </button>
          </form>

          <div className="card-footer">
            ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
          </div>

          <div className="card-pitch-line" />
        </div>
      </main>
    </div>
  );
}
