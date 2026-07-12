export interface Team {
  n: string;
  f: string;
}

export interface Match {
  id: string;
  grupo: string;
  jornada: number;
  local: Team;
  visitante: Team;
  kickoff: Date;
  sede: string;
}

export interface GroupDef {
  id: string;
  equipos: Team[];
}

export interface KnockoutRound {
  id: string;
  name: string;
  short: string;
  count: number;
}

const GRUPOS_DEF: GroupDef[] = [
  { id: 'A', equipos: [{ n: 'México', f: '🇲🇽' }, { n: 'Sudáfrica', f: '🇿🇦' }, { n: 'Corea del Sur', f: '🇰🇷' }, { n: 'Rep. Checa', f: '🇨🇿' }] },
  { id: 'B', equipos: [{ n: 'Canadá', f: '🇨🇦' }, { n: 'Bosnia y Herz.', f: '🇧🇦' }, { n: 'Qatar', f: '🇶🇦' }, { n: 'Suiza', f: '🇨🇭' }] },
  { id: 'C', equipos: [{ n: 'Brasil', f: '🇧🇷' }, { n: 'Marruecos', f: '🇲🇦' }, { n: 'Haití', f: '🇭🇹' }, { n: 'Escocia', f: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' }] },
  { id: 'D', equipos: [{ n: 'EE.UU.', f: '🇺🇸' }, { n: 'Paraguay', f: '🇵🇾' }, { n: 'Australia', f: '🇦🇺' }, { n: 'Turquía', f: '🇹🇷' }] },
  { id: 'E', equipos: [{ n: 'Alemania', f: '🇩🇪' }, { n: 'Curazao', f: '🇨🇼' }, { n: 'Costa de Marfil', f: '🇨🇮' }, { n: 'Ecuador', f: '🇪🇨' }] },
  { id: 'F', equipos: [{ n: 'Países Bajos', f: '🇳🇱' }, { n: 'Japón', f: '🇯🇵' }, { n: 'Suecia', f: '🇸🇪' }, { n: 'Túnez', f: '🇹🇳' }] },
  { id: 'G', equipos: [{ n: 'Bélgica', f: '🇧🇪' }, { n: 'Egipto', f: '🇪🇬' }, { n: 'Irán', f: '🇮🇷' }, { n: 'Nueva Zelanda', f: '🇳🇿' }] },
  { id: 'H', equipos: [{ n: 'España', f: '🇪🇸' }, { n: 'Cabo Verde', f: '🇨🇻' }, { n: 'Arabia Saudita', f: '🇸🇦' }, { n: 'Uruguay', f: '🇺🇾' }] },
  { id: 'I', equipos: [{ n: 'Francia', f: '🇫🇷' }, { n: 'Senegal', f: '🇸🇳' }, { n: 'Irak', f: '🇮🇶' }, { n: 'Noruega', f: '🇳🇴' }] },
  { id: 'J', equipos: [{ n: 'Argentina', f: '🇦🇷' }, { n: 'Argelia', f: '🇩🇿' }, { n: 'Austria', f: '🇦🇹' }, { n: 'Jordania', f: '🇯🇴' }] },
  { id: 'K', equipos: [{ n: 'Portugal', f: '🇵🇹' }, { n: 'R.D. Congo', f: '🇨🇩' }, { n: 'Uzbekistán', f: '🇺🇿' }, { n: 'Colombia', f: '🇨🇴' }] },
  { id: 'L', equipos: [{ n: 'Inglaterra', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' }, { n: 'Croacia', f: '🇭🇷' }, { n: 'Ghana', f: '🇬🇭' }, { n: 'Panamá', f: '🇵🇦' }] },
];

const E: Record<string, Team[]> = {};
GRUPOS_DEF.forEach(({ id, equipos }) => { E[id] = equipos; });

export const MATCHES: Match[] = [
  // GRUPO A
  { id: 'A1', grupo: 'A', jornada: 1, local: E.A[0], visitante: E.A[1], kickoff: new Date('2026-06-11T19:00:00Z'), sede: 'Estadio Azteca, Ciudad de México' },
  { id: 'A2', grupo: 'A', jornada: 1, local: E.A[2], visitante: E.A[3], kickoff: new Date('2026-06-12T02:00:00Z'), sede: 'Estadio Akron, Zapopan' },
  { id: 'A3', grupo: 'A', jornada: 2, local: E.A[3], visitante: E.A[1], kickoff: new Date('2026-06-18T16:00:00Z'), sede: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'A4', grupo: 'A', jornada: 2, local: E.A[0], visitante: E.A[2], kickoff: new Date('2026-06-19T01:00:00Z'), sede: 'Estadio Akron, Zapopan' },
  { id: 'A5', grupo: 'A', jornada: 3, local: E.A[3], visitante: E.A[0], kickoff: new Date('2026-06-25T01:00:00Z'), sede: 'Estadio Azteca, Ciudad de México' },
  { id: 'A6', grupo: 'A', jornada: 3, local: E.A[1], visitante: E.A[2], kickoff: new Date('2026-06-25T01:00:00Z'), sede: 'Estadio BBVA, Guadalupe' },
  // GRUPO B
  { id: 'B1', grupo: 'B', jornada: 1, local: E.B[0], visitante: E.B[1], kickoff: new Date('2026-06-12T19:00:00Z'), sede: 'BMO Field, Toronto' },
  { id: 'B2', grupo: 'B', jornada: 1, local: E.B[2], visitante: E.B[3], kickoff: new Date('2026-06-13T19:00:00Z'), sede: "Levi's Stadium, Santa Clara" },
  { id: 'B3', grupo: 'B', jornada: 2, local: E.B[3], visitante: E.B[1], kickoff: new Date('2026-06-18T19:00:00Z'), sede: 'SoFi Stadium, Los Ángeles' },
  { id: 'B4', grupo: 'B', jornada: 2, local: E.B[0], visitante: E.B[2], kickoff: new Date('2026-06-18T22:00:00Z'), sede: 'BC Place, Vancouver' },
  { id: 'B5', grupo: 'B', jornada: 3, local: E.B[3], visitante: E.B[0], kickoff: new Date('2026-06-24T19:00:00Z'), sede: 'BC Place, Vancouver' },
  { id: 'B6', grupo: 'B', jornada: 3, local: E.B[1], visitante: E.B[2], kickoff: new Date('2026-06-24T19:00:00Z'), sede: 'Lumen Field, Seattle' },
  // GRUPO C
  { id: 'C1', grupo: 'C', jornada: 1, local: E.C[0], visitante: E.C[1], kickoff: new Date('2026-06-13T22:00:00Z'), sede: 'MetLife Stadium, Nueva York' },
  { id: 'C2', grupo: 'C', jornada: 1, local: E.C[2], visitante: E.C[3], kickoff: new Date('2026-06-14T01:00:00Z'), sede: 'Gillette Stadium, Boston' },
  { id: 'C3', grupo: 'C', jornada: 2, local: E.C[3], visitante: E.C[1], kickoff: new Date('2026-06-19T22:00:00Z'), sede: 'Gillette Stadium, Boston' },
  { id: 'C4', grupo: 'C', jornada: 2, local: E.C[0], visitante: E.C[2], kickoff: new Date('2026-06-20T00:30:00Z'), sede: 'Lincoln Financial Field, Filadelfia' },
  { id: 'C5', grupo: 'C', jornada: 3, local: E.C[3], visitante: E.C[0], kickoff: new Date('2026-06-24T22:00:00Z'), sede: 'Hard Rock Stadium, Miami' },
  { id: 'C6', grupo: 'C', jornada: 3, local: E.C[1], visitante: E.C[2], kickoff: new Date('2026-06-24T22:00:00Z'), sede: 'Mercedes-Benz Stadium, Atlanta' },
  // GRUPO D
  { id: 'D1', grupo: 'D', jornada: 1, local: E.D[0], visitante: E.D[1], kickoff: new Date('2026-06-13T01:00:00Z'), sede: 'SoFi Stadium, Los Ángeles' },
  { id: 'D2', grupo: 'D', jornada: 1, local: E.D[2], visitante: E.D[3], kickoff: new Date('2026-06-14T04:00:00Z'), sede: 'BC Place, Vancouver' },
  { id: 'D3', grupo: 'D', jornada: 2, local: E.D[0], visitante: E.D[2], kickoff: new Date('2026-06-19T19:00:00Z'), sede: 'Lumen Field, Seattle' },
  { id: 'D4', grupo: 'D', jornada: 2, local: E.D[3], visitante: E.D[1], kickoff: new Date('2026-06-20T03:00:00Z'), sede: "Levi's Stadium, Santa Clara" },
  { id: 'D5', grupo: 'D', jornada: 3, local: E.D[3], visitante: E.D[0], kickoff: new Date('2026-06-26T02:00:00Z'), sede: 'SoFi Stadium, Los Ángeles' },
  { id: 'D6', grupo: 'D', jornada: 3, local: E.D[1], visitante: E.D[2], kickoff: new Date('2026-06-26T02:00:00Z'), sede: "Levi's Stadium, Santa Clara" },
  // GRUPO E
  { id: 'E1', grupo: 'E', jornada: 1, local: E.E[0], visitante: E.E[1], kickoff: new Date('2026-06-14T17:00:00Z'), sede: 'NRG Stadium, Houston' },
  { id: 'E2', grupo: 'E', jornada: 1, local: E.E[2], visitante: E.E[3], kickoff: new Date('2026-06-14T23:00:00Z'), sede: 'Lincoln Financial Field, Filadelfia' },
  { id: 'E3', grupo: 'E', jornada: 2, local: E.E[0], visitante: E.E[2], kickoff: new Date('2026-06-20T20:00:00Z'), sede: 'BMO Field, Toronto' },
  { id: 'E4', grupo: 'E', jornada: 2, local: E.E[3], visitante: E.E[1], kickoff: new Date('2026-06-21T00:00:00Z'), sede: 'Arrowhead Stadium, Kansas City' },
  { id: 'E5', grupo: 'E', jornada: 3, local: E.E[1], visitante: E.E[2], kickoff: new Date('2026-06-25T20:00:00Z'), sede: 'Lincoln Financial Field, Filadelfia' },
  { id: 'E6', grupo: 'E', jornada: 3, local: E.E[3], visitante: E.E[0], kickoff: new Date('2026-06-25T20:00:00Z'), sede: 'MetLife Stadium, Nueva York' },
  // GRUPO F
  { id: 'F1', grupo: 'F', jornada: 1, local: E.F[0], visitante: E.F[1], kickoff: new Date('2026-06-14T20:00:00Z'), sede: 'AT&T Stadium, Dallas' },
  { id: 'F2', grupo: 'F', jornada: 1, local: E.F[2], visitante: E.F[3], kickoff: new Date('2026-06-15T02:00:00Z'), sede: 'Estadio BBVA, Guadalupe' },
  { id: 'F3', grupo: 'F', jornada: 2, local: E.F[0], visitante: E.F[2], kickoff: new Date('2026-06-20T17:00:00Z'), sede: 'NRG Stadium, Houston' },
  { id: 'F4', grupo: 'F', jornada: 2, local: E.F[3], visitante: E.F[1], kickoff: new Date('2026-06-21T04:00:00Z'), sede: 'Estadio BBVA, Guadalupe' },
  { id: 'F5', grupo: 'F', jornada: 3, local: E.F[1], visitante: E.F[2], kickoff: new Date('2026-06-25T23:00:00Z'), sede: 'AT&T Stadium, Dallas' },
  { id: 'F6', grupo: 'F', jornada: 3, local: E.F[3], visitante: E.F[0], kickoff: new Date('2026-06-25T23:00:00Z'), sede: 'Arrowhead Stadium, Kansas City' },
  // GRUPO G
  { id: 'G1', grupo: 'G', jornada: 1, local: E.G[2], visitante: E.G[3], kickoff: new Date('2026-06-16T01:00:00Z'), sede: 'SoFi Stadium, Los Ángeles' },
  { id: 'G2', grupo: 'G', jornada: 1, local: E.G[0], visitante: E.G[1], kickoff: new Date('2026-06-15T19:00:00Z'), sede: 'Lumen Field, Seattle' },
  { id: 'G3', grupo: 'G', jornada: 2, local: E.G[0], visitante: E.G[2], kickoff: new Date('2026-06-21T19:00:00Z'), sede: 'SoFi Stadium, Los Ángeles' },
  { id: 'G4', grupo: 'G', jornada: 2, local: E.G[3], visitante: E.G[1], kickoff: new Date('2026-06-22T01:00:00Z'), sede: 'BC Place, Vancouver' },
  { id: 'G5', grupo: 'G', jornada: 3, local: E.G[1], visitante: E.G[2], kickoff: new Date('2026-06-27T03:00:00Z'), sede: 'Lumen Field, Seattle' },
  { id: 'G6', grupo: 'G', jornada: 3, local: E.G[3], visitante: E.G[0], kickoff: new Date('2026-06-27T03:00:00Z'), sede: 'BC Place, Vancouver' },
  // GRUPO H
  { id: 'H1', grupo: 'H', jornada: 1, local: E.H[0], visitante: E.H[1], kickoff: new Date('2026-06-15T16:00:00Z'), sede: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'H2', grupo: 'H', jornada: 1, local: E.H[2], visitante: E.H[3], kickoff: new Date('2026-06-15T22:00:00Z'), sede: 'Hard Rock Stadium, Miami' },
  { id: 'H3', grupo: 'H', jornada: 2, local: E.H[0], visitante: E.H[2], kickoff: new Date('2026-06-21T16:00:00Z'), sede: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'H4', grupo: 'H', jornada: 2, local: E.H[3], visitante: E.H[1], kickoff: new Date('2026-06-21T22:00:00Z'), sede: 'Hard Rock Stadium, Miami' },
  { id: 'H5', grupo: 'H', jornada: 3, local: E.H[1], visitante: E.H[2], kickoff: new Date('2026-06-27T00:00:00Z'), sede: 'NRG Stadium, Houston' },
  { id: 'H6', grupo: 'H', jornada: 3, local: E.H[3], visitante: E.H[0], kickoff: new Date('2026-06-27T00:00:00Z'), sede: 'Estadio Akron, Zapopan' },
  // GRUPO I
  { id: 'I1', grupo: 'I', jornada: 1, local: E.I[0], visitante: E.I[1], kickoff: new Date('2026-06-16T19:00:00Z'), sede: 'MetLife Stadium, Nueva York' },
  { id: 'I2', grupo: 'I', jornada: 1, local: E.I[2], visitante: E.I[3], kickoff: new Date('2026-06-16T22:00:00Z'), sede: 'Gillette Stadium, Boston' },
  { id: 'I3', grupo: 'I', jornada: 2, local: E.I[0], visitante: E.I[2], kickoff: new Date('2026-06-22T21:00:00Z'), sede: 'Lincoln Financial Field, Filadelfia' },
  { id: 'I4', grupo: 'I', jornada: 2, local: E.I[3], visitante: E.I[1], kickoff: new Date('2026-06-23T00:00:00Z'), sede: 'MetLife Stadium, Nueva York' },
  { id: 'I5', grupo: 'I', jornada: 3, local: E.I[3], visitante: E.I[0], kickoff: new Date('2026-06-26T19:00:00Z'), sede: 'Gillette Stadium, Boston' },
  { id: 'I6', grupo: 'I', jornada: 3, local: E.I[1], visitante: E.I[2], kickoff: new Date('2026-06-26T19:00:00Z'), sede: 'BMO Field, Toronto' },
  // GRUPO J
  { id: 'J1', grupo: 'J', jornada: 1, local: E.J[0], visitante: E.J[1], kickoff: new Date('2026-06-17T01:00:00Z'), sede: 'Arrowhead Stadium, Kansas City' },
  { id: 'J2', grupo: 'J', jornada: 1, local: E.J[2], visitante: E.J[3], kickoff: new Date('2026-06-17T04:00:00Z'), sede: "Levi's Stadium, Santa Clara" },
  { id: 'J3', grupo: 'J', jornada: 2, local: E.J[0], visitante: E.J[2], kickoff: new Date('2026-06-22T17:00:00Z'), sede: 'AT&T Stadium, Dallas' },
  { id: 'J4', grupo: 'J', jornada: 2, local: E.J[3], visitante: E.J[1], kickoff: new Date('2026-06-23T03:00:00Z'), sede: "Levi's Stadium, Santa Clara" },
  { id: 'J5', grupo: 'J', jornada: 3, local: E.J[1], visitante: E.J[2], kickoff: new Date('2026-06-28T02:00:00Z'), sede: 'Arrowhead Stadium, Kansas City' },
  { id: 'J6', grupo: 'J', jornada: 3, local: E.J[3], visitante: E.J[0], kickoff: new Date('2026-06-28T02:00:00Z'), sede: 'AT&T Stadium, Dallas' },
  // GRUPO K
  { id: 'K1', grupo: 'K', jornada: 1, local: E.K[0], visitante: E.K[1], kickoff: new Date('2026-06-17T17:00:00Z'), sede: 'NRG Stadium, Houston' },
  { id: 'K2', grupo: 'K', jornada: 1, local: E.K[2], visitante: E.K[3], kickoff: new Date('2026-06-18T02:00:00Z'), sede: 'Estadio Azteca, Ciudad de México' },
  { id: 'K3', grupo: 'K', jornada: 2, local: E.K[0], visitante: E.K[2], kickoff: new Date('2026-06-23T17:00:00Z'), sede: 'NRG Stadium, Houston' },
  { id: 'K4', grupo: 'K', jornada: 2, local: E.K[3], visitante: E.K[1], kickoff: new Date('2026-06-24T02:00:00Z'), sede: 'Estadio Akron, Zapopan' },
  { id: 'K5', grupo: 'K', jornada: 3, local: E.K[3], visitante: E.K[0], kickoff: new Date('2026-06-27T23:30:00Z'), sede: 'Hard Rock Stadium, Miami' },
  { id: 'K6', grupo: 'K', jornada: 3, local: E.K[1], visitante: E.K[2], kickoff: new Date('2026-06-27T23:30:00Z'), sede: 'Mercedes-Benz Stadium, Atlanta' },
  // GRUPO L
  { id: 'L1', grupo: 'L', jornada: 1, local: E.L[0], visitante: E.L[1], kickoff: new Date('2026-06-17T20:00:00Z'), sede: 'AT&T Stadium, Dallas' },
  { id: 'L2', grupo: 'L', jornada: 1, local: E.L[2], visitante: E.L[3], kickoff: new Date('2026-06-17T23:00:00Z'), sede: 'BMO Field, Toronto' },
  { id: 'L3', grupo: 'L', jornada: 2, local: E.L[0], visitante: E.L[2], kickoff: new Date('2026-06-23T20:00:00Z'), sede: 'Gillette Stadium, Boston' },
  { id: 'L4', grupo: 'L', jornada: 2, local: E.L[3], visitante: E.L[1], kickoff: new Date('2026-06-23T23:00:00Z'), sede: 'BMO Field, Toronto' },
  { id: 'L5', grupo: 'L', jornada: 3, local: E.L[3], visitante: E.L[0], kickoff: new Date('2026-06-27T21:00:00Z'), sede: 'MetLife Stadium, Nueva York' },
  { id: 'L6', grupo: 'L', jornada: 3, local: E.L[2], visitante: E.L[1], kickoff: new Date('2026-06-27T21:00:00Z'), sede: 'Lincoln Financial Field, Filadelfia' },
];

export const KNOCKOUT_ROUNDS: KnockoutRound[] = [
  { id: 'R32', name: 'Dieciseisavos de Final', short: '16avos', count: 16 },
  { id: 'R16', name: 'Octavos de Final', short: 'Octavos', count: 8 },
  { id: 'QF', name: 'Cuartos de Final', short: 'Cuartos', count: 4 },
  { id: 'SF', name: 'Semifinales', short: 'Semis', count: 2 },
  { id: 'FINAL', name: 'Final y 3er Puesto', short: 'Final', count: 2 },
];
