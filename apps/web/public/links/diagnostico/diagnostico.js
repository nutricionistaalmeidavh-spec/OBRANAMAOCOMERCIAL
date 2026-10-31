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
  const heading = ['Sobre sua empresa', 'Sua rotina e desafios', 'Sua infraestrutura', 'Integrações e contexto', 'Seus objetivos'];
  const toolCheckboxes = [...form.querySelectorAll('input[name="currentSystems"]')];
  const otherToolField = form.querySelector('#other-tool-field');
  const otherToolInput = form.querySelector('#current-systems-other');
  const namedSystemFields = new Map([...form.querySelectorAll('[data-system-name-for]')].map(field => [field.dataset.systemNameFor, field]));
  function syncTools(changed) {
    if (changed && changed.checked) {
      for (const input of toolCheckboxes) {
        if (changed.value === 'nenhum' ? input !== changed : input.value === 'nenhum') input.checked = false;
      }
    }
    const hasOther = toolCheckboxes.some(input => input.value === 'outros' && input.checked);
    otherToolField.hidden = !hasOther;
    otherToolInput.disabled = !hasOther;
    otherToolInput.required = hasOther;
    if (!hasOther) {
      otherToolInput.value = '';
      otherToolInput.removeAttribute('aria-invalid');
    }
    for (const [key, container] of namedSystemFields) {
      const selected = toolCheckboxes.some(input => input.checked && input.value === key);
      const nameInput = container.querySelector('input');
      container.hidden = !selected;
      nameInput.disabled = !selected;
      nameInput.required = selected;
      if (!selected) {
        nameInput.value = '';
        nameInput.removeAttribute('aria-invalid');
      }
    }
  }
  toolCheckboxes.forEach(input => input.addEventListener('change', () => syncTools(input)));
  syncTools(null);
  const serverOptions = [...form.querySelectorAll('input[name="serverKind"]')];
  const serverProviderField = form.querySelector('#server-provider-field');
  const serverProviderInput = form.querySelector('#server-provider');
  const serverAdminField = form.querySelector('#server-admin-field');
  const serverAdminOptions = [...form.querySelectorAll('input[name="serverAdmin"]')];
  const integrationOptions = [...form.querySelectorAll('input[name="integrations"]')];
  const integrationOtherField = form.querySelector('#integration-other-field');
  const integrationOtherInput = form.querySelector('#integration-other');
  const sensitiveOptions = [...form.querySelectorAll('input[name="sensitiveData"]')];

  function setConditionalField(container, input, shown, required = false) {
    container.hidden = !shown;
    input.disabled = !shown;
    input.required = shown && required;
    if (!shown) {
      input.value = '';
      input.removeAttribute('aria-invalid');
    }
  }

  function syncServer() {
    const selected = serverOptions.find(input => input.checked)?.value;
    setConditionalField(serverProviderField, serverProviderInput, selected === 'cloud');
    serverAdminField.hidden = selected !== 'local';
    for (const input of serverAdminOptions) {
      input.disabled = selected !== 'local';
      input.required = selected === 'local';
      if (selected !== 'local') input.checked = false;
    }
  }

  function syncExclusiveChoices(inputs, exclusiveValues, changed) {
    if (!changed?.checked) return;
    if (exclusiveValues.includes(changed.value)) {
      for (const input of inputs) if (input !== changed) input.checked = false;
    } else {
      for (const input of inputs) if (exclusiveValues.includes(input.value)) input.checked = false;
    }
  }

  function syncIntegrations(changed) {
    syncExclusiveChoices(integrationOptions, ['none', 'unknown'], changed);
    const showOther = integrationOptions.some(input => input.checked && input.value === 'other');
    setConditionalField(integrationOtherField, integrationOtherInput, showOther, true);
  }

  serverOptions.forEach(input => input.addEventListener('change', syncServer));
  integrationOptions.forEach(input => input.addEventListener('change', () => syncIntegrations(input)));
  sensitiveOptions.forEach(input => input.addEventListener('change',
    () => syncExclusiveChoices(sensitiveOptions, ['none', 'unknown'], input)));
  syncServer();
  syncIntegrations(null);
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
    if (index === 2) {
      if (!form.querySelector('input[name="workDevices"]:checked')) {
        status('Selecione pelo menos um dispositivo de uso.');
        form.querySelector('input[name="workDevices"]').focus();
        return false;
      }
    }
    if (index === 3) {
      if (!form.querySelector('input[name="integrations"]:checked') ||
          !form.querySelector('input[name="sensitiveData"]:checked')) {
        status('Selecione as integrações e categorias de dados da empresa.');
        const group = !form.querySelector('input[name="integrations"]:checked') ? 'integrations' : 'sensitiveData';
        form.querySelector(`input[name="${group}"]`).focus();
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
    data.currentSystems = fields.getAll('currentSystems');
    data.workDevices = fields.getAll('workDevices');
    data.integrations = fields.getAll('integrations');
    data.sensitiveData = fields.getAll('sensitiveData');
    data.currentSystemNames = Object.fromEntries(
      [...namedSystemFields].filter(([, field]) => !field.hidden)
        .map(([key, field]) => [key, field.querySelector('input').value.trim()])
    );
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