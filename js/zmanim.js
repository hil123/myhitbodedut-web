// Les zmanim du jour (Zmanim.kt, 10/10), sans réseau, par kosher-zmanim 0.9.0.
// Le profil est celui d'Android, ligne pour ligne : chaque zman nomme sa
// méthode (ZMANIM.md). web/test compare chaque valeur à KosherJava, à une
// seconde près, et les méthodes équivalentes à Hebcal (sans l'embarquer).

import { ComplexZmanimCalendar, DateTime, GeoLocation, NOAACalculator } from '../vendor/kosher-zmanim-0.9.0.min.js';

export const MOTEUR = 'kosher-zmanim 0.9.0, NOAACalculator';

/** [clé, méthode, paramètres, calcul] : le même ordre et les mêmes méthodes que Zmanim.PROFIL. */
const PROFIL = [
  ['alot', 'degres', '16.1', (c) => c.getAlos16Point1Degrees()],
  ['misheyakir', 'degres', '11.5', (c) => c.getMisheyakir11Point5Degrees()],
  ['netz', 'niveau_mer', '', (c) => c.getSeaLevelSunrise()],
  ['szks_mga', 'mga_72', '72', (c) => c.getSofZmanShmaMGA()],
  ['szks_gra', 'gra', '', (c) => c.getSofZmanShmaGRA()],
  ['szt_mga', 'mga_72', '72', (c) => c.getSofZmanTfilaMGA()],
  ['szt_gra', 'gra', '', (c) => c.getSofZmanTfilaGRA()],
  ['chatsot', 'meridien', '', (c) => c.getSunTransit()],
  ['minha_gedola', 'gra', '', (c) => c.getMinchaGedola()],
  ['minha_ketana', 'gra', '', (c) => c.getMinchaKetana()],
  ['plag', 'gra', '', (c) => c.getPlagHamincha()],
  ['chkia', 'niveau_mer', '', (c) => c.getSeaLevelSunset()],
  ['tset', 'degres', '8.5', (c) => c.getTzaisGeonim8Point5Degrees()],
  ['tset_rt', 'minutes', '72', (c) => c.getTzais72()],
  ['chatsot_layla', 'milieu_chatsot', '', null],
];
export const CLES = PROFIL.map(([cle]) => cle);
export const ALLUMAGES = [18, 20, 22, 30, 40];
export const ALLUMAGE_DEFAUT = 18;

function calendrier(lieu, iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const c = new ComplexZmanimCalendar(new GeoLocation(lieu.nom, lieu.latitude, lieu.longitude, lieu.altitude ?? 0, lieu.fuseau));
  c.setDate(DateTime.fromObject({ year, month, day, hour: 12 }, { zone: lieu.fuseau }));
  // Explicite : le profil calcule au niveau de la mer.
  c.setUseElevation(false);
  // L'algorithme de la NOAA, écrit plutôt que laissé au défaut (Zmanim.kt).
  c.setAstronomicalCalculator(new NOAACalculator());
  return c;
}

/** Le nom du calculateur réellement utilisé, pour les tests. */
export const calculateur = (lieu, iso) => calendrier(lieu, iso).getAstronomicalCalculator().getCalculatorName();

const lendemain = (iso) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + 1, 12)).toISOString().slice(0, 10);
};

/**
 * Le format commun : { cle, methode, parametres, statut, instant (Date|null),
 * moteur }. « absent » : l'événement n'a pas lieu ce jour-là (au-delà du
 * cercle polaire) ; « erreur » : le calcul a échoué. Les deux ne se
 * confondent pas.
 */
function zman(cle, methode, parametres, calcul) {
  try {
    const d = calcul();
    if (d === null || d === undefined) return { cle, methode, parametres, statut: 'absent', instant: null, moteur: MOTEUR };
    const instant = new Date(d.toMillis ? d.toMillis() : +d);
    if (Number.isNaN(+instant)) throw new Error('date invalide');
    return { cle, methode, parametres, statut: 'ok', instant, moteur: MOTEUR };
  } catch {
    return { cle, methode, parametres, statut: 'erreur', instant: null, moteur: MOTEUR };
  }
}

/** Les quinze zmanim du profil pour « AAAA-MM-JJ » au lieu donné. */
export function jour(lieu, iso) {
  const c = calendrier(lieu, iso);
  const chatsot = zman('chatsot', 'meridien', '', () => c.getSunTransit());
  const demain = zman('chatsot', 'meridien', '', () => calendrier(lieu, lendemain(iso)).getSunTransit());
  return PROFIL.map(([cle, methode, parametres, calcul]) => {
    if (cle !== 'chatsot_layla') return zman(cle, methode, parametres, () => calcul(c));
    // getSolarMidnight de KosherJava 2.5.0 : le milieu entre chatsot
    // d'aujourd'hui et de demain. kosher-zmanim 0.9.0 en a une autre
    // définition (le soleil au plus bas) : on suit KosherJava, comme Android,
    // en vérifiant d'abord que les deux chatsot existent.
    if (chatsot.statut !== 'ok' || demain.statut !== 'ok') return zman(cle, methode, parametres, () => null);
    return zman(cle, methode, parametres, () => new Date((+chatsot.instant + +demain.instant) / 2));
  });
}

/** L'allumage : coucher au niveau de la mer moins [minutes] (getCandleLighting). */
export function allumage(lieu, iso, minutes) {
  const c = calendrier(lieu, iso);
  c.setCandleLightingOffset(minutes);
  return zman('allumage', 'avant_chkia', String(minutes), () => c.getCandleLighting());
}

/** « 06:38 » dans le fuseau du lieu. */
export function heure(instant, fuseau) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: fuseau }).format(instant);
}
