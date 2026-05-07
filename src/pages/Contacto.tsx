import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Pages.css';

export default function Contacto() {
  const [sent, setSent] = useState(false);

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
          <div className="page-tag">Contacto</div>
          <h1 className="page-title">¿Tenés alguna consulta?</h1>
          <p className="page-sub">Estamos para ayudarte. Escribinos y te responderemos a la brevedad.</p>

          {!sent ? (
            <div className="contact-form">
              <div className="form-group">
                <label className="form-label">Tu nombre</label>
                <input className="form-input" type="text" placeholder="Tu nombre" />
              </div>
              <div className="form-group">
                <label className="form-label">Tu email</label>
                <input className="form-input" type="email" placeholder="tu@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Mensaje</label>
                <textarea placeholder="Describí tu consulta o problema..." />
              </div>
              <button className="btn-gold" onClick={() => setSent(true)} style={{ width: '100%', justifyContent: 'center' }}>
                📧 Enviar mensaje
              </button>
            </div>
          ) : (
            <div className="hero-banner">
              <span className="hero-emoji">✅</span>
              <h2>¡Mensaje enviado!</h2>
              <p>Gracias por escribirnos. Te responderemos lo antes posible al email que nos indicaste.</p>
            </div>
          )}

          <div className="section">
            <div className="section-title">Otras formas de contacto</div>
            <p>También podés escribirnos directamente a <strong style={{ color: 'var(--gold)' }}>bautistaoteroalen2008@gmail.com</strong></p>
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
