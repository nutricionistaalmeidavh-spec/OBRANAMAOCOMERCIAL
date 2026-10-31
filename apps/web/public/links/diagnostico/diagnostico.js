(() => {
  'use strict';
  const form = document.querySelector('#diagnostic-form');
  if (!form) return;
  const steps = [...form.querySelectorAll('.wizard-step')];
  const next = document.querySelector('#next-button');
  const back = document.querySelector('#back-button');
  const submit = document.querySelector('#submit-button');
  const message = document.querySelector('#form-message');
  const title = document.querySelector('#step-title');
  const overline = document.querySelector('#step-overline');
  const counter = document.querySelector('.wizard-time');
  const progress = document.querySelector('.progress-track');
  const bar = document.querySelector('#progress-value');
  const heading = ['Sobre sua empresa', 'Sua rotina e desafios', 'Seus objetivos'];
  let current = 0;
  let sending = false;

  function status(text) { message.textContent = text || ''; }
  function showStep(index, moveFocus = false) {
    current = index;
    steps.forEach((step, i) => { step.hidden = i !== index; });
    title.textContent = heading[index];
    overline.textContent = `ETAPA ${index + 1} DE ${steps.length}`;
    counter.textContent = `0${index + 1} / 0${steps.length}`;
    bar.style.width = `${((index + 1) / steps.length) * 100}%`;
    progress.setAttribute('aria-valuenow', String(index + 1));
    back.hidden = index === 0;
    next.hidden = index === steps.length - 1;
    submit.hidden = index !== steps.length - 1;
    status('');
    if (moveFocus) {
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
      document.querySelector('.diagnostic-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  function validateStep(index) {
    const controls = [...steps[index].querySelectorAll('input, select, textarea')].filter(el => !el.disabled);
    for (const el of controls) {
      el.removeAttribute('aria-invalid');
      if (!el.checkValidity()) {
        status('Confira os campos obrigatórios desta etapa.');
        el.setAttribute('aria-invalid', 'true');
        el.focus();
        return false;
      }
    }
    if (index === 0) {
      const whatsapp = form.elements.whatsapp.value.replace(/\D/g, '');
      if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) {
        status('Confira o número de WhatsApp informado.');
        form.elements.whatsapp.setAttribute('aria-invalid', 'true');
        form.elements.whatsapp.focus();
        return false;
      }
    }
    if (index === 1) {
      const selected = [...form.querySelectorAll('input[name="painPoints"]:checked')];
      if (selected.length < 1 || selected.length > 3) {
        status('Selecione de 1 a 3 dificuldades principais.');
        form.querySelector('input[name="painPoints"]').focus();
        return false;
      }
    }
    return true;
  }
  form.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('input', () => {
    el.removeAttribute('aria-invalid');
    if (message.textContent) status('');
  }));
  form.querySelectorAll('input[name="painPoints"]').forEach(el => el.addEventListener('change', () => {
    const chosen = form.querySelectorAll('input[name="painPoints"]:checked');
    if (chosen.length > 3) {
      el.checked = false;
      status('Escolha no máximo três dificuldades.');
    }
  }));
  next.addEventListener('click', () => { if (validateStep(current)) showStep(current + 1, true); });
  back.addEventListener('click', () => { if (current > 0) showStep(current - 1, true); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !validateStep(current)) return;
    const fields = new FormData(form);
    const data = Object.fromEntries(fields);
    data.painPoints = fields.getAll('painPoints');
    data.consent = fields.get('consent') === 'on';
    sending = true;
    submit.disabled = true;
    submit.firstChild.textContent = 'Enviando... ';
    status('Registrando suas respostas com segurança...');
    try {
      const response = await fetch('/api/public/diagnostico', {
        method: 'POST', credentials: 'omit', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.message || 'Não foi possível enviar. Tente novamente.');
      form.hidden = true;
      document.querySelector('.wizard-head').hidden = true;
      progress.hidden = true;
      document.querySelector('#protocol-number').textContent = result.protocol;
      const success = document.querySelector('#diagnostic-success');
      success.hidden = false;
      success.querySelector('h2').setAttribute('tabindex', '-1');
      success.querySelector('h2').focus();
    } catch (error) {
      status(error instanceof Error ? error.message : 'Falha no envio. Tente novamente.');
    } finally {
      sending = false;
      submit.disabled = false;
      submit.firstChild.textContent = 'Enviar meu diagnóstico ';
    }
  });
  showStep(0);
})();