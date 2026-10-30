// L'aération d'un paragraphe de prière (28/10, Aeration.kt) : « mieux séparer les textes en
// plusieurs paragraphes, espacer, mettre le premier mot plus grand et plus gras ».
//
// Deux gestes, sur le balisage du siddour (<b>, <small>, <br>) et à l'affichage seulement :
// les données, les annotations et les marque-pages gardent leurs blocs tels quels.
// - Un long paragraphe (plus de LONG lettres visibles) se coupe après une fin de phrase
//   (« : » ou « ׃ » suivi d'une espace, hors balise et hors <small>), quand le morceau
//   en cours a au moins MORCEAU lettres et qu'il en reste au moins RESTE après.
// - Le premier mot est mis en gras s'il ne l'est pas déjà (le renderer l'agrandit) ; un
//   paragraphe qui commence par une balise <small> ou une parenthèse n'est pas touché.

export const LONG = 500;
export const MORCEAU = 250;
export const RESTE = 150;

const visible = (html) => html.replace(/<[^>]+>/g, '').length;

export function premierMot(html) {
  if (html.startsWith('<b>')) return html;
  const m = /^([֐-׿יִ-ﭏ"'״׳-]+)(?=[\s,:;.]|$)/.exec(html);
  return m ? `<b>${m[1]}</b>${html.slice(m[1].length)}` : html;
}

export function couper(html) {
  const total = visible(html);
  if (total <= LONG) return html;
  let sortie = '';
  let balise = false;
  let petit = 0;
  let depuis = 0;
  let vus = 0;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (c === '<') {
      balise = true;
      if (html.startsWith('<small', i)) petit++;
      else if (html.startsWith('</small', i)) petit = Math.max(0, petit - 1);
    }
    sortie += c;
    if (balise) { if (c === '>') balise = false; continue; }
    vus++;
    depuis++;
    if ((c === ':' || c === '׃') && petit === 0 && html[i + 1] === ' ' && depuis >= MORCEAU && total - vus >= RESTE) {
      sortie += '<br><br>';
      i++; // l'espace qui suivait
      depuis = 0;
    }
  }
  return sortie;
}

export function aerer(html) {
  return premierMot(couper(html));
}
