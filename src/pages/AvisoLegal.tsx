import { Link } from 'react-router-dom';
import './Pages.css';

export default function AvisoLegal() {
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
          <h1 className="page-title">Aviso Legal</h1>
          <p className="page-sub">Condiciones de uso de Prode Mundial 2026</p>

          <div className="privacy-block">
            <h3>1. Titularidad</h3>
            <p>Prode Mundial 2026 es un proyecto personal sin fines de lucro, creado como entretenimiento para el seguimiento del Mundial FIFA 2026.</p>
          </div>

          <div className="privacy-block">
            <h3>2. Uso del servicio</h3>
            <p>El servicio es gratuito y se ofrece tal cual está. Al registrarte, aceptás utilizar la plataforma de forma responsable y no intentar vulnerar su seguridad ni la de otros usuarios.</p>
          </div>

          <div className="privacy-block">
            <h3>3. Propiedad intelectual</h3>
            <p>Los nombres de los equipos, torneos y la marca FIFA son propiedad de sus respectivos titulares. Este proyecto no tiene afiliación oficial con FIFA ni con ninguna federación de fútbol.</p>
          </div>

          <div className="privacy-block">
            <h3>4. Limitación de responsabilidad</h3>
            <p>No nos hacemos responsables por errores en los datos del fixture o resultados. Los datos se actualizan manualmente y pueden presentar demoras.</p>
          </div>

          <div className="privacy-block">
            <h3>5. Contacto</h3>
            <p>Para cualquier consulta legal podés usar el formulario de la página de <Link to="/contacto" style={{ color: 'var(--gold)' }}>Contacto</Link>.</p>
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
