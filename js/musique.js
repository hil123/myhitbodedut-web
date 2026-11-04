// La musique : les règles sans navigateur, pour se tester (web/test/musique.test.mjs).

/**
 * La lecture aléatoire (MelangeMusique.kt, demande du 28/09) : un morceau au
 * hasard, puis un autre, et aucun ne revient avant que tous aient été entendus.
 * Au passage d'un tour au suivant, le dernier morceau joué n'ouvre pas le
 * nouveau tour : sinon on l'entendrait deux fois de suite.
 *
 * `hasard` rend un nombre dans [0, 1[, comme Math.random.
 */
export class MelangeMusique {
  constructor(hasard = Math.random) {
    this.hasard = hasard;
    this.sac = [];
    this.dernier = null;
  }

  /** Le prochain morceau parmi `ids`, ou null s'il n'y en a aucun. */
  suivant(ids) {
    if (!ids.length) return null;
    // Un morceau retiré entre-temps de la bibliothèque ne doit plus sortir.
    this.sac = this.sac.filter((id) => ids.includes(id));
    if (!this.sac.length) {
      const tour = [...new Set(ids)];
      // Fisher-Yates, comme List.shuffled de Kotlin.
      for (let i = tour.length - 1; i > 0; i--) {
        const j = Math.floor(this.hasard() * (i + 1));
        [tour[i], tour[j]] = [tour[j], tour[i]];
      }
      if (tour.length > 1 && tour[0] === this.dernier) {
        [tour[0], tour[tour.length - 1]] = [tour[tour.length - 1], tour[0]];
      }
      this.sac.push(...tour);
    }
    this.dernier = this.sac.shift();
    return this.dernier;
  }
}

/** Le titre d'un fichier ajouté : son nom sans l'extension (MusicActivity.displayName). */
export function titreDeFichier(nom) {
  const base = String(nom ?? '').split(/[\\/]/).pop().trim();
  const point = base.lastIndexOf('.');
  return (point > 0 ? base.slice(0, point) : base).trim();
}

/** Le nom donné par l'utilisateur (MusicLibrary.nameOf), ou null s'il porte encore son titre. */
export function nomDonne(noms, id) {
  const v = noms && typeof noms === 'object' ? noms[id] : null;
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/** MusicLibrary.rename : un nom vide rend le titre d'origine. */
export function renomme(noms, id, titre) {
  const suite = { ...(noms && typeof noms === 'object' ? noms : {}) };
  const t = String(titre ?? '').trim();
  if (t === '') delete suite[id]; else suite[id] = t;
  return suite;
}

/** Plus de place pour garder le fichier : chaque navigateur le dit à sa façon. */
export function estQuota(e) {
  return e?.name === 'QuotaExceededError' || e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e?.code === 22;
}
