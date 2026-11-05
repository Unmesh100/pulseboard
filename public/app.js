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

async function main() {
  const [{ services }, summary] = await Promise.all([
    fetch('/api/services').then((r) => r.json()),
    fetch('/api/summary').then((r) => r.json()),
  ]);
  renderSummary(summary);
  document.getElementById('services').replaceChildren(...services.map(serviceCard));
}

main().catch((err) => {
  document.getElementById('overall').textContent = `Could not load status: ${err.message}`;
});
