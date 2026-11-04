// Les morceaux ajoutés depuis l'appareil (MusicLibrary.addUserTrack, 02/11).
//
// Android garde l'adresse du fichier, qu'il relit à chaque séance. Une page ne
// peut pas relire un fichier choisi la veille : elle en garde donc une copie,
// dans IndexedDB (le localStorage n'en tiendrait pas un seul). Rien ne quitte
// l'appareil ; une adresse blob: le fait lire par l'élément <audio>.

const BASE = 'myhitbodedut-musique';
const MAGASIN = 'morceaux';

let base = null;
function ouvre() {
  if (base) return base;
  base = new Promise((resolu, rejete) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN, { keyPath: 'id' });
    r.onsuccess = () => resolu(r.result);
    r.onerror = () => rejete(r.error);
    r.onblocked = () => rejete(new Error('blocked'));
  });
  base.catch(() => { base = null; });
  return base;
}

/** Une transaction menée à son terme ; son erreur (le quota, par exemple) la rejette. */
async function transaction(mode, faire) {
  const db = await ouvre();
  return new Promise((resolu, rejete) => {
    const t = db.transaction(MAGASIN, mode);
    const resultat = faire(t.objectStore(MAGASIN));
    t.oncomplete = () => resolu(resultat?.result);
    t.onerror = () => rejete(t.error ?? resultat?.error);
    t.onabort = () => rejete(t.error ?? new Error('abort'));
  });
}

/**
 * Tous les morceaux gardés, dans l'ordre où ils ont été ajoutés. Rien si le navigateur refuse.
 * `attente` (ms) : au-delà, on rend une liste vide sans retenir le démarrage ; null attend la base.
 */
export async function tous({ attente = 3000 } = {}) {
  if (typeof indexedDB === 'undefined') return [];
  const lus = transaction('readonly', (m) => m.getAll()).then((l) => (l ?? []).sort((a, b) => a.ajoute - b.ajoute)).catch(() => []);
  if (attente === null) return lus;
  return Promise.race([lus, new Promise((resolu) => setTimeout(() => resolu([]), attente))]);
}

/** Garde `blob` sous `id` ; rejette si l'appareil n'a plus de place. */
export async function ajoute({ id, titre, source, blob }) {
  await transaction('readwrite', (m) => m.add({ id, titre, source, ajoute: Date.now(), blob }));
}

export async function retire(id) {
  await transaction('readwrite', (m) => m.delete(id));
}
