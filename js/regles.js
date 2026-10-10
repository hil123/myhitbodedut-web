// Les règles de l'application Android, portées une à une.
//
// Chaque fonction garde le nom et le comportement de son original Kotlin
// (Langue.kt, Reference.kt, JaugeSemaine.kt, DureeSeance.kt,
// Store.formatDuration). Elles ne touchent ni au DOM ni au stockage, pour
// se tester avec Node seul (web/test).

// --- RegleLangue (Langue.kt) ------------------------------------------------
// En hébreu, rien que de l'hébreu ; en anglais, l'hébreu et l'anglais ; en
// français, l'hébreu et le français. Jamais de repli d'une langue sur une
// autre : un texte dont la langue n'est pas permise n'est pas montré.
export const RegleLangue = {
  /** « iw » est l'ancien code d'Android pour l'hébreu. */
  normalise(etiquette) {
    const brute = String(etiquette ?? '').split('-')[0].split('_')[0].toLowerCase();
    return brute === 'iw' ? 'he' : brute;
  },
  permises(interfaceLangue) {
    const l = RegleLangue.normalise(interfaceLangue);
    return l === 'he' ? new Set(['he']) : new Set(['he', l]);
  },
  permet(interfaceLangue, langueDuTexte) {
    return RegleLangue.permises(interfaceLangue).has(RegleLangue.normalise(langueDuTexte));
  },
  /** Montre-t-on une traduction à côté de l'hébreu ? Non, en hébreu. */
  traduit(interfaceLangue) {
    return RegleLangue.normalise(interfaceLangue) !== 'he';
  },
  /** Le texte de la langue de l'interface, ou null. Pas de repli. */
  choisit(interfaceLangue, textes) {
    const t = textes?.[RegleLangue.normalise(interfaceLangue)];
    return typeof t === 'string' && t.trim() !== '' ? t : null;
  },
};

// --- Reference (Reference.kt) -----------------------------------------------
// Du plus long au plus court : « Likoutei Moharan II » avant « … I ».
const LIVRES = [
  ["Likoutei Etsot, Hit'hazkout ", 'Likutei Etsot, Strengthening ', 'ליקוטי עצות, התחזקות '],
  ['Rambam, Hilkhot Tefila ', 'Rambam, Hilkhot Tefillah ', 'רמב״ם, הלכות תפילה '],
  ['Likoutei Moharan II, ', 'Likutei Moharan II, ', 'ליקוטי מוהר״ן תניינא, '],
  ['Likoutei Moharan I, ', 'Likutei Moharan I, ', 'ליקוטי מוהר״ן, '],
  ['Likoutei Tefilot II, ', 'Likutei Tefilot II, ', 'ליקוטי תפילות ב, '],
  ['Likoutei Tefilot I, ', 'Likutei Tefilot I, ', 'ליקוטי תפילות א, '],
  ["Si'hot HaRan ", 'Sihot HaRan ', 'שיחות הר״ן '],
  ["'Hayé Moharan ", 'Hayei Moharan ', 'חיי מוהר״ן '],
  ["Chiv'hei HaRan ", 'Shivhei HaRan ', 'שבחי הר״ן '],
  ['Tehilim ', 'Tehillim ', 'תהילים '],
  ['Michlé ', 'Mishlei ', 'משלי '],
  ['Eikha ', 'Eikha ', 'איכה '],
].map(([fr, en, he]) => ({ fr, en, he }));

const UNITES = ' אבגדהוזחט';
const DIZAINES = ' יכלמנסעפצ';
const CENTAINES = ' קרש';

