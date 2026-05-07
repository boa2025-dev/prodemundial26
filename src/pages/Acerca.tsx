import { Link } from 'react-router-dom';
import './Pages.css';

export default function Acerca() {
  return (
    <div className="static-page">
      <nav className="static-nav">
        <Link className="nav-logo" to="/dashboard">
          <img src="/logo.png" alt="Logo" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 14px var(--glow)' }} />
          Prode <span className="gold">2026</span>
        </Link>
        <Link className="nav-back" to="/dashboard">← Volver al inicio</Link>
      </nav>

      <main>
        <div className="container">
          <div className="page-tag">Quiénes somos</div>
          <h1 className="page-title">Acerca de Prode Mundial 2026</h1>
          <p className="page-sub">El prode más completo para vivir el Mundial de fútbol con tus amigos. Predecí, competí y seguí cada partido del torneo.</p>

          <div className="hero-banner">
            <span className="hero-emoji">🏆</span>
            <h2>Hecho para vivir el Mundial al máximo</h2>
            <p>Prode Mundial 2026 es una plataforma gratuita donde podés armar grupos con tus amigos, cargar tus predicciones para cada partido y ver quién acierta más a lo largo de todo el torneo.</p>
          </div>

          <div className="stats">
            <div className="stat"><div className="stat-num">48</div><div className="stat-label">Selecciones</div></div>
            <div className="stat"><div className="stat-num">104</div><div className="stat-label">Partidos</div></div>
            <div className="stat"><div className="stat-num">3</div><div className="stat-label">Países sede</div></div>
          </div>

          <div className="features">
            {[
              { icon: '👥', title: 'Grupos privados', desc: 'Creá tu grupo con un código único y compartilo con tus amigos, familia o compañeros de trabajo.' },
              { icon: '🎯', title: 'Predicciones en tiempo real', desc: 'Cargá los resultados de todos los partidos de la fase de grupos y las eliminatorias.' },
              { icon: '📊', title: 'Tabla de puntos', desc: 'Seguí el puntaje de todos los participantes de tu grupo con la tabla actualizada automáticamente.' },
              { icon: '⚡', title: 'Bracket automático', desc: 'El cuadro de eliminatorias se arma solo a partir de los resultados reales de la fase de grupos.' },
              { icon: '🔒', title: 'Seguro y gratuito', desc: 'Sin costo, sin publicidad invasiva. Tus datos están protegidos con Firebase de Google.' },
              { icon: '📱', title: 'Desde cualquier dispositivo', desc: 'Funciona perfecto en celular, tablet y computadora. Solo necesitás un navegador.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="feature-card">
                <div className="feature-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>

          <div className="section">
            <div className="section-title">Cómo funciona</div>
            <p>1. <strong>Registrate</strong> con tu email o tu cuenta de Google.</p>
            <p>2. <strong>Creá o unite</strong> a un grupo con tu código de invitación.</p>
            <p>3. <strong>Cargá tus predicciones</strong> antes de que arranque cada partido.</p>
            <p>4. <strong>Seguí la tabla</strong> y mirá cómo van sumando puntos todos los del grupo.</p>
            <p>5. <strong>El que más acierte gana</strong> — exacto vale doble que solo el ganador.</p>
          </div>

          <div className="section">
            <div className="section-title">Sistema de puntos</div>
            <p><strong>Resultado exacto:</strong> 3 puntos — adivinás el marcador exacto del partido.</p>
            <p><strong>Resultado correcto:</strong> 1 punto — adivinás quién gana (o el empate) pero no el marcador.</p>
            <p><strong>Resultado incorrecto:</strong> 0 puntos.</p>
          </div>

          <div className="cta">
            <h3>¿Todavía no jugás?</h3>
            <p>Registrate gratis y empezá a predecir los partidos del Mundial 2026.</p>
            <Link className="btn-gold" to="/register">⚽ Unirme ahora</Link>
          </div>
        </div>
      </main>

      <footer>
        <Link to="/contacto">Contacto</Link>
        <Link to="/acerca">Acerca de</Link>
        <Link to="/privacidad">Privacidad</Link>
        <Link to="/aviso-legal">Aviso Legal</Link>
        <br /><br />© 2026 Prode Mundial. Todos los derechos reservados.
      </footer>
    </div>
  );
}
