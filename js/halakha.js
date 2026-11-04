// La halakha du jour hors ligne (Halakha.kt, 11/10) : le Ben Ish 'Haï,
// Halakhot, en hébreu (data/ben_ish_hai.json, domaine public, Wikisource via
// Sefaria). La section de la paracha du Chabbat qui vient, partagée en sept
// du dimanche au Chabbat ; première année du livre les années hébraïques
// impaires, deuxième les paires, l'autre quand la section manque ; 'Hanouka
// partagée en huit. Mêmes choix que l'application Android.
import { calendrier } from './calendrier-juif.js';

// L'énumération Parsha de KosherJava et de kosher-zmanim, dans l'ordre.
export const PARSHIOT = ['NONE', 'BERESHIS', 'NOACH', 'LECH_LECHA', 'VAYERA', 'CHAYEI_SARA', 'TOLDOS', 'VAYETZEI',
  'VAYISHLACH', 'VAYESHEV', 'MIKETZ', 'VAYIGASH', 'VAYECHI', 'SHEMOS', 'VAERA', 'BO', 'BESHALACH', 'YISRO',
  'MISHPATIM', 'TERUMAH', 'TETZAVEH', 'KI_SISA', 'VAYAKHEL', 'PEKUDEI', 'VAYIKRA', 'TZAV', 'SHMINI', 'TAZRIA',
  'METZORA', 'ACHREI_MOS', 'KEDOSHIM', 'EMOR', 'BEHAR', 'BECHUKOSAI', 'BAMIDBAR', 'NASSO', 'BEHAALOSCHA', 'SHLACH',
  'KORACH', 'CHUKAS', 'BALAK', 'PINCHAS', 'MATOS', 'MASEI', 'DEVARIM', 'VAESCHANAN', 'EIKEV', 'REEH', 'SHOFTIM',
  'KI_SEITZEI', 'KI_SAVO', 'NITZAVIM', 'VAYEILECH', 'HAAZINU', 'VZOS_HABERACHA', 'VAYAKHEL_PEKUDEI',
  'TAZRIA_METZORA', 'ACHREI_MOS_KEDOSHIM', 'BEHAR_BECHUKOSAI', 'CHUKAS_BALAK', 'MATOS_MASEI', 'NITZAVIM_VAYEILECH'];

export const JOINTES = {
  VAYAKHEL_PEKUDEI: ['VAYAKHEL', 'PEKUDEI'], TAZRIA_METZORA: ['TAZRIA', 'METZORA'],
  ACHREI_MOS_KEDOSHIM: ['ACHREI_MOS', 'KEDOSHIM'], BEHAR_BECHUKOSAI: ['BEHAR', 'BECHUKOSAI'],
  CHUKAS_BALAK: ['CHUKAS', 'BALAK'], MATOS_MASEI: ['MATOS', 'MASEI'], NITZAVIM_VAYEILECH: ['NITZAVIM', 'VAYEILECH'],
};

/** [{ s: section, depart, h: halakhot }] pour une paracha dans une année du livre, ou null. */
export function sections(annee, parsha) {
  if (annee[parsha]) return [{ s: annee[parsha], depart: 0, h: annee[parsha].h }];
  if (JOINTES[parsha]) {
    const [a, b] = JOINTES[parsha].map((p) => sections(annee, p));
    return a || b ? [...(a ?? []), ...(b ?? [])] : null;
  }
  // Lue seule, traitée jointe par le livre : sa moitié.
  const jointe = Object.entries(JOINTES).find(([, parts]) => parts.includes(parsha));
  if (jointe && annee[jointe[0]]) {
    const s = annee[jointe[0]]; const milieu = Math.ceil(s.h.length / 2);
    return jointe[1][0] === parsha ? [{ s, depart: 0, h: s.h.slice(0, milieu) }] : [{ s, depart: milieu, h: s.h.slice(milieu) }];
  }
  return null;
}

export function part(items, jour, parts) {
  if (!items.length) return [];
  if (items.length < parts) return [items[jour % items.length]];
  return items.slice(Math.floor(jour * items.length / parts), Math.floor((jour + 1) * items.length / parts));
}

export const anneeDuLivre = (anneeHebraique) => (anneeHebraique % 2 === 1 ? 1 : 2);

/** [{ texte, numero, section, annee }] */
export function choix(livre, parsha, jourSemaine, anneeHebraique, jourHanouka = 0) {
  if (jourHanouka >= 1 && jourHanouka <= 8 && livre.hanouka) {
    const h = livre.hanouka;
    return part(h.h.map((_, i) => i), jourHanouka - 1, 8).map((i) => ({ texte: h.h[i], numero: i + 1, section: h.he, annee: 1 }));
  }
  const premiere = anneeDuLivre(anneeHebraique);
  for (const a of [premiere, 3 - premiere]) {
    const secs = sections(livre.annees[String(a)] ?? {}, parsha);
    if (!secs) continue;
    const toutes = secs.flatMap(({ s, depart, h }) => h.map((t, i) => ({ texte: t, numero: depart + i + 1, section: s.he, annee: a })));
    if (toutes.length) return part(toutes, jourSemaine, 7);
  }
  return [];
}

export function pour(livre, iso, enIsrael) {
  const jc = calendrier(iso, enIsrael, false, false);
  const semaine = jc.getDayOfWeek() - 1; // 1 dimanche … 7 Chabbat
  // getUpcomingParshah de KosherJava (celui de kosher-zmanim 0.9.0 plante : son clone n'a pas getParsha).
  const [a, m, d] = iso.split('-').map(Number);
  let p = jc.getParsha();
  for (let n = 6 - semaine || 7; !p; n += 7) {
    p = calendrier(new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10), enIsrael, false, false).getParsha();
  }
  return choix(livre, PARSHIOT[p], semaine, jc.getJewishYear(), Math.max(0, jc.getDayOfChanukah()));
}

export function recherche(livre, texte) {
  const nu = (t) => t.replace(/[־׀]/g, ' ').replace(/[֑-ׇ"'״׳]/g, '');
  const q = nu(texte.trim());
  if (q.length < 2) return [];
  const tout = Object.keys(livre.annees).sort().flatMap((a) => Object.values(livre.annees[a])
    .flatMap((s) => s.h.map((t, i) => ({ texte: t, numero: i + 1, section: s.he, annee: Number(a) }))));
  if (livre.hanouka) tout.push(...livre.hanouka.h.map((t, i) => ({ texte: t, numero: i + 1, section: livre.hanouka.he, annee: 1 })));
  return tout.filter((x) => nu(x.texte).includes(q));
}

/** « בן איש חי · שנה ראשונה · לך לך · אות א » */
export function source(x, lettres) {
  return ['בן איש חי', x.annee === 1 ? 'שנה ראשונה' : 'שנה שנייה', x.section, `אות ${lettres(x.numero)}`].join(' · ');
}
