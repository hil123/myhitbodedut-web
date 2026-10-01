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
  ["Likoutei Etsot, Hit'hazkout ", 'Likutei Etzot, Strengthening ', 'ליקוטי עצות, התחזקות '],
  ['Rambam, Hilkhot Tefila ', 'Rambam, Hilchot Tefillah ', 'רמב״ם, הלכות תפילה '],
  ['Likoutei Moharan II, ', 'Likutei Moharan II, ', 'ליקוטי מוהר״ן תניינא, '],
  ['Likoutei Moharan I, ', 'Likutei Moharan I, ', 'ליקוטי מוהר״ן, '],
  ['Likoutei Tefilot II, ', 'Likutei Tefilot II, ', 'ליקוטי תפילות ב, '],
  ['Likoutei Tefilot I, ', 'Likutei Tefilot I, ', 'ליקוטי תפילות א, '],
  ["Si'hot HaRan ", 'Sichot HaRan ', 'שיחות הר״ן '],
  ["'Hayé Moharan ", 'Chayei Moharan ', 'חיי מוהר״ן '],
  ["Chiv'hei HaRan ", 'Shivchei HaRan ', 'שבחי הר״ן '],
  ['Tehilim ', 'Tehillim ', 'תהלים '],
  ['Michlé ', 'Mishlei ', 'משלי '],
  ['Eikha ', 'Eichah ', 'איכה '],
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
