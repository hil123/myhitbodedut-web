// Les paliers d'objectifs (Paliers.kt, 11/10) : après chaque palier atteint,
// le suivant. Mêmes pistes, mêmes échelles, mêmes règles qu'Android.

export const PISTES = ['serie', 'jour', 'semaine', 'mois', 'cumul', 'jours'];

const ECHELLES = {
  serie: [[3, 7, 14, 18, 21, 30, 40, 50, 70, 100, 150, 180, 250, 365], 365],
  jour: [[10, 15, 20, 30, 45, 60, 90, 120], 60],
  semaine: [[30, 60, 90, 120, 180, 240, 300, 420, 600, 840], 300],
  mois: [[60, 120, 180, 300, 450, 600, 900, 1200, 1800, 2400, 3000, 3600], 1200],
  cumul: [[60, 180, 300, 600, 1080, 1500, 2160, 3000, 4320, 6000, 9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000], 12000],
  jours: [[1, 3, 7, 10, 18, 30, 40, 50, 70, 100, 150, 180, 250, 365, 500, 613, 800, 1000], 250],
};

const decale = (iso, n) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10);
};
const debutSemaineDe = (iso) => decale(iso, -new Date(`${iso}T12:00:00Z`).getUTCDay());

export function echelle(piste, jusqua, objectifJour = 0) {
  const [base, pas] = ECHELLES[piste];
  const liste = [...base];
  if (piste === 'jour' && objectifJour > 0 && !liste.includes(objectifJour)) liste.push(objectifJour);
  liste.sort((a, b) => a - b);
  while (liste.at(-1) <= jusqua) liste.push(liste.at(-1) + pas);
  return liste;
}

export function etat(piste, valeur, objectifJour = 0) {
  const v = Math.max(0, valeur);
  const e = echelle(piste, v, objectifJour);
  const faits = e.filter((x) => x <= v);
  const atteint = faits.at(-1) ?? 0;
  const prochain = e.find((x) => x > v);
  return { piste, valeur: v, atteint, prochain, rang: faits.length, reste: prochain - v,
    avancee: Math.min(1, Math.max(0, v / prochain)) }; // la valeur sur le prochain palier (15/10)
}

/** minutes : { iso: minutes } des jours faits. */
export function etats({ aujourdhui, minutes, serie, debutMoisHebreu, objectifJour }) {
  const entre = (debut) => Object.entries(minutes).filter(([d]) => d >= debut && d <= aujourdhui).reduce((s, [, m]) => s + m, 0);
  return [
    etat('serie', serie),
    etat('jour', minutes[aujourdhui] ?? 0, objectifJour),
    etat('semaine', entre(debutSemaineDe(aujourdhui))),
    etat('mois', entre(debutMoisHebreu)),
    etat('cumul', Object.values(minutes).reduce((s, m) => s + m, 0)),
    etat('jours', Object.keys(minutes).length),
  ];
}

export const aLaUne = (liste) => liste.filter((e) => ['serie', 'jour', 'semaine', 'mois'].includes(e.piste))
  .reduce((a, b) => (b.avancee > a.avancee ? b : a));

export function marques(liste, { aujourdhui, debutMoisHebreu, objectifJour }) {
  const periode = { jour: `:${aujourdhui}`, semaine: `:${debutSemaineDe(aujourdhui)}`, mois: `:${debutMoisHebreu}` };
  return new Set(liste.flatMap((e) => echelle(e.piste, e.valeur, objectifJour).filter((x) => x <= e.valeur)
    .map((x) => `${e.piste}${periode[e.piste] ?? ''}:${x}`)));
}

export function nouveaux(liste, bilan, vus) {
  const neuves = new Set([...marques(liste, bilan)].filter((m) => !vus.has(m)).map((m) => m.split(':')[0]));
  return liste.filter((e) => neuves.has(e.piste));
}

export function records(minutes, moisDe) {
  const semaines = {};
  const mois = {};
  for (const [d, m] of Object.entries(minutes)) {
    const s = debutSemaineDe(d);
    semaines[s] = (semaines[s] ?? 0) + m;
    const k = moisDe(d);
    mois[k] = (mois[k] ?? 0) + m;
  }
  const max = (o) => Math.max(0, ...Object.values(o));
  return { jour: Math.max(0, ...Object.values(minutes)), semaine: max(semaines), mois: max(mois) };
}
