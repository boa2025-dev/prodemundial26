import type { Team } from './matches.js';
import { formatDateTime } from './utils.js';

export const SITE_URL = 'https://prodemundial26.online';

export interface CandidateMatch {
  id: string;
  local: Team;
  visitante: Team;
  kickoff: Date;
  label: string;
}

export function matchRow(m: CandidateMatch): string {
  return `
  <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;margin-bottom:10px;">
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="width:42%;text-align:left;color:#f0f4f8;font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:14px;">
          <span style="font-size:18px;vertical-align:middle;">${m.local.f}</span>
          <span style="vertical-align:middle;"> ${m.local.n}</span>
        </td>
        <td style="width:16%;text-align:center;color:#7a8898;font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:12px;letter-spacing:.08em;">VS</td>
        <td style="width:42%;text-align:right;color:#f0f4f8;font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:14px;">
          <span style="vertical-align:middle;">${m.visitante.n} </span>
          <span style="font-size:18px;vertical-align:middle;">${m.visitante.f}</span>
        </td>
      </tr>
    </table>
    <div style="margin-top:8px;text-align:center;color:#c9a84c;font-family:Inter,Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:.04em;">
      ${m.label} · ${formatDateTime(m.kickoff)} hs
    </div>
  </div>`;
}

export function emailShell(title: string, intro: string, rows: string): string {
  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background:#08090f;font-family:Inter,Arial,Helvetica,sans-serif;">
    <div style="background:#08090f;padding:32px 16px;">
      <div style="max-width:520px;margin:0 auto;background:#0c1220;border:1px solid rgba(201,168,76,.2);border-radius:20px;padding:32px 28px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${SITE_URL}/logo.png" alt="" width="44" height="44" style="border-radius:50%;display:block;margin:0 auto 10px;box-shadow:0 0 14px rgba(201,168,76,.35);" />
          <div style="font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:20px;letter-spacing:.04em;color:#f0f4f8;">
            PRODE <span style="color:#c9a84c;">2026</span>
          </div>
        </div>
        <h1 style="font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:800;color:#f0f4f8;margin:0 0 10px;text-align:center;">${title}</h1>
        <p style="color:#7a8898;font-size:14px;line-height:1.6;margin:0 0 20px;text-align:center;">${intro}</p>
        ${rows}
        <div style="text-align:center;margin-top:24px;">
          <a href="${SITE_URL}/dashboard?tab=prode" style="display:inline-block;background:linear-gradient(135deg,#f0c040,#c9a84c);color:#08090f;font-family:Montserrat,Arial,sans-serif;font-weight:800;text-decoration:none;padding:13px 32px;border-radius:50px;font-size:14px;letter-spacing:.02em;">Completar pronóstico</a>
        </div>
        <div style="text-align:center;margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06);">
          <p style="color:#7a8898;font-size:11px;line-height:1.5;margin:0;">
            Recibís este mail porque participás de un grupo en PRODE 2026.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
