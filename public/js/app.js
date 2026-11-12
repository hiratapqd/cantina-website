'use strict';
// Aprimoramento progressivo: navegação, consultas e formulários comuns funcionam sem JavaScript.
const fontButton = document.querySelector('[data-font-toggle]');
try { if (localStorage.getItem('ca-large-text') === 'true') document.documentElement.classList.add('large-text'); } catch {}
function updateFontButton() { const large = document.documentElement.classList.contains('large-text'); fontButton?.setAttribute('aria-pressed', String(large)); fontButton?.setAttribute('aria-label', large ? 'Usar tamanho padrão das letras' : 'Aumentar tamanho das letras'); }
updateFontButton();
fontButton?.addEventListener('click', () => { const large = document.documentElement.classList.toggle('large-text'); try { localStorage.setItem('ca-large-text', String(large)); } catch {} updateFontButton(); });
document.querySelectorAll('[data-print]').forEach(button => button.addEventListener('click', () => window.print()));
document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => history.length > 1 ? history.back() : location.assign('/')));

const dialog = document.querySelector('#confirm-dialog');
let pendingForm;
document.querySelectorAll('form[data-confirm]').forEach(form => form.addEventListener('submit', event => {
  if (form.dataset.confirmed === 'true') return;
  if (!dialog?.showModal) { if (!window.confirm(form.dataset.confirm)) event.preventDefault(); return; }
  event.preventDefault(); pendingForm = form;
  document.querySelector('#confirm-message').textContent = form.dataset.confirm;
  dialog.showModal();
}));
dialog?.addEventListener('close', () => { if (dialog.returnValue === 'confirm' && pendingForm) { pendingForm.dataset.confirmed = 'true'; pendingForm.requestSubmit(); } pendingForm = null; });

document.querySelectorAll('[data-used-book-form]').forEach(form => {
  const condition = form.querySelector('[data-book-condition]'); if (!condition) return;
  const cost = form.querySelector('[data-cost]'), price = form.querySelector('[data-price]');
  const minStock = form.querySelector('[data-min-stock]');
  let newCost = cost.value, newPrice = price.value, newMinimum = minStock.value;
  let wasUsed = false;
  function update() {
    const used = condition.value === 'usado';
    cost.readOnly = used; price.readOnly = used; minStock.readOnly = used;
    if (used) {
      if (!wasUsed) { newCost = cost.value; newPrice = price.value; newMinimum = minStock.value; }
      cost.value = '0,00'; price.value = '10,00'; minStock.value = '0';
    } else if (wasUsed) { cost.value = newCost; price.value = newPrice; minStock.value = newMinimum; }
    wasUsed = used;
    const note = form.querySelector('[data-used-note]'); if (note) note.hidden = !used;
  }
  condition.addEventListener('change', update); update();
});

document.querySelectorAll('[data-kit-form]').forEach(form => {
  const hidden = form.querySelector('[data-components]'), list = form.querySelector('[data-kit-list]');
  let components; try { components = JSON.parse(hidden.value); } catch { components = []; }
  function render() {
    hidden.value = JSON.stringify(components); list.replaceChildren();
    components.forEach((item, index) => {
      const li = document.createElement('li'); const span = document.createElement('span'); span.textContent = `${item.quantity} × ${item.name}`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'link-button'; remove.textContent = 'Retirar'; remove.setAttribute('aria-label', `Retirar ${item.name}`); remove.addEventListener('click', () => { components.splice(index, 1); render(); });
      li.append(span, remove); list.append(li);
    });
  }
  form.querySelector('[data-kit-add]').addEventListener('click', () => {
    const select = form.querySelector('[data-kit-item]'), quantityInput = form.querySelector('[data-kit-quantity]');
    const quantity = Number(quantityInput.value);
    if (!select.value || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) { select.focus(); return; }
    const [kind, catalogId] = select.value.split(':');
    if (components.some(c => c.catalogId === catalogId)) { select.focus(); return; }
    components.push({ kind, catalogId, name: select.selectedOptions[0].dataset.name, quantity }); render(); select.value = '';
  }); render();
});

document.querySelectorAll('form[method="post"]').forEach(form => form.addEventListener('submit', event => {
  if (event.defaultPrevented) return;
  const button = event.submitter;
  if (button) { button.disabled = true; button.classList.add('is-loading'); setTimeout(() => { button.disabled = false; button.classList.remove('is-loading'); }, 10000); }
}));
