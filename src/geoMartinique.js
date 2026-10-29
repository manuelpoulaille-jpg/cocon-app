// src/geoMartinique.js
// Localisation approximative des adresses de Martinique (centre de chaque commune),
// pour estimer les trajets entre interventions sans service externe ni clé d'API.

// [nom, codes postaux, latitude, longitude]
const COMMUNES = [
  ["Fort-de-France",     ["97200","97234"], 14.604, -61.068],
  ["Schœlcher",          ["97233"],         14.615, -61.089],
  ["Le Lamentin",        ["97232"],         14.611, -60.997],
  ["Saint-Joseph",       ["97212"],         14.671, -61.041],
  ["Le Robert",          ["97231"],         14.677, -60.941],
  ["Le François",        ["97240"],         14.616, -60.903],
  ["Ducos",              ["97224"],         14.574, -60.974],
  ["Rivière-Salée",      ["97215"],         14.529, -60.969],
  ["Saint-Esprit",       ["97270"],         14.560, -60.929],
  ["Le Vauclin",         ["97280"],         14.545, -60.838],
  ["Rivière-Pilote",     ["97211"],         14.483, -60.901],
  ["Sainte-Luce",        ["97228"],         14.469, -60.924],
  ["Le Marin",           ["97290"],         14.469, -60.868],
  ["Sainte-Anne",        ["97227"],         14.438, -60.882],
  ["Le Diamant",         ["97223"],         14.477, -61.029],
  ["Les Anses-d'Arlet",  ["97217"],         14.487, -61.080],
  ["Les Trois-Îlets",    ["97229"],         14.539, -61.041],
  ["Case-Pilote",        ["97222"],         14.641, -61.131],
  ["Bellefontaine",      ["97222"],         14.670, -61.159],
  ["Le Carbet",          ["97221"],         14.709, -61.178],
  ["Saint-Pierre",       ["97250"],         14.743, -61.176],
  ["Le Prêcheur",        ["97250"],         14.801, -61.224],
  ["Fonds-Saint-Denis",  ["97250"],         14.733, -61.115],
  ["Le Morne-Vert",      ["97226"],         14.704, -61.135],
  ["Le Morne-Rouge",     ["97260"],         14.770, -61.133],
  ["L'Ajoupa-Bouillon",  ["97216"],         14.816, -61.140],
  ["Basse-Pointe",       ["97218"],         14.870, -61.116],
  ["Macouba",            ["97218"],         14.874, -61.144],
  ["Grand'Rivière",      ["97218"],         14.872, -61.180],
  ["Le Lorrain",         ["97214"],         14.832, -61.058],
  ["Le Marigot",         ["97225"],         14.816, -61.035],
  ["Sainte-Marie",       ["97230"],         14.784, -60.992],
  ["La Trinité",         ["97220"],         14.739, -60.963],
  ["Gros-Morne",         ["97213"],         14.715, -61.011],
];

const normaliser = (s) => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/œ/g, "oe")
  .replace(/[^a-z0-9]+/g, " ").trim();

// Écritures acceptées : avec ou sans article, « st » / « ste »
const variantes = (nom) => {
  const base = normaliser(nom);
  const sansArticle = base.replace(/^(le|la|les|l) /, "");
  return [...new Set([base, sansArticle].flatMap(v => [v, v.replace(/\bsainte\b/g, "ste").replace(/\bsaint\b/g, "st")]))];
};

const INDEX = COMMUNES.map(([nom, cps, lat, lon]) => ({ commune:nom, cps, lat, lon, alias:variantes(nom) }));

// Commune dont une écriture apparaît dans le texte (la plus longue l'emporte : « riviere salee » avant « salee »)
const chercherNom = (texte) => {
  const t = ` ${normaliser(texte)} `;
  let meilleur = null, longueur = 0;
  INDEX.forEach(c => c.alias.forEach(a => {
    if (a.length > longueur && t.includes(` ${a} `)) { meilleur = c; longueur = a.length; }
  }));
  return meilleur;
};

const resultat = (c) => c && { commune:c.commune, lat:c.lat, lon:c.lon };

// « Lotissement Ramedace, 97212 Saint-Joseph » → { commune:"Saint-Joseph", lat, lon } ; null si introuvable
export const localiserAdresse = (adresse) => {
  if (!adresse) return null;
  const cp = adresse.match(/\b(972\d{2})\b\s*([^,\n]*)/);
  if (cp) {
    // Le nom après le code postal, puis le code postal seul (partagé par des communes voisines)
    const parNom = chercherNom(cp[2]);
    if (parNom && parNom.cps.includes(cp[1])) return resultat(parNom);
    return resultat(INDEX.find(c => c.cps.includes(cp[1])) || parNom);
  }
  // Sans code postal : la dernière partie de l'adresse, puis l'adresse entière
  const morceaux = adresse.split(",");
  return resultat(chercherNom(morceaux[morceaux.length - 1]) || chercherNom(adresse));
};

// Point de départ des équipes : le siège, Dillon (Fort-de-France)
export const BASE_COCON = { commune:"Fort-de-France (siège)", lat:14.607, lon:-61.056 };

// Distance routière estimée en km (vol d'oiseau × 1,4 pour les routes de Martinique)
export const distanceKm = (a, b) => {
  if (!a || !b) return 0;
  const rad = (x) => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h)) * 1.4;
};
