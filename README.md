# Prode Mundial 2026

Aplicación web para predecir los resultados del Mundial FIFA 2026. Registrate, creá o unite a grupos con amigos, predecí los marcadores de cada partido y competí en una tabla de puntos en tiempo real.

🌐 **[prodemundial26.online](https://prodemundial26.online)**

---

## Características

- **Predicciones por partido** — predecí el marcador exacto de cada partido de la fase de grupos y las eliminatorias
- **Sistema de puntos** — exacto (+3 pts) · resultado correcto (+1 pt)
- **Podio Mundial** — predecí los 3 mejores equipos del torneo · cada posición correcta suma +10 pts
- **Grupos privados** — creá grupos con un código único y compartilo con tus amigos
- **Invitación por link** — compartí un link directo por WhatsApp para que otros se unan automáticamente
- **Tabla de puntos en vivo** — ranking actualizado por grupo tras cada resultado
- **Bloqueo automático** — las predicciones se cierran al inicio de cada partido
- **Panel admin** — el administrador carga resultados, controla el bracket de eliminatorias y puede bloquear partidos manualmente
- **PWA** — instalable en el celular como una app nativa
- **Mobile-first** — diseño optimizado para celulares con navegación inferior tipo pill glass
- **Recordatorios por email** — aviso automático cuando faltan ~3hs para un partido sin pronosticar, y cuando se habilita una nueva fase de eliminatorias

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript |
| Build | Vite + vite-plugin-pwa |
| Routing | React Router v6 |
| Backend / DB | Firebase (Auth + Firestore) |
| Deploy | Vercel |

---

## Estructura del proyecto

```
src/
├── pages/
│   ├── Home.tsx          # Landing page
│   ├── Login.tsx         # Inicio de sesión
│   ├── Register.tsx      # Registro
│   ├── Onboarding.tsx    # Crear / unirse al primer grupo
│   ├── Dashboard.tsx     # Panel principal (predicciones + tabla)
│   ├── Perfil.tsx        # Perfil del usuario y mis grupos
│   ├── Admin.tsx         # Panel de administración
│   ├── Join.tsx          # Landing de invitación por link
│   └── Predictions.tsx   # Vista de predicciones
├── components/
│   ├── BottomNav.tsx     # Navegación inferior (mobile)
│   ├── ScoreSheet.tsx    # Bottom sheet para ingresar marcadores (mobile)
│   └── ProtectedRoute.tsx
├── data/
│   └── matches.ts        # Fixture completo + equipos + bracket
├── hooks/
│   └── useAuth.ts        # Contexto de autenticación
├── lib/
│   └── utils.ts          # Helpers de fechas y generación de códigos
└── firebase.ts           # Inicialización de Firebase
```

---

## Instalación local

### Requisitos

- Node.js 18+
- Cuenta de Firebase con un proyecto configurado (Auth + Firestore)

### Pasos

```bash
# 1. Clonar el repo
git clone https://github.com/boa2025-dev/prodemundial26.git
cd prodemundial26

# 2. Instalar dependencias
npm install

# 3. Configurar Firebase
# Editá src/firebase.ts con los datos de tu proyecto Firebase

# 4. Levantar el servidor de desarrollo
npm run dev
```

### Build de producción

```bash
npm run build
# Los archivos quedan en /dist
```

---

## Firestore — estructura de datos

| Colección / Documento | Contenido |
|---|---|
| `predictions/{uid}_global` | Predicciones de partidos (`matches: {}`) + podio (`bonus: {}`) del usuario |
| `results/matches` | Resultados reales de los partidos de grupos |
| `results/matchLocks` | Bloqueos manuales por partido (admin) |
| `results/bonusResults` | Podio real del Mundial (admin) |
| `knockout/bracket` | Equipos, kickoffs y resultados del bracket eliminatorio |
| `knockout/phases` | Fases habilitadas para predicciones |
| `groups/{code}` | Datos del grupo: nombre, código, `memberUids[]`, `members[]` |
| `notifications/state` | Estado interno del cron de notificaciones (deduplicación) |

---

## Notificaciones por email

Un cron job (`api/cron/notify.ts`) corre cada hora vía **Vercel Cron** y envía mails con **Resend**:

- **Partido por arrancar**: si a un usuario le faltan menos de 3hs para el kickoff de un partido (no bloqueado) y todavía no cargó su pronóstico, recibe un recordatorio.
- **Nueva fase disponible**: cuando el admin habilita una fase de eliminatorias con el bracket ya armado, los usuarios con predicciones pendientes de esa fase reciben un aviso.

Cada combinación partido/usuario y fase se notifica una sola vez (se guarda en `notifications/state`).

### Configuración

Variables de entorno necesarias en Vercel → **Project Settings → Environment Variables** (ver `.env.example`):

| Variable | Descripción |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON completo de la cuenta de servicio (Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada) |
| `RESEND_API_KEY` | API key de [Resend](https://resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | Remitente verificado, ej. `Prode Mundial 2026 <notificaciones@prodemundial26.online>` |
| `CRON_SECRET` | Secreto random — Vercel lo envía automáticamente como `Authorization: Bearer <CRON_SECRET>` en cada ejecución programada |

El cron está declarado en `vercel.json` (`crons`) con frecuencia horaria.

---

## Sistema de puntos

| Acierto | Puntos |
|---|---|
| Marcador exacto | +3 |
| Resultado correcto (G/E/P) | +1 |
| Podio Mundial — posición correcta | +10 |

---

## Panel de administración

Accesible desde `/admin` solo para el email administrador. Permite:

- Cargar los resultados reales de cada partido (fase de grupos y eliminatorias)
- Habilitar / deshabilitar fases del bracket
- Bloquear predicciones manualmente para un partido específico
- Ingresar el podio real del Mundial
- Ver la tabla de puntos de todos los grupos creados en el prode

---

## Deploy

El proyecto se despliega automáticamente en **Vercel** con cada `git push origin main`.

La configuración de `vercel.json` incluye:
- SPA rewrite (`/*` → `/`)
- Cache inmutable para assets
- Headers de seguridad (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

---

## Licencia

Uso personal y educativo. No para distribución comercial.
