// A wind-up points-of-sail circle for the guided theory demos. The coloured
// ranges use the same true-wind-angle boundaries as pointOfSail() in physics.js.
const ZONES = [
  { name: 'In Irons — No-Go Zone', label: 'No-go zone', from: 0, to: 32, color: '#e8a89e' },
  { name: 'Close-Hauled', label: 'Close-hauled', from: 32, to: 52, color: '#9dbbd2' },
  { name: 'Close Reach', label: 'Close reach', from: 52, to: 80, color: '#a9d0cd' },
  { name: 'Beam Reach', label: 'Beam reach', from: 80, to: 102, color: '#7fbea9' },
  { name: 'Broad Reach', label: 'Broad reach', from: 102, to: 150, color: '#b4d4bd' },
  { name: 'Running', label: 'Run', from: 150, to: 180, color: '#cbbfda' },
];

const polar = (degrees, radius) => {
  const angle = degrees * Math.PI / 180;
  return `${(90 + Math.sin(angle) * radius).toFixed(2)} ${(90 - Math.cos(angle) * radius).toFixed(2)}`;
};

function ringSector(from, to, side) {
  const begin = from * side, end = to * side;
  const outward = side === 1 ? 1 : 0;
  return `M ${polar(begin, 78)} A 78 78 0 0 ${outward} ${polar(end, 78)} ` +
    `L ${polar(end, 52)} A 52 52 0 0 ${1 - outward} ${polar(begin, 52)} Z`;
}

export function theoryChartMarkup() {
  const sectors = ZONES.flatMap((zone) => [-1, 1].map((side) =>
    `<path class="theory-sector" data-theory-point="${zone.name}" d="${ringSector(zone.from, zone.to, side)}" fill="${zone.color}"/>`
  )).join('');
  const key = ZONES.map((zone) =>
    `<span class="theory-key-item" data-theory-point="${zone.name}"><i style="background:${zone.color}"></i>${zone.label}</span>`
  ).join('');
  return `<figure class="theory-compass" aria-label="Points of sail, with the wind coming from the top">
    <div class="theory-compass-wheel"><span class="theory-wind-label">Wind from here</span>
      <svg viewBox="0 0 180 180" aria-hidden="true" focusable="false">
        <circle cx="90" cy="90" r="79" fill="#f8fbfd" stroke="#a6b8c8" stroke-width="1"/>
        ${sectors}
        <circle cx="90" cy="90" r="51" fill="#f8fbfd"/>
        <circle cx="90" cy="90" r="3" fill="#8197aa"/>
        <g id="theoryBoatMarker" transform="translate(90 25) rotate(0)">
          <path d="M 0 -12 C 6 -7 7 5 4 11 L -4 11 C -7 5 -6 -7 0 -12 Z" fill="#103660" stroke="#fff" stroke-width="2"/>
          <path d="M 0 -4 L 0 7" stroke="#fff" stroke-width="1.5"/>
        </g>
      </svg>
    </div>
    <figcaption class="theory-compass-key">${key}</figcaption>
  </figure>`;
}

export function theoryMarkerTransform(heading) {
  const degrees = heading * 180 / Math.PI;
  const x = Math.round(90 + Math.sin(heading) * 65);
  const y = Math.round(90 - Math.cos(heading) * 65);
  return `translate(${x} ${y}) rotate(${Math.round(degrees)})`;
}

export function updateTheoryChart(heading, point) {
  const marker = document.getElementById('theoryBoatMarker');
  if (!marker) return;
  marker.setAttribute('transform', theoryMarkerTransform(heading));
  for (const element of document.querySelectorAll('[data-theory-point]')) {
    element.classList.toggle('current', element.getAttribute('data-theory-point') === point);
  }
}
