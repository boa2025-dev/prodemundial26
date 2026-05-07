import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { MATCHES, GROUP_IDS } from '../data/matches';
import type { Match } from '../data/matches';
import { formatDate, formatDateTime } from '../lib/utils';
import './Predictions.css';

interface Pred {
  home: number | null;
  away: number | null;
}

export default function Predictions() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const GROUP_CODE = params.get('code')?.toUpperCase() || '';

  const [groupData, setGroupData] = useState<{ name: string; code: string } | null>(null);
  const [savedPreds, setSavedPreds] = useState<Record<string, Pred>>({});
  const [activeTab, setActiveTab] = useState(GROUP_IDS[0]);
  const [isDirty, setIsDirty] = useState(false);
  const [predInputs, setPredInputs] = useState<Record<string, { home: string; away: string }>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '', show: false });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) { navigate('/login', { replace: true }); return; }
    if (!GROUP_CODE) { navigate('/dashboard', { replace: true }); return; }
    loadData();
  }, [currentUser, GROUP_CODE]);

  async function loadData() {
    if (!currentUser) return;
    try {
      const [groupSnap, predSnap] = await Promise.all([
        getDoc(doc(db, 'groups', GROUP_CODE)),
        getDoc(doc(db, 'predictions', `${currentUser.uid}_${GROUP_CODE}`)),
      ]);

      if (!groupSnap.exists()) {
        setError('Grupo no encontrado.');
        return;
      }

      setGroupData(groupSnap.data() as { name: string; code: string });
      setSavedPreds(predSnap.exists() ? (predSnap.data().matches || {}) : {});
      document.title = `${groupSnap.data().name} · Prode 2026`;
    } catch (err: any) {
      setError(`Error al cargar: ${err.message}`);
    }
  }

  function getPredInput(matchId: string, side: 'home' | 'away'): string {
    if (predInputs[matchId]) return predInputs[matchId][side];
    const saved = savedPreds[matchId];
    if (saved && saved[side] != null) return String(saved[side]);
    return '';
  }

  function handleInput(matchId: string, side: 'home' | 'away', value: string) {
    const v = parseInt(value);
    const clamped = value !== '' && !isNaN(v) ? Math.max(0, Math.min(99, v)).toString() : value;
    setPredInputs((prev) => ({
      ...prev,
      [matchId]: {
        home: side === 'home' ? clamped : (prev[matchId]?.home ?? getPredInput(matchId, 'home')),
        away: side === 'away' ? clamped : (prev[matchId]?.away ?? getPredInput(matchId, 'away')),
      },
    }));
    setIsDirty(true);
  }

  async function save() {
    if (!currentUser) return;
    setSaving(true);
    try {
      const updates: Record<string, Pred> = {};
      MATCHES.forEach((m) => {
        const h = predInputs[m.id]?.home ?? (savedPreds[m.id]?.home != null ? String(savedPreds[m.id].home) : '');
        const a = predInputs[m.id]?.away ?? (savedPreds[m.id]?.away != null ? String(savedPreds[m.id].away) : '');
        if (h !== '' && a !== '') updates[m.id] = { home: parseInt(h), away: parseInt(a) };
      });
      const merged = { ...savedPreds, ...updates };

      await setDoc(
        doc(db, 'predictions', `${currentUser.uid}_${GROUP_CODE}`),
        { matches: merged, updatedAt: serverTimestamp(), groupCode: GROUP_CODE },
        { merge: true }
      );
      setSavedPreds(merged);
      setIsDirty(false);
      showToast('✓ Predicciones guardadas', 'success');
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg: string, type = '') {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }

  const matches = MATCHES.filter((m) => m.grupo === activeTab);
  const byMatchday: Record<number, Match[]> = {};
  matches.forEach((m) => {
    if (!byMatchday[m.jornada]) byMatchday[m.jornada] = [];
    byMatchday[m.jornada].push(m);
  });

  const totalFilled = MATCHES.filter((m) => {
    const h = getPredInput(m.id, 'home');
    const a = getPredInput(m.id, 'away');
    return h !== '' && a !== '';
  }).length;

  if (error) {
    return (
      <div className="preds-page">
        <div className="loading-state">
          <p>{error} <Link to="/dashboard" style={{ color: 'var(--gold)' }}>← Volver</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="preds-page">
      {/* NAV */}
      <nav className="preds-nav">
        <div className="nav-in">
          <Link to="/dashboard" className="back-btn">← Mis grupos</Link>
          <div className="nav-group">
            <div className="nav-group-name">{groupData?.name || 'Cargando...'}</div>
            {groupData && <div className="nav-group-code">Código: {GROUP_CODE}</div>}
          </div>
          <button className="btn-logout" onClick={() => signOut(auth).then(() => navigate('/login'))}>Salir</button>
        </div>
      </nav>

      {/* TABS */}
      <div className="tabs-wrap">
        <div className="tabs">
          {GROUP_IDS.map((id) => (
            <div key={id} className={`tab${id === activeTab ? ' active' : ''}`} onClick={() => setActiveTab(id)}>
              Grupo {id}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main>
        <div className="group-header">
          <div className="group-header-left">
            <h2>Grupo {activeTab}</h2>
            <p>Completá el marcador que predecís para cada partido</p>
          </div>
          <div className="save-status">
            <div className={`save-dot${isDirty ? ' unsaved' : ' saved'}`} />
            <span>{isDirty ? 'Cambios sin guardar' : 'Guardado'}</span>
          </div>
        </div>

        {[1, 2, 3].map((jornada) => {
          const ms = byMatchday[jornada] || [];
          if (!ms.length) return null;
          return (
            <div key={jornada} className="matchday">
              <div className="matchday-label">Jornada {jornada} · {formatDate(ms[0].kickoff)}</div>
              {ms.map((m) => {
                const now = Date.now();
                const locked = now >= m.kickoff.getTime();
                const isLive = locked && now < m.kickoff.getTime() + 2 * 60 * 60 * 1000;
                const homeVal = getPredInput(m.id, 'home');
                const awayVal = getPredInput(m.id, 'away');
                const hasPred = homeVal !== '' && awayVal !== '';
                return (
                  <div key={m.id} className={`match-row${hasPred ? ' has-prediction' : ''}${locked ? ' locked' : ''}`}>
                    <div className="match-teams">
                      <div className="team local">
                        <span className="team-flag">{m.local.f}</span>
                        <span className="team-name">{m.local.n}</span>
                      </div>
                      <div className="score-inputs">
                        <input className="score-in" type="number" min={0} max={99} value={homeVal} placeholder="–" disabled={locked}
                          onChange={(e) => handleInput(m.id, 'home', e.target.value)} />
                        <span className="score-sep">:</span>
                        <input className="score-in" type="number" min={0} max={99} value={awayVal} placeholder="–" disabled={locked}
                          onChange={(e) => handleInput(m.id, 'away', e.target.value)} />
                      </div>
                      <div className="team away">
                        <span className="team-flag">{m.visitante.f}</span>
                        <span className="team-name">{m.visitante.n}</span>
                      </div>
                    </div>
                    <div className="match-meta">
                      <span className="match-date">{formatDateTime(m.kickoff)} · {m.sede}</span>
                      <span>{locked && <span className={`lock-badge${isLive ? ' live' : ''}`}>{isLive ? '🔴 En vivo' : '🔒 Cerrado'}</span>}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </main>

      {/* SAVE BAR */}
      <div className="save-bar">
        <div className="save-bar-inner">
          <div className="save-info">
            <strong>{totalFilled}</strong> / {MATCHES.length} predicciones completadas
          </div>
          <button className={`btn-save${saving ? ' loading' : ''}`} disabled={!isDirty || saving} onClick={save}>
            <span className="s-text">Guardar predicciones</span>
            <div className="s-spinner" />
          </button>
        </div>
      </div>

      <div className={`toast ${toast.type}${toast.show ? ' show' : ''}`}>{toast.msg}</div>
    </div>
  );
}
