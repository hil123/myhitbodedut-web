// Les jours chômés (Holidays.kt), sans réseau.
//
// Android s'appuie sur KosherJava (isAssurBemelacha). Le navigateur a son
// propre calendrier hébraïque, celui d'ICU, exposé par Intl : on y lit le
// jour et le mois hébreux, et la liste des jours de Yom Tov fait le reste.
// Les mêmes cas que HolidaysTest.kt sont vérifiés dans web/test, sous Node
// et sous WebKit (le moteur de Safari).

const FORMAT = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric', month: 'long', timeZone: 'UTC',
});

/** { jour, mois } hébreux d'une date civile « AAAA-MM-JJ ». */
export function dateHebraique(iso) {
  // Midi UTC : aucun fuseau ne fait passer la date au jour voisin.
  const parts = FORMAT.formatToParts(new Date(`${iso}T12:00:00Z`));
  const jour = Number(parts.find((p) => p.type === 'day').value);
  const mois = parts.find((p) => p.type === 'month').value;
  return { jour, mois };
}

// Les jours de fête où le travail est interdit. Le second jour de fête de
// diaspora n'est compté qu'hors d'Israël ; Roch Hachana a deux jours partout.
const YOM_TOV = {
  Tishri: { partout: [1, 2, 10, 15, 22], diaspora: [16, 23] },
  Nisan: { partout: [15, 21], diaspora: [16, 22] },
  Sivan: { partout: [6], diaspora: [7] },
};

export function estYomTov(iso, enIsrael) {
  const { jour, mois } = dateHebraique(iso);
  const fetes = YOM_TOV[mois];
  if (!fetes) return false;
  return fetes.partout.includes(jour) || (!enIsrael && fetes.diaspora.includes(jour));
}

export function estSamedi(iso) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay() === 6;
}

/** Shabbat ou Yom Tov : le jour où la pratique n'est pas attendue. */
export function estJourChome(iso, enIsrael) {
  return estSamedi(iso) || estYomTov(iso, enIsrael);
}

/** Israël par défaut si le téléphone est à l'heure de Jérusalem. */
export function israelParDefaut(fuseau) {
  return fuseau === 'Asia/Jerusalem';
}

// --- Dates civiles locales ------------------------------------------------
// Toutes les journées se nomment « AAAA-MM-JJ », comme LocalDate.toString()
// côté Android : c'est aussi la clé du fichier de sauvegarde.

export function isoLocal(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function ajouteJours(iso, n) {
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + n, 12));
  return d.toISOString().slice(0, 10);
}

/** 0 = dimanche … 6 = samedi. */
export function jourSemaine(iso) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}