export const Reference = {
  /**
   * Un nombre en lettres hébraïques, de 1 à 999 : כ״ה, תל״ז, ז׳.
   * 15 et 16 s'écrivent ט״ו et ט״ז, pour ne pas former le Nom.
   */
  lettres(n) {
    if (n <= 0 || n >= 1000) return String(n);
    let b = '';
    let reste = n;
    while (reste >= 400) { b += 'ת'; reste -= 400; }
    if (reste >= 100) { b += CENTAINES[Math.floor(reste / 100)]; reste %= 100; }
    if (reste === 15) b += 'טו';
    else if (reste === 16) b += 'טז';
    else {
      if (reste >= 10) b += DIZAINES[Math.floor(reste / 10)];
      if (reste % 10 > 0) b += UNITES[reste % 10];
    }
    return b.length === 1 ? `${b}׳` : `${b.slice(0, -1)}״${b.slice(-1)}`;
  },

  /** La référence dans la langue de l'interface ; les données portent la graphie française. */
  localise(ref, langue) {
    const cible = RegleLangue.normalise(langue);
    if (cible !== 'en' && cible !== 'he') return ref;
    let texte = ref;
    for (const livre of LIVRES) {
      if (texte.startsWith(livre.fr)) {
        texte = (cible === 'en' ? livre.en : livre.he) + texte.slice(livre.fr.length);
      }
    }
    // L'espace avant le point-virgule est une typographie française.
    texte = texte.split(' ; ').join('; ');
    if (cible === 'he') {
      texte = texte.replace(/(\d+):(\d+)/g, (_, a, b) =>
        `${Reference.lettres(Number(a))}, ${Reference.lettres(Number(b))}`);
      texte = texte.replace(/\d+/g, (m) => Reference.lettres(Number(m)));
    }
    return texte;
  },

  connue(ref) {
    return LIVRES.some((l) => ref.startsWith(l.fr));
  },
};

// --- JaugeSemaine (JaugeSemaine.kt) ------------------------------------------
// Un Chabbat ou un jour de pause n'est pas dû ; une séance faite un jour
// exempté compte quand même.
/**
 * La salutation de l'accueil selon l'heure, comme Salutation.kt : bonjour
 * le matin et l'après-midi, bonsoir le soir et la nuit (demande du 30/09).
 */
export const Salutation = {
  cle(heure) {
    if (heure >= 5 && heure < 12) return 'hero_greeting_morning';
    if (heure >= 12 && heure < 18) return 'hero_greeting_afternoon';
    return 'hero_greeting_evening';
  },
};

/**
 * Les trois anneaux de l'accueil (Anneaux.kt) : le jour en minutes sur
 * l'objectif, la semaine, la série sur le prochain palier. Un anneau ne se
 * ferme pas à l'objectif : la fraction dépasse 1 et le dessin fait un
 * second tour, comme chez Apple.
 */
