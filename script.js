// Copia ací la URL del projecte i la clau publicable de Supabase.
const SUPABASE_URL = 'https://snxkaxlxypmqevfsksul.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dbfGWZXvN3cVWrYNnIE2tg_D-x-siVb';

const form = document.getElementById('resultats');
const fields = document.getElementById('formulari');
const anonymousInput = document.getElementById('anonimo');
const identityFields = document.getElementById('dades-personals');
const nameInput = document.getElementById('nombre');
const emailInput = document.getElementById('correo');
const genderGroup = document.getElementById('grup-genero');
const nameLabel = document.querySelector('label[for="nombre"]');
const emailLabel = document.querySelector('label[for="correo"]');
const genderLegend = genderGroup.querySelector('legend');
const genderInputs = [
  document.getElementById('genero-femeni'),
  document.getElementById('genero-masculi'),
  document.getElementById('genero-altre')
];
const saveButton = document.getElementById('guardar');
const statusMessage = document.getElementById('estat');
let sending = false;
let saved = false;
let pendingResult = null;
let anonymousKey = null;
const ANONYMOUS_STORAGE_KEY = 'gaia_anonymous_id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requiredIndicatorTimers = new WeakMap();

function flashRequiredIndicator(label) {
  clearTimeout(requiredIndicatorTimers.get(label));
  label.classList.remove('camp-obligatori-pendent');
  // Força el reinici de l’animació quan es torna a prémer el botó.
  void label.offsetWidth;
  label.classList.add('camp-obligatori-pendent');
  const timer = setTimeout(() => {
    label.classList.remove('camp-obligatori-pendent');
    requiredIndicatorTimers.delete(label);
  }, 2000);
  requiredIndicatorTimers.set(label, timer);
}

function getAnonymousKey() {
  if (anonymousKey) return anonymousKey;
  let id = null;
  try {
    const storedId = localStorage.getItem(ANONYMOUS_STORAGE_KEY);
    if (storedId && UUID_PATTERN.test(storedId)) id = storedId;
  } catch (error) {
    console.warn('No s’ha pogut llegir l’identificador anònim local.', error);
  }
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(ANONYMOUS_STORAGE_KEY, id);
    } catch (error) {
      console.warn('No s’ha pogut conservar l’identificador anònim local.', error);
    }
  }
  anonymousKey = `anonim-${id}`;
  return anonymousKey;
}

function storageError(response, error) {
  // No registrem el nom, les puntuacions ni les claus del participant.
  console.error('Error de Supabase:', {
    status: response.status, code: error.code, message: error.message,
    details: error.details, hint: error.hint
  });
  const reference = ` (HTTP ${response.status}${error.code ? `, ${error.code}` : ''})`;
  if (error.code === '42501') {
    return new Error('Supabase no permet guardar: cal revisar el permís d’execució de la funció guardar_resultado.' + reference);
  }
  if (error.code === '23514') {
    return new Error('La taula ha rebutjat el nom, les puntuacions o el total. Cal revisar les restriccions de resultados.' + reference);
  }
  if (error.code === '23502') {
    return new Error('La taula exigix un camp que no s’ha enviat. Cal revisar la configuració de resultados.' + reference);
  }
  if (error.code === 'PGRST202') {
    return new Error('No s’ha trobat la funció de guardat. Executa migracion-genero.sql en Supabase.' + reference);
  }
  if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.code === '42P01' || error.code === '42703') {
    return new Error('La base de dades no coincidix amb la configuració del formulari.' + reference);
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
  const isAnonymous = anonymousInput.checked;
  const selectedGender = genderInputs.find(input => input.checked);
  const result = {
    nombre: isAnonymous ? 'Anònim' : nameInput.value.trim(),
    correo: isAnonymous ? `${getAnonymousKey()}@anonim.invalid` : emailInput.value.trim().toLowerCase(),
    genero: isAnonymous ? 'Altre' : selectedGender?.value || ''
  };
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
emailInput.addEventListener('input', () => emailInput.removeAttribute('aria-invalid'));
genderInputs.forEach(input => input.addEventListener('change', () => genderGroup.removeAttribute('aria-invalid')));
anonymousInput.addEventListener('change', () => {
  const isAnonymous = anonymousInput.checked;
  identityFields.hidden = isAnonymous;
  nameInput.disabled = isAnonymous;
  emailInput.disabled = isAnonymous;
  genderInputs.forEach(input => { input.disabled = isAnonymous; });
  nameInput.removeAttribute('aria-invalid');
  emailInput.removeAttribute('aria-invalid');
  genderGroup.removeAttribute('aria-invalid');
  statusMessage.textContent = '';
});
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
  if (!anonymousInput.checked && !nameInput.value.trim()) {
    nameInput.setAttribute('aria-invalid', 'true');
    flashRequiredIndicator(nameLabel);
    statusMessage.textContent = 'Introduïx el nom de l’escalador.';
    nameInput.focus();
    return;
  }
  if (!anonymousInput.checked) emailInput.value = emailInput.value.trim().toLowerCase();
  if (!anonymousInput.checked && (!emailInput.value || !emailInput.validity.valid || !EMAIL_PATTERN.test(emailInput.value))) {
    emailInput.setAttribute('aria-invalid', 'true');
    flashRequiredIndicator(emailLabel);
    statusMessage.textContent = 'Introduïx un correu electrònic vàlid.';
    emailInput.focus();
    return;
  }
  if (!anonymousInput.checked && !genderInputs.some(input => input.checked)) {
    genderGroup.setAttribute('aria-invalid', 'true');
    flashRequiredIndicator(genderLegend);
    statusMessage.textContent = 'Selecciona una opció de gènere.';
    genderInputs[0].focus();
    return;
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('Cal configurar la connexió amb Supabase abans de guardar. Consulta el README.');
    }
    const result = readResult();
    if (!anonymousInput.checked) {
      nameInput.value = result.nombre;
      emailInput.value = result.correo;
    }
    pendingResult = result;

    sending = true;
    fields.disabled = true;
    form.setAttribute('aria-busy', 'true');
    saveButton.textContent = 'Guardant…';
    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/guardar_resultado`;
    const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
    // També admet la clau anon antiga. La clau publicable nova només necessita apikey.
    if (SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers,
        body: JSON.stringify(Object.fromEntries(
          Object.entries(pendingResult).map(([key, value]) => [`p_${key}`, value])
        )),
        signal: controller.signal
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw storageError(response, error);
      }
    } finally {
      clearTimeout(timeout);
    }
    saved = true;
    document.getElementById('resum-nom').textContent = pendingResult.nombre;
    document.getElementById('resum-correu').textContent = pendingResult.correo;
    document.getElementById('resum-genero').textContent = pendingResult.genero;
    const isAnonymousResult = pendingResult.correo.endsWith('@anonim.invalid');
    document.getElementById('resum-correu-etiqueta').hidden = isAnonymousResult;
    document.getElementById('resum-correu').hidden = isAnonymousResult;
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
