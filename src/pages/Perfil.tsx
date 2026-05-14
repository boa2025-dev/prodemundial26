import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { arrayRemove, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import BottomNav from '../components/BottomNav';
import './Perfil.css';

const GLOBAL_PRED_KEY = (uid: string) => `${uid}_global`;

export default function Perfil() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [stats, setStats] = useState({ pts: 0, exactos: 0, resultados: 0 });
  const [loading, setLoading] = useState(true);
  const [showGroups, setShowGroups] = useState(false);
  const [leavingCode, setLeavingCode] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) { navigate('/login', { replace: true }); return; }
    loadStats();
  }, [currentUser]);

  async function loadStats() {
    if (!currentUser) return;
    try {
      const [predSnap, groupSnap, resultsSnap] = await Promise.all([
        getDoc(doc(db, 'predictions', GLOBAL_PRED_KEY(currentUser.uid))),
        getDocs(query(collection(db, 'groups'), where('memberUids', 'array-contains', currentUser.uid))),
        getDoc(doc(db, 'results', 'matches')),
      ]);

      const preds = predSnap.exists() ? (predSnap.data().matches || {}) : {};
      const results: Record<string, { home: number; away: number }> = resultsSnap.exists() ? (resultsSnap.data().scores || {}) : {};

      let pts = 0, exactos = 0, resultados = 0;
      for (const [matchId, res] of Object.entries(results)) {
        const pred = preds[matchId];
        if (!pred || pred.home == null || pred.away == null) continue;
        if (pred.home === res.home && pred.away === res.away) { pts += 3; exactos++; }
        else if (Math.sign(pred.home - pred.away) === Math.sign(res.home - res.away)) { pts += 1; resultados++; }
      }

      setStats({ pts, exactos, resultados });
      setGroups(groupSnap.docs.map(d => d.data()));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function leaveGroup(group: any) {
    if (!currentUser) return;
    if (!window.confirm(`¿Seguro que querés salir de "${group.name}"?`)) return;
    setLeavingCode(group.code);
    try {
      const groupRef = doc(db, 'groups', group.code);
      const groupSnap = await getDoc(groupRef);
      if (!groupSnap.exists()) return;
      const currentMembers: any[] = groupSnap.data().members || [];
      const newMembers = currentMembers.filter((m: any) => m.uid !== currentUser.uid);
      await updateDoc(groupRef, {
        memberUids: arrayRemove(currentUser.uid),
        members: newMembers,
      });
      const newGroups = groups.filter(g => g.code !== group.code);
      setGroups(newGroups);
      if (newGroups.length === 0) navigate('/onboarding', { replace: true });
    } catch {
      alert('Error al salir del grupo. Intentá de nuevo.');
    } finally {
      setLeavingCode(null);
    }
  }

  const name = currentUser?.displayName || currentUser?.email || '';
  const initial = name.charAt(0).toUpperCase();
  const email = currentUser?.email || '';

  const ACHIEVEMENTS = [
    { icon: '🎯', title: 'Tirador', desc: '5 exactos', unlocked: stats.exactos >= 5 },
    { icon: '🔥', title: 'Racha x5', desc: '5 al hilo', unlocked: stats.exactos >= 5 },
    { icon: '👑', title: 'Líder', desc: '#1 grupo', unlocked: stats.pts > 100 },
    { icon: '⚽', title: 'Prode pro', desc: '50 preds', unlocked: false },
    { icon: '🏆', title: 'Campeón', desc: 'Ganó grupo', unlocked: false },
  ];

  return (
    <div className="perfil-page">
      <div className="perfil-header">
        <span className="perfil-title">Perfil</span>
        <button className="perfil-settings-btn" aria-label="Ajustes">⚙</button>
      </div>

      {/* Avatar */}
      <div className="perfil-avatar-wrap">
        <div className="perfil-avatar">{initial}</div>
        <div className="perfil-check">✓</div>
      </div>
      <div className="perfil-name">{name.split(' ').slice(0, 2).join(' ')}</div>
      <div className="perfil-email">{email}</div>

      {/* Stats */}
      <div className="perfil-stats">
        <div className="perfil-stat">
          <div className="perfil-stat-num" style={{ color: 'var(--gold-l)' }}>{stats.pts}</div>
          <div className="perfil-stat-label">PUNTOS</div>
        </div>
        <div className="perfil-stat">
          <div className="perfil-stat-num" style={{ color: 'var(--green)' }}>{stats.exactos}</div>
          <div className="perfil-stat-label">EXACTOS</div>
        </div>
        <div className="perfil-stat">
          <div className="perfil-stat-num">{groups.length}</div>
          <div className="perfil-stat-label">GRUPOS</div>
        </div>
      </div>

      {/* Achievements */}
      <div className="perfil-section-label">LOGROS</div>
      <div className="perfil-achievements">
        {ACHIEVEMENTS.map(a => (
          <div key={a.title} className={`perfil-achievement${a.unlocked ? '' : ' locked'}`}>
            <span className="ach-icon">{a.icon}</span>
            <span className="ach-title">{a.title}</span>
            <span className="ach-desc">{a.desc}</span>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="perfil-menu">
        <div className="perfil-menu-item" onClick={() => setShowGroups(v => !v)}>
          <span className="pmi-icon">🔗</span>
          <span className="pmi-label">Mis grupos</span>
          <span className="pmi-right">{groups.length} <span className="pmi-chevron">{showGroups ? '↓' : '›'}</span></span>
        </div>

        {/* Inline groups list */}
        {showGroups && (
          <div className="perfil-groups-list">
            {groups.length === 0 && (
              <div className="pgl-empty">No estás en ningún grupo todavía.</div>
            )}
            {groups.map(g => (
              <div key={g.code} className="pgl-item">
                <div className="pgl-avatar">{g.name.charAt(0).toUpperCase()}</div>
                <div className="pgl-info">
                  <div className="pgl-name">{g.name}</div>
                  <div className="pgl-meta">{g.code} · {g.memberUids?.length || 1} jugadores</div>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`¡Sumate a mi prode del Mundial 2026! 🏆\n\nEstoy en el grupo *${g.name}* y necesitamos más participantes.\n\nEntrá por acá: https://prodemundial26.online/join?code=${g.code}\n\n¡Es gratis y sin instalar nada! ⚽`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pgl-share"
                  onClick={e => e.stopPropagation()}
                  title="Compartir por WhatsApp"
                >🔗</a>
                <button
                  className="pgl-leave"
                  onClick={e => { e.stopPropagation(); leaveGroup(g); }}
                  disabled={leavingCode === g.code}
                >
                  {leavingCode === g.code ? '...' : 'Salir'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="perfil-menu-item" onClick={() => navigator.share?.({ title: 'Prode Mundial 2026', url: 'https://prodemundial26.online' }).catch(() => {})}>
          <span className="pmi-icon">↗</span>
          <span className="pmi-label">Compartir Prode</span>
          <span className="pmi-chevron">›</span>
        </div>
        <div className="perfil-menu-item" onClick={() => navigate('/acerca')}>
          <span className="pmi-icon">ℹ</span>
          <span className="pmi-label">Acerca de</span>
          <span className="pmi-chevron">›</span>
        </div>
        <div className="perfil-menu-item" onClick={() => navigate('/privacidad')}>
          <span className="pmi-icon">🔒</span>
          <span className="pmi-label">Privacidad</span>
          <span className="pmi-chevron">›</span>
        </div>
        <div className="perfil-menu-item danger" onClick={() => signOut(auth).then(() => navigate('/login'))}>
          <span className="pmi-icon">↩</span>
          <span className="pmi-label">Cerrar sesión</span>
        </div>
      </div>

      <div style={{ height: 100 }} />
      <BottomNav />
    </div>
  );
}
