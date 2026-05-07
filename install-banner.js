(function () {
  'use strict';

  /* ── Registrar Service Worker ── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
  }

  /* ── Detección de plataforma ── */
  const ua = navigator.userAgent;
  const isIOS     = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isDesktop = !isIOS && !isAndroid;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;

  const dismissed = localStorage.getItem('pwa_dismissed') === '1';

  /* No mostrar si ya está instalada o el usuario lo cerró */
  if (isStandalone || dismissed) return;

  /* ── Capturar evento de instalación (Android / Desktop) ── */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    /* En desktop/Android mostramos el banner solo cuando tenemos el prompt */
    if (!isIOS) showBanner();
  });

  /* En iOS lo mostramos directamente (no hay beforeinstallprompt) */
  if (isIOS) {
    window.addEventListener('load', () => {
      setTimeout(showBanner, 1800); // pequeño delay para no interrumpir la carga
    });
  }

  /* ── Inyectar CSS ── */
  const style = document.createElement('style');
  style.textContent = `
    #pwa-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,.55);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex; align-items: flex-end; justify-content: center;
      padding: 1rem;
      animation: pwaFadeIn .25s ease;
    }
    @keyframes pwaFadeIn { from { opacity: 0 } to { opacity: 1 } }

    #pwa-modal {
      background: #0f1828;
      border: 1px solid rgba(201,168,76,.25);
      border-radius: 24px 24px 20px 20px;
      width: 100%; max-width: 420px;
      padding: 2rem 1.6rem 1.6rem;
      box-shadow: 0 -10px 60px rgba(0,0,0,.6);
      animation: pwaSlideUp .3s ease;
      position: relative;
    }
    @keyframes pwaSlideUp {
      from { transform: translateY(40px); opacity: 0 }
      to   { transform: translateY(0);    opacity: 1 }
    }

    #pwa-close {
      position: absolute; top: 1rem; right: 1rem;
      background: rgba(255,255,255,.08); border: none;
      width: 30px; height: 30px; border-radius: 50%;
      color: #fff; font-size: 1rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .2s;
    }
    #pwa-close:hover { background: rgba(255,255,255,.15); }

    .pwa-header {
      display: flex; align-items: center; gap: 1rem; margin-bottom: 1.2rem;
    }
    .pwa-icon {
      width: 60px; height: 60px; border-radius: 14px;
      object-fit: cover; flex-shrink: 0;
      box-shadow: 0 4px 20px rgba(201,168,76,.3);
    }
    .pwa-app-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 900; font-size: 1.1rem; color: #f0f4f8;
    }
    .pwa-app-desc {
      font-size: .78rem; color: #7a8898; margin-top: .2rem; line-height: 1.4;
    }

    .pwa-steps {
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(201,168,76,.12);
      border-radius: 14px; padding: 1rem 1.2rem;
      margin-bottom: 1.2rem;
    }
    .pwa-step {
      display: flex; align-items: flex-start; gap: .75rem;
      font-size: .85rem; color: #c8d0d8; line-height: 1.5;
      padding: .4rem 0;
    }
    .pwa-step:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,.06); }
    .pwa-step-num {
      flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
      background: linear-gradient(135deg,#c9a84c,#7a5010);
      display: flex; align-items: center; justify-content: center;
      font-size: .7rem; font-weight: 800; color: #000;
      margin-top: .1rem;
    }
    .pwa-emoji { font-size: 1.1rem; }

    .pwa-btn-install {
      width: 100%; padding: .9rem;
      background: linear-gradient(135deg, #c9a84c, #a07830);
      border: none; border-radius: 50px;
      font-family: 'Montserrat', sans-serif;
      font-weight: 800; font-size: .95rem; color: #000;
      cursor: pointer; letter-spacing: .04em;
      box-shadow: 0 4px 24px rgba(201,168,76,.35);
      transition: transform .2s, box-shadow .2s;
      margin-bottom: .75rem;
    }
    .pwa-btn-install:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(201,168,76,.5);
    }
    .pwa-btn-skip {
      width: 100%; padding: .7rem;
      background: transparent; border: none;
      font-size: .82rem; color: #7a8898;
      cursor: pointer; transition: color .2s;
    }
    .pwa-btn-skip:hover { color: #f0f4f8; }
  `;
  document.head.appendChild(style);

  /* ── Crear HTML del modal ── */
  function showBanner() {
    if (document.getElementById('pwa-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pwa-overlay';

    const iosSteps = `
      <div class="pwa-steps">
        <div class="pwa-step">
          <span class="pwa-step-num">1</span>
          <span>Tocá el botón <strong style="color:#f0f4f8">Compartir</strong> <span class="pwa-emoji">⬆️</span> en la barra inferior de Safari</span>
        </div>
        <div class="pwa-step">
          <span class="pwa-step-num">2</span>
          <span>Deslizá hacia abajo y tocá <strong style="color:#f0f4f8">"Agregar a pantalla de inicio"</strong> <span class="pwa-emoji">➕</span></span>
        </div>
        <div class="pwa-step">
          <span class="pwa-step-num">3</span>
          <span>Tocá <strong style="color:#f0f4f8">"Agregar"</strong> en la esquina superior derecha <span class="pwa-emoji">✅</span></span>
        </div>
      </div>
    `;

    const androidDesktopBtn = `
      <button class="pwa-btn-install" id="pwa-btn-install">
        ⚽ Instalar app
      </button>
    `;

    overlay.innerHTML = `
      <div id="pwa-modal">
        <button id="pwa-close" aria-label="Cerrar">✕</button>
        <div class="pwa-header">
          <img src="/logo.png" alt="Prode Mundial 2026" class="pwa-icon"/>
          <div>
            <div class="pwa-app-name">Prode Mundial 2026</div>
            <div class="pwa-app-desc">Instalá la app y accedé rápido desde tu pantalla de inicio</div>
          </div>
        </div>
        ${isIOS ? iosSteps : androidDesktopBtn}
        <button class="pwa-btn-skip" id="pwa-btn-skip">Continuar en la web</button>
      </div>
    `;

    document.body.appendChild(overlay);

    /* Cerrar al hacer click fuera del modal */
    overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });
    document.getElementById('pwa-close').addEventListener('click', dismiss);
    document.getElementById('pwa-btn-skip').addEventListener('click', dismiss);

    /* Botón instalar (Android / Desktop) */
    const btnInstall = document.getElementById('pwa-btn-install');
    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') localStorage.setItem('pwa_dismissed', '1');
        dismiss();
      });
    }
  }

  function dismiss() {
    const overlay = document.getElementById('pwa-overlay');
    if (overlay) overlay.remove();
    localStorage.setItem('pwa_dismissed', '1');
  }
})();
