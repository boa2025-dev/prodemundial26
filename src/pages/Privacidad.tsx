import { Link } from 'react-router-dom';
import './Pages.css';

export default function Privacidad() {
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
          <div className="page-tag">Legal</div>
          <h1 className="page-title">Política de Privacidad</h1>
          <p className="page-sub">Última actualización: enero de 2026</p>

          <div className="privacy-block">
            <h3>1. Datos que recopilamos</h3>
            <p>Recopilamos los siguientes datos cuando usás Prode Mundial 2026:</p>
            <ul>
              <li>Email y nombre (al registrarte con email/contraseña o Google)</li>
              <li>Tus predicciones de partidos</li>
              <li>Los grupos que creás o a los que te unís</li>
            </ul>
          </div>

          <div className="privacy-block">
            <h3>2. Cómo usamos tus datos</h3>
            <p>Usamos tus datos únicamente para:</p>
            <ul>
              <li>Mostrarte la tabla de puntos en tu grupo</li>
              <li>Permitirte guardar y ver tus predicciones</li>
              <li>Gestionar tu cuenta de usuario</li>
            </ul>
            <p>No compartimos tus datos con terceros ni los usamos para publicidad.</p>
          </div>

          <div className="privacy-block">
            <h3>3. Seguridad</h3>
            <p>Tus datos se almacenan en Firebase (Google). Utilizamos autenticación segura y todas las comunicaciones se realizan por HTTPS.</p>
          </div>

          <div className="privacy-block">
            <h3>4. Tus derechos</h3>
            <p>Podés solicitar la eliminación de tu cuenta y datos en cualquier momento a través de la página de <Link to="/contacto" style={{ color: 'var(--gold)' }}>Contacto</Link>.</p>
          </div>

          <div className="privacy-block">
            <h3>5. Cookies</h3>
            <p>Usamos cookies estrictamente necesarias para mantener tu sesión iniciada. No usamos cookies de seguimiento ni publicidad.</p>
          </div>

          <div className="cta">
            <h3>¿Tenés preguntas?</h3>
            <p>Usá el formulario de contacto para cualquier consulta sobre privacidad.</p>
            <Link className="btn-gold" to="/contacto">Contactarnos</Link>
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
