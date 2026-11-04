// La déclinaison magnétique (28/10), pour la boussole du web : le navigateur
// donne le cap par rapport au nord magnétique (iPhone : webkitCompassHeading),
// et la direction de Jérusalem est comptée depuis le nord vrai. Android le fait
// avec GeomagneticField ; le navigateur n'a rien de tel.
//
// Le World Magnetic Model 2025 (NOAA NCEI et British Geological Survey), du
// domaine public : coefficients de WMM2025.COF (13/11/2024), valables de 2025 à
// 2030, recopiés tels quels. Le calcul suit le rapport technique du WMM :
// coordonnées géodésiques vers géocentriques, fonctions de Legendre
// semi-normalisées de Schmidt, champ en coordonnées sphériques puis tourné vers
// le repère géodésique. Vérifié contre WMM2025_TestValues.txt
// (test/magnetisme.test.mjs).

export const EPOQUE = 2025.0;
const N = 12;

/** [n, m, g, h, dg/dt, dh/dt], en nT et nT/an. */
const COEFS = [
  [1,0,-29351.8,0.0,12.0,0.0], [1,1,-1410.8,4545.4,9.7,-21.5], [2,0,-2556.6,0.0,-11.6,0.0],
  [2,1,2951.1,-3133.6,-5.2,-27.7], [2,2,1649.3,-815.1,-8.0,-12.1], [3,0,1361.0,0.0,-1.3,0.0],
  [3,1,-2404.1,-56.6,-4.2,4.0], [3,2,1243.8,237.5,0.4,-0.3], [3,3,453.6,-549.5,-15.6,-4.1],
  [4,0,895.0,0.0,-1.6,0.0], [4,1,799.5,278.6,-2.4,-1.1], [4,2,55.7,-133.9,-6.0,4.1],
  [4,3,-281.1,212.0,5.6,1.6], [4,4,12.1,-375.6,-7.0,-4.4], [5,0,-233.2,0.0,0.6,0.0],
  [5,1,368.9,45.4,1.4,-0.5], [5,2,187.2,220.2,0.0,2.2], [5,3,-138.7,-122.9,0.6,0.4],
  [5,4,-142.0,43.0,2.2,1.7], [5,5,20.9,106.1,0.9,1.9], [6,0,64.4,0.0,-0.2,0.0],
  [6,1,63.8,-18.4,-0.4,0.3], [6,2,76.9,16.8,0.9,-1.6], [6,3,-115.7,48.8,1.2,-0.4],
  [6,4,-40.9,-59.8,-0.9,0.9], [6,5,14.9,10.9,0.3,0.7], [6,6,-60.7,72.7,0.9,0.9],
  [7,0,79.5,0.0,-0.0,0.0], [7,1,-77.0,-48.9,-0.1,0.6], [7,2,-8.8,-14.4,-0.1,0.5],
  [7,3,59.3,-1.0,0.5,-0.8], [7,4,15.8,23.4,-0.1,0.0], [7,5,2.5,-7.4,-0.8,-1.0],
  [7,6,-11.1,-25.1,-0.8,0.6], [7,7,14.2,-2.3,0.8,-0.2], [8,0,23.2,0.0,-0.1,0.0],
  [8,1,10.8,7.1,0.2,-0.2], [8,2,-17.5,-12.6,0.0,0.5], [8,3,2.0,11.4,0.5,-0.4],
  [8,4,-21.7,-9.7,-0.1,0.4], [8,5,16.9,12.7,0.3,-0.5], [8,6,15.0,0.7,0.2,-0.6],
  [8,7,-16.8,-5.2,-0.0,0.3], [8,8,0.9,3.9,0.2,0.2], [9,0,4.6,0.0,-0.0,0.0],
  [9,1,7.8,-24.8,-0.1,-0.3], [9,2,3.0,12.2,0.1,0.3], [9,3,-0.2,8.3,0.3,-0.3],
  [9,4,-2.5,-3.3,-0.3,0.3], [9,5,-13.1,-5.2,0.0,0.2], [9,6,2.4,7.2,0.3,-0.1],
  [9,7,8.6,-0.6,-0.1,-0.2], [9,8,-8.7,0.8,0.1,0.4], [9,9,-12.9,10.0,-0.1,0.1],
  [10,0,-1.3,0.0,0.1,0.0], [10,1,-6.4,3.3,0.0,0.0], [10,2,0.2,0.0,0.1,-0.0],
  [10,3,2.0,2.4,0.1,-0.2], [10,4,-1.0,5.3,-0.0,0.1], [10,5,-0.6,-9.1,-0.3,-0.1],
  [10,6,-0.9,0.4,0.0,0.1], [10,7,1.5,-4.2,-0.1,0.0], [10,8,0.9,-3.8,-0.1,-0.1],
  [10,9,-2.7,0.9,-0.0,0.2], [10,10,-3.9,-9.1,-0.0,-0.0], [11,0,2.9,0.0,0.0,0.0],
  [11,1,-1.5,0.0,-0.0,-0.0], [11,2,-2.5,2.9,0.0,0.1], [11,3,2.4,-0.6,0.0,-0.0],
  [11,4,-0.6,0.2,0.0,0.1], [11,5,-0.1,0.5,-0.1,-0.0], [11,6,-0.6,-0.3,0.0,-0.0],
  [11,7,-0.1,-1.2,-0.0,0.1], [11,8,1.1,-1.7,-0.1,-0.0], [11,9,-1.0,-2.9,-0.1,0.0],
  [11,10,-0.2,-1.8,-0.1,0.0], [11,11,2.6,-2.3,-0.1,0.0], [12,0,-2.0,0.0,0.0,0.0],
  [12,1,-0.2,-1.3,0.0,-0.0], [12,2,0.3,0.7,-0.0,0.0], [12,3,1.2,1.0,-0.0,-0.1],
  [12,4,-1.3,-1.4,-0.0,0.1], [12,5,0.6,-0.0,-0.0,-0.0], [12,6,0.6,0.6,0.1,-0.0],
  [12,7,0.5,-0.1,-0.0,-0.0], [12,8,-0.1,0.8,0.0,0.0], [12,9,-0.4,0.1,0.0,-0.0],
  [12,10,-0.2,-1.0,-0.1,-0.0], [12,11,-1.3,0.1,-0.0,0.0], [12,12,-0.7,0.2,-0.1,-0.1],
];

