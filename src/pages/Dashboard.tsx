import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection, doc, getDoc, getDocs, query,
  setDoc, updateDoc, where, arrayUnion, arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { MATCHES, KNOCKOUT_ROUNDS, GRUPOS_DEF, ALL_TEAMS } from '../data/matches';
import type { Match, Team } from '../data/matches';
import { formatDateFull, formatTime, formatDateTime, genCode, TZ } from '../lib/utils';
import BottomNav from '../components/BottomNav';
import ScoreSheet from '../components/ScoreSheet';
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

interface Pred { home: number | null; away: number | null; }

interface KoBracketEntry {
  slot1?: Team | null; slot2?: Team | null;
  kickoff?: any; sede?: string;
  home?: number | null; away?: number | null;
}

interface LbScore {
  name: string; uid: string; pts: number; exact: number; outcome: number; bonusPts: number;
}

interface TeamBonus { n: string; f: string; }
interface BonusPreds { p1: string; p2: string; p3: string; }
interface BonusResults { p1?: TeamBonus; p2?: TeamBonus; p3?: TeamBonus; }

type Phase = {
  id: string; label: string; matches: Match[]; available: boolean; locked: boolean;
};

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Core state ──
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [savedPreds, setSavedPreds] = useState<Record<string, Pred>>({});
  const [knockoutBracket, setKnockoutBracket] = useState<Record<string, KoBracketEntry>>({});
  const [knockoutPhases, setKnockoutPhases] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState('grupos');
  const [predInputs, setPredInputs] = useState<Record<string, { home: string; away: string }>>({});
  // Leaderboard as raw data
  const [lbScores, setLbScores] = useState<LbScore[]>([]);
  const [lbResolved, setLbResolved] = useState(0);
  const [lbLoading, setLbLoading] = useState(true);
  // UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState<'create' | 'join' | null>(null);
  const [pendingCode, setPendingCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '', show: false });
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  // Mobile-specific state
  const [sheetMatch, setSheetMatch] = useState<Match | null>(null);
  const [shareGroup, setShareGroup] = useState<Group | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [manualLocks, setManualLocks] = useState<Record<string, boolean>>({});
  const [bonusPreds, setBonusPreds] = useState<BonusPreds>({ p1: '', p2: '', p3: '' });
  const [bonusRealResults, setBonusRealResults] = useState<BonusResults | null>(null);
  const [bonusSaving, setBonusSaving] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLoading = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Mobile tab from URL ──
  const rawTab = searchParams.get('tab') || 'inicio';
  const mobileTab = (rawTab === 'prode' || rawTab === 'tabla') ? rawTab : 'inicio';

  useEffect(() => { if (!currentUser) navigate('/login', { replace: true }); }, [currentUser, navigate]);

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([loadGroups(), loadPredictions(), loadKnockoutBracket(), loadMatchLocks(), loadBonus()]);
  }, [currentUser]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
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

  async function loadMatchLocks() {
    try {
      const snap = await getDoc(doc(db, 'results', 'matchLocks'));
      setManualLocks(snap.exists() ? snap.data() : {});
    } catch { setManualLocks({}); }
  }

  async function loadBonus() {
    if (!currentUser) return;
    try {
      const [predSnap, realSnap] = await Promise.all([
        getDoc(doc(db, 'predictions', currentUser.uid + '_bonus')),
        getDoc(doc(db, 'results', 'bonusResults')),
      ]);
      if (predSnap.exists()) {
        const d = predSnap.data();
        setBonusPreds({ p1: d.p1?.n || '', p2: d.p2?.n || '', p3: d.p3?.n || '' });
      }
      if (realSnap.exists()) setBonusRealResults(realSnap.data() as BonusResults);
    } catch { /* ignore */ }
  }

  async function saveBonus(preds: BonusPreds) {
    if (!currentUser) return;
    setBonusSaving(true);
    try {
      const toObj = (name: string): TeamBonus | null =>
        ALL_TEAMS.find(t => t.n === name) || null;
      await setDoc(doc(db, 'predictions', currentUser.uid + '_bonus'), {
        p1: toObj(preds.p1), p2: toObj(preds.p2), p3: toObj(preds.p3),
        updatedAt: serverTimestamp(),
      });
      showToast('✓ Podio guardado', 'success');
    } catch { showToast('Error al guardar', 'error'); }
    finally { setBonusSaving(false); }
  }

  async function loadGroups() {
    if (!currentUser) return;
    const q = query(collection(db, 'groups'), where('memberUids', 'array-contains', currentUser.uid));
    try {
      let snap = await getDocs(q);
      let groups = snap.docs.map(d => d.data() as Group);
      groups.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      if (groups.length === 0) {
        await new Promise(r => setTimeout(r, 1500));
        snap = await getDocs(q);
        groups = snap.docs.map(d => d.data() as Group);
        groups.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      }
      if (groups.length === 0) { navigate('/onboarding', { replace: true }); return; }
      setAllGroups(groups);
      setActiveGroup(groups[0]);
      loadLeaderboard(groups[0]);
    } catch { /* ignore */ }
  }

  async function loadLeaderboard(group: Group) {
    setLbLoading(true);
    try {
      const [resultsSnap, bonusResultsSnap] = await Promise.all([
        getDoc(doc(db, 'results', 'matches')),
        getDoc(doc(db, 'results', 'bonusResults')),
      ]);
      const results: Record<string, { home: number; away: number }> = resultsSnap.exists() ? (resultsSnap.data().scores || {}) : {};
      const realBonus: BonusResults | null = bonusResultsSnap.exists() ? bonusResultsSnap.data() as BonusResults : null;
      const resolvedCount = Object.keys(results).length;
      const members = group.members || group.memberUids.map(uid => ({ uid, displayName: uid }));

      const allPreds = await Promise.all(
        members.map(async m => {
          const [predSnap, bonusSnap] = await Promise.all([
            getDoc(doc(db, 'predictions', GLOBAL_PRED_KEY(m.uid))).catch(() => null),
            getDoc(doc(db, 'predictions', m.uid + '_bonus')).catch(() => null),
          ]);
          return {
            member: m,
            preds: predSnap?.exists() ? (predSnap.data().matches || {}) : {},
            bonus: bonusSnap?.exists() ? bonusSnap.data() : null,
          };
        })
      );

      const scores = allPreds.map(({ member, preds, bonus }) => {
        let pts = 0, exact = 0, outcome = 0, bonusPts = 0;
        for (const [matchId, res] of Object.entries(results)) {
          const pred = preds[matchId];
          if (!pred || pred.home == null || pred.away == null) continue;
          if (pred.home === res.home && pred.away === res.away) { pts += 3; exact++; }
          else if (Math.sign(pred.home - pred.away) === Math.sign(res.home - res.away)) { pts += 1; outcome++; }
        }
        if (realBonus && bonus) {
          if (realBonus.p1?.n && bonus.p1?.n === realBonus.p1.n) bonusPts += 10;
          if (realBonus.p2?.n && bonus.p2?.n === realBonus.p2.n) bonusPts += 10;
          if (realBonus.p3?.n && bonus.p3?.n === realBonus.p3.n) bonusPts += 10;
        }
        return { name: member.displayName || member.uid, uid: member.uid, pts: pts + bonusPts, exact, outcome, bonusPts };
      });
      scores.sort((a, b) => b.pts - a.pts || b.exact - a.exact);
      setLbScores(scores);
      setLbResolved(resolvedCount);
    } catch { setLbScores([]); }
    finally { setLbLoading(false); }
  }

  // ── Phases ──
  function buildPhases(): Phase[] {
    const phases: Phase[] = [];
    const groupMatches = [...MATCHES].sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
    phases.push({ id: 'grupos', label: '⚽ Fase de Grupos', matches: groupMatches, available: true, locked: false });
    KNOCKOUT_ROUNDS.forEach(round => {
      const enabled = !!knockoutPhases[round.id];
      const matches: Match[] = [];
      for (let i = 1; i <= round.count; i++) {
        const id = `${round.id}-${i}`;
        const bm = knockoutBracket[id];
        if (bm?.slot1?.n && bm?.slot2?.n) {
          const kickoff = bm.kickoff ? (bm.kickoff.toDate ? bm.kickoff.toDate() : new Date(bm.kickoff)) : new Date('2026-12-31');
          matches.push({ id, grupo: round.id, jornada: i, local: bm.slot1, visitante: bm.slot2, kickoff, sede: bm.sede || '' });
        }
      }
      phases.push({ id: round.id, label: `⚔️ ${round.name}`, matches, available: enabled && matches.length > 0, locked: !enabled });
    });
    phases.push({ id: 'bonus', label: '🏅 Podio Mundial', matches: [], available: true, locked: false });
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
    setPredInputs(prev => ({
      ...prev,
      [matchId]: {
        home: side === 'home' ? clamped : (prev[matchId]?.home ?? getPredInput(matchId, 'home')),
        away: side === 'away' ? clamped : (prev[matchId]?.away ?? getPredInput(matchId, 'away')),
      },
    }));
    setIsDirty(true);
    setSaveStatus('unsaved');
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(savePredictions, 1500);
  }

  // ── Handle sheet save (mobile) ──
  function handleSheetSave(matchId: string, home: number, away: number) {
    setPredInputs(prev => ({ ...prev, [matchId]: { home: String(home), away: String(away) } }));
    setIsDirty(true);
    setSaveStatus('unsaved');
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(savePredictions, 800);
  }

  function collectPreds(): Record<string, Pred> {
    const updates: Record<string, Pred> = {};
    MATCHES.forEach(m => {
      const h = predInputs[m.id]?.home ?? (savedPreds[m.id]?.home != null ? String(savedPreds[m.id].home) : '');
      const a = predInputs[m.id]?.away ?? (savedPreds[m.id]?.away != null ? String(savedPreds[m.id].away) : '');
      if (h !== '' && a !== '') updates[m.id] = { home: parseInt(h), away: parseInt(a) };
    });
    KNOCKOUT_ROUNDS.forEach(round => {
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
    } finally { saveLoading.current = false; }
  }

  function showToast(msg: string, type = '') {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  }

  function openCreateModal() { setPendingCode(genCode()); setGroupName(''); setCreateError(''); setModalOpen('create'); }
  function openJoinModal() { setJoinCode(''); setJoinError(''); setModalOpen('join'); }

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

  function openShareModal(g: Group) {
    setShareGroup(g);
    setMenuOpen(false);
    setLinkCopied(false);
  }

  function getInviteLink(code: string, name?: string) {
    const base = `https://prodemundial26.online/join?code=${code}`;
    return name ? `${base}&name=${encodeURIComponent(name)}` : base;
  }

  function getWhatsAppLink(g: Group) {
    const link = getInviteLink(g.code, g.name);
    const msg = `¡Sumate a mi prode del Mundial 2026! 🏆\n\nEstoy en el grupo *${g.name}* y necesitamos más participantes.\n\nEntrá por acá: ${link}\n\n¡Es gratis y sin instalar nada! ⚽`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }

  function copyInviteLink(code: string) {
    navigator.clipboard.writeText(getInviteLink(code, shareGroup?.name));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function leaveGroup(g: Group) {
    if (!currentUser) return;
    if (!window.confirm(`¿Seguro que querés salir de "${g.name}"?`)) return;
    setMenuOpen(false);
    try {
      const groupRef = doc(db, 'groups', g.code);
      const groupSnap = await getDoc(groupRef);
      if (!groupSnap.exists()) return;
      const currentMembers: any[] = groupSnap.data().members || [];
      const newMembers = currentMembers.filter((m: any) => m.uid !== currentUser.uid);
      await updateDoc(groupRef, {
        memberUids: arrayRemove(currentUser.uid),
        members: newMembers,
      });
      const newGroups = allGroups.filter(x => x.code !== g.code);
      setAllGroups(newGroups);
      if (newGroups.length === 0) { navigate('/onboarding', { replace: true }); return; }
      setActiveGroup(newGroups[0]);
      loadLeaderboard(newGroups[0]);
      showToast(`Saliste de "${g.name}"`, '');
    } catch {
      showToast('Error al salir del grupo. Intentá de nuevo.', 'error');
    }
  }

  // ── Data for renders ──
  const phases = buildPhases();
  const activePhase = phases.find(p => p.id === activePhaseId);
  const totalFilled = Object.values(savedPreds).filter(p => p.home != null && p.away != null).length;
  const medals = ['🥇', '🥈', '🥉'];
  const posClass = ['first', 'second', 'third'];
  const myScore = lbScores.find(s => s.uid === currentUser?.uid);
  const myRank = lbScores.findIndex(s => s.uid === currentUser?.uid) + 1;

  // Next upcoming match
  const now = Date.now();
  const nextMatch = MATCHES.filter(m => m.kickoff.getTime() > now).sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())[0];
  const nextMatchMinsToClose = nextMatch ? Math.floor((nextMatch.kickoff.getTime() - now) / 60000) : 0;

  // Leaderboard table JSX (shared between desktop and mobile tabla tab)
  const lbTableJsx = lbLoading
    ? <div style={{ color: 'var(--muted)', fontSize: '.84rem', display: 'flex', alignItems: 'center', gap: '.6rem' }}><div className="spin-sm" />Calculando puntos...</div>
    : (
      <>
        <table className="lb-table">
          <thead><tr><th>#</th><th>Jugador</th><th>Pts</th><th>Exactos</th><th>Resultado</th></tr></thead>
          <tbody>
            {lbScores.map((s, i) => (
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
          {lbResolved === 0
            ? 'El torneo aún no comenzó · Los puntos se actualizarán cuando haya resultados'
            : `Basado en ${lbResolved} partido${lbResolved !== 1 ? 's' : ''} · Exacto = 3pts · Resultado = 1pt`}
        </p>
      </>
    );

  // ── Mobile tab content renderers ──
  const MobileInicio = () => (
    <div className="mob-inicio">
      {/* Group card */}
      <div className="mob-group-card" ref={menuRef}>
        <div className="mgc-avatar">{activeGroup?.name.charAt(0).toUpperCase() || '?'}</div>
        <div className="mgc-info">
          <div className="mgc-name">{activeGroup?.name || 'Cargando...'}</div>
          <div className="mgc-meta">{activeGroup?.code} · {activeGroup?.memberUids.length || 0} jugadores</div>
        </div>
        <button className="mgc-switch" onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}>⇅</button>
        {menuOpen && (
          <div className="mob-groups-menu" onClick={e => e.stopPropagation()}>
            {allGroups.map(g => (
              <div key={g.code} className={`mgm-item${activeGroup?.code === g.code ? ' active' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }} onClick={() => selectGroup(g)}>
                  <div className="mgm-dot" />
                  <div className="mgm-info">
                    <div className="mgm-name">{g.name}</div>
                    <div className="mgm-meta">{g.code} · {g.memberUids?.length || 1} jugadores</div>
                  </div>
                  {activeGroup?.code === g.code && <span style={{ color: 'var(--gold)', fontSize: '.8rem', flexShrink: 0 }}>✓</span>}
                </div>
                <button
                  className="mgm-share-btn"
                  onClick={e => { e.stopPropagation(); openShareModal(g); }}
                  title={`Invitar a "${g.name}"`}
                >🔗</button>
                <button
                  className="mgm-leave-btn"
                  onClick={e => { e.stopPropagation(); leaveGroup(g); }}
                  title={`Salir de "${g.name}"`}
                >✕</button>
              </div>
            ))}
            <div className="mgm-divider" />
            <div className="mgm-action" onClick={() => { setMenuOpen(false); openCreateModal(); }}>＋ Crear nuevo grupo</div>
            <div className="mgm-action" onClick={() => { setMenuOpen(false); openJoinModal(); }}>🔑 Unirse con código</div>
          </div>
        )}
      </div>

      {/* Leaderboard card */}
      <div className="mob-lb-card">
        <div className="mob-card-header">
          <span className="mob-card-icon">🏆</span>
          <span className="mob-card-title">Tabla de Puntos</span>
          <button className="mob-card-action" onClick={() => setSearchParams({ tab: 'tabla' })}>Ver todos →</button>
        </div>

        {lbLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
            <div className="spin-sm" />Calculando...
          </div>
        ) : lbScores.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin jugadores aún</div>
        ) : (
          <>
            {/* Visual podium top 3 */}
            {lbScores.length >= 2 && (
              <div className="mob-podium">
                {/* 2nd (left) */}
                {lbScores[1] && (
                  <div className="mob-podium-slot second">
                    <div className={`mob-podium-avatar${lbScores[1].uid === currentUser?.uid ? ' me' : ''}`}>{lbScores[1].name.charAt(0).toUpperCase()}</div>
                    <div className="mob-podium-name">{lbScores[1].name.split(' ')[0]}</div>
                    <div className="mob-podium-bar second-bar">
                      <div className="mob-podium-rank">2</div>
                      <div className="mob-podium-pts">{lbScores[1].pts}</div>
                    </div>
                  </div>
                )}
                {/* 1st (center) */}
                <div className="mob-podium-slot first">
                  <div className={`mob-podium-avatar first-avatar${lbScores[0].uid === currentUser?.uid ? ' me' : ''}`}>{lbScores[0].name.charAt(0).toUpperCase()}</div>
                  <div className="mob-podium-name">{lbScores[0].name.split(' ')[0]}</div>
                  <div className="mob-podium-bar first-bar">
                    <div className="mob-podium-rank">1</div>
                    <div className="mob-podium-pts">{lbScores[0].pts}</div>
                  </div>
                </div>
                {/* 3rd (right) */}
                {lbScores[2] && (
                  <div className="mob-podium-slot third">
                    <div className={`mob-podium-avatar${lbScores[2].uid === currentUser?.uid ? ' me' : ''}`}>{lbScores[2].name.charAt(0).toUpperCase()}</div>
                    <div className="mob-podium-name">{lbScores[2].name.split(' ')[0]}</div>
                    <div className="mob-podium-bar third-bar">
                      <div className="mob-podium-rank">3</div>
                      <div className="mob-podium-pts">{lbScores[2].pts}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Remaining rows */}
            {lbScores.slice(3).map((s, i) => (
              <div key={s.uid} className={`mob-lb-row${s.uid === currentUser?.uid ? ' me' : ''}`}>
                <span className="mob-lb-rank">{i + 4}</span>
                <div className="mob-lb-avatar">{s.name.charAt(0).toUpperCase()}</div>
                <span className="mob-lb-name">{s.name.split(' ')[0]}{s.uid === currentUser?.uid && <span className="you-tag">vos</span>}</span>
                <span className="mob-lb-pts">{s.pts}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Próximo partido */}
      {nextMatch && (
        <div className="mob-next-match">
          <div className="mob-nm-header">
            <span className="mob-nm-label">PRÓXIMO PARTIDO</span>
            {nextMatchMinsToClose < 120 && (
              <span className="mob-nm-closing">
                · CIERRA EN {nextMatchMinsToClose}M
              </span>
            )}
          </div>
          <div className="mob-nm-card">
            <div className="mob-nm-team">
              <span className="mob-nm-flag">{nextMatch.local.f}</span>
              <span className="mob-nm-name">{nextMatch.local.n}</span>
            </div>
            <div className="mob-nm-center">
              <div className={`mob-nm-time${nextMatchMinsToClose < 120 ? ' urgent' : ''}`}>
                {formatTime(nextMatch.kickoff)} hs
              </div>
              <div className="mob-nm-vs">VS</div>
              <div className="mob-nm-venue">{nextMatch.sede.split(',')[0]}</div>
            </div>
            <div className="mob-nm-team">
              <span className="mob-nm-flag">{nextMatch.visitante.f}</span>
              <span className="mob-nm-name">{nextMatch.visitante.n}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 100 }} />
    </div>
  );

  const MobileProde = () => {
    const mPhases = buildPhases().filter(p => !p.locked || p.id === 'grupos');
    const mPhase = mPhases.find(p => p.id === activePhaseId) || mPhases[0];

    // All matches for current phase, sorted by date (already sorted for grupos)
    const allMatches = mPhase?.matches || [];

    // Pending = no prediction set
    const pendingCount = mPhase?.id === 'grupos'
      ? MATCHES.filter(m => {
          const h = getPredInput(m.id, 'home');
          const a = getPredInput(m.id, 'away');
          return h === '' || a === '';
        }).length
      : 0;

    // Apply pending filter
    const visibleMatches = showOnlyPending && mPhase?.id === 'grupos'
      ? allMatches.filter(m => {
          const h = getPredInput(m.id, 'home');
          const a = getPredInput(m.id, 'away');
          return h === '' || a === '';
        })
      : allMatches;

    // Group by date for grupos phase
    const byDate: Record<string, Match[]> = {};
    if (mPhase?.id === 'grupos') {
      visibleMatches.forEach(m => {
        const key = m.kickoff.toLocaleDateString('en-CA', { timeZone: TZ });
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(m);
      });
    }

    return (
      <div className="mob-prode">
        {/* Phase pills */}
        <div className="mob-phase-pills">
          {mPhases.map(p => (
            <button
              key={p.id}
              className={`mob-phase-pill${activePhaseId === p.id ? ' active' : ''}`}
              onClick={() => setActivePhaseId(p.id)}
            >
              {p.id === 'grupos' ? 'Grupos' : p.label.replace('⚔️ ', '')}
            </button>
          ))}
        </div>

        {/* Counter + toggle — only for grupos phase */}
        {mPhase?.id === 'grupos' && (
          <div className="mob-pred-header">
            <div className="mob-pred-counter">
              {pendingCount === 0
                ? <><span className="mob-pred-counter-check">✓</span> Todas completadas</>
                : <><strong className="mob-pred-counter-num">{pendingCount}</strong> de {MATCHES.length} partidos sin completar</>
              }
            </div>
            <div className="mob-pred-toggle-row">
              <span className="mob-pred-toggle-label">Solo pendientes</span>
              <button
                className={`mob-pred-switch${showOnlyPending ? ' on' : ''}`}
                onClick={() => setShowOnlyPending(v => !v)}
                aria-pressed={showOnlyPending}
              />
            </div>
          </div>
        )}

        {/* Save status */}
        <div className="mob-save-status">
          <div className={`save-dot ${saveStatus === 'saved' ? 'saved' : 'unsaved'}`} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {saveStatus === 'saved' ? 'Guardado' : 'Guardando...'}
          </span>
        </div>

        {/* Bonus section — mobile */}
        {mPhase?.id === 'bonus' && (
          <div style={{ padding: '0 16px' }}>
            <BonusSection
              bonusPreds={bonusPreds}
              bonusRealResults={bonusRealResults}
              saving={bonusSaving}
              onSave={preds => { setBonusPreds(preds); saveBonus(preds); }}
            />
            <div style={{ height: 100 }} />
          </div>
        )}

        {/* Match cards */}
        {mPhase?.id !== 'bonus' && (mPhase?.locked ? (
          <div className="mob-phase-locked">
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔒</div>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, marginBottom: 4 }}>Fase no disponible</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>El admin todavía no habilitó esta fase.</div>
          </div>
        ) : mPhase?.id === 'grupos' ? (
          Object.keys(byDate).length === 0
            ? <div className="mob-phase-locked" style={{ marginTop: 8 }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>✅</div>
                <div style={{ fontFamily: 'var(--fh)', fontWeight: 700 }}>¡Todo al día!</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>No quedan partidos pendientes.</div>
              </div>
            : Object.entries(byDate).map(([, matches]) => (
              <div key={matches[0].kickoff.toISOString()} className="mob-matchday">
                <div className="mob-matchday-label">{formatDateFull(matches[0].kickoff)}</div>
                {matches.map(m => <MobileMatchCard key={m.id} match={m} />)}
              </div>
            ))
        ) : (
          <div className="mob-matchday">
            {allMatches.length === 0
              ? <div className="mob-phase-locked" style={{ marginTop: 16 }}>⏳ Equipos sin definir todavía</div>
              : allMatches.map(m => <MobileMatchCard key={m.id} match={m} />)}
          </div>
        ))}

        {mPhase?.id !== 'bonus' && <div style={{ height: 100 }} />}
      </div>
    );
  };

  const MobileMatchCard = ({ match }: { match: Match }) => {
    const autoLocked = now >= match.kickoff.getTime();
    const locked = autoLocked || !!manualLocks[match.id];
    const isLive = autoLocked && now < match.kickoff.getTime() + 1.5 * 3600 * 1000;
    const homeVal = getPredInput(match.id, 'home');
    const awayVal = getPredInput(match.id, 'away');
    const hasPred = homeVal !== '' && awayVal !== '';

    function handleTap() {
      if (locked) { showToast('Este partido está cerrado 🔒', ''); return; }
      setSheetMatch(match);
    }

    return (
      <div
        className={`mob-match-card${hasPred ? ' has-pred' : ''}${locked ? ' locked' : ''}`}
        onClick={handleTap}
      >
        <div className="mob-mc-teams">
          <div className="mob-mc-team">
            <span className="mob-mc-flag">{match.local.f}</span>
            <span className="mob-mc-name">{match.local.n}</span>
          </div>

          <div className="mob-mc-center">
            {hasPred ? (
              <div className="mob-mc-score">
                <span>{homeVal}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 400 }}>—</span>
                <span>{awayVal}</span>
              </div>
            ) : locked ? (
              <div className="mob-mc-badge locked">🔒</div>
            ) : isLive ? (
              <div className="mob-mc-badge live">🔴 Vivo</div>
            ) : (
              <div className="mob-mc-badge predecir">PREDECIR +</div>
            )}
          </div>

          <div className="mob-mc-team right">
            <span className="mob-mc-flag">{match.visitante.f}</span>
            <span className="mob-mc-name">{match.visitante.n}</span>
          </div>
        </div>
      </div>
    );
  };

  const MobileTabla = () => (
    <div className="mob-tabla">
      {/* My row pinned */}
      {myScore && (
        <div className="mob-my-row">
          <div className="mob-my-avatar">{myScore.name.charAt(0).toUpperCase()}</div>
          <div className="mob-my-info">
            <div className="mob-my-name">{myScore.name} <span className="you-tag">vos</span></div>
            <div className="mob-my-meta">{myScore.exact} exactos · {myScore.outcome} resultados</div>
          </div>
          <div className="mob-my-pts">{myScore.pts}<div className="mob-my-pts-label">PTS</div></div>
        </div>
      )}

      {/* Full leaderboard */}
      <div className="mob-lb-full">
        <div className="mob-lb-header">
          <span>#</span><span>JUGADOR</span><span>EXC</span><span>RES</span><span>PTS</span>
        </div>
        {lbLoading
          ? <div style={{ padding: 20, color: 'var(--muted)', display: 'flex', gap: 8 }}><div className="spin-sm" />Calculando...</div>
          : lbScores.map((s, i) => (
            <div key={s.uid} className={`mob-lb-row-full${s.uid === currentUser?.uid ? ' me' : ''}`}>
              <span className={`mob-rank-num${i < 3 ? ' top' : ''}`}>{medals[i] || i + 1}</span>
              <div className="mob-player">
                <div className="mob-player-avatar">{s.name.charAt(0).toUpperCase()}</div>
                <span>{s.name.split(' ')[0]}</span>
              </div>
              <span className="mob-exact-num">{s.exact}</span>
              <span style={{ color: 'var(--gold)', fontSize: 13 }}>{s.outcome}</span>
              <span className={`mob-pts-num${i === 0 ? ' leader' : ''}`}>{s.pts}</span>
            </div>
          ))
        }
      </div>
      <div style={{ height: 100 }} />
    </div>
  );

  return (
    <div className="dashboard-page">
      {/* ─── DESKTOP NAV (hidden on mobile) ─── */}
      <nav className="db-nav db-desktop-only">
        <div className="nav-in">
          <Link to="/" className="nav-logo">
            <img src="/logo.png" alt="Logo" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 14px var(--glow)' }} />
            <span>PRODE <span className="gold">2026</span></span>
          </Link>
          <div className="groups-dropdown-wrap" style={{ position: 'relative' }} ref={menuRef}>
            <div className={`groups-btn${menuOpen ? ' open' : ''}`} onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}>
              <div className="gb-dot" />
              <span className="gb-name">{activeGroup?.name || 'Cargando...'}</span>
              <span className="gb-arrow">▼</span>
            </div>
            {menuOpen && (
              <div className="groups-menu open" onClick={e => e.stopPropagation()}>
                {allGroups.map(g => (
                  <div key={g.code} className={`gm-item${activeGroup?.code === g.code ? ' active' : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flex: 1, minWidth: 0 }} onClick={() => selectGroup(g)}>
                      <div className="gm-icon">⚽</div>
                      <div className="gm-info">
                        <div className="gm-name">{g.name}</div>
                        <div className="gm-meta">{g.code} · 👥 {g.memberUids?.length || 1}</div>
                      </div>
                      {activeGroup?.code === g.code && <span className="gm-check">✓</span>}
                    </div>
                    <button
                      className="gm-share-btn"
                      onClick={e => { e.stopPropagation(); openShareModal(g); }}
                      title={`Invitar a "${g.name}"`}
                    >🔗</button>
                    <button
                      className="gm-leave-btn"
                      onClick={e => { e.stopPropagation(); leaveGroup(g); }}
                      title={`Salir de "${g.name}"`}
                    >✕</button>
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

      {/* ─── MOBILE HEADER ─── */}
      <div className="mob-header db-mobile-only">
        <div className="mob-greeting">
          <div className="mob-greeting-avatar">{(currentUser?.displayName || currentUser?.email || '?').charAt(0).toUpperCase()}</div>
          <div>
            <div className="mob-greeting-text">Hola, <strong>{currentUser?.displayName?.split(' ')[0] || 'Jugador'}</strong></div>
            {activeGroup && <div className="mob-greeting-group">{activeGroup.name}</div>}
          </div>
          {currentUser?.email === ADMIN_EMAIL && (
            <Link to="/admin" className="admin-link" style={{ display: 'inline-flex', marginLeft: 'auto' }}>⚙</Link>
          )}
        </div>
      </div>

      {/* ─── DESKTOP CONTENT ─── */}
      <div className="page db-desktop-only">
        {activeGroup && (
          <div className="lb-panel" style={{ display: 'block' }}>
            <div className="lb-panel-header">
              <span style={{ fontSize: '1.1rem' }}>🏆</span>
              <span className="lb-panel-title">Tabla de Puntos</span>
              <span className="lb-group-name">{activeGroup.name}</span>
            </div>
            <div>{lbTableJsx}</div>
          </div>
        )}

        <div className="preds-header">
          <div className="preds-header-left">
            <h2>Mis Predicciones</h2>
            <p>Tus pronósticos valen para todos tus grupos</p>
          </div>
          <div className="save-status">
            <div className={`save-dot ${saveStatus === 'saved' ? 'saved' : 'unsaved'}`} />
            <span>{saveStatus === 'saved' ? 'Guardado automáticamente' : 'Guardando...'}</span>
          </div>
        </div>

        <div className="phase-selector-wrap">
          <select className="phase-select" value={activePhaseId} onChange={e => setActivePhaseId(e.target.value)}>
            {phases.map(p => (
              <option key={p.id} value={p.id}>
                {p.label}{p.locked ? ' 🔒' : (!p.available && p.id !== 'grupos') ? ' (sin definir)' : ''}
              </option>
            ))}
          </select>
          <PhaseCounter phase={activePhase} savedPreds={savedPreds} predInputs={predInputs} getPredInput={getPredInput} />
        </div>

        {/* Bonus section — desktop */}
        {activePhaseId === 'bonus' && (
          <BonusSection
            bonusPreds={bonusPreds}
            bonusRealResults={bonusRealResults}
            saving={bonusSaving}
            onSave={preds => { setBonusPreds(preds); saveBonus(preds); }}
          />
        )}

        {/* Counter + toggle for grupos phase (desktop) */}
        {activePhaseId === 'grupos' && (() => {
          const pending = MATCHES.filter(m => {
            const h = getPredInput(m.id, 'home');
            const a = getPredInput(m.id, 'away');
            return h === '' || a === '';
          }).length;
          return (
            <div className="pred-info-bar">
              <div className="pred-info-counter">
                {pending === 0
                  ? <><span style={{ color: 'var(--green)' }}>✓</span> Todas las predicciones completadas</>
                  : <><strong style={{ color: 'var(--white)' }}>{pending}</strong> de {MATCHES.length} partidos sin completar</>
                }
              </div>
              <div className="pred-info-toggle">
                <span className="pred-toggle-label">Solo pendientes</span>
                <button
                  className={`pred-switch${showOnlyPending ? ' on' : ''}`}
                  onClick={() => setShowOnlyPending(v => !v)}
                  aria-pressed={showOnlyPending}
                />
              </div>
            </div>
          );
        })()}

        {activePhaseId !== 'bonus' && (
          <PredictionsContent
            phase={activePhase}
            savedPreds={savedPreds}
            predInputs={predInputs}
            onInput={handleScoreInput}
            getPredInput={getPredInput}
            showOnlyPending={showOnlyPending}
            manualLocks={manualLocks}
          />
        )}
      </div>

      {/* Desktop save bar */}
      <div className="save-bar db-desktop-only">
        <div className="save-bar-inner">
          <div className="save-info">
            <strong>{totalFilled}</strong> / {MATCHES.length} predicciones completadas
          </div>
          <button className="btn-save" disabled={!isDirty} onClick={savePredictions}>
            <span className="s-text">Guardar predicciones</span>
            <div className="s-spinner" />
          </button>
        </div>
      </div>

      {/* ─── MOBILE CONTENT ─── */}
      <div className="db-mobile-only">
        {mobileTab === 'inicio' && <MobileInicio />}
        {mobileTab === 'prode' && <MobileProde />}
        {mobileTab === 'tabla' && <MobileTabla />}
      </div>

      {/* Bottom nav (mobile only) */}
      <BottomNav />

      {/* Score sheet */}
      {sheetMatch && (
        <ScoreSheet
          match={sheetMatch}
          initialHome={getPredInput(sheetMatch.id, 'home')}
          initialAway={getPredInput(sheetMatch.id, 'away')}
          onSave={handleSheetSave}
          onClose={() => setSheetMatch(null)}
        />
      )}

      {/* Modals */}
      <div className={`modal-overlay${modalOpen === 'create' ? ' open' : ''}`} onClick={() => setModalOpen(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setModalOpen(null)}>✕</button>
          <div className="modal-icon">🏆</div>
          <h2 className="modal-title">Crear nuevo grupo</h2>
          <p className="modal-sub">Elegí un nombre y compartí el código con tus amigos.</p>
          {createError && <div className="modal-error show">{createError}</div>}
          <div className="form-group">
            <label className="form-label">Nombre del grupo</label>
            <input className="form-input" type="text" placeholder="Ej: Los Cracks del Barrio" maxLength={40} value={groupName} onChange={e => setGroupName(e.target.value)} />
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

      <div className={`modal-overlay${modalOpen === 'join' ? ' open' : ''}`} onClick={() => setModalOpen(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setModalOpen(null)}>✕</button>
          <div className="modal-icon">🔑</div>
          <h2 className="modal-title">Unirse a un grupo</h2>
          <p className="modal-sub">Ingresá el código de 6 letras que te compartieron.</p>
          {joinError && <div className="modal-error show">{joinError}</div>}
          <div className="form-group">
            <label className="form-label">Código del grupo</label>
            <input className="form-input" type="text" placeholder="XXXXXX" maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: '.2em', fontSize: '1.1rem', fontFamily: "'Courier New', monospace" }}
              value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
          </div>
          <button className={`btn-modal${modalLoading ? ' loading' : ''}`} onClick={handleJoin} disabled={modalLoading}>
            <span className="btn-text">Unirse al grupo</span>
            <div className="btn-spinner" />
          </button>
        </div>
      </div>

      {/* Share modal */}
      <div className={`modal-overlay${shareGroup ? ' open' : ''}`} onClick={() => setShareGroup(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setShareGroup(null)}>✕</button>
          <div className="modal-icon">🔗</div>
          <h2 className="modal-title">Invitar al grupo</h2>
          <p className="modal-sub">
            Compartí el link y tus amigos se unirán directo sin necesidad de ingresar el código.
          </p>

          {shareGroup && (
            <>
              {/* Group info */}
              <div className="share-group-info">
                <div className="share-group-name">{shareGroup.name}</div>
                <div className="share-code-pill">
                  Código: <strong>{shareGroup.code}</strong>
                </div>
              </div>

              {/* Link preview */}
              <div className="share-link-box">
                <span className="share-link-text">
                  prodemundial26.online/join?code={shareGroup.code}&name=...
                </span>
                <button
                  className={`btn-copy${linkCopied ? ' copied' : ''}`}
                  onClick={() => copyInviteLink(shareGroup.code)}
                >
                  {linkCopied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>

              {/* WhatsApp button */}
              <a
                href={getWhatsAppLink(shareGroup)}
                target="_blank"
                rel="noopener noreferrer"
                className="share-whatsapp-btn"
                onClick={() => setShareGroup(null)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Compartir por WhatsApp
              </a>
            </>
          )}
        </div>
      </div>

      <div className={`toast ${toast.type}${toast.show ? ' show' : ''}`}>{toast.msg}</div>
    </div>
  );
}

// ── Desktop sub-components ──
function PhaseCounter({ phase, savedPreds, predInputs, getPredInput }: {
  phase?: Phase;
  savedPreds: Record<string, any>;
  predInputs: Record<string, { home: string; away: string }>;
  getPredInput: (id: string, side: 'home' | 'away') => string;
}) {
  if (!phase?.available || phase.matches.length === 0) return null;
  const total = phase.matches.length;
  const filled = phase.matches.filter(m => {
    const h = getPredInput(m.id, 'home');
    const a = getPredInput(m.id, 'away');
    return h !== '' && a !== '';
  }).length;
  const complete = filled === total;
  return (
    <span className={`phase-counter${complete ? ' complete' : ''}`}>
      {complete ? '✓ Fase completa' : <><strong>{filled}</strong> / {total} predicciones completadas</>}
    </span>
  );
}

function PredictionsContent({ phase, savedPreds, predInputs, onInput, getPredInput, showOnlyPending, manualLocks = {} }: {
  phase?: Phase;
  savedPreds: Record<string, any>;
  predInputs: Record<string, { home: string; away: string }>;
  onInput: (id: string, side: 'home' | 'away', v: string) => void;
  getPredInput: (id: string, side: 'home' | 'away') => string;
  showOnlyPending?: boolean;
  manualLocks?: Record<string, boolean>;
}) {
  if (!phase) return null;
  if (phase.locked) return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.07)', borderRadius: 16 }}>
      <div style={{ fontSize: '2rem', marginBottom: '.8rem' }}>🔒</div>
      <div style={{ fontWeight: 700, color: 'var(--white)', fontFamily: 'var(--fh)', marginBottom: '.4rem' }}>Fase no disponible</div>
      <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>El administrador todavía no habilitó los pronósticos para esta fase.</div>
    </div>
  );
  if (!phase.available || phase.matches.length === 0) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontSize: '.88rem', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.07)', borderRadius: 16 }}>
      ⏳ Los equipos de esta fase todavía no están definidos
    </div>
  );

  const now = Date.now();
  if (phase.id === 'grupos') {
    // Apply pending filter
    const visibleMatches = showOnlyPending
      ? phase.matches.filter(m => {
          const h = getPredInput(m.id, 'home');
          const a = getPredInput(m.id, 'away');
          return h === '' || a === '';
        })
      : phase.matches;

    const byDate: Record<string, typeof phase.matches> = {};
    visibleMatches.forEach(m => {
      const key = m.kickoff.toLocaleDateString('en-CA', { timeZone: TZ });
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(m);
    });

    if (visibleMatches.length === 0) return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontSize: '.88rem', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.07)', borderRadius: 16 }}>
        ✅ No quedan predicciones pendientes
      </div>
    );

    return (
      <div id="predsContent">
        {Object.values(byDate).map((matches, idx) => (
          <div key={idx} className="date-group">
            <div className="date-label">{formatDateFull(matches[0].kickoff)}</div>
            {matches.map(m => <MatchRow key={m.id} match={m} now={now} homeVal={getPredInput(m.id, 'home')} awayVal={getPredInput(m.id, 'away')} onInput={onInput} manualLocks={manualLocks} />)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div id="predsContent">
      {phase.matches.map(m => <MatchRow key={m.id} match={m} now={now} homeVal={getPredInput(m.id, 'home')} awayVal={getPredInput(m.id, 'away')} onInput={onInput} manualLocks={manualLocks} />)}
    </div>
  );
}

function MatchRow({ match, now, homeVal, awayVal, onInput, manualLocks = {} }: {
  match: Match; now: number; homeVal: string; awayVal: string;
  onInput: (id: string, side: 'home' | 'away', v: string) => void;
  manualLocks?: Record<string, boolean>;
}) {
  const autoLocked = now >= match.kickoff.getTime();
  const locked = autoLocked || !!manualLocks[match.id];
  const isLive = autoLocked && now < match.kickoff.getTime() + 1.5 * 3600 * 1000;
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
            onChange={e => onInput(match.id, 'home', e.target.value)} />
          <span className="score-sep">:</span>
          <input className="score-in" type="number" min={0} max={99} value={awayVal} placeholder="–" disabled={locked}
            onChange={e => onInput(match.id, 'away', e.target.value)} />
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

// ── Bonus section component ──
// Primer partido del Mundial — cierre automático de predicciones bonus
const BONUS_LOCK_DATE = new Date('2026-06-11T19:00:00Z');

function BonusSection({ bonusPreds, bonusRealResults, saving, onSave }: {
  bonusPreds: BonusPreds;
  bonusRealResults: BonusResults | null;
  saving: boolean;
  onSave: (preds: BonusPreds) => void;
}) {
  const [local, setLocal] = useState<BonusPreds>(bonusPreds);

  // Sync if parent state updates (e.g. initial load)
  useState(() => { setLocal(bonusPreds); });

  const autoLocked = Date.now() >= BONUS_LOCK_DATE.getTime();
  // Locked if: the Mundial already started OR the admin published real results
  const isLocked = autoLocked || !!bonusRealResults;

  const positions = [
    { key: 'p1' as const, medal: '🥇', label: 'Campeón' },
    { key: 'p2' as const, medal: '🥈', label: 'Subcampeón' },
    { key: 'p3' as const, medal: '🥉', label: 'Tercer Puesto' },
  ];

  const bonusPtsTotal = bonusRealResults
    ? positions.reduce((acc, { key }) => {
        const correct = bonusRealResults[key]?.n && local[key] === bonusRealResults[key]?.n;
        return acc + (correct ? 10 : 0);
      }, 0)
    : null;

  return (
    <div className="bonus-section">
      <div className="bonus-header">
        <div className="bonus-title">🏅 Podio Mundial</div>
        <div className="bonus-sub">
          Predecí los 3 mejores equipos del Mundial. Cada posición correcta suma <strong>+10 puntos</strong>.
          {autoLocked && !bonusRealResults && (
            <span className="bonus-locked-badge">🔒 Cerrado — el Mundial ya empezó</span>
          )}
        </div>
      </div>

      {positions.map(({ key, medal, label }) => {
        const realTeam = bonusRealResults?.[key];
        const userPick = local[key];
        const isCorrect = realTeam?.n && userPick === realTeam.n;
        const isWrong = realTeam?.n && userPick && userPick !== realTeam.n;

        return (
          <div key={key} className={`bonus-row${isCorrect ? ' correct' : isWrong ? ' wrong' : ''}`}>
            <div className="bonus-row-left">
              <span className="bonus-medal">{medal}</span>
              <span className="bonus-position-label">{label}</span>
            </div>
            <div className="bonus-row-right">
              {realTeam?.n ? (
                // Admin published results — show verdict
                <div className="bonus-result-view">
                  <div className="bonus-user-pick">
                    {userPick
                      ? <><span>{ALL_TEAMS.find(t => t.n === userPick)?.f}</span> {userPick}</>
                      : <span style={{ color: 'var(--muted)', fontSize: 13 }}>Sin predecir</span>}
                  </div>
                  <div className={`bonus-verdict${isCorrect ? ' hit' : ' miss'}`}>
                    {isCorrect ? '✓ +10 pts' : isWrong ? '✗' : '—'}
                  </div>
                  <div className="bonus-real-team">
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Real:</span>
                    {realTeam.f} {realTeam.n}
                  </div>
                </div>
              ) : isLocked ? (
                // Auto-locked (Mundial started) but no results yet — show pick read-only
                <div className="bonus-user-pick" style={{ opacity: 0.7 }}>
                  {userPick
                    ? <><span>{ALL_TEAMS.find(t => t.n === userPick)?.f}</span> {userPick}</>
                    : <span style={{ color: 'var(--muted)', fontSize: 13 }}>Sin predecir</span>}
                </div>
              ) : (
                // Open — editable selector
                <select
                  className="bonus-select"
                  value={local[key]}
                  onChange={e => setLocal(prev => ({ ...prev, [key]: e.target.value }))}
                >
                  <option value="">-- Seleccioná --</option>
                  {ALL_TEAMS.map(t => (
                    <option key={t.n} value={t.n}>{t.f} {t.n}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        );
      })}

      {bonusPtsTotal !== null && (
        <div className="bonus-total">
          <span>Puntos bonus ganados:</span>
          <strong style={{ color: bonusPtsTotal > 0 ? 'var(--gold-l)' : 'var(--muted)' }}>
            +{bonusPtsTotal} pts
          </strong>
        </div>
      )}

      {/* Save button only when open */}
      {!isLocked && (
        <button
          className={`bonus-save-btn${saving ? ' loading' : ''}`}
          disabled={saving || (!local.p1 && !local.p2 && !local.p3)}
          onClick={() => onSave(local)}
        >
          {saving ? 'Guardando...' : 'Guardar Podio'}
        </button>
      )}
    </div>
  );
}
