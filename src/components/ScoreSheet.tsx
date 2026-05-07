import { useState, useEffect } from 'react';
import type { Match } from '../data/matches';
import { formatDateTime } from '../lib/utils';
import './ScoreSheet.css';

interface Props {
  match: Match;
  initialHome: string;
  initialAway: string;
  onSave: (matchId: string, home: number, away: number) => void;
  onClose: () => void;
}

export default function ScoreSheet({ match, initialHome, initialAway, onSave, onClose }: Props) {
  const [home, setHome] = useState(initialHome !== '' ? parseInt(initialHome) : 0);
  const [away, setAway] = useState(initialAway !== '' ? parseInt(initialAway) : 0);
  const [hasInitial] = useState(initialHome !== '' && initialAway !== '');

  // Prevent body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function inc(side: 'home' | 'away') {
    if (side === 'home') setHome(v => Math.min(99, v + 1));
    else setAway(v => Math.min(99, v + 1));
  }

  function dec(side: 'home' | 'away') {
    if (side === 'home') setHome(v => Math.max(0, v - 1));
    else setAway(v => Math.max(0, v - 1));
  }

  function handleSave() {
    onSave(match.id, home, away);
    onClose();
  }

  // Points preview
  const homeWins = home > away;
  const awayWins = away > home;
  const draw = home === away;

  let resultLabel = '';
  let resultFlag = '';
  if (homeWins) { resultLabel = `Gana ${match.local.n}`; resultFlag = match.local.f; }
  else if (awayWins) { resultLabel = `Gana ${match.visitante.n}`; resultFlag = match.visitante.f; }
  else { resultLabel = 'Empate'; resultFlag = '🤝'; }

  const jornada = 'jornada' in match ? (match as any).jornada : '';

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-container" onClick={e => e.stopPropagation()}>
        <div className="sheet-grabber" />

        <div className="sheet-header">
          <div className="sheet-header-info">
            {jornada && <span className="sheet-jornada">Jornada {jornada} · {formatDateTime(match.kickoff)}</span>}
            <span className="sheet-title">Tu predicción</span>
          </div>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>

        <div className="sheet-teams">
          {/* Home */}
          <div className="sheet-team">
            <span className="sheet-team-flag">{match.local.f}</span>
            <span className="sheet-team-name">{match.local.n}</span>
            <button className="sheet-stepper up" onClick={() => inc('home')}>＋</button>
            <div className="sheet-score-box">{home}</div>
            <button className="sheet-stepper down" onClick={() => dec('home')}>－</button>
          </div>

          <div className="sheet-vs">—</div>

          {/* Away */}
          <div className="sheet-team">
            <span className="sheet-team-flag">{match.visitante.f}</span>
            <span className="sheet-team-name">{match.visitante.n}</span>
            <button className="sheet-stepper up" onClick={() => inc('away')}>＋</button>
            <div className="sheet-score-box">{away}</div>
            <button className="sheet-stepper down" onClick={() => dec('away')}>－</button>
          </div>
        </div>

        {/* Points preview */}
        <div className="sheet-preview">
          <span className="sheet-preview-flag">{resultFlag}</span>
          <span className="sheet-preview-label">{resultLabel}</span>
          <div className="sheet-preview-pts">
            <span className="sheet-pts-row">Acierto exacto: <strong>+3 pts</strong></span>
            <span className="sheet-pts-row">Resultado: <strong>+1 pt</strong></span>
          </div>
        </div>

        <button className="sheet-save-btn" onClick={handleSave}>
          GUARDAR PREDICCIÓN
        </button>
      </div>
    </div>
  );
}