const A = 6378.137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const RE = 6371.2;
const rad = (d) => (d * Math.PI) / 180;

/** L'année décimale d'une date (2026-07-02 ≈ 2026,5). */
export function anneeDecimale(date) {
  const a = date.getUTCFullYear();
  const debut = Date.UTC(a, 0, 1);
  return a + (date.getTime() - debut) / (Date.UTC(a + 1, 0, 1) - debut);
}

/**
 * Le champ au point donné : latitude et longitude géodésiques en degrés,
 * altitude en km au-dessus de l'ellipsoïde, année décimale. Rend
 * { declinaison, inclinaison } en degrés et X, Y, Z en nT (nord, est, bas).
 */
export function champ(latitude, longitude, altitudeKm, annee) {
  const dt = annee - EPOQUE;
  const phi = rad(latitude);
  const lambda = rad(longitude);
  const Rc = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  const p = (Rc + altitudeKm) * Math.cos(phi);
  const z = (Rc * (1 - E2) + altitudeKm) * Math.sin(phi);
  const r = Math.hypot(p, z);
  const phiC = Math.asin(z / r);
  const cosT = Math.sin(phiC);
  const sinT = Math.cos(phiC);

  // Legendre de Schmidt P[n][m](cos θ) et leur dérivée en θ.
  const P = Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
  const dP = Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
  P[0][0] = 1;
  for (let n = 1; n <= N; n++) {
    for (let m = 0; m <= n; m++) {
      if (n === m) {
        const k = n === 1 ? 1 : Math.sqrt((2 * n - 1) / (2 * n));
        P[n][n] = k * sinT * P[n - 1][n - 1];
        dP[n][n] = k * (cosT * P[n - 1][n - 1] + sinT * dP[n - 1][n - 1]);
      } else {
        const k1 = (2 * n - 1) / Math.sqrt(n * n - m * m);
        const k2 = Math.sqrt(((n - 1) * (n - 1) - m * m) / (n * n - m * m));
        const p2 = n >= 2 ? P[n - 2][m] : 0;
        const d2 = n >= 2 ? dP[n - 2][m] : 0;
        P[n][m] = k1 * cosT * P[n - 1][m] - k2 * p2;
        dP[n][m] = k1 * (cosT * dP[n - 1][m] - sinT * P[n - 1][m]) - k2 * d2;
      }
    }
  }

  let Xc = 0, Yc = 0, Zc = 0;
  for (const [n, m, g0, h0, gd, hd] of COEFS) {
    const g = g0 + dt * gd;
    const h = h0 + dt * hd;
    const f = (RE / r) ** (n + 2);
    const c = Math.cos(m * lambda);
    const s = Math.sin(m * lambda);
    Xc += f * (g * c + h * s) * dP[n][m];
    Yc += f * m * (g * s - h * c) * P[n][m];
    Zc -= f * (n + 1) * (g * c + h * s) * P[n][m];
  }
  Yc /= Math.cos(phiC);

  const psi = phiC - phi;
  const X = Xc * Math.cos(psi) - Zc * Math.sin(psi);
  const Y = Yc;
  const Z = Xc * Math.sin(psi) + Zc * Math.cos(psi);
  const H = Math.hypot(X, Y);
  return {
    declinaison: (Math.atan2(Y, X) * 180) / Math.PI,
    inclinaison: (Math.atan2(Z, H) * 180) / Math.PI,
    X, Y, Z,
  };
}

/** La déclinaison en degrés (positive vers l'est), au niveau de la mer, à la date donnée. */
export function declinaison(latitude, longitude, date = new Date()) {
  return champ(latitude, longitude, 0, anneeDecimale(date)).declinaison;
}
