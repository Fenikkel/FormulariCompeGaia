# Resultats d’escalada

Web senzilla en valencià, sense dependències. Cada participant indica el nom, deu blocs (0/5/15) i dos vies (0/20/50). El total màxim és 250 punts. Les dades de tots els dispositius es guarden juntes en Supabase; no s’utilitza localStorage.

## 1. Configurar l’emmagatzematge gratuït

1. Entra en [Supabase](https://supabase.com), crea un compte i una organització amb el pla **Free**. Crea un projecte, tria una regió europea i guarda la contrasenya de la base de dades. Espera que acabe d’iniciar-se.
2. Obri **SQL Editor**, crea una consulta, copia tot el contingut de `supabase.sql` i prem **Run**. Executa’l una sola vegada en un projecte nou. En **Table Editor** apareixerà `resultados`.
3. En el diàleg **Connect** del projecte trobaràs la URL i la clau publicable. També pots consultar la URL en **Settings → Data API** i la clau en **Settings → API Keys**. Copia la clau **publishable** (`sb_publishable_…`); no copies una clau secret ni service_role.
4. Al principi de `script.js`, substituïx els valors buits:

   ```js
   const SUPABASE_URL = 'https://EL-TEU-PROJECTE.supabase.co';
   const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LA_TEUA_CLAU';
   ```

La clau publicable està pensada per a usar-se en el navegador. La configuració només permet llegir i inserir resultats públicament, sense modificar-los ni eliminar-los. No cal configurar login. Els noms i les puntuacions són públics.

El [pla gratuït](https://supabase.com/pricing) pot pausar projectes després d’una setmana amb poca activitat. Abans de la competició, comprova al tauler que el projecte està actiu i fes un enviament de prova. Si està pausat, restaura’l des del tauler.

## 2. Obrir i publicar la web

Per a provar-la localment, des de la carpeta del projecte:

```sh
python3 -m http.server 8000
```

Obri `http://localhost:8000`. No cal instal·lar paquets ni compilar.

Per a compartir-la amb els participants, publica els tres fitxers `index.html`, `styles.css` i `script.js` en un allotjament estàtic amb HTTPS. Per exemple, si puges el projecte a GitHub, activa **Settings → Pages → Deploy from a branch**, selecciona la branca amb els fitxers i la carpeta **/(root)**. GitHub mostrarà l’enllaç públic quan acabe la publicació.

HTTPS (o localhost en desenvolupament) és necessari per a generar l’UUID amb `crypto.randomUUID()`. Els participants només necessiten l’enllaç públic i connexió a Internet.

## 3. Consultar els resultats des d’una altra web

Usa la mateixa URL i clau publicable. Este exemple recupera totes les files en pàgines de 500 per a no quedar-se amb el límit d’una sola resposta. No necessita cap llibreria:

```js
const SUPABASE_URL = 'https://EL-TEU-PROJECTE.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LA_TEUA_CLAU';

async function llegirResultats() {
  const resultats = [];
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY };
  // Només si utilitzes una clau anon antiga, amb format JWT:
  if (SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
  }

  const mida = 500;
  for (let offset = 0; ; offset += mida) {
    const url = `${SUPABASE_URL}/rest/v1/resultados` +
      `?select=*&order=created_at.asc,id.asc&limit=${mida}&offset=${offset}`;
    const resposta = await fetch(url, { headers });
    if (!resposta.ok) throw new Error('No s’han pogut llegir els resultats.');
    const pagina = await resposta.json();
    resultats.push(...pagina);
    if (pagina.length === 0) break;
  }
  return resultats;
}

llegirResultats().then(console.log).catch(console.error);
```

Cada fila conté `id`, `nombre`, `bloque1`…`bloque10`, `via1`, `via2`, `total` i `created_at` (data del servidor). Quan mostres noms en una altra web, usa `textContent` per a inserir-los com a text.

Documentació oficial: [claus API](https://supabase.com/docs/guides/getting-started/api-keys), [API REST](https://supabase.com/docs/guides/api/creating-routes) i [polítiques de dades](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 4. Comprovar el funcionament

- Inicialment, els dotze controls tenen 0 seleccionat i el total és 0.
- Cada control admet una sola selecció. Amb tots els blocs a 15 i les vies a 50, el total és 250.
- Una combinació de blocs `[15, 5, 0, 15, 5, 15, 0, 5, 15, 5]` i vies `[50, 20]` suma **150**.
- Un nom buit o amb només espais mostra un missatge en valencià i no s’envia.
- Durant l’enviament, el formulari queda bloquejat. Després de guardar, s’oculta i mostra «Gràcies per participar» amb un resum del nom, els blocs, les vies i el total enviats.
- Si falla la connexió, conserva els valors i permet reintentar. Un reintent amb les mateixes dades reutilitza l’UUID i comprova un possible guardat anterior. Si canvies les dades, es considera un altre enviament.
- Revisa la web a 320 px i amb el teclat: Tab per a entrar als grups i fletxes per a canviar puntuacions.
- Amb Supabase configurat, envia resultats des de dos telèfons i comprova que apareixen en `resultados` i en la consulta anterior.

El bloqueig dura fins que es recarrega la pàgina; no es prohibixen noms repetits ni noves participacions després de recarregar. No hi ha enviaments automàtics ni guardat sense connexió.

## Si Supabase rebutja el guardat

El missatge inclou l’estat HTTP i el codi de Supabase. La consola del navegador mostra una entrada **Error de Supabase** amb la causa tècnica, sense afegir el nom, les puntuacions enviades ni les claus. En un ordinador, obri les ferramentes de desenvolupament i la pestanya **Console**, i prova de guardar.

- `42501`: revisa els permisos INSERT del rol `anon` i la política d’inserció.
- `23514`: una restricció de la taula ha rebutjat les dades; el missatge de consola identifica la restricció.
- `23502`: falta un camp obligatori o un valor per defecte en la taula.
- `PGRST204` / `PGRST205`: revisa els noms de la taula i dels camps.
- HTTP 401/403: revisa la clau publicable i els permisos.

Després de publicar un canvi, espera que acabe el desplegament de GitHub Pages i recarrega la pàgina sense la memòria cau.
