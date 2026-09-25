/* Interactive verhuischecklist: check/uncheck tasks, live progress %, print/PDF,
 * per-device persistence, and a simple email lead-magnet. No data is transmitted;
 * progress is saved only in this browser (localStorage, wrapped in try/catch). */
(() => {
  const root = document.getElementById('checklist');
  if (!root) return;

  const boxes = [...root.querySelectorAll('input[type="checkbox"][data-cl]')];
  const bar = document.getElementById('cl-bar');
  const pct = document.getElementById('cl-percent');
  const cnt = document.getElementById('cl-count');
  const KEY = 'bcz-verhuischecklist-v1';

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } };
  let state = load();

  const markItem = (b) => b.closest('.cl-item')?.classList.toggle('is-done', b.checked);

  const update = () => {
    const total = boxes.length;
    const done = boxes.filter((b) => b.checked).length;
    const p = total ? Math.round((done / total) * 100) : 0;
    if (bar) { bar.style.width = p + '%'; bar.parentElement?.setAttribute('aria-valuenow', String(p)); }
    if (pct) pct.textContent = p + '% voltooid';
    if (cnt) cnt.textContent = done + ' van ' + total + ' taken';
  };

  boxes.forEach((b) => {
    if (state[b.dataset.cl]) b.checked = true;
    markItem(b);
    b.addEventListener('change', () => {
      state[b.dataset.cl] = b.checked;
      save(state);
      markItem(b);
      update();
    });
  });
  update();

  document.getElementById('cl-print')?.addEventListener('click', () => window.print());

  document.getElementById('cl-reset')?.addEventListener('click', () => {
    if (!window.confirm('Weet u zeker dat u alle vinkjes wilt wissen?')) return;
    state = {};
    save(state);
    boxes.forEach((b) => { b.checked = false; markItem(b); });
    update();
  });

  // Lead-magnet email form (design concept: nothing is sent).
  const form = document.getElementById('cl-form');
  if (form) {
    const err = form.querySelector('.form-error');
    const email = form.querySelector('[name="email"]');
    form.addEventListener('input', (e) => e.target.removeAttribute?.('aria-invalid'));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (err) err.hidden = true;
      if (!email.value.trim() || !email.checkValidity()) {
        email.setAttribute('aria-invalid', 'true');
        if (err) { err.textContent = 'Vul een geldig e-mailadres in.'; err.hidden = false; }
        return email.focus();
      }
      form.innerHTML = '<div class="success-state" role="status"><p class="eyebrow">Gelukt</p>'
        + '<h2>Bedankt! De checklist is onderweg.</h2>'
        + '<p>U ontvangt de verhuischecklist per e-mail. Wilt u alvast uw verhuizing bespreken? App of bel ons gerust.</p>'
        + '<div class="contact-hooks"><a class="button button-whatsapp" href="https://wa.me/31634755656?text=Hallo%2C%20ik%20heb%20de%20verhuischecklist%20aangevraagd%20bij%20Busje%20komt%20zo." target="_blank" rel="noopener">WhatsApp ons</a>'
        + '<a class="button" href="tel:+31850508282">Bel 085 050 8282</a></div>'
        + '<p class="prototype-note">Ontwerpconcept: deze versie verzendt nog geen gegevens.</p></div>';
    });
  }
})();
