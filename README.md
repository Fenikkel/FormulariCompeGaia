# Resultats d’escalada

Web senzilla en valencià, sense dependències. Cada participant indica el nom, el correu, el gènere, deu blocs (0/5/15) i dos vies (0/20/50), o pot participar en mode anònim sense facilitar dades personals. El total màxim és 250 punts. Les dades de tots els dispositius es guarden juntes en Supabase. `localStorage` només conserva l’identificador del mode anònim; no guarda resultats.

## 1. Configurar l’emmagatzematge gratuït

1. Entra en [Supabase](https://supabase.com), crea un compte i una organització amb el pla **Free**. Crea un projecte, tria una regió europea i guarda la contrasenya de la base de dades. Espera que acabe d’iniciar-se.
2. Obri **SQL Editor**, crea una consulta, copia tot el contingut de `supabase.sql` i prem **Run**. Executa’l una sola vegada. **El script elimina la taula `resultados` i tots els resultats anteriors** abans de crear la nova estructura.
3. En el diàleg **Connect** del projecte trobaràs la URL i la clau publicable. També pots consultar la URL en **Settings → Data API** i la clau en **Settings → API Keys**. Copia la clau **publishable** (`sb_publishable_…`); no copies una clau secret ni service_role.
4. Al principi de `script.js`, substituïx els valors buits:

   ```js
   const SUPABASE_URL = 'https://EL-TEU-PROJECTE.supabase.co';
   const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LA_TEUA_CLAU';
   ```

La clau publicable està pensada per a usar-se en el navegador. La configuració permet llegir les columnes públiques i executar una funció que inserix o actualitza un resultat pel correu; no permet modificar ni eliminar directament la taula. No cal configurar login. Els noms i les puntuacions són públics, però la columna `correo` no té permís de lectura pública.

### Afegir el gènere a una base de dades existent

Executa una sola vegada `migracion-genero.sql` en **SQL Editor** abans de publicar el formulari actualitzat. La migració conserva totes les files i assigna `Altre` als resultats existents. No tornes a executar `supabase.sql`, perquè eixe fitxer recrea la taula i elimina les dades.

El [pla gratuït](https://supabase.com/pricing) pot pausar projectes després d’una setmana amb poca activitat. Abans de la competició, comprova al tauler que el projecte està actiu i fes un enviament de prova. Si està pausat, restaura’l des del tauler.

## 2. Obrir i publicar la web

Per a provar-la localment, des de la carpeta del projecte:

```sh
python3 -m http.server 8000
```

Obri `http://localhost:8000`. No cal instal·lar paquets ni compilar.

Per a compartir-la amb els participants, publica els tres fitxers `index.html`, `styles.css` i `script.js` en un allotjament estàtic amb HTTPS. Per exemple, si puges el projecte a GitHub, activa **Settings → Pages → Deploy from a branch**, selecciona la branca amb els fitxers i la carpeta **/(root)**. GitHub mostrarà l’enllaç públic quan acabe la publicació.

Els participants només necessiten l’enllaç públic i connexió a Internet.

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
    const camps = 'id,nombre,genero,bloque1,bloque2,bloque3,bloque4,bloque5,' +
      'bloque6,bloque7,bloque8,bloque9,bloque10,via1,via2,total,updated_at';
    const url = `${SUPABASE_URL}/rest/v1/resultados` +
      `?select=${camps}&order=updated_at.asc,id.asc&limit=${mida}&offset=${offset}`;
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

Cada fila pública conté `id`, `nombre`, `genero`, `bloque1`…`bloque10`, `via1`, `via2`, `total` i `updated_at` (data de l’últim enviament). El correu o identificador intern no es pot consultar públicament. Quan mostres noms en una altra web, usa `textContent` per a inserir-los com a text.

Documentació oficial: [claus API](https://supabase.com/docs/guides/getting-started/api-keys), [API REST](https://supabase.com/docs/guides/api/creating-routes) i [polítiques de dades](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 4. Comprovar el funcionament

- Inicialment, els dotze controls tenen 0 seleccionat i el total és 0.
- Cada control admet una sola selecció. Amb tots els blocs a 15 i les vies a 50, el total és 250.
- Una combinació de blocs `[15, 5, 0, 15, 5, 15, 0, 5, 15, 5]` i vies `[50, 20]` suma **150**.
- Un nom buit, un correu buit o un correu invàlid mostra un missatge en valencià i no s’envia.
- Cal seleccionar `Femení`, `Masculí` o `Altre` abans d’enviar una participació identificada.
- En activar «Anònim», desapareixen el nom, el correu i el gènere. El resultat es guarda com `Anònim`, amb gènere `Altre`, i utilitza internament una adreça amb format `anonim-UUID@anonim.invalid`. El UUID es conserva en `localStorage`, de manera que el mateix navegador reutilitza la identitat després de recarregar i actualitza el resultat anterior.
- Durant l’enviament, el formulari queda bloquejat. Després de guardar, s’oculta i mostra «Gràcies per participar» amb un resum del correu i les dades enviades.
- Si falla la connexió, conserva els valors i permet reintentar. Un correu nou crea una fila; un correu ja registrat reemplaça el nom, les puntuacions i el total anteriors.
- Revisa la web a 320 px i amb el teclat: Tab per a entrar als grups i fletxes per a canviar puntuacions.
- Amb Supabase configurat, envia resultats des de dos telèfons i comprova que apareixen en `resultados` i en la consulta anterior.

El bloqueig dura fins que es recarrega la pàgina. Els noms poden repetir-se, però cada correu només té un resultat. Qualsevol persona que conega un correu registrat pot reemplaçar el seu resultat perquè esta web no té autenticació. En mode anònim, canviar de navegador, usar navegació privada o esborrar les dades locals genera una identitat nova; diverses persones que compartixen el mateix navegador també compartixen la identitat anònima. No hi ha guardat de resultats sense connexió.

## Si Supabase rebutja el guardat

El missatge inclou l’estat HTTP i el codi de Supabase. La consola del navegador mostra una entrada **Error de Supabase** amb la causa tècnica, sense afegir el nom, les puntuacions enviades ni les claus. En un ordinador, obri les ferramentes de desenvolupament i la pestanya **Console**, i prova de guardar.

- `42501`: revisa el permís d’execució de `guardar_resultado` per al rol `anon`.
- `23514`: una restricció de la taula ha rebutjat les dades; el missatge de consola identifica la restricció.
- `23502`: falta un camp obligatori o un valor per defecte en la taula.
- `PGRST202`: executa `migracion-genero.sql` si la base de dades ja existia, o `supabase.sql` en una instal·lació nova.
- `PGRST204` / `PGRST205`: revisa els noms de la taula i dels camps.
- HTTP 401/403: revisa la clau publicable i els permisos.

Després de publicar un canvi, espera que acabe el desplegament de GitHub Pages i recarrega la pàgina sense la memòria cau.
