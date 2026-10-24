const depositElement = document.getElementById('stats-deposits');
const manualElement = document.getElementById('stats-manual-income');
const totalElement = document.getElementById('stats-total-income');

const money = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

function readAmount(element) {
  if (!element) return null;
  const rawValue = String(element.dataset.value || '').trim();
  if (rawValue) {
    const numericValue = Number(rawValue);
    if (Number.isFinite(numericValue) && numericValue >= 0) return numericValue;
  }
  const source = String(element.textContent || '').trim();
  const cleaned = source.replace(/[^0-9,.-]/g, '');
  if (!cleaned) return null;

  // Los datos pueden llegar como número o como importe formateado en Argentina.
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/\./g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function updateTotal() {
  const deposit = readAmount(depositElement);
  const manual = readAmount(manualElement);
  if (deposit === null && manual === null) {
    totalElement.textContent = '$ —';
    return;
  }
  totalElement.textContent = '$ ' + money.format((deposit || 0) + (manual || 0));
}

updateTotal();
const observer = new MutationObserver(updateTotal);
for (const element of [depositElement, manualElement]) {
  if (element) observer.observe(element, {
    attributes: true,
    attributeFilter: ['data-value'],
    childList: true,
    characterData: true,
    subtree: true
  });
}
