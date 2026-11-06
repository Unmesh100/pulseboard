const STATUS_LABEL = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
};

const OVERALL_LABEL = {
  operational: 'All systems operational',
  partial_outage: 'Partial outage',
  major_outage: 'Major outage',
};

function serviceCard(service) {
  const card = document.createElement('article');
  card.className = `card status-${service.status}`;
  card.innerHTML = `
    <div class="card-head">
      <h2></h2>
      <span class="pill"></span>
    </div>
    <p class="meta"></p>
    <dl class="stats">
      <div><dt>Uptime (30d)</dt><dd class="uptime"></dd></div>
      <div><dt>Latency</dt><dd class="latency"></dd></div>
    </dl>`;
  card.querySelector('h2').textContent = service.name;
  card.querySelector('.pill').textContent = STATUS_LABEL[service.status] ?? service.status;
  card.querySelector('.meta').textContent = `${service.team} · ${service.region}`;
  card.querySelector('.uptime').textContent = `${service.uptime}%`;
  card.querySelector('.latency').textContent =
    service.status === 'down' ? '—' : `${service.latencyMs} ms`;
  return card;
}

function renderSummary(summary) {
  const overall = document.getElementById('overall');
  overall.className = `overall overall-${summary.overall}`;
  overall.textContent = OVERALL_LABEL[summary.overall];

  const el = document.getElementById('summary');
  el.replaceChildren(
    ...Object.entries(summary.counts).map(([status, count]) => {
      const chip = document.createElement('div');
      chip.className = `count count-${status}`;
      chip.innerHTML = `<strong></strong><span></span>`;
      chip.querySelector('strong').textContent = count;
      chip.querySelector('span').textContent = STATUS_LABEL[status];
      return chip;
    }),
  );
}

const STATUS_FILTERS = ['', 'operational', 'degraded', 'down'];
const state = { status: '', q: '' };
let requestId = 0;

function readStateFromUrl() {
  const params = new URLSearchParams(location.search);
  const status = params.get('status') ?? '';
  state.status = STATUS_FILTERS.includes(status) ? status : '';
  state.q = params.get('q') ?? '';
}

function writeStateToUrl() {
  const params = new URLSearchParams();
  if (state.status) params.set('status', state.status);
  if (state.q) params.set('q', state.q);
  const query = params.toString();
  history.replaceState(null, '', query ? `?${query}` : location.pathname);
}

function renderChips() {
  document.getElementById('status-chips').replaceChildren(
    ...STATUS_FILTERS.map((status) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = status ? STATUS_LABEL[status] : 'All';
      chip.setAttribute('aria-pressed', String(state.status === status));
      chip.addEventListener('click', () => {
        state.status = status;
        renderChips();
        refresh();
      });
      return chip;
    }),
  );
}

function renderServices(services) {
  const grid = document.getElementById('services');
  if (services.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No services match your filters.';
    grid.replaceChildren(empty);
    return;
  }
  grid.replaceChildren(...services.map(serviceCard));
}

async function refresh() {
  writeStateToUrl();
  const id = ++requestId;
  const params = new URLSearchParams();
  if (state.status) params.set('status', state.status);
  if (state.q.trim()) params.set('q', state.q.trim());
  const res = await fetch(`/api/services?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { services } = await res.json();
  if (id === requestId) renderServices(services);
}

async function main() {
  readStateFromUrl();
  const input = document.getElementById('q');
  input.value = state.q;
  renderChips();

  let timer;
  input.addEventListener('input', () => {
    state.q = input.value;
    clearTimeout(timer);
    timer = setTimeout(() => refresh().catch(showError), 150);
  });

  const summary = await fetch('/api/summary').then((r) => r.json());
  renderSummary(summary);
  await refresh();
}

function showError(err) {
  document.getElementById('overall').textContent = `Could not load status: ${err.message}`;
}

main().catch(showError);
