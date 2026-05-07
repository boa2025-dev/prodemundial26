import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const MUNDIAL_DATE = new Date('2026-06-11T19:00:00Z').getTime();

function pad(n: number) { return String(n).padStart(2, '0'); }
function calcCountdown() {
  const diff = MUNDIAL_DATE - Date.now();
  if (diff <= 0) return { days: '00', hours: '00', mins: '00', secs: '00' };
  return {
    days: pad(Math.floor(diff / 86400000)),
    hours: pad(Math.floor((diff % 86400000) / 3600000)),
    mins: pad(Math.floor((diff % 3600000) / 60000)),
    secs: pad(Math.floor((diff % 60000) / 1000)),
  };
}

const TEAMS = [
  { flag: '🇦🇷', name: 'Argentina', group: 'Favorito' }, { flag: '🇧🇷', name: 'Brasil', group: 'Grupo C' },
  { flag: '🇫🇷', name: 'Francia', group: 'Grupo I' }, { flag: '🇩🇪', name: 'Alemania', group: 'Grupo E' },
  { flag: '🇪🇸', name: 'España', group: 'Grupo H' }, { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'Inglaterra', group: 'Grupo L' },
  { flag: '🇵🇹', name: 'Portugal', group: 'Grupo K' }, { flag: '🇺🇸', name: 'EE.UU.', group: 'Sede' },
  { flag: '🇲🇽', name: 'México', group: 'Sede' }, { flag: '🇨🇦', name: 'Canadá', group: 'Sede' },
  { flag: '🇳🇱', name: 'Países Bajos', group: 'Grupo F' }, { flag: '🇧🇪', name: 'Bélgica', group: 'Grupo G' },
  { flag: '🇺🇾', name: 'Uruguay', group: 'Grupo H' }, { flag: '🇨🇴', name: 'Colombia', group: 'Grupo K' },
  { flag: '🇯🇵', name: 'Japón', group: 'Grupo F' }, { flag: '🇸🇳', name: 'Senegal', group: 'Grupo I' },
  { flag: '🇲🇦', name: 'Marruecos', group: 'Grupo C' }, { flag: '🇭🇷', name: 'Croacia', group: 'Grupo L' },
  { flag: '🇦🇺', name: 'Australia', group: 'Grupo D' }, { flag: '🇰🇷', name: 'Corea del Sur', group: 'Grupo A' },
  { flag: '🇨🇭', name: 'Suiza', group: 'Grupo B' }, { flag: '🇳🇴', name: 'Noruega', group: 'Grupo I' },
  { flag: '🇦🇹', name: 'Austria', group: 'Grupo J' }, { flag: '🇪🇨', name: 'Ecuador', group: 'Grupo E' },
];

