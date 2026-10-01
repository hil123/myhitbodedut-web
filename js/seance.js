// L'arithmétique d'une séance et la mesure de la danse, sans navigateur :
// SessionRule.kt et DanseMesure.kt, portés tels quels.

// --- SessionRule -----------------------------------------------------------
export const SessionRule = {
  /** La durée d'une séance sans durée. */
  OUVERTE: 0,

  estOuverte: (debut, duree) => debut > 0 && duree === SessionRule.OUVERTE,

  /** Une séance ouverte court tant qu'on ne l'a pas close ; une minutée, jusqu'à son terme. */
  enCours: (debut, fin, duree, maintenant) =>
    SessionRule.estOuverte(debut, duree) ? true : fin > maintenant,

  /** Les minutes pleines écoulées depuis le début. */
  minutesEcoulees(debut, maintenant) {
    if (debut <= 0) return 0;
    return Math.max(0, Math.floor((maintenant - debut) / 60000));
  },

  /** Arrondi au supérieur, jamais négatif. */
  minutesRestantes(fin, maintenant) {
    const reste = fin - maintenant;
    if (reste <= 0) return 0;
    return Math.floor((reste + 59999) / 60000);
  },

  /** Ce que le compteur a le droit de dire. Le masquage l'emporte. */
  compteur: (ouverte, masque) => (masque ? 'masque' : ouverte ? 'ecoule' : 'reste'),
};

// --- DanseMesure -------------------------------------------------------------
// Une mesure de deux temps (t de 0 à 1) : pose A au premier temps, pose B au
// second ; chaque temps est un saut, et la pose change à la réception.
export const DanseMesure = {
  /** Un temps. 480 ms : un peu plus de deux pas par seconde, un niggoun joyeux. */
  TEMPS_MS: 480,
  RELAIS: 0.1,
  FLEXION: 0.14,

  pas(t) {
    const mesure = t - Math.floor(t);
    const temps = mesure * 2;
    const second = temps >= 1;
    const p = temps - Math.floor(temps);
    const relais = Math.min(1, p / DanseMesure.RELAIS);
    return {
      hauteur: Math.max(0, Math.sin(Math.PI * p)),
      flexion: Math.max(0, 1 - p / DanseMesure.FLEXION),
      balance: Math.sin(2 * Math.PI * mesure),
      poseB: second ? relais : 1 - relais,
    };
  },
};
