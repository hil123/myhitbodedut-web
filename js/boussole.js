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
  if (e.absolute && typeof e.alpha === 'number' && Number.isFinite(e.alpha)) {
    if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return norm(360 - e.alpha + angleEcran);
    return capDevant(e.alpha, e.beta, e.gamma, angleEcran);
  }
  return null;
}

/**
 * Le cap de la direction où l'on fait face (bug du 02/11) : alpha seul est le
 * cap du haut de l'écran, qui pointe le ciel quand le téléphone est droit, et
 * le cap s'affole. On somme le haut de l'écran et le dos du téléphone (−Z),
 * passés dans le repère Est-Nord-Haut (matrice Z·X·Y de la spécification
 * DeviceOrientation) : à plat, le premier donne le cap ; droit, le second.
 * Même calcul que BoussoleActivity.capDevant.
 */
export function capDevant(alpha, beta, gamma, angleEcran = 0) {
  const r = Math.PI / 180;
  const [cA, sA, cB, sB, cG, sG] = [Math.cos(alpha * r), Math.sin(alpha * r), Math.cos(beta * r), Math.sin(beta * r), Math.cos(gamma * r), Math.sin(gamma * r)];
  // Le haut de l'écran dans le repère du téléphone, selon la rotation de l'affichage.
  const ux = Math.sin(angleEcran * r);
  const uy = Math.cos(angleEcran * r);
  // Les colonnes X, Y, Z de la matrice : composantes Est et Nord.
  const xE = cA * cG - sA * sB * sG; const xN = cG * sA + cA * sB * sG;
  const yE = -cB * sA; const yN = cA * cB;
  const zE = cG * sA * sB + cA * sG; const zN = sA * sG - cA * cG * sB;
  const est = ux * xE + uy * yE - zE;
  const nord = ux * xN + uy * yN - zN;
  return norm(Math.atan2(est, nord) / r);
}

/** Le cap depuis le nord vrai, au lieu donné. */
export const capVrai = (magnetique, lieu, date = new Date()) => norm(magnetique + declinaison(lieu.latitude, lieu.longitude, date));

/**
 * Faut-il dire de calibrer la boussole (BoussoleActivity.onAccuracyChanged, 02/11) ?
 * Android montre « boussole_calibrer » quand la précision du capteur magnétique tombe à
 * SENSOR_STATUS_ACCURACY_LOW ou plus bas (UNRELIABLE), et le cache sinon ; tant que rien
 * n'est rapporté, l'avertissement reste caché (GONE).
 *
 * Dans un navigateur, seul l'iPhone dit la précision : webkitCompassAccuracy, l'écart
 * possible en degrés, négatif quand le cap n'est pas fiable (CLHeading.headingAccuracy).
 * Le négatif répond à UNRELIABLE ; au-delà de SEUIL_IMPRECIS, c'est LOW (HIGH et MEDIUM
 * couvrant jusqu'à 15° et 30°, le découpage usuel des trois niveaux). Chrome et les
 * autres ne donnent aucune précision : on rend null, « inconnu », et l'avertissement
 * reste caché, comme sur Android tant que le capteur ne s'est pas prononcé.
 */
export const SEUIL_IMPRECIS = 30;
export function aCalibrer(e) {
  const a = e?.webkitCompassAccuracy;
  if (typeof a !== 'number' || !Number.isFinite(a)) return null;
  return a < 0 || a > SEUIL_IMPRECIS;
}
