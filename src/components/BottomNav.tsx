import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import './BottomNav.css';

const TABS = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'prode',
    label: 'Prode',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'tabla',
    label: 'Tabla',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    id: 'perfil',
    label: 'Perfil',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isOnPerfil = location.pathname === '/perfil';
  const tabParam = searchParams.get('tab') || 'inicio';
  const activeTab = isOnPerfil ? 'perfil' : tabParam;

  function handleTab(id: string) {
    if (id === 'perfil') { navigate('/perfil'); return; }
    if (id === 'inicio') { navigate('/dashboard'); return; }
    navigate(`/dashboard?tab=${id}`);
  }

  return (
    <div className="bottom-nav">
      {TABS.map(({ id, label, icon }) => (
        <button
          key={id}
          className={`bn-item${activeTab === id ? ' active' : ''}`}
          onClick={() => handleTab(id)}
          aria-label={label}
        >
          <span className="bn-icon">{icon}</span>
          <span className="bn-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
