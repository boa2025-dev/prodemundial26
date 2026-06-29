export const TZ = 'America/Argentina/Buenos_Aires';

export function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDateFull(d: Date): string {
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  });
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  });
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

export function formatDateTime(d: Date): string {
  return (
    d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: TZ }) +
    ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  );
}

// Host country for a venue string, used to accent match cards with the
// official FIFA World Cup 26 Host Country Emblem colours (Mexico/Canada/USA).
export function getHostCountry(sede: string): 'MX' | 'CA' | 'US' {
  if (/zapopan|guadalupe|azteca|akron|bbva|méxico|guadalajara|monterrey/i.test(sede)) return 'MX';
  if (/vancouver|toronto|bc place|bmo field/i.test(sede)) return 'CA';
  return 'US';
}

export const HOST_COUNTRY_META: Record<'MX' | 'CA' | 'US', { flag: string; color: string }> = {
  MX: { flag: '🇲🇽', color: '#006847' },
  CA: { flag: '🇨🇦', color: '#CE1125' },
  US: { flag: '🇺🇸', color: '#1A237E' },
};

export function mapFirebaseError(code: string): string {
  const map: Record<string, string> = {
    'auth/user-not-found': 'No existe una cuenta con ese email.',
    'auth/wrong-password': 'Contraseña incorrecta. Intentá de nuevo.',
    'auth/invalid-email': 'El formato del email no es válido.',
    'auth/too-many-requests': 'Demasiados intentos fallidos. Intentá más tarde.',
    'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/popup-closed-by-user': 'Cerraste la ventana antes de completar el login.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  };
  return map[code] || 'Ocurrió un error. Intentá de nuevo.';
}
