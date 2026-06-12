export const TZ = 'America/Argentina/Buenos_Aires';

export function formatDateTime(d: Date): string {
  return (
    d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: TZ }) +
    ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  );
}