export default function Home() {
  const [cd, setCd] = useState(calcCountdown());
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [statsStarted, setStatsStarted] = useState(false);
  const [counts, setCounts] = useState({ a: 0, b: 0, c: 0, d: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const ctaStarsRef = useRef<HTMLDivElement>(null);

  // Countdown
  useEffect(() => {
    const t = setInterval(() => setCd(calcCountdown()), 1000);
    return () => clearInterval(t);
  }, []);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // CTA stars
  useEffect(() => {
    if (!ctaStarsRef.current) return;
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('div');
      s.className = 'cta-star';
      s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;--dur:${2 + Math.random() * 4}s;--del:${Math.random() * 5}s;`;
      ctaStarsRef.current.appendChild(s);
    }
  }, []);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Stats counter
  useEffect(() => {
    if (statsStarted) return;
    const el = statsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !statsStarted) {
        setStatsStarted(true);
        const targets = [104, 39, 48, 3];
        const keys = ['a', 'b', 'c', 'd'] as const;
        targets.forEach((target, i) => {
          const dur = 1600, step = 16, steps = dur / step;
          let curr = 0;
          const inc = target / steps;
          const timer = setInterval(() => {
            curr += inc;
            if (curr >= target) { curr = target; clearInterval(timer); }
            setCounts((prev) => ({ ...prev, [keys[i]]: Math.round(curr) }));
          }, step);
        });
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [statsStarted]);

  // Canvas particles
  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = heroRef.current;
    if (!canvas || !hero) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0;
    const mouse = { x: -9999, y: -9999 };
    const GOLD = '201,168,76';
    const COUNT = 70;

    function resize() {
      W = canvas!.width = canvas!.offsetWidth;
      H = canvas!.height = canvas!.offsetHeight;
    }

    class Particle {
      x = 0; y = 0; vx = 0; vy = 0; r = 0; alpha = 0; life = 0; maxLife = 0;
      constructor() { this.reset(true); }
      reset(init: boolean) {
        this.x = Math.random() * W;
        this.y = init ? Math.random() * H : H + 10;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = -(Math.random() * 0.6 + 0.15);
        this.r = Math.random() * 2.2 + 0.6;
        this.alpha = Math.random() * 0.3 + 0.08;
        this.life = 0;
        this.maxLife = Math.random() * 300 + 150;
      }
      update() {
        const dx = this.x - mouse.x, dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) { const f = (120 - dist) / 120 * 0.8; this.vx += (dx / dist) * f * 0.06; this.vy += (dy / dist) * f * 0.06; }
        this.vx *= 0.985; this.vy *= 0.985;
        this.x += this.vx; this.y += this.vy; this.life++;
        if (this.life > this.maxLife || this.y < -10 || this.x < -10 || this.x > W + 10) this.reset(false);
      }
      draw() {
        const progress = this.life / this.maxLife;
        const a = this.alpha * (1 - Math.pow(progress - 0.5, 2) * 4);
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${GOLD},${Math.max(0, a)})`; ctx.fill();
      }
    }

    resize();
    const particles = Array.from({ length: COUNT }, () => new Particle());

    function drawConnections() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 90) { ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.strokeStyle = `rgba(${GOLD},${(1 - d / 90) * 0.06})`; ctx.lineWidth = 0.5; ctx.stroke(); }
        }
      }
    }

    let raf: number;
    function loop() { ctx.clearRect(0, 0, W, H); particles.forEach((p) => { p.update(); p.draw(); }); drawConnections(); raf = requestAnimationFrame(loop); }

    window.addEventListener('resize', resize, { passive: true });
    const onMove = (e: MouseEvent) => { const r = canvas!.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    hero.addEventListener('mousemove', onMove, { passive: true });
    hero.addEventListener('mouseleave', onLeave, { passive: true });
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); hero.removeEventListener('mousemove', onMove); hero.removeEventListener('mouseleave', onLeave); };
  }, []);

  const track1 = TEAMS.slice(0, 12);
  const track2 = TEAMS.slice(12);

  return (
    <div className="home-page">
      {/* NAV */}
      <header>
        <nav id="navbar" className={scrolled ? 'scrolled' : ''}>
          <div className="container nav-inner">
            <a href="/" className="nav-logo" aria-label="Prode Mundial 2026 - Inicio">
              <img src="/logo.png" alt="Prode Mundial 2026 logo" width={36} height={36} />
              PRODE <span className="gold">2026</span>
            </a>
            <ul className={`nav-links${menuOpen ? ' open' : ''}`}>
              <li><a href="#features">Características del prode</a></li>
              <li><a href="#how-it-works">Cómo jugar el prode</a></li>
              <li><a href="#teams">Equipos del Mundial</a></li>
              <li><a href="#leaderboard">Ranking del grupo</a></li>
            </ul>
            <div className={`nav-cta${menuOpen ? ' open' : ''}`}>
              <Link to="/login" className="btn btn-outline" style={{ padding: '.65rem 1.4rem', fontSize: '.85rem' }}>Iniciar sesión al prode</Link>
              <Link to="/register" className="btn btn-primary" style={{ padding: '.65rem 1.4rem', fontSize: '.85rem' }}>Registrarse gratis</Link>
            </div>
            <div className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
              <span /><span /><span />
            </div>
          </div>
        </nav>
      </header>

      <main>
        {/* HERO */}
        <section id="hero" ref={heroRef}>
          <div id="heroBg" />
          <canvas ref={canvasRef} id="heroCanvas" />

          {/* 3D Ball */}
          <div className="ball-wrap" aria-hidden="true">
            <div className="ball-3d">
              <svg className="ball-svg" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="bg" cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#cccccc" />
                  </radialGradient>
                  <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
                    <stop offset="60%" stopColor="transparent" /><stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
                  </radialGradient>
                </defs>
                <circle cx="80" cy="80" r="76" fill="url(#bg)" stroke="#aaa" strokeWidth=".5" />
                <circle cx="80" cy="80" r="76" fill="url(#shadow)" />
                <polygon points="80,10 95,22 90,40 70,40 65,22" fill="#222" opacity="0.9" />
                <polygon points="16,55 33,48 46,60 40,77 22,76" fill="#222" opacity="0.9" />
                <polygon points="144,55 127,48 114,60 120,77 138,76" fill="#222" opacity="0.9" />
                <polygon points="28,118 42,106 58,112 56,130 38,135" fill="#222" opacity="0.9" />
                <polygon points="132,118 118,106 102,112 104,130 122,135" fill="#222" opacity="0.9" />
                <polygon points="80,148 66,136 70,118 90,118 94,136" fill="#222" opacity="0.9" />
                <polygon points="80,52 97,65 91,84 69,84 63,65" fill="#111" opacity="0.95" />
                <line x1="80" y1="40" x2="80" y2="52" stroke="#444" strokeWidth="1.2" />
                <line x1="46" y1="60" x2="63" y2="65" stroke="#444" strokeWidth="1.2" />
                <line x1="114" y1="60" x2="97" y2="65" stroke="#444" strokeWidth="1.2" />
                <line x1="40" y1="77" x2="69" y2="84" stroke="#444" strokeWidth="1.2" />
                <line x1="120" y1="77" x2="91" y2="84" stroke="#444" strokeWidth="1.2" />
                <line x1="58" y1="112" x2="70" y2="118" stroke="#444" strokeWidth="1.2" />
                <line x1="102" y1="112" x2="90" y2="118" stroke="#444" strokeWidth="1.2" />
                <ellipse cx="62" cy="48" rx="10" ry="7" fill="rgba(255,255,255,0.55)" transform="rotate(-25,62,48)" />
              </svg>
            </div>
          </div>

          {/* Floating cards */}
          <div className="float-card c1">
            <div className="fc-label">⏳ Cuenta regresiva al Mundial</div>
            <div style={{ display: 'flex', gap: '.7rem', marginTop: '.2rem' }}>
              {[['cd-days', cd.days, 'DÍAS'], ['cd-hours', cd.hours, 'HS'], ['cd-mins', cd.mins, 'MIN'], ['cd-secs', cd.secs, 'SEG']].map(([, val, lbl], i) => (
                <>
                  {i > 0 && <div key={`sep${i}`} style={{ color: 'var(--gold)', fontSize: '1.1rem', alignSelf: 'flex-start', marginTop: '.1rem' }}>:</div>}
                  <div key={lbl} style={{ textAlign: 'center' }}>
                    <div className="fc-score" style={{ fontSize: '1.3rem' }}>{val}</div>
                    <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginTop: '.2rem' }}>{lbl}</div>
                  </div>
                </>
              ))}
            </div>
            <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginTop: '.5rem' }}>🏟️ Inicio: 11 Jun 2026 · Estadio Azteca</div>
          </div>

          <div className="float-card c2">
            <div className="fc-label">Tu puntaje</div>
            <div className="fc-pts">
              <span className="fc-pts-num">87</span>
              <span className="fc-pts-lbl">puntos<br />Grupo A</span>
            </div>
          </div>

          <div className="float-card c3">
            <div className="fc-label">Tu grupo — Tabla</div>
            <div className="fc-rank">
              <div className="fc-rank-row"><span className="fc-rank-pos">1.</span><span className="fc-rank-name">Mati</span><span className="fc-rank-score">92 pts</span></div>
              <div className="fc-rank-row"><span className="fc-rank-pos">2.</span><span className="fc-rank-name fc-rank-you">Vos</span><span className="fc-rank-score fc-rank-you">87 pts</span></div>
              <div className="fc-rank-row"><span className="fc-rank-pos">3.</span><span className="fc-rank-name">Caro</span><span className="fc-rank-score">74 pts</span></div>
            </div>
          </div>

          <div className="hero-content">
            <div className="hero-badge">
              <div className="badge-ring" />
              <div className="badge-inner">⚽</div>
            </div>
            <div className="hero-eyebrow">FIFA World Cup · 11 Junio 2026</div>
            <h1 className="hero-title">
              <span>PRODE MUNDIAL</span>
              <span className="year">2026</span>
              <span className="sr-only"> — Predicciones FIFA Gratis</span>
            </h1>
            <p className="hero-sub">
              Hacé tus <strong style={{ color: 'var(--white)', fontWeight: 600 }}>predicciones del Mundial FIFA 2026</strong>, competí con amigos en grupos privados y seguí el ranking de tu quiniela en tiempo real.
            </p>
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary">Jugar el prode gratis ⚽</Link>
              <Link to="/login" className="btn btn-outline">Ya tengo cuenta →</Link>
            </div>

            {/* Mobile countdown */}
            <div className="hero-countdown-mobile">
              <div className="hcm-inner">
                <div>
                  <div className="hcm-label">⏳ Cuenta regresiva al Mundial</div>
                  <div className="hcm-digits">
                    {[['DÍAS', cd.days], ['HS', cd.hours], ['MIN', cd.mins], ['SEG', cd.secs]].map(([lbl, val], i) => (
                      <>
                        {i > 0 && <span key={`s${i}`} className="hcm-sep">:</span>}
                        <div key={lbl} className="hcm-unit">
                          <div className="hcm-num">{val}</div>
                          <div className="hcm-lbl">{lbl}</div>
                        </div>
                      </>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-stats" ref={statsRef}>
              {[['a', counts.a, 'Partidos'], ['b', counts.b, 'Días de torneo'], ['c', counts.c, 'Selecciones'], ['d', counts.d, 'Países sede']].map(([key, val, lbl]) => (
                <div key={key} className="stat">
                  <div className="stat-num">{val}</div>
                  <div className="stat-label">{lbl}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="scroll-hint">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features">
          <div className="container">
            <div className="features-header">
              <div className="section-tag reveal fade-in">Plataforma</div>
              <h2 className="section-title reveal fade-up">Todo lo que necesitás para<br /><span className="gold">el mejor prode del Mundial 2026</span></h2>
              <div className="divider reveal fade-in" style={{ '--delay': '100ms' } as any} />
              <p className="section-sub reveal fade-up" style={{ '--delay': '150ms' } as any}>Desde la fase de grupos hasta la gran final, predecí cada resultado y vívelo con tus amigos.</p>
            </div>
            <div className="features-grid">
              {[
                { icon: '📅', title: 'Todos los partidos', desc: 'Los 72 partidos de la fase de grupos más las eliminatorias, con horarios en tiempo real para Argentina.' },
                { icon: '👥', title: 'Grupos privados', desc: 'Creá un grupo con código de invitación y competí sólo contra tus amigos, familia o trabajo.' },
                { icon: '🏆', title: 'Tabla de posiciones', desc: 'Ranking actualizado en vivo con puntos, aciertos exactos y posición de cada participante.' },
                { icon: '⚡', title: 'Autoguardado', desc: 'Tus predicciones se guardan automáticamente. Sin botones, sin perder datos, sin estrés.' },
                { icon: '🔐', title: 'Login seguro', desc: 'Ingresá con tu cuenta de Google en un clic o registrate con email y contraseña.' },
                { icon: '📱', title: '100% responsive', desc: 'Diseñado para funcionar perfecto en celular, tablet y escritorio. Cualquier dispositivo.' },
              ].map(({ icon, title, desc }, i) => (
                <div key={title} className="feature-card reveal fade-up" style={{ '--delay': `${i * 80}ms` } as any}>
                  <div className="feature-icon">{icon}</div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works">
          <div className="container">
            <div className="hiw-layout">
              <div className="hiw-steps">
                <div className="section-tag reveal fade-in">Cómo funciona</div>
                <h2 className="section-title reveal fade-up" style={{ '--delay': '50ms' } as any}>Completá el fixture<br /><span className="gold">del Mundial 2026 en 3 pasos</span></h2>
                <div className="divider reveal fade-in" style={{ '--delay': '100ms' } as any} />
                {[
                  { n: '1', title: 'Registrate gratis', desc: 'Creá tu cuenta con Google o email en menos de 30 segundos. Sin tarjeta, sin compromisos.' },
                  { n: '2', title: 'Creá o unite a un grupo', desc: 'Invitá a tus amigos con un código único. Cada grupo tiene su propia tabla de posiciones.' },
                  { n: '3', title: 'Predecí y competí', desc: 'Ingresá los marcadores antes de cada partido. Ganás puntos por acierto de resultado y marcador exacto.' },
                ].map((step, i) => (
                  <div key={step.n} className="step reveal fade-left" style={{ '--delay': `${150 + i * 100}ms` } as any}>
                    <div className="step-num">{step.n}</div>
                    <div className="step-body">
                      <h4>{step.title}</h4>
                      <p>{step.desc}</p>
                    </div>
                  </div>
                ))}
                <div className="reveal fade-up" style={{ '--delay': '450ms', marginTop: '2rem' } as any}>
                  <Link to="/register" className="btn btn-primary">Empezar ahora →</Link>
                </div>
              </div>

              <div className="hiw-visual reveal fade-right" style={{ '--delay': '200ms' } as any}>
                <div className="stadium-scene">
                  <div className="stadium-lights">
                    <div className="s-light" /><div className="s-light" /><div className="s-light" /><div className="s-light" />
                  </div>
                  <div className="stadium-crowd" />
                  <div className="stadium-pitch">
                    <div className="pitch-lines">
                      <div className="pitch-circle" />
                      <div className="pitch-center-line" />
                      <div className="pitch-box left" />
                      <div className="pitch-box right" />
                      <div className="goal-post left" />
                      <div className="goal-post right" />
                    </div>
                    <span className="s-ball">⚽</span>
                    <span className="s-ball">⚽</span>
                    <span className="s-ball">⚽</span>
                  </div>
                  <div className="pitch-score">
                    <span className="ps-flag">🇦🇷</span>
                    <span className="ps-score">2 – 1</span>
                    <span className="ps-flag">🇧🇷</span>
                    <span className="ps-live">EN VIVO</span>
                  </div>
                  <div className="pitch-group-tag"><strong>Grupo A</strong>Jornada 2</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TEAMS */}
        <section id="teams">
          <div className="container">
            <div className="teams-header">
              <div className="section-tag reveal fade-in">Participantes</div>
              <h2 className="section-title reveal fade-up" style={{ '--delay': '50ms' } as any}>Las <span className="gold">48 selecciones</span><br />del Mundial 2026</h2>
              <div className="divider reveal fade-in" style={{ '--delay': '100ms' } as any} />
              <p className="section-sub reveal fade-up" style={{ '--delay': '150ms' } as any}>Por primera vez en la historia, 48 países compiten en un Mundial con sede en EE.UU., México y Canadá.</p>
            </div>
          </div>
          <div className="teams-marquee-wrap reveal fade-in" style={{ '--delay': '200ms' } as any}>
            <div className="teams-track">
              {[...track1, ...track1].map((t, i) => (
                <div key={i} className="team-card">
                  <div className="team-flag">{t.flag}</div>
                  <div className="team-name">{t.name}</div>
                  <div className="team-group">{t.group}</div>
                </div>
              ))}
            </div>
            <div className="teams-track-2">
              {[...track2, ...track2].map((t, i) => (
                <div key={i} className="team-card">
                  <div className="team-flag">{t.flag}</div>
                  <div className="team-name">{t.name}</div>
                  <div className="team-group">{t.group}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LEADERBOARD */}
        <section id="leaderboard">
          <div className="container">
            <div className="lb-layout">
              <div className="lb-table reveal fade-left">
                <div className="lb-thead">
                  <span>#</span><span>Jugador</span><span style={{ textAlign: 'right' }}>Pts</span><span style={{ textAlign: 'right' }}>Exactos</span>
                </div>
                {[
                  { rank: '🥇', avatar: '🦁', name: 'Maticito99', pts: 124, exact: 8, top: true },
                  { rank: '🥈', avatar: '🐯', name: 'LauraFut', pts: 117, exact: 6, top: true },
                  { rank: '🥉', avatar: '⚡', name: 'FacuGol', pts: 109, exact: 5, top: true },
                  { rank: '4', avatar: '🌟', name: 'CamiWorld', pts: 98, exact: 4, top: false },
                  { rank: '5', avatar: '🔥', name: 'NicoProde', pts: 91, exact: 3, top: false },
                  { rank: '6', avatar: '🎯', name: 'SofíaFifa', pts: 85, exact: 3, top: false },
                ].map((row) => (
                  <div key={row.name} className={`lb-row${row.top ? ' top' : ''}`}>
                    <span className="lb-rank">{row.rank}</span>
                    <div className="lb-user"><span className="lb-avatar">{row.avatar}</span><span className="lb-name">{row.name}</span></div>
                    <span className="lb-pts">{row.pts}</span>
                    <span className="lb-exact">{row.exact}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="section-tag reveal fade-in">Ranking</div>
                <h2 className="section-title reveal fade-up" style={{ '--delay': '50ms' } as any}>Seguí el ranking<br /><span className="gold">del prode online con amigos</span></h2>
                <div className="divider reveal fade-in" style={{ '--delay': '100ms' } as any} />
                <p className="section-sub reveal fade-up" style={{ '--delay': '150ms' } as any}>La tabla de posiciones se actualiza automáticamente después de cada partido.</p>
                <div className="reveal fade-up" style={{ '--delay': '250ms', marginTop: '2rem' } as any}>
                  <p style={{ fontSize: '.88rem', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: 1.7 }}>
                    <strong style={{ color: 'var(--white)' }}>Sistema de puntuación:</strong><br />
                    ✔ Resultado correcto → <span className="gold">3 puntos</span><br />
                    ✔ Marcador exacto → <span className="gold">6 puntos</span><br />
                    ✔ Ganador del torneo → <span className="gold">Bonus especial</span>
                  </p>
                  <Link to="/register" className="btn btn-primary">Unirme al ranking →</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST */}
        <section id="trust">
          <div className="container">
            <div className="trust-header">
              <div className="section-tag reveal fade-in">Confianza</div>
              <h2 className="section-title reveal fade-up" style={{ '--delay': '50ms' } as any}>Jugá el prode online<br /><span className="gold">con total seguridad y confianza</span></h2>
              <div className="divider reveal fade-in" style={{ '--delay': '100ms' } as any} />
              <p className="section-sub reveal fade-up" style={{ '--delay': '150ms' } as any}>Tu información está protegida con la misma infraestructura que usan los proyectos más grandes del mundo.</p>
            </div>
            <div className="trust-grid">
              {[
                { icon: '🔒', title: 'HTTPS Seguro', desc: 'Toda la comunicación está cifrada con TLS. Tus datos nunca viajan en texto plano.' },
                { icon: '☁️', title: 'Firebase / Google', desc: 'Autenticación y base de datos en la infraestructura de Google Cloud.' },
                { icon: '🛡️', title: 'Reglas de seguridad', desc: 'Cada usuario sólo puede ver y modificar sus propios datos.' },
                { icon: '💸', title: '100% Gratuito', desc: 'Sin cargos, sin apuestas, sin datos de pago. Solo diversión entre amigos.' },
              ].map(({ icon, title, desc }, i) => (
                <div key={title} className="trust-card reveal fade-up" style={{ '--delay': `${i * 80}ms` } as any}>
                  <div className="trust-icon">{icon}</div>
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
            <div className="trust-badges reveal fade-up" style={{ '--delay': '300ms' } as any}>
              {['Google Firebase', 'Firestore Database', 'Google Auth', 'HTTPS / TLS', 'Sin tarjeta de crédito', 'Privacidad GDPR'].map((b) => (
                <span key={b} className="trust-badge"><span className="trust-badge-dot" />{b}</span>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta">
          <div className="cta-stars" ref={ctaStarsRef} />
          <div className="container cta-content">
            <div className="cta-trophy reveal fade-scale">🏆</div>
            <h2 className="cta-title reveal fade-up" style={{ '--delay': '100ms' } as any}>
              El Mundial empieza el<br /><span>11 de junio de 2026</span>
            </h2>
            <p className="cta-sub reveal fade-up" style={{ '--delay': '200ms' } as any}>
              Registrate gratis, creá tu grupo privado e invitá a tus amigos. La diversión está garantizada.
            </p>
            <div className="reveal fade-up" style={{ '--delay': '300ms' } as any}>
              <Link to="/register" className="btn btn-cta">Jugar gratis · Es gratis ⚽</Link>
            </div>
            <p style={{ marginTop: '1.2rem', fontSize: '.8rem', color: 'var(--muted)' }} className="reveal fade-in">
              Sin tarjeta de crédito &nbsp;·&nbsp; Sin compromisos &nbsp;·&nbsp; 100% gratuito
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="container footer-inner">
          <div className="footer-logo">
            <img src="/logo.png" alt="Prode Mundial 2026 logo" width={28} height={28} loading="lazy" />
            <span>PRODE <span className="gold">2026</span></span>
          </div>
          <ul className="footer-links">
            <li><Link to="/acerca">Acerca de</Link></li>
            <li><Link to="/privacidad">Privacidad</Link></li>
            <li><Link to="/aviso-legal">Aviso Legal</Link></li>
            <li><Link to="/contacto">Contacto</Link></li>
          </ul>
          <p className="footer-copy">© 2026 Prode Mundial. Proyecto fan-made. No afiliado con FIFA.</p>
        </div>
      </footer>
    </div>
  );
}
