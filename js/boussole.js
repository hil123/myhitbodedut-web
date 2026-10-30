// La direction de Jérusalem (DirectionJerusalem.kt, 28/10), ligne pour ligne :
// le hassid suit le plus court chemin sur le globe (grand cercle, cap initial),
// la direction réelle ; la direction sur la carte (loxodromie, cap constant)
// reste affichée pour information. Vers Har haBayit, 31,7781° N, 35,2354° E.
// Le cap du téléphone vient de l'orientation de l'appareil (nord magnétique),
// corrigé de la déclinaison du lieu (magnetisme.js, WMM2025).

import { declinaison } from './magnetisme.js';

export const LATITUDE = 31.7781;
export const LONGITUDE = 35.2354;
/** À ±4°, on est face à Jérusalem. */
export const TOLERANCE = 4;
const RAYON_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export const norm = (d) => ((d % 360) + 360) % 360;

export function grandCercle(lat, lon) {
  const f1 = rad(lat), f2 = rad(LATITUDE), dl = rad(LONGITUDE - lon);
  return norm(deg(Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl))));
}

export function carte(lat, lon) {
  let dl = rad(LONGITUDE - lon);
  // Par le plus court côté du méridien de 180°.
  if (Math.abs(dl) > Math.PI) dl = dl > 0 ? dl - 2 * Math.PI : dl + 2 * Math.PI;
  const q = Math.log(Math.tan(Math.PI / 4 + rad(LATITUDE) / 2) / Math.tan(Math.PI / 4 + rad(lat) / 2));
  return norm(deg(Math.atan2(dl, q)));
}

export function distanceKm(lat, lon) {
  const f1 = rad(lat), f2 = rad(LATITUDE);
  const c = Math.sin(f1) * Math.sin(f2) + Math.cos(f1) * Math.cos(f2) * Math.cos(rad(LONGITUDE - lon));
  return RAYON_KM * Math.acos(Math.min(1, Math.max(-1, c)));
}

/** De combien tourner, de -180 (à gauche) à +180 (à droite), pour passer du cap [cap] à [cible]. */
export function ecart(cible, cap) {
  const e = norm(cible - cap);
  return e > 180 ? e - 360 : e;
}

export const face = (e) => Math.abs(e) <= TOLERANCE;
/** En degrés entiers, de 0 à 359. */
export const degres = (d) => Math.round(norm(d)) % 360;
/** Le point cardinal le plus proche, de 0 (N) à 7 (NO). */
export const point = (d) => Math.round(norm(d) / 45) % 8;
/** Un filtre doux sur le cercle : un cinquième du chemin à chaque mesure. */
export const lisser = (avant, mesure) => (avant == null ? mesure : norm(avant + ecart(mesure, avant) * 0.2));
/** La place de Jérusalem sur l'horizon de la scène C, bornée à ±150. */
export const xHorizon = (e) => Math.max(-150, Math.min(150, e * 2.2));

/**
 * Le cap du haut de l'écran, depuis le nord magnétique, d'un événement
 * d'orientation ; null s'il ne donne pas le nord. iPhone : webkitCompassHeading
 * (sens horaire). Ailleurs : alpha d'un événement absolu (sens antihoraire).
 * [angleEcran] : screen.orientation.angle.
 */
export function capMagnetique(e, angleEcran = 0) {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) return norm(e.webkitCompassHeading + angleEcran);
  if (e.absolute && typeof e.alpha === 'number' && Number.isFinite(e.alpha)) return norm(360 - e.alpha + angleEcran);
  return null;
}

/** Le cap depuis le nord vrai, au lieu donné. */
export const capVrai = (magnetique, lieu, date = new Date()) => norm(magnetique + declinaison(lieu.latitude, lieu.longitude, date));
