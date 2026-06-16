import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { MATCHES, GRUPOS_DEF, KNOCKOUT_ROUNDS, BRACKET_MAP, ALL_TEAMS } from '../data/matches';
import type { Team } from '../data/matches';
import { formatDate, formatDateTime } from '../lib/utils';
import './Admin.css';

const ADMIN_EMAIL = 'bautistaoteroalen2008@gmail.com';

interface GroupPreview {
  name: string;
  code: string;
  memberUids: string[];
  members?: { uid: string; displayName: string }[];
  createdAt?: { seconds: number };
}

interface ScoreEntry {
  name: string;
  uid: string;
  pts: number;
  exact: number;
  outcome: number;
  predictedPct: number;
}

interface KoEntry {
  slot1?: Team | null;
  slot2?: Team | null;
  kickoff?: Date | null;
  sede?: string;
  home?: number | null;
  away?: number | null;
}

export default function Admin() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'groups' | 'knockout' | 'preview' | 'bonus' | 'global'>('groups');
  const [allGroups, setAllGroups] = useState<GroupPreview[]>([]);
  const [bonusInputs, setBonusInputs] = useState<{ p1: string; p2: string; p3: string }>({ p1: '', p2: '', p3: '' });
  const [bonusSaving, setBonusSaving] = useState(false);
  const [savedResults, setSavedResults] = useState<Record<string, { home: number; away: number }>>({});
  const [savedKnockout, setSavedKnockout] = useState<Record<string, KoEntry>>({});
  const [savedPhases, setSavedPhases] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '', show: false });
  const [loaded, setLoaded] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [matchLocks, setMatchLocks] = useState<Record<string, boolean>>({});
  const [groupInputs, setGroupInputs] = useState<Record<string, { home: string; away: string }>>({});
  const [koInputs, setKoInputs] = useState<Record<string, { s1f: string; s1n: string; s2f: string; s2n: string; kickoff: string; sede: string; home: string; away: string }>>({});

  useEffect(() => {
    if (!currentUser) { navigate('/login', { replace: true }); return; }
    if (currentUser.email !== ADMIN_EMAIL) { setAccessDenied(true); return; }
    loadAll();
  }, [currentUser]);

  async function loadAll() {
    try {
      const [resSnap, koSnap, phasesSnap, locksSnap, groupsSnap, bonusSnap] = await Promise.all([
        getDoc(doc(db, 'results', 'matches')),
        getDoc(doc(db, 'knockout', 'bracket')),
        getDoc(doc(db, 'knockout', 'phases')),
        getDoc(doc(db, 'results', 'matchLocks')),
        getDocs(collection(db, 'groups')),
        getDoc(doc(db, 'results', 'bonusResults')),
      ]);
      const results = resSnap.exists() ? (resSnap.data().scores || {}) : {};
      const knockout = koSnap.exists() ? koSnap.data() : {};
      const phases = phasesSnap.exists() ? phasesSnap.data() : {};
      const locks = locksSnap.exists() ? locksSnap.data() : {};

      setSavedResults(results);
      setSavedKnockout(knockout);
      setSavedPhases(phases);
      setMatchLocks(locks);
      const groups = groupsSnap.docs.map(d => d.data() as GroupPreview);
      groups.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAllGroups(groups);
      if (bonusSnap.exists()) {
        const b = bonusSnap.data();
        setBonusInputs({ p1: b.p1?.n || '', p2: b.p2?.n || '', p3: b.p3?.n || '' });
      }

      // Init group inputs from saved results
      const gi: typeof groupInputs = {};
      MATCHES.forEach((m) => {
        const r = results[m.id];
        gi[m.id] = { home: r?.home != null ? String(r.home) : '', away: r?.away != null ? String(r.away) : '' };
      });
      setGroupInputs(gi);

      // Init ko inputs
      const ki: typeof koInputs = {};
      KNOCKOUT_ROUNDS.forEach((round) => {
        for (let i = 1; i <= round.count; i++) {
          const id = `${round.id}-${i}`;
          const m = knockout[id] || {};
          let kickoffVal = '';
          if (m.kickoff) {
            const d = m.kickoff.toDate ? m.kickoff.toDate() : new Date(m.kickoff);
            kickoffVal = d.toISOString().slice(0, 16);
          }
          ki[id] = {
            s1f: m.slot1?.f || '', s1n: m.slot1?.n || '',
            s2f: m.slot2?.f || '', s2n: m.slot2?.n || '',
            kickoff: kickoffVal, sede: m.sede || '',
            home: m.home != null ? String(m.home) : '',
            away: m.away != null ? String(m.away) : '',
          };
        }
      });
      setKoInputs(ki);
      setLoaded(true);
    } catch (err: any) {
      showToast('Error al cargar: ' + err.message, 'error');
    }
  }

  function showToast(msg: string, type = '') {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }

  function calcGroupStandings() {
    const standings: Record<string, { team: Team; pts: number; gf: number; ga: number; gd: number }[]> = {};
    GRUPOS_DEF.forEach(({ id, equipos }) => {
      const stats: Record<string, { team: Team; pts: number; gf: number; ga: number; gd: number }> = {};
      equipos.forEach((eq) => { stats[eq.n] = { team: eq, pts: 0, gf: 0, ga: 0, gd: 0 }; });
      MATCHES.filter((m) => m.grupo === id).forEach((m) => {
        const res = savedResults[m.id] || (groupInputs[m.id]?.home !== '' && groupInputs[m.id]?.away !== '' ? { home: parseInt(groupInputs[m.id].home), away: parseInt(groupInputs[m.id].away) } : null);
        if (!res || res.home == null || res.away == null) return;
        const { home: h, away: a } = res;
        stats[m.local.n].gf += h; stats[m.local.n].ga += a; stats[m.local.n].gd += h - a;
        stats[m.visitante.n].gf += a; stats[m.visitante.n].ga += h; stats[m.visitante.n].gd += a - h;
        if (h > a) stats[m.local.n].pts += 3;
        else if (h < a) stats[m.visitante.n].pts += 3;
        else { stats[m.local.n].pts += 1; stats[m.visitante.n].pts += 1; }
      });
      standings[id] = Object.values(stats).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    });
    return standings;
  }

  function resolveSlot(slotKey: string, standings: Record<string, any[]>, best8thirds: any[], ko: Record<string, KoEntry>): Team | null {
    const gpMatch = slotKey.match(/^([1-4])([A-L])$/);
    if (gpMatch) return standings[gpMatch[2]]?.[parseInt(gpMatch[1]) - 1]?.team || null;
    const t3Match = slotKey.match(/^T3-(\d+)$/);
    if (t3Match) return best8thirds[parseInt(t3Match[1]) - 1]?.team || null;
    const winMatch = slotKey.match(/^W([A-Z0-9]+)-(\d+)$/);
    if (winMatch) {
      const prev = ko[`${winMatch[1]}-${winMatch[2]}`];
      if (!prev || prev.home == null || prev.away == null || !prev.slot1 || !prev.slot2) return null;
      return prev.home >= prev.away ? prev.slot1 : prev.slot2;
    }
    const loseMatch = slotKey.match(/^L([A-Z0-9]+)-(\d+)$/);
    if (loseMatch) {
      const prev = ko[`${loseMatch[1]}-${loseMatch[2]}`];
      if (!prev || prev.home == null || prev.away == null || !prev.slot1 || !prev.slot2) return null;
      return prev.home < prev.away ? prev.slot1 : prev.slot2;
    }
    return null;
  }

  function autoPopulateBracket(currentKo: Record<string, KoEntry>): { updated: Record<string, KoEntry>; filled: number } {
    const standings = calcGroupStandings();
    const allThirds = GRUPOS_DEF.map(({ id }) => standings[id]?.[2]).filter(Boolean);
    allThirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    const best8thirds = allThirds.slice(0, 8);
    const updated = { ...currentKo };
    let filled = 0;
    for (const [matchId, map] of Object.entries(BRACKET_MAP)) {
      const existing = updated[matchId] || {};
      const t1 = resolveSlot(map.s1, standings, best8thirds, updated);
      const t2 = resolveSlot(map.s2, standings, best8thirds, updated);
      if (t1 || t2) {
        updated[matchId] = { kickoff: existing.kickoff || map.kickoff || null, sede: existing.sede || map.sede || '', ...existing, slot1: t1 || existing.slot1 || null, slot2: t2 || existing.slot2 || null };
        if (t1 && t2) filled++;
      } else if (!existing.kickoff && map.kickoff) {
        updated[matchId] = { ...existing, kickoff: map.kickoff, sede: map.sede || '' };
      }
    }
    return { updated, filled };
  }

  function sanitizeEntry(entry: KoEntry) {
    const out: Record<string, any> = {};
    if (entry.kickoff != null) out.kickoff = entry.kickoff;
    if (entry.sede) out.sede = entry.sede;
    if (entry.home != null) out.home = entry.home;
    if (entry.away != null) out.away = entry.away;
    if (entry.slot1?.n) out.slot1 = { n: entry.slot1.n, f: entry.slot1.f || '' };
    if (entry.slot2?.n) out.slot2 = { n: entry.slot2.n, f: entry.slot2.f || '' };
    return out;
  }

  async function saveBonusResults() {
    setBonusSaving(true);
    try {
      const toObj = (name: string) => ALL_TEAMS.find(t => t.n === name) || null;
      await setDoc(doc(db, 'results', 'bonusResults'), {
        p1: toObj(bonusInputs.p1),
        p2: toObj(bonusInputs.p2),
        p3: toObj(bonusInputs.p3),
        updatedAt: serverTimestamp(),
      });
      showToast('✓ Podio guardado', 'success');
    } catch { showToast('Error al guardar', 'error'); }
    finally { setBonusSaving(false); }
  }

  async function toggleMatchLock(matchId: string, locked: boolean) {
    const updated = { ...matchLocks, [matchId]: locked };
    setMatchLocks(updated);
    try {
      await setDoc(doc(db, 'results', 'matchLocks'), updated);
      showToast(locked ? `🔒 Partido bloqueado` : `🔓 Partido desbloqueado`, 'success');
    } catch {
      setMatchLocks(matchLocks); // revert on error
      showToast('Error al guardar el bloqueo', 'error');
    }
  }

  async function save() {
    setSaving(true);
    try {
      if (phase === 'groups') await saveGroupResults();
      else await saveKnockout();
      setIsDirty(false);
      showToast('✓ Guardado correctamente', 'success');
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveGroupResults() {
    const updates: Record<string, { home: number; away: number }> = {};
    MATCHES.forEach((m) => {
      const h = groupInputs[m.id]?.home;
      const a = groupInputs[m.id]?.away;
      if (h !== '' && a !== '' && h != null && a != null) updates[m.id] = { home: parseInt(h), away: parseInt(a) };
    });
    const merged = { ...savedResults, ...updates };
    await setDoc(doc(db, 'results', 'matches'), { scores: merged, updatedAt: serverTimestamp(), updatedBy: currentUser!.email }, { merge: true });
    setSavedResults(merged);

    const { updated: koUpdated, filled } = autoPopulateBracket(savedKnockout);
    const koPayload: Record<string, any> = { updatedAt: serverTimestamp(), updatedBy: currentUser!.email };
    for (const [id, entry] of Object.entries(koUpdated)) {
      const clean = sanitizeEntry(entry);
      if (Object.keys(clean).length > 0) koPayload[id] = clean;
    }
    await setDoc(doc(db, 'knockout', 'bracket'), koPayload, { merge: true });
    setSavedKnockout(koUpdated);
  }

  async function saveKnockout() {
    const updated: Record<string, KoEntry> = { ...savedKnockout };
    KNOCKOUT_ROUNDS.forEach((round) => {
      for (let i = 1; i <= round.count; i++) {
        const id = `${round.id}-${i}`;
        const inp = koInputs[id];
        if (!inp) return;
        const existing = updated[id] || {};
        updated[id] = {
          ...existing,
          slot1: inp.s1n ? { n: inp.s1n, f: inp.s1f } : existing.slot1 || null,
          slot2: inp.s2n ? { n: inp.s2n, f: inp.s2f } : existing.slot2 || null,
          kickoff: inp.kickoff ? new Date(inp.kickoff) : existing.kickoff || null,
          sede: inp.sede || existing.sede || '',
          ...(inp.home !== '' && inp.away !== '' ? { home: parseInt(inp.home), away: parseInt(inp.away) } : { home: existing.home ?? null, away: existing.away ?? null }),
        };
      }
    });

    const prev = savedKnockout;
    setSavedKnockout(updated);
    const { updated: autoUpdated, filled } = autoPopulateBracket(updated);
    setSavedKnockout(prev);

    for (const [id, autoMatch] of Object.entries(autoUpdated)) {
      if (!updated[id]) updated[id] = autoMatch;
      else {
        if (autoMatch.slot1?.n) updated[id].slot1 = autoMatch.slot1;
        if (autoMatch.slot2?.n) updated[id].slot2 = autoMatch.slot2;
      }
    }

    const payload: Record<string, any> = { updatedAt: serverTimestamp(), updatedBy: currentUser!.email };
    for (const [id, entry] of Object.entries(updated)) {
      const clean = sanitizeEntry(entry);
      if (Object.keys(clean).length > 0) payload[id] = clean;
    }
    await setDoc(doc(db, 'knockout', 'bracket'), payload, { merge: true });
    setSavedKnockout(updated);
  }

  async function togglePhase(roundId: string, enabled: boolean) {
    const updated = { ...savedPhases, [roundId]: enabled };
    setSavedPhases(updated);
    try {
      await setDoc(doc(db, 'knockout', 'phases'), updated, { merge: false });
    } catch (err: any) {
      setSavedPhases({ ...updated, [roundId]: !enabled });
      showToast('Error al guardar: ' + err.message, 'error');
    }
  }

  async function toggleBonusOpen(enabled: boolean) {
    const updated = { ...savedPhases, bonusOpen: enabled };
    setSavedPhases(updated);
    try {
      await setDoc(doc(db, 'knockout', 'phases'), updated, { merge: false });
      showToast(enabled ? '🔓 Podio abierto' : '🔒 Podio cerrado', 'success');
    } catch (err: any) {
      setSavedPhases({ ...updated, bonusOpen: !enabled });
      showToast('Error al guardar: ' + err.message, 'error');
    }
  }

  if (accessDenied) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ fontFamily: 'var(--fh)', fontSize: '1.3rem', fontWeight: 800, marginBottom: '.5rem' }}>Acceso restringido</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginBottom: '1.5rem' }}>Solo el administrador puede acceder a este panel.</p>
          <Link to="/dashboard" style={{ color: 'var(--gold)' }}>← Volver al dashboard</Link>
        </div>
      </div>
    );
  }

  const totalGroupDone = Object.keys(savedResults).filter((id) => !id.includes('-')).length;
  const totalKo = KNOCKOUT_ROUNDS.reduce((s, r) => s + r.count, 0);
  const doneBracket = Object.keys(savedKnockout).filter((id) => {
    const m = savedKnockout[id];
    return m?.slot1?.n && m?.slot2?.n;
  }).length;

  return (
    <div className="admin-page">
      {/* NAV */}
      <nav>
        <div className="nav-in">
          <Link to="/dashboard" className="back-btn">← Dashboard</Link>
          <div className="nav-center">
            <span className="nav-title">PANEL <span className="gold">ADMIN</span></span>
            <span className="admin-badge">ADMIN</span>
          </div>
          <button className="btn-logout" onClick={() => signOut(auth).then(() => navigate('/login'))}>Salir</button>
        </div>
      </nav>

      <div className="admin-shell">
        {/* Phase switcher */}
        <div className="phase-switcher">
          <div className="phase-tabs">
            <div className={`phase-tab${phase === 'groups' ? ' active' : ''}`} onClick={() => { if (isDirty && !confirm('Cambios sin guardar. ¿Cambiar?')) return; setIsDirty(false); setPhase('groups'); }}>⚽ Fase de Grupos</div>
            <div className={`phase-tab${phase === 'knockout' ? ' active' : ''}`} onClick={() => { if (isDirty && !confirm('Cambios sin guardar. ¿Cambiar?')) return; setIsDirty(false); setPhase('knockout'); }}>⚔️ Eliminatorias</div>
            <div className={`phase-tab${phase === 'preview' ? ' active' : ''}`} onClick={() => { if (isDirty && !confirm('Cambios sin guardar. ¿Cambiar?')) return; setIsDirty(false); setPhase('preview'); }}>👥 Grupos</div>
            <div className={`phase-tab${phase === 'bonus' ? ' active' : ''}`} onClick={() => { if (isDirty && !confirm('Cambios sin guardar. ¿Cambiar?')) return; setIsDirty(false); setPhase('bonus'); }}>🏅 Podio</div>
            <div className={`phase-tab${phase === 'global' ? ' active' : ''}`} onClick={() => { if (isDirty && !confirm('Cambios sin guardar. ¿Cambiar?')) return; setIsDirty(false); setPhase('global'); }}>🌍 Podio Global</div>
          </div>
        </div>

        <main>
        <AdminStats
          totalGroupDone={totalGroupDone}
          totalGroupMatches={MATCHES.length}
          doneBracket={doneBracket}
          totalKo={totalKo}
          groupsCount={allGroups.length}
          bonusOpen={savedPhases.bonusOpen !== false}
        />
        {!loaded ? (
          <div className="loading-state"><div className="spinner-lg" /></div>
        ) : phase === 'groups' ? (
          <GroupPhase
            savedResults={savedResults}
            inputs={groupInputs}
            matchLocks={matchLocks}
            onInput={(matchId, side, val) => {
              setGroupInputs((prev) => ({ ...prev, [matchId]: { ...prev[matchId], [side]: val } }));
              setIsDirty(true);
            }}
            onToggleLock={toggleMatchLock}
          />
        ) : phase === 'preview' ? (
          <AllGroupsPreview groups={allGroups} savedResults={savedResults} />
        ) : phase === 'bonus' ? (
          <AdminBonusSection
            inputs={bonusInputs}
            saving={bonusSaving}
            onSave={() => saveBonusResults()}
            onChange={setBonusInputs}
            bonusOpen={savedPhases.bonusOpen !== false}
            onToggleBonus={toggleBonusOpen}
          />
        ) : phase === 'global' ? (
          <AdminGlobalPodium
            savedResults={savedResults}
            savedKnockout={savedKnockout}
            allGroups={allGroups}
          />
        ) : (
          <KnockoutPhase
            savedResults={savedResults}
            savedKnockout={savedKnockout}
            savedPhases={savedPhases}
            inputs={koInputs}
            onInput={(id, field, val) => {
              setKoInputs((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
              setIsDirty(true);
            }}
            onTogglePhase={togglePhase}
          />
        )}
        </main>
      </div>

      {/* Save bar — hidden in preview mode */}
      <div className="save-bar" style={(phase === 'preview' || phase === 'bonus' || phase === 'global') ? { display: 'none' } : {}}>
        <div className="save-bar-inner">
          <div className="save-info">
            {phase === 'groups'
              ? <><strong>{totalGroupDone}</strong> / {MATCHES.length} resultados cargados</>
              : <><strong>{doneBracket}</strong> / {totalKo} partidos configurados</>
            }
          </div>
          <button className={`btn-save admin-save${saving ? ' loading' : ''}`} disabled={!isDirty || saving} onClick={save}>
            <span className="s-text s-text-desktop">Guardar</span>
            <span className="s-text s-text-mobile">Guardar Resultados</span>
            <div className="s-spinner" />
          </button>
        </div>
      </div>

      <div className={`toast ${toast.type}${toast.show ? ' show' : ''}`}>{toast.msg}</div>
    </div>
  );
}

// ─────────────────────────────────────────
// STAT CARDS
// ─────────────────────────────────────────
function AdminStats({ totalGroupDone, totalGroupMatches, doneBracket, totalKo, groupsCount, bonusOpen }: {
  totalGroupDone: number;
  totalGroupMatches: number;
  doneBracket: number;
  totalKo: number;
  groupsCount: number;
  bonusOpen: boolean;
}) {
  return (
    <div className="admin-stats">
      <div className="admin-stat-card">
        <div className="admin-stat-value">{totalGroupDone}/{totalGroupMatches}</div>
        <div className="admin-stat-label">Resultados de grupos</div>
      </div>
      <div className="admin-stat-card">
        <div className="admin-stat-value">{doneBracket}/{totalKo}</div>
        <div className="admin-stat-label">Partidos eliminatoria</div>
      </div>
      <div className="admin-stat-card">
        <div className="admin-stat-value">{groupsCount}</div>
        <div className="admin-stat-label">Grupos creados</div>
      </div>
      <div className="admin-stat-card">
        <div className={`admin-stat-value${bonusOpen ? ' on' : ''}`}>{bonusOpen ? 'Abierto' : 'Cerrado'}</div>
        <div className="admin-stat-label">Podio</div>
      </div>
    </div>
  );
}

function GroupPhase({ savedResults, inputs, matchLocks, onInput, onToggleLock }: {
  savedResults: Record<string, { home: number; away: number }>;
  inputs: Record<string, { home: string; away: string }>;
  matchLocks: Record<string, boolean>;
  onInput: (matchId: string, side: 'home' | 'away', val: string) => void;
  onToggleLock: (matchId: string, locked: boolean) => void;
}) {
  const matches = [...MATCHES].sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
  const byDay: Record<string, typeof matches> = {};
  matches.forEach((m) => {
    const key = formatDate(m.kickoff);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(m);
  });
  const now = Date.now();

  return (
    <div>
      <div className="section-hdr">
        <div className="section-hdr-left">
          <h2>Fase de Grupos</h2>
          <p>Ingresá el marcador final · El candado manual bloquea predicciones antes del inicio</p>
        </div>
      </div>
      {Object.entries(byDay).map(([day, ms]) => {
        return (
          <div key={day} className="matchday">
            <div className="matchday-label">{day}</div>
            {ms.map((m) => {
              const hv = inputs[m.id]?.home ?? (savedResults[m.id]?.home != null ? String(savedResults[m.id].home) : '');
              const av = inputs[m.id]?.away ?? (savedResults[m.id]?.away != null ? String(savedResults[m.id].away) : '');
              const done = hv !== '' && av !== '';
              const autoLocked = now >= m.kickoff.getTime();
              const manualLocked = !!matchLocks[m.id];
              const isLocked = autoLocked || manualLocked;
              return (
                <div key={m.id} className={`match-row${done ? ' has-result' : ''}${isLocked ? ' admin-locked' : ''}`}>
                  <div className="match-teams">
                    <span className="group-badge">Grupo {m.grupo}</span>
                    <div className="team local"><span className="team-flag">{m.local.f}</span><span className="team-name">{m.local.n}</span></div>
                    <div className="score-inputs">
                      <input className="score-in admin-score" type="number" min={0} max={99} value={hv} placeholder="–"
                        onChange={(e) => onInput(m.id, 'home', e.target.value)} />
                      <span className="score-sep">:</span>
                      <input className="score-in admin-score" type="number" min={0} max={99} value={av} placeholder="–"
                        onChange={(e) => onInput(m.id, 'away', e.target.value)} />
                    </div>
                    <div className="team away"><span className="team-flag">{m.visitante.f}</span><span className="team-name">{m.visitante.n}</span></div>
                  </div>
                  <div className="match-meta admin-match-meta">
                    <span>{formatDateTime(m.kickoff)}</span>

                    {/* Lock toggle */}
                    <div className={`match-lock-toggle${isLocked ? ' locked' : ''}`}>
                      {autoLocked ? (
                        <span className="lock-auto-badge">🔒 Auto</span>
                      ) : (
                        <label className="match-lock-label">
                          <span className={`lock-label-text${manualLocked ? ' on' : ''}`}>
                            {manualLocked ? '🔒 Bloqueado' : '🔓 Abierto'}
                          </span>
                          <div className="match-lock-switch-wrap">
                            <input
                              type="checkbox"
                              checked={manualLocked}
                              onChange={(e) => onToggleLock(m.id, e.target.checked)}
                              className="match-lock-checkbox"
                            />
                            <span className="match-lock-track" />
                          </div>
                        </label>
                      )}
                    </div>

                    <span>{done ? <span className="result-badge">✓ Guardado</span> : <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>Pendiente</span>}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function KnockoutPhase({ savedResults, savedKnockout, savedPhases, inputs, onInput, onTogglePhase }: {
  savedResults: Record<string, any>;
  savedKnockout: Record<string, KoEntry>;
  savedPhases: Record<string, boolean>;
  inputs: Record<string, any>;
  onInput: (id: string, field: string, val: string) => void;
  onTogglePhase: (roundId: string, enabled: boolean) => void;
}) {
  const groupResultsCount = Object.keys(savedResults).filter((id) => !id.includes('-')).length;
  const totalGroupMatches = MATCHES.length;
  const allGroupsDone = groupResultsCount === totalGroupMatches;
  const someGroupsDone = groupResultsCount > 0;

  return (
    <div>
      <div className="section-hdr">
        <div className="section-hdr-left">
          <h2>Eliminatorias</h2>
          <p>Los equipos se completan automáticamente según los resultados de grupos.</p>
        </div>
      </div>

      {allGroupsDone
        ? <div className="auto-status show">✓ Todos los resultados de grupos están cargados. El bracket se calcula automáticamente.</div>
        : someGroupsDone
        ? <div className="auto-warn show">⚡ Fase de grupos incompleta ({groupResultsCount}/{totalGroupMatches}). El bracket se completa a medida que se cargan resultados.</div>
        : <div className="auto-warn show">📋 Cargá los resultados de la fase de grupos para que el bracket se complete automáticamente.</div>
      }

      {KNOCKOUT_ROUNDS.map((round) => {
        const isOn = !!savedPhases[round.id];
        return (
          <div key={round.id} className="ko-round">
            <div className="ko-round-hdr">
              <span style={{ fontSize: '1rem' }}>⚔️</span>
              <span className="ko-round-title">{round.name}</span>
              <div className="ko-round-line" />
              <div className="phase-toggle-wrap">
                <span className={`phase-toggle-label${isOn ? ' on' : ''}`}>{isOn ? 'Abierto' : 'Cerrado'}</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={isOn} onChange={(e) => onTogglePhase(round.id, e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>
            {Array.from({ length: round.count }, (_, i) => {
              const id = `${round.id}-${i + 1}`;
              const inp = inputs[id] || { s1f: '', s1n: '', s2f: '', s2n: '', kickoff: '', sede: '', home: '', away: '' };
              const m = savedKnockout[id] || {};
              const configured = !!(inp.s1n || m.slot1?.n) && !!(inp.s2n || m.slot2?.n);
              const hasResult = inp.home !== '' && inp.away !== '';
              return (
                <div key={id} className={`ko-match${configured ? ' configured' : ''}${hasResult ? ' has-result' : ''}`}>
                  <div className="ko-match-num">
                    Partido {round.short} #{i + 1}
                    {hasResult && <span className="result-badge" style={{ marginLeft: '.5rem' }}>✓ Resultado</span>}
                    {!hasResult && configured && <span style={{ marginLeft: '.5rem', fontSize: '.68rem', color: 'var(--gold)' }}>● Configurado</span>}
                  </div>
                  <div className="ko-teams-row">
                    <div className="ko-team-inputs">
                      <input className="ko-input ko-flag-in" type="text" maxLength={4} value={inp.s1f} placeholder="🏳" onChange={(e) => onInput(id, 's1f', e.target.value)} />
                      <input className="ko-input ko-name-in" type="text" maxLength={30} value={inp.s1n} placeholder="Equipo 1" onChange={(e) => onInput(id, 's1n', e.target.value)} />
                    </div>
                    <span className="ko-vs">VS</span>
                    <div className="ko-team-inputs">
                      <input className="ko-input ko-flag-in" type="text" maxLength={4} value={inp.s2f} placeholder="🏳" onChange={(e) => onInput(id, 's2f', e.target.value)} />
                      <input className="ko-input ko-name-in" type="text" maxLength={30} value={inp.s2n} placeholder="Equipo 2" onChange={(e) => onInput(id, 's2n', e.target.value)} />
                    </div>
                  </div>
                  <div className="ko-bottom-row">
                    <input className="ko-input ko-date-in" type="datetime-local" value={inp.kickoff} onChange={(e) => onInput(id, 'kickoff', e.target.value)} />
                    <input className="ko-input ko-venue-in" type="text" maxLength={50} value={inp.sede} placeholder="Estadio / Sede" onChange={(e) => onInput(id, 'sede', e.target.value)} />
                    <div className="ko-score-wrap">
                      <span className="ko-score-label">Resultado:</span>
                      <input className="score-in admin-score ko-input" type="number" min={0} max={30} value={inp.home} placeholder="–" style={{ color: 'var(--green)' }} onChange={(e) => onInput(id, 'home', e.target.value)} />
                      <span className="score-sep">:</span>
                      <input className="score-in admin-score ko-input" type="number" min={0} max={30} value={inp.away} placeholder="–" style={{ color: 'var(--green)' }} onChange={(e) => onInput(id, 'away', e.target.value)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────
// GROUPS PREVIEW
// ─────────────────────────────────────────
function AllGroupsPreview({
  groups,
  savedResults,
}: {
  groups: GroupPreview[];
  savedResults: Record<string, { home: number; away: number }>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [groupScores, setGroupScores] = useState<Record<string, ScoreEntry[]>>({});
  const [loadingScores, setLoadingScores] = useState<Record<string, boolean>>({});

  async function loadScores(group: GroupPreview) {
    if (groupScores[group.code] || loadingScores[group.code]) return;
    setLoadingScores(prev => ({ ...prev, [group.code]: true }));
    try {
      const members = group.members || group.memberUids.map(uid => ({ uid, displayName: uid }));
      const allPreds = await Promise.all(
        members.map(m =>
          getDoc(doc(db, 'predictions', `${m.uid}_global`))
            .then(snap => ({ member: m, preds: snap.exists() ? (snap.data().matches || {}) : {} }))
            .catch(() => ({ member: m, preds: {} as Record<string, any> }))
        )
      );
      const scores: ScoreEntry[] = allPreds.map(({ member, preds }) => {
        let pts = 0, exact = 0, outcome = 0;
        for (const [matchId, res] of Object.entries(savedResults)) {
          const pred = preds[matchId];
          if (!pred || pred.home == null || pred.away == null) continue;
          if (pred.home === res.home && pred.away === res.away) { pts += 3; exact++; }
          else if (Math.sign(pred.home - pred.away) === Math.sign(res.home - res.away)) { pts += 1; outcome++; }
        }
        const predictedCount = MATCHES.filter(m => {
          const pred = preds[m.id];
          return pred && pred.home != null && pred.away != null;
        }).length;
        const predictedPct = Math.round((predictedCount / MATCHES.length) * 100);
        return { name: member.displayName || member.uid, uid: member.uid, pts, exact, outcome, predictedPct };
      });
      scores.sort((a, b) => b.pts - a.pts || b.exact - a.exact);
      setGroupScores(prev => ({ ...prev, [group.code]: scores }));
    } catch { /* ignore */ }
    finally { setLoadingScores(prev => ({ ...prev, [group.code]: false })); }
  }

  function toggle(group: GroupPreview) {
    if (expanded === group.code) { setExpanded(null); return; }
    setExpanded(group.code);
    loadScores(group);
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <div className="section-hdr">
        <div className="section-hdr-left">
          <h2>Vista de Grupos</h2>
          <p>
            {groups.length === 0
              ? 'No hay grupos creados todavía'
              : `${groups.length} grupo${groups.length !== 1 ? 's' : ''} en el prode · Clic para ver el ranking`}
          </p>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="loading-state" style={{ padding: '3rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>👥</div>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>Ningún usuario ha creado un grupo todavía</div>
        </div>
      )}

      {groups.map(group => {
        const isOpen = expanded === group.code;
        const scores = groupScores[group.code];
        const loading = loadingScores[group.code];

        return (
          <div key={group.code} className={`preview-group-card${isOpen ? ' open' : ''}`}>
            <div className="pgc-header" onClick={() => toggle(group)}>
              <div className="pgc-avatar">{group.name.charAt(0).toUpperCase()}</div>
              <div className="pgc-info">
                <div className="pgc-name">{group.name}</div>
                <div className="pgc-meta">
                  <span className="pgc-code">{group.code}</span>
                  <span>·</span>
                  <span>👥 {group.memberUids.length} jugador{group.memberUids.length !== 1 ? 'es' : ''}</span>
                  {group.createdAt && (
                    <>
                      <span>·</span>
                      <span>{new Date(group.createdAt.seconds * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                    </>
                  )}
                </div>
              </div>
              <span className={`pgc-chevron${isOpen ? ' up' : ''}`}>›</span>
            </div>

            {isOpen && (
              <div className="pgc-body">
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 0', color: 'var(--muted)', fontSize: 13 }}>
                    <div className="spin-sm" /> Calculando puntos...
                  </div>
                ) : scores && scores.length > 0 ? (
                  <table className="lb-table">
                    <thead>
                      <tr><th>#</th><th>Jugador</th><th>Pts</th><th>Exactos</th><th>Result.</th><th>Pronosticado</th></tr>
                    </thead>
                    <tbody>
                      {scores.map((s, i) => (
                        <tr key={s.uid}>
                          <td className={`lb-pos${i < 3 ? ` ${['first','second','third'][i]}` : ''}`}>{medals[i] || i + 1}</td>
                          <td className="lb-name" style={{ fontSize: '.84rem' }}>{s.name}</td>
                          <td className={`lb-pts${i === 0 ? ' leader' : ''}`}>{s.pts}</td>
                          <td className="lb-exact">{s.exact}</td>
                          <td className="lb-outcome">{s.outcome}</td>
                          <td className={`lb-pct${s.predictedPct === 100 ? ' complete' : ''}`}>{s.predictedPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '.5rem 0 1rem', color: 'var(--muted)', fontSize: 13 }}>
                    Los puntos aparecerán cuando haya resultados de partidos cargados.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────
// ADMIN BONUS SECTION
// ─────────────────────────────────────────
function AdminBonusSection({ inputs, saving, onSave, onChange, bonusOpen, onToggleBonus }: {
  inputs: { p1: string; p2: string; p3: string };
  saving: boolean;
  onSave: () => void;
  onChange: (v: { p1: string; p2: string; p3: string }) => void;
  bonusOpen: boolean;
  onToggleBonus: (enabled: boolean) => void;
}) {
  const positions = [
    { key: 'p1' as const, medal: '🥇', label: 'Campeón del Mundial' },
    { key: 'p2' as const, medal: '🥈', label: 'Subcampeón' },
    { key: 'p3' as const, medal: '🥉', label: 'Tercer Puesto' },
  ];

  return (
    <div>
      <div className="section-hdr">
        <div className="section-hdr-left">
          <h2>Podio Mundial</h2>
          <p>Ingresá los 3 primeros puestos reales del Mundial. Acertar cada posición suma 5 pts al jugador.</p>
        </div>
      </div>

      <div className="admin-bonus-card">
        <div className="ko-round-hdr" style={{ marginTop: 0, marginBottom: '1.2rem' }}>
          <span style={{ fontSize: '1rem' }}>🏅</span>
          <span className="ko-round-title">Predicción de podio para usuarios</span>
          <div className="ko-round-line" />
          <div className="phase-toggle-wrap">
            <span className={`phase-toggle-label${bonusOpen ? ' on' : ''}`}>{bonusOpen ? 'Abierto' : 'Cerrado'}</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={bonusOpen} onChange={(e) => onToggleBonus(e.target.checked)} />
              <span className="toggle-track" />
            </label>
          </div>
        </div>

        {positions.map(({ key, medal, label }) => (
          <div key={key} className="admin-bonus-row">
            <div className="admin-bonus-left">
              <span style={{ fontSize: '1.6rem' }}>{medal}</span>
              <div>
                <div className="admin-bonus-label">{label}</div>
                {inputs[key] && (
                  <div className="admin-bonus-selected">
                    {ALL_TEAMS.find(t => t.n === inputs[key])?.f} {inputs[key]}
                  </div>
                )}
              </div>
            </div>
            <select
              className="admin-bonus-select"
              value={inputs[key]}
              onChange={e => onChange({ ...inputs, [key]: e.target.value })}
            >
              <option value="">-- Sin definir --</option>
              {ALL_TEAMS.map(t => (
                <option key={t.n} value={t.n}>{t.f} {t.n}</option>
              ))}
            </select>
          </div>
        ))}

        <button
          className={`btn-save admin-save${saving ? ' loading' : ''}`}
          style={{ marginTop: '1.5rem' }}
          disabled={saving}
          onClick={onSave}
        >
          <span className="s-text">Guardar Podio</span>
          <div className="s-spinner" />
        </button>

        <p style={{ marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          ⚠️ Una vez guardado, los usuarios verán el resultado y no podrán cambiar sus predicciones.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// GLOBAL PODIUM
// ─────────────────────────────────────────
interface GlobalScore {
  uid: string;
  name: string;
  pts: number;
  exact: number;
  outcome: number;
  predictedPct: number;
  preds: Record<string, any>;
}

function calcPts(pred: any, home: number, away: number): number {
  if (!pred || pred.home == null || pred.away == null) return 0;
  if (pred.home === home && pred.away === away) return 3;
  if (Math.sign(pred.home - pred.away) === Math.sign(home - away)) return 1;
  return 0;
}

function AdminGlobalPodium({ savedResults, savedKnockout, allGroups }: {
  savedResults: Record<string, { home: number; away: number }>;
  savedKnockout: Record<string, KoEntry>;
  allGroups: GroupPreview[];
}) {
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<GlobalScore[]>([]);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const medals = ['🥇', '🥈', '🥉'];

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const userMap = new Map<string, string>();
    allGroups.forEach(g => {
      const members = g.members || g.memberUids.map(uid => ({ uid, displayName: uid }));
      members.forEach((m: { uid: string; displayName: string }) => {
        if (!userMap.has(m.uid)) userMap.set(m.uid, m.displayName || m.uid);
      });
    });
    const uids = Array.from(userMap.keys());
    if (!uids.length) { setLoading(false); return; }

    const data = await Promise.all(
      uids.map(uid =>
        getDoc(doc(db, 'predictions', `${uid}_global`))
          .then(snap => ({ uid, name: userMap.get(uid)!, preds: snap.exists() ? (snap.data().matches || {}) : {} }))
          .catch(() => ({ uid, name: userMap.get(uid)!, preds: {} as Record<string, any> }))
      )
    );

    const result: GlobalScore[] = data.map(({ uid, name, preds }) => {
      let pts = 0, exact = 0, outcome = 0;
      for (const [id, res] of Object.entries(savedResults)) {
        const p = calcPts(preds[id], res.home, res.away);
        pts += p; if (p === 3) exact++; else if (p === 1) outcome++;
      }
      for (const [id, m] of Object.entries(savedKnockout)) {
        if (m.home == null || m.away == null) continue;
        const p = calcPts(preds[id], m.home!, m.away!);
        pts += p; if (p === 3) exact++; else if (p === 1) outcome++;
      }
      const predictedPct = Math.round(
        (MATCHES.filter(m => { const p = preds[m.id]; return p && p.home != null && p.away != null; }).length / MATCHES.length) * 100
      );
      return { uid, name, pts, exact, outcome, predictedPct, preds };
    });

    result.sort((a, b) => b.pts - a.pts || b.exact - a.exact);
    setScores(result);
    setLoading(false);
  }

  if (loading) return <div className="loading-state"><div className="spinner-lg" /></div>;

  const top3 = scores.slice(0, 3);
  const playedCount = Object.keys(savedResults).length;

  return (
    <div>
      <div className="section-hdr">
        <div className="section-hdr-left">
          <h2>Podio Global</h2>
          <p>{scores.length} jugadores en total · {playedCount} partido{playedCount !== 1 ? 's' : ''} con resultado</p>
        </div>
      </div>

      {/* Visual podium top 3 */}
      {top3.length > 0 && (
        <div className="gp-podium">
          {([1, 0, 2] as const).map(idx => {
            const s = scores[idx];
            if (!s) return <div key={idx} className="gp-podium-slot" />;
            return (
              <div key={idx} className={`gp-podium-slot place-${idx + 1}`} onClick={() => setExpandedUid(expandedUid === s.uid ? null : s.uid)}>
                <div className="gp-medal">{medals[idx]}</div>
                <div className={`gp-avatar${expandedUid === s.uid ? ' active' : ''}`}>{s.name.charAt(0).toUpperCase()}</div>
                <div className="gp-name">{s.name.split(' ')[0]}</div>
                <div className={`gp-bar bar-${idx + 1}`}>
                  <div className="gp-bar-pts">{s.pts} pts</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full ranked list */}
      <div className="gp-list">
        {scores.map((s, i) => (
          <div key={s.uid}>
            <div
              className={`gp-row${expandedUid === s.uid ? ' expanded' : ''}`}
              onClick={() => setExpandedUid(expandedUid === s.uid ? null : s.uid)}
            >
              <span className={`gp-row-pos${i < 3 ? ` pos-${['first','second','third'][i]}` : ''}`}>
                {medals[i] || i + 1}
              </span>
              <div className="gp-row-avatar">{s.name.charAt(0).toUpperCase()}</div>
              <span className="gp-row-name">{s.name}</span>
              <span className="gp-row-stat">{s.exact} exactos</span>
              <span className="gp-row-stat muted">{s.outcome} result.</span>
              <span className="gp-row-pct">{s.predictedPct}%</span>
              <span className="gp-row-pts">{s.pts} pts</span>
              <span className="gp-row-chevron">{expandedUid === s.uid ? '▲' : '›'}</span>
            </div>
            {expandedUid === s.uid && (
              <UserMatchDetail preds={s.preds} savedResults={savedResults} savedKnockout={savedKnockout} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function UserMatchDetail({ preds, savedResults, savedKnockout }: {
  preds: Record<string, any>;
  savedResults: Record<string, { home: number; away: number }>;
  savedKnockout: Record<string, KoEntry>;
}) {
  type MatchRow = { id: string; local: Team; visitante: Team; res: { home: number; away: number } | null; pred: any; pts: number | null; hasPred: boolean };

  // All group matches grouped by grupo
  const byGroup: Record<string, MatchRow[]> = {};
  MATCHES.forEach(m => {
    const res = savedResults[m.id] ?? null;
    const pred = preds[m.id];
    const hasPred = pred && pred.home != null && pred.away != null;
    const pts = (res && hasPred) ? calcPts(pred, res.home, res.away) : null;
    if (!byGroup[m.grupo]) byGroup[m.grupo] = [];
    byGroup[m.grupo].push({ id: m.id, local: m.local, visitante: m.visitante, res, pred, pts, hasPred });
  });

  // All configured KO matches grouped by round
  type KoSection = { label: string; rows: MatchRow[] };
  const koSections: KoSection[] = [];
  KNOCKOUT_ROUNDS.forEach(round => {
    const rows: MatchRow[] = [];
    for (let i = 1; i <= round.count; i++) {
      const id = `${round.id}-${i}`;
      const m = savedKnockout[id];
      if (!m?.slot1?.n || !m?.slot2?.n) continue;
      const res = (m.home != null && m.away != null) ? { home: m.home!, away: m.away! } : null;
      const pred = preds[id];
      const hasPred = pred && pred.home != null && pred.away != null;
      const pts = (res && hasPred) ? calcPts(pred, res.home, res.away) : null;
      rows.push({ id, local: m.slot1 as Team, visitante: m.slot2 as Team, res, pred, pts, hasPred });
    }
    if (rows.length) koSections.push({ label: round.name, rows });
  });

  const totalPred = MATCHES.filter(m => { const p = preds[m.id]; return p && p.home != null && p.away != null; }).length;
  const totalEarned = [
    ...Object.values(byGroup).flat(),
    ...koSections.flatMap(s => s.rows),
  ].reduce((s, r) => s + (r.pts ?? 0), 0);

  const renderRow = (row: MatchRow) => (
    <div key={row.id} className={`ud-row${row.res ? (row.pts === 3 ? ' hit-exact' : row.pts === 1 ? ' hit-result' : row.hasPred ? ' hit-miss' : '') : ''}`}>
      <div className="ud-teams">
        <span className="ud-flag">{row.local.f}</span>
        <span className="ud-tname">{row.local.n}</span>
        {row.res
          ? <span className="ud-result">{row.res.home}:{row.res.away}</span>
          : <span className="ud-result pending">–:–</span>
        }
        <span className="ud-tname right">{row.visitante.n}</span>
        <span className="ud-flag">{row.visitante.f}</span>
      </div>
      <div className="ud-pred">
        {row.hasPred
          ? <><span className="ud-pred-label">pred:</span> <span className="ud-pred-score">{row.pred.home}:{row.pred.away}</span></>
          : <span className="ud-pred-label no-pred">sin pred.</span>
        }
      </div>
      <div className={`ud-pts pts-badge-${row.pts === null ? 'pending' : row.pts}`}>
        {row.pts !== null ? `+${row.pts}` : row.hasPred ? '⏳' : '–'}
      </div>
    </div>
  );

  return (
    <div className="ud-panel">
      <div className="ud-summary">
        <strong>{totalPred}</strong> / {MATCHES.length} predicciones completadas ·
        <strong style={{ color: 'var(--gold-l)' }}> {totalEarned} pts</strong> ganados
      </div>

      {/* Group phase sections */}
      {Object.entries(byGroup).map(([grupo, rows]) => (
        <div key={grupo} className="ud-section">
          <div className="ud-section-label">Grupo {grupo}</div>
          {rows.map(renderRow)}
        </div>
      ))}

      {/* Knockout sections */}
      {koSections.map(sec => (
        <div key={sec.label} className="ud-section">
          <div className="ud-section-label">⚔️ {sec.label}</div>
          {sec.rows.map(renderRow)}
        </div>
      ))}
    </div>
  );
}
