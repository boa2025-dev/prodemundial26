import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { MATCHES, GROUP_IDS, GRUPOS_DEF, KNOCKOUT_ROUNDS, BRACKET_MAP, ALL_TEAMS } from '../data/matches';
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
  const [phase, setPhase] = useState<'groups' | 'knockout' | 'preview' | 'bonus'>('groups');
  const [allGroups, setAllGroups] = useState<GroupPreview[]>([]);
  const [bonusInputs, setBonusInputs] = useState<{ p1: string; p2: string; p3: string }>({ p1: '', p2: '', p3: '' });
  const [bonusSaving, setBonusSaving] = useState(false);
  const [activeGroup, setActiveGroup] = useState(GROUP_IDS[0]);
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

      {/* Phase switcher */}
      <div className="phase-switcher">
        <div className="phase-tabs">
          <div className={`phase-tab${phase === 'groups' ? ' active' : ''}`} onClick={() => { if (isDirty && !confirm('Cambios sin guardar. ¿Cambiar?')) return; setIsDirty(false); setPhase('groups'); }}>⚽ Fase de Grupos</div>
          <div className={`phase-tab${phase === 'knockout' ? ' active' : ''}`} onClick={() => { if (isDirty && !confirm('Cambios sin guardar. ¿Cambiar?')) return; setIsDirty(false); setPhase('knockout'); }}>⚔️ Eliminatorias</div>
          <div className={`phase-tab${phase === 'preview' ? ' active' : ''}`} onClick={() => { if (isDirty && !confirm('Cambios sin guardar. ¿Cambiar?')) return; setIsDirty(false); setPhase('preview'); }}>👥 Grupos</div>
          <div className={`phase-tab${phase === 'bonus' ? ' active' : ''}`} onClick={() => { if (isDirty && !confirm('Cambios sin guardar. ¿Cambiar?')) return; setIsDirty(false); setPhase('bonus'); }}>🏅 Podio</div>
        </div>
      </div>

      {/* Group tabs (only in groups phase) */}
      {phase === 'groups' && (
        <div className="group-tabs-wrap">
          <div className="group-tabs">
            {GROUP_IDS.map((id) => {
              const done = MATCHES.filter((m) => m.grupo === id).some((m) => savedResults[m.id] != null);
              return (
                <div key={id} className={`g-tab${id === activeGroup ? ' active' : ''}${done ? ' done' : ''}`} onClick={() => setActiveGroup(id)}>
                  Grupo {id}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <main>
        {!loaded ? (
          <div className="loading-state"><div className="spinner-lg" /></div>
        ) : phase === 'groups' ? (
          <GroupPhase
            gid={activeGroup}
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

      {/* Save bar — hidden in preview mode */}
      <div className="save-bar" style={(phase === 'preview' || phase === 'bonus') ? { display: 'none' } : {}}>
        <div className="save-bar-inner">
          <div className="save-info">
            {phase === 'groups'
              ? <><strong>{totalGroupDone}</strong> / {MATCHES.length} resultados cargados</>
              : <><strong>{doneBracket}</strong> / {totalKo} partidos configurados</>
            }
          </div>
          <button className={`btn-save admin-save${saving ? ' loading' : ''}`} disabled={!isDirty || saving} onClick={save}>
            <span className="s-text">Guardar</span>
            <div className="s-spinner" />
          </button>
        </div>
      </div>

      <div className={`toast ${toast.type}${toast.show ? ' show' : ''}`}>{toast.msg}</div>
    </div>
  );
}

function GroupPhase({ gid, savedResults, inputs, matchLocks, onInput, onToggleLock }: {
  gid: string;
  savedResults: Record<string, { home: number; away: number }>;
  inputs: Record<string, { home: string; away: string }>;
  matchLocks: Record<string, boolean>;
  onInput: (matchId: string, side: 'home' | 'away', val: string) => void;
  onToggleLock: (matchId: string, locked: boolean) => void;
}) {
  const matches = MATCHES.filter((m) => m.grupo === gid);
  const byMatchday: Record<number, typeof matches> = {};
  matches.forEach((m) => { if (!byMatchday[m.jornada]) byMatchday[m.jornada] = []; byMatchday[m.jornada].push(m); });
  Object.values(byMatchday).forEach((ms) => ms.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime()));
  const now = Date.now();

  return (
    <div>
      <div className="section-hdr">
        <div className="section-hdr-left">
          <h2>Grupo {gid}</h2>
          <p>Ingresá el marcador final · El candado manual bloquea predicciones antes del inicio</p>
        </div>
      </div>
      {[1, 2, 3].map((j) => {
        const ms = byMatchday[j] || [];
        if (!ms.length) return null;
        return (
          <div key={j} className="matchday">
            <div className="matchday-label">Jornada {j} · {formatDate(ms[0].kickoff)}</div>
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
function AdminBonusSection({ inputs, saving, onSave, onChange }: {
  inputs: { p1: string; p2: string; p3: string };
  saving: boolean;
  onSave: () => void;
  onChange: (v: { p1: string; p2: string; p3: string }) => void;
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
          <p>Ingresá los 3 primeros puestos reales del Mundial. Acertar cada posición suma 10 pts al jugador.</p>
        </div>
      </div>

      <div className="admin-bonus-card">
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
