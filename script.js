// Copia ací la URL del projecte i la clau publicable de Supabase.
const SUPABASE_URL = 'https://snxkaxlxypmqevfsksul.supabase.co/rest/v1/';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dbfGWZXvN3cVWrYNnIE2tg_D-x-siVb';
// ContrasenyaCompe2026

const form = document.getElementById('resultats');
const fields = document.getElementById('formulari');
const nameInput = document.getElementById('nombre');
const saveButton = document.getElementById('guardar');
const statusMessage = document.getElementById('estat');
let sending = false;
let saved = false;
let pendingResult = null;
let pendingSignature = '';

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
          if (!check.ok) throw new Error('No s’ha pogut confirmar el guardat. Torna-ho a provar.');
          const rows = await check.json();
          if (!rows.some(row => Object.entries(pendingResult).every(([key, value]) => row[key] === value))) {
            throw new Error('No s’ha pogut confirmar el guardat. Torna-ho a provar.');
          }
        } else {
          throw new Error('No s’han pogut guardar els resultats. Torna-ho a provar. Si continua, avisa l’organització.');
        }
      }
    } finally {
      clearTimeout(timeout);
    }
    saved = true;
    statusMessage.textContent = 'Resultats guardats correctament.';
    saveButton.textContent = 'RESULTATS GUARDATS';
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