export const Anneaux = {
  PALIERS: [7, 14, 30, 60, 100, 180, 365],
  palier(serie) {
    const p = this.PALIERS.find((x) => x >= serie);
    return p ?? Math.ceil(serie / 365) * 365;
  },
  anneau(quel, fait, objectif) {
    const fraction = objectif <= 0 ? 0 : fait / objectif;
    return { quel, fait, objectif, fraction, tours: Math.floor(fraction), reste: fraction - Math.floor(fraction), atteint: objectif > 0 && fait >= objectif };
  },
  etat(minutesJour, objectifJour, semaine, serie) {
    const s = Math.max(0, serie);
    return {
      jour: this.anneau('jour', Math.max(0, minutesJour), Math.max(0, objectifJour)),
      semaine: this.anneau('semaine', semaine.faits, semaine.dus),
      serie: this.anneau('serie', s, this.palier(s)),
    };
  },
  objectifEffectif(regle, dureeHabituelle) {
    return regle > 0 ? regle : Math.max(1, dureeHabituelle);
  },
  /**
   * Ce qui rend « nouveau » un anneau fermé (Anneaux.marque) : la date, le
   * dimanche de la semaine, le palier. Un anneau se fête une fois par marque.
   * [aujourdhui] : « AAAA-MM-JJ ».
   */
  marque(anneau, aujourdhui) {
    if (!anneau.atteint) return null;
    if (anneau.quel === 'jour') return `jour:${aujourdhui}`;
    if (anneau.quel === 'semaine') {
      const d = new Date(`${aujourdhui}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - d.getUTCDay());
      return `semaine:${d.toISOString().slice(0, 10)}`;
    }
    return `serie:${anneau.objectif}`;
  },
  marques(etat, aujourdhui) {
    return new Set([etat.jour, etat.semaine, etat.serie].map((a) => this.marque(a, aujourdhui)).filter(Boolean));
  },
  /** Les anneaux fermés pas encore fêtés, du centre vers l'extérieur. */
  aFeter(etat, aujourdhui, dejaFetes) {
    return [etat.jour, etat.semaine, etat.serie]
      .filter((a) => { const m = this.marque(a, aujourdhui); return m !== null && !dejaFetes.has(m); })
      .map((a) => a.quel);
  },
};

/**
 * Les faces du centre des anneaux (Plaque.kt) : le hassid, puis vos
 * chiffres. Chaque face qui parle d'un anneau le met en avant.
 */
export const Plaque = {
  FACES: [['hassid', null], ['jour', 'jour'], ['semaine', 'semaine'], ['serie', 'serie'],
    ['meilleure', 'serie'], ['total', null], ['jours', null], ['moyenne', null]],
  RETOUR_MS: 8000,
  anneau(face) { return this.FACES.find(([f]) => f === face)?.[1] ?? null; },
  suivante(face) {
    const i = this.FACES.findIndex(([f]) => f === face);
    return this.FACES[(i + 1) % this.FACES.length][0];
  },
  pour(quel) { return this.FACES.find(([, a]) => a === quel)[0]; },
  moyenne(totalMinutes, jours) { return jours <= 0 ? 0 : Math.round(totalMinutes / jours); },
  /** La plus longue suite de jours faits ; un jour exempté ne compte pas et ne casse pas. */
  meilleureSerie(faits, exempt) {
    if (faits.size === 0) return 0;
    const tries = [...faits].sort();
    const jour = new Date(`${tries[0]}T00:00:00Z`);
    const fin = tries.at(-1);
    let courante = 0;
    let meilleure = 0;
    for (let iso = tries[0]; iso <= fin; jour.setUTCDate(jour.getUTCDate() + 1), iso = jour.toISOString().slice(0, 10)) {
      if (faits.has(iso)) meilleure = Math.max(meilleure, ++courante);
      else if (!exempt(iso)) courante = 0;
    }
    return meilleure;
  },
};

/**
 * Les deux façons de dire tout le livre de Tehilim (Tehilim.kt) : une
 * portion par jour du mois hébraïque, ou par jour de la semaine.
 */
const portion = (debut, fin, debutVerset = 1, finVerset = null) => ({ debut, fin, debutVerset, finVerset });
export const CycleTehilim = {
  MOIS: [
    [1, 9], [10, 17], [18, 22], [23, 28], [29, 34], [35, 38], [39, 43], [44, 48], [49, 54], [55, 59],
    [60, 65], [66, 68], [69, 71], [72, 76], [77, 78], [79, 82], [83, 87], [88, 89], [90, 96], [97, 103],
    [104, 105], [106, 107], [108, 112], [113, 118], [119, 119, 1, 96], [119, 119, 97, 176],
    [120, 134], [135, 139], [140, 144], [145, 150],
  ].map((a) => portion(...a)),
  /** Du dimanche au Shabbat. */
  SEMAINE: [[1, 29], [30, 50], [51, 72], [73, 89], [90, 106], [107, 119], [120, 150]].map((a) => portion(...a)),
  /** Un mois de 29 jours dit le 29 les deux dernières portions. */
  duMois(jour, longueur) {
    if (jour >= 29 && longueur === 29) return portion(140, 150);
    return this.MOIS[Math.min(30, Math.max(1, jour)) - 1];
  },
  /** [jour] : Date.getDay(), 0 pour dimanche. */
  deLaSemaine(jour) { return this.SEMAINE[jour]; },
  partielle(p) { return p.debut === p.fin && (p.debutVerset > 1 || p.finVerset !== null); },
  /** Les numéros des versets à lire dans [psaume], qui en compte [total]. */
  versets(p, psaume, total) {
    const de = psaume === p.debut ? p.debutVerset : 1;
    const a = psaume === p.fin ? (p.finVerset ?? total) : total;
    return Array.from({ length: a - de + 1 }, (_, i) => de + i);
  },
  portion,
};

export const JaugeSemaine = {
  progression(jours) {
    const faits = jours.filter((j) => j.done).length;
    const dus = jours.filter((j) => j.done || !j.exempt).length;
    const fraction = dus === 0 ? 0 : Math.min(1, Math.max(0, faits / dus));
    return { faits, dus, fraction };
  },
};

// --- DureeSeance (DureeSeance.kt) --------------------------------------------
export const DureeSeance = {
  PROPOSEES: [5, 10, 15, 30, 60, 90],
  MIN: 1,
  MAX: 240,
  /** Le nombre saisi, ramené entre 1 et 240 ; null si ce n'est pas un nombre. */
  lire(texte) {
    const t = String(texte).trim();
    if (!/^[+-]?\d+$/.test(t)) return null;
    const n = Number(t);
    // toIntOrNull() de Kotlin rend null hors des entiers 32 bits.
    if (n > 2147483647 || n < -2147483648) return null;
    return Math.min(DureeSeance.MAX, Math.max(DureeSeance.MIN, n));
  },
};

// --- SiddurMoment (Siddur.kt) ---------------------------------------------------
// Le texte que l'heure suggère en tête du siddour, et le hassid qui l'accompagne.
export const SiddurMoment = {
  /** Le texte de l'heure locale (heures, minutes). */
  suggestion(heures, minutes = 0) {
    const m = heures * 60 + minutes;
    if (m < 5 * 60) return 'tikoun_hatsot';
    if (m < 6 * 60 + 30) return 'birkot_hachahar';
    if (m < 12 * 60 + 30) return 'chaharit';
    if (m < 18 * 60 + 30) return 'minha';
    if (m < 22 * 60 + 30) return 'arvit';
    return 'chema_coucher';
  },
  illustration(id) {
    return {
      tikoun_hatsot: 'char_sitting_low',
      birkot_hachahar: 'char_welcome',
      chaharit: 'char_praying',
      minha: 'char_standing_back',
      arvit: 'char_reading_seated',
    }[id] ?? 'char_thinking';
  },
};

// --- LibraryRules (LibraryRules.kt) ---------------------------------------------
// Une « source » est du domaine public : ses paragraphes s'affichent. La
// vocalisation d'une édition dont la licence n'est pas déclarée est un
// travail éditorial qu'on ne reprend pas : le texte sans nikkoud, alors.
export const LibraryRules = {
  paragraphes(bibliotheque, source) {
    const nikkoudOk = bibliotheque?._meta?.editions?.[source.edition]?.nikkoud_ok === true;
    const avec = source.paragraphes ?? [];
    if (nikkoudOk) return avec;
    const sans = source.paragraphes_sans_nikkoud ?? [];
    return sans.length > 0 ? sans : avec;
  },
  /** Les sources de la bibliothèque, par section et sous-section ; les articles restent sur Android. */
  sources(bibliotheque) {
    return (bibliotheque?.sections ?? []).map((section) => ({
      ...section,
      sous_sections: (section.sous_sections ?? []).map((sous) => ({
        ...sous, entrees: (sous.entrees ?? []).filter((e) => e.type === 'source'),
      })).filter((sous) => sous.entrees.length > 0),
    })).filter((section) => section.sous_sections.length > 0);
  },
  entree(bibliotheque, id) {
    for (const section of bibliotheque?.sections ?? []) {
      for (const sous of section.sous_sections ?? []) {
        const e = (sous.entrees ?? []).find((x) => x.id === id);
        if (e) return e;
      }
    }
    return null;
  },
};
