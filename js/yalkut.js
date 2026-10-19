// La halakha du jour (YalkutYosef.kt, 13/10) : une sélection de halakhot courtes
// du ילקוט יוסף – קיצור שולחן ערוך (data/yalkut_yosef.json ; droits et source
// dans tools/yalkut_yosef_construction.py). Mêmes choix que l'application
// Android : deux se'ifim par jour ; Roch 'Hodech ; avant et pendant chaque fête
// les siennes ; les vendredis ordinaires le Chabbat ; sinon la vie de chaque jour.
import { calendrier } from './calendrier-juif.js';

export const PAR_JOUR = 2;
// Les mois de KosherJava et de kosher-zmanim.
const NISSAN = 1, IYAR = 2, SIVAN = 3, TAMMUZ = 4, AV = 5, ELUL = 6, TISHREI = 7, KISLEV = 9, TEVES = 10, SHEVAT = 11, ADAR = 12, ADAR_II = 13;

export function fenetre(mois, jour, embolismique) {
  const adar = embolismique ? ADAR_II : ADAR;
  if (mois === adar && jour <= 15) return 'pourim';
  if (mois === adar || (mois === NISSAN && jour <= 22)) return 'pessah';
  if (mois === NISSAN || mois === IYAR || (mois === SIVAN && jour <= 7)) return 'omer';
  if ((mois === TAMMUZ && jour >= 17) || (mois === AV && jour <= 9)) return 'bein_hametsarim';
  if (mois === ELUL || (mois === TISHREI && jour <= 2)) return 'eloul';
  if (mois === TISHREI && jour <= 10) return 'kippour';
  if (mois === TISHREI && jour <= 23) return 'soukkot';
  if ((mois === KISLEV && jour >= 15) || (mois === TEVES && jour <= 3)) return 'hanouka';
  if (mois === SHEVAT && jour <= 15) return 'tou_bichvat';
  return null;
}

const decale = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10); };
const epoque = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);
const fenetreDu = (iso, il) => { const c = calendrier(iso, il, false, false); return fenetre(c.getJewishMonth(), c.getJewishDayOfMonth(), c.isJewishLeapYear()); };

/** [période, rang du jour dans la période] */
export function periode(iso, il) {
  const c = calendrier(iso, il, false, false);
  // Le 30 ouvre le Roch 'Hodech du mois suivant, le 1er le poursuit : deux rangs qui se suivent.
  if (c.isRoshChodesh()) return ['roch_hodech', c.getJewishDayOfMonth() === 30 ? (c.getJewishMonth() + 1) * 2 : c.getJewishMonth() * 2 + 1];
  const f = fenetreDu(iso, il);
  if (f) {
    let n = 0;
    while (n < 60 && fenetreDu(decale(iso, -(n + 1)), il) === f) n++;
    return [f, n];
  }
  const e = epoque(iso);
  return new Date(`${iso}T12:00:00Z`).getUTCDay() === 5 ? ['chabbat', Math.floor(e / 7)] : ['ordinaire', e];
}

export function du(seifs, rang) {
  if (!seifs?.length) return [];
  const debut = (((rang * PAR_JOUR) % seifs.length) + seifs.length) % seifs.length;
  return Array.from({ length: Math.min(PAR_JOUR, seifs.length) }, (_, i) => seifs[(debut + i) % seifs.length]);
}

export function pour(livre, iso, il) {
  const [p, rang] = periode(iso, il);
  return du(livre.periodes[p] ?? [], rang);
}

export function recherche(livre, texte) {
  const nu = (t) => t.replace(/[־׀]/g, ' ').replace(/[֑-ׇ"'״׳]/g, '');
  const q = nu(texte.trim());
  if (q.length < 2) return [];
  const vus = new Set();
  return Object.values(livre.periodes).flat().filter((x) => {
    const cle = `${x.p}|${x.l}`;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return nu(x.t).includes(q) || nu(x.s).includes(q);
  });
}

/** « ילקוט יוסף · סימן א - הלכות השכמת הבוקר · סעיף ב » */
export const source = (x) => ['ילקוט יוסף', x.s, x.l ? `סעיף ${x.l}` : null].filter(Boolean).join(' · ');

/** Les halakhot du jour en une seule carte (YalkutYosef.titreCarte) : le siman une fois s'il est commun. */
export const titreCarte = (seifs) => (new Set(seifs.map((x) => x.s)).size === 1 ? `ילקוט יוסף · ${seifs[0].s}` : 'ילקוט יוסף');

/** Chaque se'if sous sa lettre, et son siman s'ils diffèrent (YalkutYosef.texteCarte). */
export function texteCarte(seifs) {
  const commun = new Set(seifs.map((x) => x.s)).size === 1;
  return seifs.map((x) => { const l = x.l ? `${x.l}. ` : ''; return commun ? `${l}${x.t}` : `${x.s}\n${l}${x.t}`; }).join('\n\n');
}
