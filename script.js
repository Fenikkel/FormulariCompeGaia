// Copia ací la URL del projecte i la clau publicable de Supabase.
const SUPABASE_URL = 'https://snxkaxlxypmqevfsksul.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dbfGWZXvN3cVWrYNnIE2tg_D-x-siVb';

const form = document.getElementById('resultats');
const fields = document.getElementById('formulari');
const nameInput = document.getElementById('nombre');
const saveButton = document.getElementById('guardar');
const statusMessage = document.getElementById('estat');
let sending = false;
let saved = false;
let pendingResult = null;
let pendingSignature = '';

function storageError(response, error) {
  // No registrem el nom, les puntuacions ni les claus del participant.
  console.error('Error de Supabase:', {
    status: response.status, code: error.code, message: error.message,
    details: error.details, hint: error.hint
  });
  const reference = ` (HTTP ${response.status}${error.code ? `, ${error.code}` : ''})`;
  if (error.code === '42501') {
    return new Error('Supabase no permet guardar: cal revisar els permisos d’inserció i la política de la taula resultados.' + reference);
  }
  if (error.code === '23514') {
    return new Error('La taula ha rebutjat el nom, les puntuacions o el total. Cal revisar les restriccions de resultados.' + reference);
  }
  if (error.code === '23502') {
    return new Error('La taula exigix un camp que no s’ha enviat. Cal revisar la configuració de resultados.' + reference);
  }
  if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.code === '42P01' || error.code === '42703') {
    return new Error('La taula resultados o els seus camps no coincidixen amb la configuració del formulari.' + reference);
  }
  if (response.status === 401 || response.status === 403) {
    return new Error('Supabase ha rebutjat l’accés. Cal revisar la clau publicable i els permisos de la taula.' + reference);
  }
  return new Error('No s’han pogut guardar els resultats. Torna-ho a provar. Si continua, avisa l’organització.' + reference);
}

function createScores(containerId, prefix, label, count, scores) {
  const container = document.getElementById(containerId);
  for (let i = 1; i <= count; i++) {
    const group = document.createElement('fieldset');
    group.className = 'puntuacio';
    const legend = document.createElement('legend');
    legend.textContent = `${label} ${i}`;
    group.append(legend);
    const options = document.createElement('div');
    options.className = 'opcions';
    for (const score of scores) {
      const option = document.createElement('label');
      option.className = 'opcio';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `${prefix}${i}`;
      radio.value = String(score);
      radio.checked = score === 0;
      radio.setAttribute('aria-label', `${score} punts`);
      const text = document.createElement('span');
      text.textContent = String(score);
      option.append(radio, text);
      options.append(option);
    }
    group.append(options);
    container.append(group);
  }
}

createScores('blocs', 'bloque', 'Bloc', 10, [0, 5, 15]);
createScores('vies', 'via', 'Via', 2, [0, 20, 50]);

function readResult() {
  const data = new FormData(form);
  const result = { nombre: nameInput.value.trim() };
  let total = 0;
  for (const [prefix, count, allowed] of [['bloque', 10, [0, 5, 15]], ['via', 2, [0, 20, 50]]]) {
    for (let i = 1; i <= count; i++) {
      const raw = data.get(`${prefix}${i}`);
      const score = Number(raw);
      if (raw === null || !allowed.includes(score)) {
        throw new Error('Selecciona una puntuació vàlida en cada bloc i via.');
      }
      result[`${prefix}${i}`] = score;
      total += score;
    }
  }
  result.total = total;
  return result;
}

form.addEventListener('change', () => {
  document.getElementById('total').textContent = `Total: ${readResult().total} punts`;
});
nameInput.addEventListener('input', () => nameInput.removeAttribute('aria-invalid'));
form.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
  }
});

function scrollToTop() {
  function resetPosition() {
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
  resetPosition();
  // Repetix després que el navegador aplique l’altura de la pantalla de resum.
  requestAnimationFrame(() => {
    resetPosition();
    requestAnimationFrame(resetPosition);
  });
}

function showScoreSummary(containerId, label, prefix, count, result) {
  const container = document.getElementById(containerId);
  container.replaceChildren();
  for (let i = 1; i <= count; i++) {
    const row = document.createElement('div');
    const title = document.createElement('dt');
    title.textContent = `${label} ${i}`;
    const score = document.createElement('dd');
    score.textContent = `${result[`${prefix}${i}`]} punts`;
    row.append(title, score);
    container.append(row);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (sending || saved) return;
  statusMessage.textContent = '';
  if (!nameInput.value.trim()) {
    nameInput.setAttribute('aria-invalid', 'true');
    statusMessage.textContent = 'Introduïx el nom de l’escalador.';
    nameInput.focus();
    return;
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('Cal configurar la connexió amb Supabase abans de guardar. Consulta el README.');
    }
    const result = readResult();
    nameInput.value = result.nombre;
    const signature = JSON.stringify(result);
    if (signature !== pendingSignature) {
      pendingResult = { id: crypto.randomUUID(), ...result };
      pendingSignature = signature;
    }

    sending = true;
    fields.disabled = true;
    form.setAttribute('aria-busy', 'true');
    saveButton.textContent = 'Guardant…';
    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/resultados`;
    const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
    // També admet la clau anon antiga. La clau publicable nova només necessita apikey.
    if (SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(pendingResult), signal: controller.signal
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        // Una resposta perduda pot deixar la fila guardada. Confirma-la pel mateix UUID.
        if (response.status === 409 && error.code === '23505') {
          const check = await fetch(`${endpoint}?id=eq.${pendingResult.id}&select=*`, {
            headers, signal: controller.signal
          });
          if (!check.ok) throw storageError(check, await check.json().catch(() => ({})));
          const rows = await check.json();
          if (!rows.some(row => Object.entries(pendingResult).every(([key, value]) => row[key] === value))) {
            throw new Error('No s’ha pogut confirmar el guardat. Torna-ho a provar.');
          }
        } else {
          throw storageError(response, error);
        }
      }
    } finally {
      clearTimeout(timeout);
    }
    saved = true;
    document.getElementById('resum-nom').textContent = pendingResult.nombre;
    showScoreSummary('resum-blocs', 'Bloc', 'bloque', 10, pendingResult);
    showScoreSummary('resum-vies', 'Via', 'via', 2, pendingResult);
    document.getElementById('resum-total').textContent = `${pendingResult.total} punts`;
    form.hidden = true;
    statusMessage.textContent = '';
    document.getElementById('confirmacio').hidden = false;
    document.getElementById('agraiment').focus({ preventScroll: true });
    scrollToTop();
  } catch (error) {
    statusMessage.textContent = error.name === 'AbortError'
      ? 'La connexió ha tardat massa. Torna-ho a provar sense canviar les dades.'
      : error instanceof TypeError
        ? 'No s’ha pogut connectar. Comprova la connexió a Internet i torna-ho a provar.'
        : error.message;
    saveButton.textContent = 'GUARDAR RESULTATS';
  } finally {
    sending = false;
    fields.disabled = saved;
    form.removeAttribute('aria-busy');
  }
});
