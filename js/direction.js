// La direction de la tefila (28/10, DirectionTefila.kt) : vers le mont du Temple.
// Vérifié : Berakhot 30a ; Choul'han Aroukh O.H. 94:1. Discuté : route la plus courte
// (orthodromie) ou cap constant d'une carte (loxodromie) ; les deux sont donnés, jamais tranché.
// Cible : Dôme du Rocher, 31,7780 N ; 35,2354 E.

export const CIBLE_LAT = 31.7780;
export const CIBLE_LON = 35.2354;
const RAYON_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;
const cap = (r) => ((r * 180) / Math.PI + 360) % 360;

/** Le cap initial de la route la plus courte, en degrés depuis le nord géographique. */
export function orthodromie(lat, lon) {
  const p1 = rad(lat), p2 = rad(CIBLE_LAT), dl = rad(CIBLE_LON - lon);
  return cap(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)));
}

/** Le cap constant (ligne droite sur une carte de Mercator). */
export function loxodromie(lat, lon) {
  let dl = rad(CIBLE_LON - lon);
  if (Math.abs(dl) > Math.PI) dl -= Math.sign(dl) * 2 * Math.PI;
  const dp = Math.log(Math.tan(Math.PI / 4 + rad(CIBLE_LAT) / 2) / Math.tan(Math.PI / 4 + rad(lat) / 2));
  return cap(Math.atan2(dl, dp));
}

/** La distance entre deux points par la route la plus courte, en kilomètres (haversine). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const dp = rad(lat2 - lat1), dl = rad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dl / 2) ** 2;
  return 2 * RAYON_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Le point cardinal le plus proche (0 = nord, 1 = nord-est… 7 = nord-ouest). */
export function octant(c) {
  return Math.floor((((c % 360) + 360) % 360 + 22.5) / 45) % 8;
}
