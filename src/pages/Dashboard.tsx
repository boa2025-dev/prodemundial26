import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { MATCHES, KNOCKOUT_ROUNDS, BRACKET_MAP, GRUPOS_DEF } from '../data/matches';
import type { Match, Team } from '../data/matches';
import { formatDateFull, formatTime, genCode, TZ } from '../lib/utils';
import './Dashboard.css';

const ADMIN_EMAIL = 'bautistaoteroalen2008@gmail.com';
const GLOBAL_PRED_KEY = (uid: string) => `${uid}_global`;

interface Group {
  name: string;
  code: string;
  memberUids: string[];
  members?: { uid: string; displayName: string }[];
  createdAt?: { seconds: number };
}

interface Pred {
  home: number | null;
  away: number | null;
}

interface KoBracketEntry {
  slot1?: Team | null;
  slot2?: Team | null;
  kickoff?: any;
  sede?: string;
  home?: number | null;
  away?: number | null;
}

type Phase = {
  id: string;
  label: string;
  matches: Match[];
  available: boolean;
  locked: boolean;
};

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [savedPreds, setSavedPreds] = useState<Record<string, Pred>>({});
  const [knockoutBracket, setKnockoutBracket] = useState<Record<string, KoBracketEntry>>({});
  const [knockoutPhases, setKnockoutPhases] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState('grupos');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState<'create' | 'join' | null>(null);
  const [pendingCode, setPendingCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [lbContent, setLbContent] = useState<React.ReactNode>(null);
  const [toast, setToast] = useState({ msg: '', type: '', show: false });
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [predInputs, setPredInputs] = useState<Record<string, { home: string; away: string }>>({});
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLoading = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Auth guard ──
  useEffect(() => {
    if (!currentUser) navigate('/login', { replace: true });
  }, [currentUser, navigate]);

  // ── Load all data ──
  useEffect(() => {
    if (!currentUser) return;
    Promise.all([loadGroups(), loadPredictions(), loadKnockoutBracket()]);
  }, [currentUser]);

  // ── Close menu on outside click ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  async function loadPredictions() {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'predictions', GLOBAL_PRED_KEY(currentUser.uid)));
      setSavedPreds(snap.exists() ? (snap.data().matches || {}) : {});
    } catch { setSavedPreds({}); }
  }

  async function loadKnockoutBracket() {
    try {
      const [bracketSnap, phasesSnap] = await Promise.all([
        getDoc(doc(db, 'knockout', 'bracket')),
        getDoc(doc(db, 'knockout', 'phases')),
      ]);
      setKnockoutBracket(bracketSnap.exists() ? bracketSnap.data() : {});
      setKnockoutPhases(phasesSnap.exists() ? phasesSnap.data() : {});
    } catch { setKnockoutBracket({}); setKnockoutPhases({}); }
  }

  async function loadGroups() {
    if (!currentUser) return;
    const q = query(collection(db, 'groups'), where('memberUids', 'array-contains', currentUser.uid));
    try {
      let snap = await getDocs(q);
      let groups = snap.docs.map((d) => d.data() as Group);
      groups.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      if (groups.length === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        snap = await getDocs(q);
        groups = snap.docs.map((d) => d.data() as Group);
        groups.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      }

      if (groups.length === 0) { navigate('/onboarding', { replace: true }); return; }
      setAllGroups(groups);
      setActiveGroup(groups[0]);
      loadLeaderboard(groups[0]);
    } catch { /* error loading groups */ }
  }

  async function loadLeaderboard(group: Group) {
    setLbContent(<div style={{ color: 'var(--muted)', fontSize: '.84rem', display: 'flex', alignItems: 'center', gap: '.6rem' }}><div className="spin-sm" />Calculando puntos...</div>);
    try {
      const resultsSnap = await getDoc(doc(db, 'results', 'matches'));
      const results: Record<string, { home: number; away: number }> = resultsSnap.exists() ? (resultsSnap.data().scores || {}) : {};
      const resolvedCount = Object.keys(results).length;
      const members = group.members || group.memberUids.map((uid) => ({ uid, displayName: uid }));

      const allPreds = await Promise.all(
        members.map((m) =>
          getDoc(doc(db, 'predictions', GLOBAL_PRED_KEY(m.uid)))
            .then((snap) => ({ member: m, preds: snap.exists() ? (snap.data().matches || {}) : {} }))
            .catch(() => ({ member: m, preds: {} }))
        )
      );

      const scores = allPreds.map(({ member, preds }) => {
        let pts = 0, exact = 0, outcome = 0;
        for (const [matchId, res] of Object.entries(results)) {
          const pred = preds[matchId];
          if (!pred || pred.home == null || pred.away == null) continue;
          if (pred.home === res.home && pred.away === res.away) { pts += 3; exact++; }
          else if (Math.sign(pred.home - pred.away) === Math.sign(res.home - res.away)) { pts += 1; outcome++; }
        }
        return { name: member.displayName || member.uid, uid: member.uid, pts, exact, outcome };
      });
      scores.sort((a, b) => b.pts - a.pts || b.exact - a.exact);

      const medals = ['🥇', '🥈', '🥉'];
      const posClass = ['first', 'second', 'third'];

      setLbContent(
        <>
          <table className="lb-table">
            <thead><tr><th>#</th><th>Jugador</th><th>Pts</th><th>Exactos</th><th>Resultado</th></tr></thead>
            <tbody>
              {scores.map((s, i) => (
                <tr key={s.uid}>
                  <td className={`lb-pos ${posClass[i] || ''}`}>{medals[i] || i + 1}</td>
                  <td className="lb-name">{s.name}{s.uid === currentUser?.uid && <span className="you-tag">vos</span>}</td>
                  <td className={`lb-pts${i === 0 ? ' leader' : ''}`}>{s.pts}</td>
                  <td className="lb-exact">{s.exact}</td>
                  <td className="lb-outcome">{s.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="lb-note">
            {resolvedCount === 0
              ? 'El torneo aún no comenzó · Los puntos se actualizarán cuando haya resultados'
              : `Basado en ${resolvedCount} partido${resolvedCount !== 1 ? 's' : ''} con resultado · Exacto = 3pts · Resultado = 1pt`}
          </p>
        </>
      );
    } catch (err: any) {
      setLbContent(<p className="lb-no-results">Error: {err.message}</p>);
    }
  }

  function buildPhases(): Phase[] {
    const phases: Phase[] = [];
    const groupMatches = [...MATCHES].sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
    phases.push({ id: 'grupos', label: '⚽ Fase de Grupos', matches: groupMatches, available: true, locked: false });

    KNOCKOUT_ROUNDS.forEach((round) => {
      const enabled = !!knockoutPhases[round.id];
      const matches: Match[] = [];
      for (let i = 1; i <= round.count; i++) {
        const id = `${round.id}-${i}`;
        const bm = knockoutBracket[id];
        if (bm?.slot1?.n && bm?.slot2?.n) {
          const kickoff = bm.kickoff
            ? (bm.kickoff.toDate ? bm.kickoff.toDate() : new Date(bm.kickoff))
            : new Date('2026-12-31');
          matches.push({ id, grupo: round.id, jornada: i, local: bm.slot1, visitante: bm.slot2, kickoff, sede: bm.sede || '' });
        }
      }
      phases.push({ id: round.id, label: `⚔️ ${round.name}`, matches, available: enabled && matches.length > 0, locked: !enabled });
    });
    return phases;
  }

  function getPredInput(matchId: string, side: 'home' | 'away'): string {
    if (predInputs[matchId]) return predInputs[matchId][side];
    const saved = savedPreds[matchId];
    if (saved && saved[side] != null) return String(saved[side]);
    return '';
  }

  function handleScoreInput(matchId: string, side: 'home' | 'away', value: string) {
    const v = parseInt(value);
    const clamped = value !== '' && !isNaN(v) ? Math.max(0, Math.min(99, v)).toString() : value;
    setPredInputs((prev) => ({
      ...prev,
      [matchId]: { home: side === 'home' ? clamped : (prev[matchId]?.home ?? getPredInput(matchId, 'home')), away: side === 'away' ? clamped : (prev[matchId]?.away ?? getPredInput(matchId, 'away')) },
    }));
    setIsDirty(true);
    setSaveStatus('unsaved');
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(savePredictions, 1500);
  }

  function collectPreds(): Record<string, Pred> {
    const updates: Record<string, Pred> = {};
    MATCHES.forEach((m) => {
      const h = predInputs[m.id]?.home ?? (savedPreds[m.id]?.home != null ? String(savedPreds[m.id].home) : '');
      const a = predInputs[m.id]?.away ?? (savedPreds[m.id]?.away != null ? String(savedPreds[m.id].away) : '');
      if (h !== '' && a !== '') updates[m.id] = { home: parseInt(h), away: parseInt(a) };
    });
    KNOCKOUT_ROUNDS.forEach((round) => {
      for (let i = 1; i <= round.count; i++) {
        const id = `${round.id}-${i}`;
        const h = predInputs[id]?.home ?? (savedPreds[id]?.home != null ? String(savedPreds[id].home) : '');
        const a = predInputs[id]?.away ?? (savedPreds[id]?.away != null ? String(savedPreds[id].away) : '');
        if (h !== '' && a !== '') updates[id] = { home: parseInt(h), away: parseInt(a) };
      }
    });
    return { ...savedPreds, ...updates };
  }

  async function savePredictions() {
    if (!currentUser || saveLoading.current) return;
    saveLoading.current = true;
    setSaveStatus('saving');
    try {
      const merged = collectPreds();
      await setDoc(doc(db, 'predictions', GLOBAL_PRED_KEY(currentUser.uid)), { matches: merged, updatedAt: serverTimestamp() }, { merge: true });
      setSavedPreds(merged);
      setIsDirty(false);
      setSaveStatus('saved');
      if (activeGroup) loadLeaderboard(activeGroup);
    } catch (err: any) {
      setSaveStatus('unsaved');
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      saveLoading.current = false;
    }
  }

  function showToast(msg: string, type = '') {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }

  function openCreateModal() {
    setPendingCode(genCode());
    setGroupName('');
    setCreateError('');
    setModalOpen('create');
  }

  function openJoinModal() {
    setJoinCode('');
    setJoinError('');
    setModalOpen('join');
  }

  async function handleCreate() {
    setCreateError('');
    if (!groupName.trim()) { setCreateError('Poné un nombre al grupo.'); return; }
    setModalLoading(true);
    try {
      let code = pendingCode;
      const existing = await getDoc(doc(db, 'groups', code));
      if (existing.exists()) { code = genCode(); setPendingCode(code); }
      await setDoc(doc(db, 'groups', code), {
        name: groupName.trim(), code, createdBy: currentUser!.uid,
        members: [{ uid: currentUser!.uid, displayName: currentUser!.displayName || currentUser!.email }],
        memberUids: [currentUser!.uid], createdAt: serverTimestamp(),
      });
      setModalOpen(null);
      showToast('¡Grupo creado! 🎉', 'success');
      await loadGroups();
    } catch { setCreateError('Error al crear el grupo.'); }
    finally { setModalLoading(false); }
  }

  async function handleJoin() {
    setJoinError('');
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setJoinError('El código debe tener 6 letras.'); return; }
    setModalLoading(true);
    try {
      const groupDoc = await getDoc(doc(db, 'groups', code));
      if (!groupDoc.exists()) { setJoinError('No existe ningún grupo con ese código.'); return; }
      const data = groupDoc.data();
      if (!data.memberUids?.includes(currentUser!.uid)) {
        await updateDoc(doc(db, 'groups', code), {
          memberUids: arrayUnion(currentUser!.uid),
          members: arrayUnion({ uid: currentUser!.uid, displayName: currentUser!.displayName || currentUser!.email }),
        });
      }
      setModalOpen(null);
      showToast(`¡Te uniste a "${data.name}"! 🙌`, 'success');
      await loadGroups();
    } catch { setJoinError('Error al unirse.'); }
    finally { setModalLoading(false); }
  }

  function selectGroup(g: Group) {
    setActiveGroup(g);
    setMenuOpen(false);
    loadLeaderboard(g);
  }

  const phases = buildPhases();
  const activePhase = phases.find((p) => p.id === activePhaseId);
  const totalFilled = Object.values(savedPreds).filter((p) => p.home != null && p.away != null).length;

  return (
    <div className="dashboard-page">
      {/* NAV */}
      <nav>
        <div className="nav-in">
          <Link to="/" className="nav-logo">
            <img src="/logo.png" alt="Logo" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 14px var(--glow)' }} />
            <span>PRODE <span className="gold">2026</span></span>
          </Link>

          {/* Groups dropdown */}
          <div className="groups-dropdown-wrap" style={{ position: 'relative' }} ref={menuRef}>
            <div className={`groups-btn${menuOpen ? ' open' : ''}`} onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}>
              <div className="gb-dot" />
              <span className="gb-name">{activeGroup?.name || 'Cargando...'}</span>
              <span className="gb-arrow">▼</span>
            </div>
            {menuOpen && (
              <div className="groups-menu open" onClick={(e) => e.stopPropagation()}>
                {allGroups.map((g) => (
                  <div key={g.code} className={`gm-item${activeGroup?.code === g.code ? ' active' : ''}`} onClick={() => selectGroup(g)}>
                    <div className="gm-icon">⚽</div>
                    <div className="gm-info">
                      <div className="gm-name">{g.name}</div>
                      <div className="gm-meta">{g.code} · 👥 {g.memberUids?.length || 1}</div>
                    </div>
                    {activeGroup?.code === g.code && <span className="gm-check">✓</span>}
                  </div>
                ))}
                <div className="gm-divider" />
                <div className="gm-action create" onClick={() => { setMenuOpen(false); openCreateModal(); }}>
                  <div className="gm-action-icon">＋</div> Crear nuevo grupo
                </div>
                <div className="gm-action join" onClick={() => { setMenuOpen(false); openJoinModal(); }}>
                  <div className="gm-action-icon">🔑</div> Unirse con código
                </div>
              </div>
            )}
          </div>

          <div className="nav-right">
            <span className="user-name">{currentUser?.displayName || currentUser?.email}</span>
            {currentUser?.email === ADMIN_EMAIL && (
              <Link to="/admin" className="admin-link" style={{ display: 'inline-flex' }}>⚙ Admin</Link>
            )}
            <button className="btn-logout" onClick={() => signOut(auth).then(() => navigate('/login'))}>Salir</button>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <div className="page">
        {/* Leaderboard */}
        {activeGroup && (
          <div className="lb-panel" style={{ display: 'block' }}>
            <div className="lb-panel-header">
              <span style={{ fontSize: '1.1rem' }}>🏆</span>
              <span className="lb-panel-title">Tabla de Puntos</span>
              <span className="lb-group-name">{activeGroup.name}</span>
            </div>
            <div id="lbContent">{lbContent}</div>
          </div>
        )}

        {/* Header */}
        <div className="preds-header">
          <div className="preds-header-left">
            <h2>Mis Predicciones</h2>
            <p>Tus pronósticos valen para todos tus grupos</p>
          </div>
          <div className="save-status">
            <div className={`save-dot ${saveStatus === 'saved' ? 'saved' : 'unsaved'}`} />
            <span>
              {saveStatus === 'saved' ? 'Guardado automáticamente' : 'Guardando...'}
            </span>
          </div>
        </div>

        {/* Phase selector */}
        <div className="phase-selector-wrap">
          <select className="phase-select" value={activePhaseId} onChange={(e) => setActivePhaseId(e.target.value)}>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}{p.locked ? ' 🔒' : (!p.available && p.id !== 'grupos') ? ' (sin definir)' : ''}
              </option>
            ))}
          </select>
          <PhaseCounter phase={activePhase} savedPreds={savedPreds} predInputs={predInputs} />
        </div>

        {/* Predictions content */}
        <PredictionsContent
          phase={activePhase}
          savedPreds={savedPreds}
          predInputs={predInputs}
          onInput={handleScoreInput}
          getPredInput={getPredInput}
        />
      </div>

      {/* Save bar */}
      <div className="save-bar">
        <div className="save-bar-inner">
          <div className="save-info" id="saveInfo">
            <strong>{totalFilled}</strong> / {MATCHES.length} predicciones completadas
          </div>
          <button className={`btn-save${!isDirty ? '' : ''}`} disabled={!isDirty} onClick={savePredictions}>
            <span className="s-text">Guardar predicciones</span>
            <div className="s-spinner" />
          </button>
        </div>
      </div>

      {/* Modal Create */}
      <div className={`modal-overlay${modalOpen === 'create' ? ' open' : ''}`} onClick={() => setModalOpen(null)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setModalOpen(null)}>✕</button>
          <div className="modal-icon">🏆</div>
          <h2 className="modal-title">Crear nuevo grupo</h2>
          <p className="modal-sub">Elegí un nombre y compartí el código con tus amigos.</p>
          {createError && <div className="modal-error show">{createError}</div>}
          <div className="form-group">
            <label className="form-label">Nombre del grupo</label>
            <input className="form-input" type="text" placeholder="Ej: Los Cracks del Barrio" maxLength={40} value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Código de invitación</label>
            <div className="code-display">
              <span className="code-val">{pendingCode}</span>
              <button className="btn-copy" onClick={() => navigator.clipboard.writeText(pendingCode)}>Copiar</button>
            </div>
          </div>
          <button className={`btn-modal${modalLoading ? ' loading' : ''}`} onClick={handleCreate} disabled={modalLoading}>
            <span className="btn-text">Crear grupo</span>
            <div className="btn-spinner" />
          </button>
        </div>
      </div>

      {/* Modal Join */}
      <div className={`modal-overlay${modalOpen === 'join' ? ' open' : ''}`} onClick={() => setModalOpen(null)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setModalOpen(null)}>✕</button>
          <div className="modal-icon">🔑</div>
          <h2 className="modal-title">Unirse a un grupo</h2>
          <p className="modal-sub">Ingresá el código de 6 letras que te compartieron.</p>
          {joinError && <div className="modal-error show">{joinError}</div>}
          <div className="form-group">
            <label className="form-label">Código del grupo</label>
            <input className="form-input" type="text" placeholder="XXXXXX" maxLength={6} style={{ textTransform: 'uppercase', letterSpacing: '.2em', fontSize: '1.1rem', fontFamily: "'Courier New', monospace" }} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
          </div>
          <button className={`btn-modal${modalLoading ? ' loading' : ''}`} onClick={handleJoin} disabled={modalLoading}>
            <span className="btn-text">Unirse al grupo</span>
            <div className="btn-spinner" />
          </button>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast ${toast.type}${toast.show ? ' show' : ''}`}>{toast.msg}</div>
    </div>
  );
}

function PhaseCounter({ phase, savedPreds, predInputs }: { phase?: Phase; savedPreds: Record<string, Pred>; predInputs: Record<string, { home: string; away: string }> }) {
  if (!phase?.available || phase.matches.length === 0) return null;
  const total = phase.matches.length;
  const filled = phase.matches.filter((m) => {
    const h = predInputs[m.id]?.home ?? (savedPreds[m.id]?.home != null ? String(savedPreds[m.id].home) : '');
    const a = predInputs[m.id]?.away ?? (savedPreds[m.id]?.away != null ? String(savedPreds[m.id].away) : '');
    return h !== '' && a !== '';
  }).length;
  const complete = filled === total;
  return (
    <span className={`phase-counter${complete ? ' complete' : ''}`}>
      {complete ? '✓ Fase completa' : <><strong>{filled}</strong> / {total} predicciones completadas</>}
    </span>
  );
}

function PredictionsContent({ phase, savedPreds, predInputs, onInput, getPredInput }: {
  phase?: Phase;
  savedPreds: Record<string, Pred>;
  predInputs: Record<string, { home: string; away: string }>;
  onInput: (matchId: string, side: 'home' | 'away', value: string) => void;
  getPredInput: (matchId: string, side: 'home' | 'away') => string;
}) {
  if (!phase) return null;
  if (phase.locked) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.07)', borderRadius: 16 }}>
        <div style={{ fontSize: '2rem', marginBottom: '.8rem' }}>🔒</div>
        <div style={{ fontWeight: 700, color: 'var(--white)', fontFamily: 'var(--fh)', marginBottom: '.4rem' }}>Fase no disponible</div>
        <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>El administrador todavía no habilitó los pronósticos para esta fase.</div>
      </div>
    );
  }
  if (!phase.available || phase.matches.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontSize: '.88rem', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.07)', borderRadius: 16 }}>
        ⏳ Los equipos de esta fase todavía no están definidos
      </div>
    );
  }

  const now = Date.now();

  if (phase.id === 'grupos') {
    const byDate: Record<string, Match[]> = {};
    phase.matches.forEach((m) => {
      const key = m.kickoff.toLocaleDateString('en-CA', { timeZone: TZ });
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(m);
    });
    return (
      <div id="predsContent">
        {Object.values(byDate).map((matches, idx) => (
          <div key={idx} className="date-group">
            <div className="date-label">{formatDateFull(matches[0].kickoff)}</div>
            {matches.map((m) => (
              <MatchRow key={m.id} match={m} now={now} homeVal={getPredInput(m.id, 'home')} awayVal={getPredInput(m.id, 'away')} onInput={onInput} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div id="predsContent">
      {phase.matches.map((m) => (
        <MatchRow key={m.id} match={m} now={now} homeVal={getPredInput(m.id, 'home')} awayVal={getPredInput(m.id, 'away')} onInput={onInput} />
      ))}
    </div>
  );
}

function MatchRow({ match, now, homeVal, awayVal, onInput }: {
  match: Match;
  now: number;
  homeVal: string;
  awayVal: string;
  onInput: (id: string, side: 'home' | 'away', v: string) => void;
}) {
  const locked = now >= match.kickoff.getTime();
  const isLive = locked && now < match.kickoff.getTime() + 1.5 * 3600 * 1000;
  const hasPred = homeVal !== '' && awayVal !== '';

  return (
    <div className={`match-row${hasPred ? ' has-prediction' : ''}${locked ? ' locked' : ''}`} data-id={match.id}>
      <div className="match-teams">
        <div className="team local">
          <span className="team-flag">{match.local.f}</span>
          <span className="team-name">{match.local.n}</span>
        </div>
        <div className="score-inputs">
          <input className="score-in" type="number" min={0} max={99} value={homeVal} placeholder="–" disabled={locked}
            onChange={(e) => onInput(match.id, 'home', e.target.value)} />
          <span className="score-sep">:</span>
          <input className="score-in" type="number" min={0} max={99} value={awayVal} placeholder="–" disabled={locked}
            onChange={(e) => onInput(match.id, 'away', e.target.value)} />
        </div>
        <div className="team away">
          <span className="team-flag">{match.visitante.f}</span>
          <span className="team-name">{match.visitante.n}</span>
        </div>
      </div>
      <div className="match-meta">
        <span>{formatTime(match.kickoff)} hs{locked && ' · '}{locked && <span className={`lock-badge${isLive ? ' live' : ''}`}>{isLive ? '🔴 En vivo' : '🔒 Cerrado'}</span>}</span>
        <span className="match-venue">{match.sede}</span>
      </div>
    </div>
  );
}
