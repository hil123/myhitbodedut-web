// Les textes de ’hizouk : ce qui peut s'afficher, sous quelle forme, et
// dans quel ordre (ChizukRules.kt, ChizukBag.kt, ChizukCard.kt).
//
// Les textes eux-mêmes viennent de chizuk.json, servi à l'octet près.

import { RegleLangue } from './regles.js';

export const MOMENTS = ['ouverture', 'blocage', 'porte', 'relance', 'cloture', 'lieu'];

/** L'illustration d'un moment (Character.ofMoment) : l'image dit ce qu'on vit. */
export const ART_DU_MOMENT = {
  ouverture: 'char_open_arms',
  blocage: 'char_sitting_low',
  porte: 'char_pointing',
  relance: 'char_walking',
  cloture: 'char_praise',
  lieu: 'char_standing_back',
};

export const ChizukRules = {
  STATUT_PUBLIABLE: 'verifie_texte',

  /** Seul passe un texte relevé de la source ET relu par un humain. */
  publiable: (item) => item.statut_verif === ChizukRules.STATUT_PUBLIABLE && item.relu === true,

  /**
   * Le site est une version publiée : il n'a pas de mode « debug » qui
   * montrerait les textes non relus.
   */
  pourMoment: (chizuk, moment) =>
    chizuk.items.filter((it) => ChizukRules.publiable(it) && (it.moments || []).includes(moment)),

  /**
   * L'hébreu à afficher : sans nikkoud quand la licence de l'édition ne
   * permet pas d'en reprendre la vocalisation.
   */
  hebreu(chizuk, item) {
    const ok = chizuk._meta?.editions?.[item.edition]?.nikkoud_ok ?? false;
    if (ok) return item.he;
    const sans = item.he_sans_nikkoud;
    return typeof sans === 'string' && sans.trim() !== '' ? sans : item.he;
  },

  /**
   * La traduction dans la langue de l'interface ; en hébreu, aucune — le
   * texte au-dessus est le texte lui-même. Jamais d'autre langue (RegleLangue).
   */
  traduction(item, langue) {
    if (!RegleLangue.traduit(langue)) return '';
    return RegleLangue.choisit(langue, { fr: item.fr, en: item.en }) ?? '';
  },
};

// --- ChizukBag : un sac mélangé par moment, tiré sans remise ------------------
export function melange(liste, hasard = Math.random) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ChizukBag = {
  /** { id, reste } : le texte sorti, et le sac tel qu'il reste. */
  suivant(reste, vivier, dernier = null, melanger = melange) {
    if (vivier.length === 0) return { id: null, reste: [] };
    // Un texte retiré des données, ou devenu non publiable, ne ressort pas.
    const utilisable = reste.filter((id) => vivier.includes(id));
    let sac = utilisable;
    if (sac.length === 0) {
      sac = melanger(vivier);
      // Le dernier d'un cycle n'ouvre pas le suivant.
      if (vivier.length > 1 && sac[0] === dernier) sac = [...sac.slice(1), sac[0]];
    }
    return { id: sac[0], reste: sac.slice(1) };
  },

  /** Tire un texte pour ce moment et enregistre le sac restant ; null si rien n'est affichable. */
  tirer(store, chizuk, moment) {
    const vivier = ChizukRules.pourMoment(chizuk, moment).map((it) => it.id);
    const t = ChizukBag.suivant(store.chizukBag(moment), vivier, store.chizukLast(moment));
    store.setChizukBag(moment, t.reste, t.id);
    return t.id ? chizuk.items.find((it) => it.id === t.id) ?? null : null;
  },
};
