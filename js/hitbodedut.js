// La hitbodedout guidée (Hitbodedut.kt, HitbodedutCard.kt, GuideSujets.kt),
// portée pour le site le 02/11.
//
// Cinq temps, un à la fois : les quatre premiers sont ceux que Likoutei
// Moharan II, 25 énumère, dans l'ordre du chapitre ; l'action de grâce vient
// du Rambam, Hilkhot Tefila I, 2, qui la place après la demande. Chaque temps
// porte sa propre source. Rien n'oblige : le guide est éteint par défaut, on
// passe d'un temps à l'autre quand on veut, et on peut n'en faire aucun.

/** Le chapitre d'où viennent les quatre premiers temps (graphie française des données, comme Reference.localise l'attend). */
export const SOURCE_LIKOUTEI = 'Likoutei Moharan II, 25';
/** Et celui d'où vient l'action de grâce, qui n'est pas dans ce chapitre. */
export const SOURCE_RAMBAM = 'Rambam, Hilkhot Tefila 1:2';

/** Les temps : clé, intitulé hébreu de la source, chaînes du titre et de l'invitation, illustration, source. */
export const MOUVEMENTS = Object.freeze([
  { cle: 'sihah', he: 'לְפָרֵשׁ שִׂיחָתוֹ', titre: 'hitbodedut_sihah', invite: 'hitbodedut_sihah_invite', illustration: 'char_open_arms', source: SOURCE_LIKOUTEI },
  { cle: 'harata', he: 'חֲרָטָה וּתְשׁוּבָה עַל הֶעָבָר', titre: 'hitbodedut_harata', invite: 'hitbodedut_harata_invite', illustration: 'char_thinking', source: SOURCE_LIKOUTEI },
  { cle: 'bakasha', he: 'בַּקָּשַׁת תַחֲנוּנִים', titre: 'hitbodedut_bakasha', invite: 'hitbodedut_bakasha_invite', illustration: 'char_praying', source: SOURCE_LIKOUTEI },
  { cle: 'torah', he: 'לַעֲשׂוֹת מֵהַתּוֹרָה תְּפִלָּה', titre: 'hitbodedut_torah', invite: 'hitbodedut_torah_invite', illustration: 'char_torah', source: SOURCE_LIKOUTEI },
  { cle: 'hodaa', he: 'נוֹתֵן שֶׁבַח וְהוֹדָיָה', titre: 'hitbodedut_hodaa', invite: 'hitbodedut_hodaa_invite', illustration: 'char_praise', source: SOURCE_RAMBAM },
].map((m) => Object.freeze(m)));

const DERNIER = MOUVEMENTS.length - 1;
const borne = (i) => Math.min(Math.max(Number.isInteger(i) ? i : 0, 0), DERNIER);

export const Hitbodedut = {
  DERNIER,
  /** Le temps à cet indice, ramené dans les bornes plutôt que de rompre. */
  mouvement: (index) => MOUVEMENTS[borne(index)],
  suivant: (index) => borne(index + 1),
  precedent: (index) => borne(index - 1),
  estPremier: (index) => index <= 0,
  estDernier: (index) => index >= DERNIER,
};

/**
 * GuideSujets.invitation : pour chaque sujet, une invitation par temps, sous
 * l'invitation générale du temps (res/raw/guide_sujets.json, proposition 2 du
 * 19/10). « Autre chose » et l'absence de sujet n'en ont pas : null.
 *
 * @param sujets l'objet « sujets » du fichier
 * @param theme la clé du sujet de la séance (store.sessionTheme()), ou null
 */
export function invitationSujet(sujets, theme, cle, langue) {
  if (!sujets || !theme) return null;
  const temps = sujets[theme]?.[cle];
  if (!temps || typeof temps !== 'object') return null;
  const texte = temps[langue === 'he' || langue === 'iw' ? 'he' : langue];
  return typeof texte === 'string' && texte.trim() !== '' ? texte : null;
}
