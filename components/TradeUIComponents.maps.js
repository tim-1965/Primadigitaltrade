// TradeUIComponents.maps.js
// Map renderer (D3 + world-atlas) adapted from RiskMap's approach.

let d3LoadingPromise = null;
let topojsonLoadingPromise = null;

function renderFallbackCountryList(container, {
  countries = [],
  selectedCountries = [],
  onCountryToggle,
  title,
  subtitle
} = {}) {
  const selected = new Set((selectedCountries || []).map(c => String(c).toUpperCase()));
  container.innerHTML = `
    <div style="width:100%; max-width: 720px; text-align:left;">
      <div style="font-size:14px; color:#374151; font-weight:600; margin-bottom:4px;">${title || 'Select origin countries'}</div>
      <div style="font-size:12px; color:#6b7280; margin-bottom:10px;">${subtitle || 'Map unavailable. Use the list below to pick countries.'}</div>
      <input id="${container.id || 'fallback'}-filter" type="search" placeholder="Search country…" style="width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:10px; font-size:14px;" />
      <div id="${container.id || 'fallback'}-list" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:8px; max-height:340px; overflow:auto; padding-right:4px;"></div>
    </div>
  `;

  const filterInput = container.querySelector('input[type="search"]');
  const listEl = container.querySelector(`#${container.id || 'fallback'}-list`);

  const renderList = () => {
    const q = (filterInput?.value || '').trim().toLowerCase();
    const filtered = countries
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(c => !q || c.name.toLowerCase().includes(q) || String(c.iso || '').toLowerCase().includes(q));

    listEl.innerHTML = filtered.map(c => {
      const iso = String(c.iso || c.isoCode || '').toUpperCase();
      const isSelected = selected.has(iso);
      return `
        <button data-iso="${iso}" style="
          text-align:left;
          padding:10px 12px;
          border:1px solid ${isSelected ? '#1d4ed8' : '#e5e7eb'};
          background:${isSelected ? '#e0e7ff' : 'white'};
          color:${isSelected ? '#1d4ed8' : '#111827'};
          border-radius:10px;
          font-size:13px;
          cursor:pointer;
          transition:background 120ms ease, border-color 120ms ease;
        ">
          ${c.name}
          ${iso ? `<span style="display:block; color:#6b7280; font-size:11px; margin-top:2px;">${iso}</span>` : ''}
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('button[data-iso]').forEach(btn => {
      btn.addEventListener('click', () => {
        const iso = btn.dataset.iso;
        if (!iso) return;
        if (selected.has(iso)) selected.delete(iso); else selected.add(iso);
        if (onCountryToggle) onCountryToggle(iso);
        renderList();
      });
    });
  };

  if (filterInput) filterInput.addEventListener('input', renderList);
  renderList();
}

function loadD3() {
  if (typeof d3 !== 'undefined') return Promise.resolve();
  if (d3LoadingPromise) return d3LoadingPromise;

  d3LoadingPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-lib="d3"]');
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
    script.async = true;
    script.dataset.lib = 'd3';
    script.onload = () => resolve();
    script.onerror = () => {
      d3LoadingPromise = null;
      reject(new Error('Failed to load D3 library'));
    };
    document.head.appendChild(script);
  });

  return d3LoadingPromise;
}

async function loadTopoJSON() {
  const libraryAvailable = () => typeof topojson !== 'undefined' && typeof topojson.feature === 'function';
  if (libraryAvailable()) return;
  if (topojsonLoadingPromise) return topojsonLoadingPromise;

  topojsonLoadingPromise = new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const existingScript = document.querySelector('script[data-lib="topojson-client"]');
    if (existingScript) {
      const loadState = existingScript.dataset.loadState;
      if (loadState === 'loaded') {
        finish();
        return;
      }
      if (loadState === 'failed') {
        existingScript.remove();
      } else {
        existingScript.addEventListener('load', () => {
          existingScript.dataset.loadState = 'loaded';
          finish();
        }, { once: true });
        existingScript.addEventListener('error', () => {
          existingScript.dataset.loadState = 'failed';
          existingScript.remove();
          finish();
        }, { once: true });
        return;
      }
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/topojson-client/3.1.0/topojson-client.min.js';
    script.async = true;
    script.dataset.lib = 'topojson-client';
    script.dataset.loadState = 'loading';
    script.onload = () => {
      script.dataset.loadState = 'loaded';
      finish();
    };
    script.onerror = () => {
      script.dataset.loadState = 'failed';
      script.remove();
      finish();
    };
    document.head.appendChild(script);
  }).finally(() => {
    topojsonLoadingPromise = null;
  });

  return topojsonLoadingPromise;
}

async function loadWorldData() {
  try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    if (!response.ok) throw new Error('Failed to load world data');
    return await response.json();
  } catch (error) {
    console.warn('Failed to load external world data:', error);
    return null;
  }
}

function topoToFeatures(topo, objectName) {
  if (typeof topojson !== 'undefined' && topojson.feature) {
    return topojson.feature(topo, topo.objects[objectName]).features;
  }
  // Minimal internal converter fallback: if topojson isn't available, bail.
  return [];
}

function extractWorldFeatures(worldData) {
  if (!worldData) return [];
  if (worldData.type === 'FeatureCollection' && Array.isArray(worldData.features)) return worldData.features;
  if (worldData.type === 'Topology' && worldData.objects?.countries) {
    return topoToFeatures(worldData, 'countries') || [];
  }
  return [];
}

function buildIsoLookup(countries) {
  const lookup = new Map();
  (countries || []).forEach(c => {
    const code = c?.iso || c?.isoCode;
    if (code) lookup.set(String(code).toUpperCase(), c);
  });
  return lookup;
}

function normalizeIsoA3(v) {
  if (!v) return null;
  const s = String(v).trim().toUpperCase();
  if (s.length === 3) return s;
  return null;
}

export async function createSelectableWorldMap(containerId, {
  countries = [],
  selectedCountries = [],
  onCountryToggle,
  title = 'Select source countries',
  height = 420,
  width = 960,
  subtitle = 'Click countries to toggle selection.'
} = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const loadingId = `${containerId}-loading`;
  const mapWrapperId = `${containerId}-map-wrapper`;

  container.innerHTML = `
    <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center;">
      <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 6px;">${title}</h3>
      <div style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">${subtitle}</div>
      <div id="${loadingId}" style="padding: 30px; color: #6b7280;">Loading map…</div>
      <div id="${mapWrapperId}" style="width: 100%; display: flex; justify-content: center;"></div>
      <div style="margin-top: 12px; font-size: 12px; color: #6b7280;">Tip: use Ctrl/Cmd+scroll to zoom the page. Map zoom controls are included.</div>
    </div>
  `;

  await loadD3();
  const world = await loadWorldData();
  if (world?.type === 'Topology') {
    try { await loadTopoJSON(); } catch { /* fall through */ }
  }

  const features = extractWorldFeatures(world);
  const wrapper = document.getElementById(mapWrapperId);
  const loading = document.getElementById(loadingId);
  if (loading) loading.remove();

  if (!wrapper || features.length === 0) {
    if (wrapper) {
      wrapper.innerHTML = '<div style="padding: 12px; color: #6b7280;">Map could not be loaded from the CDN. Select countries using the list below instead.</div>';
      const fallback = document.createElement('div');
      fallback.id = `${containerId}-fallback-list`;
      wrapper.appendChild(fallback);
      renderFallbackCountryList(fallback, {
        countries,
        selectedCountries,
        onCountryToggle,
        title,
        subtitle
      });
    }
    return;
  }

  const isoLookup = buildIsoLookup(countries);
  const selected = new Set((selectedCountries || []).map(c => String(c).toUpperCase()));

  // Estimate a reasonable width in the embed context.
  const maxW = Math.min(width, (container.clientWidth || width));
  const maxH = Math.max(320, height);

  const svg = d3.select(wrapper)
    .append('svg')
    .attr('width', maxW)
    .attr('height', maxH)
    .attr('viewBox', `0 0 ${maxW} ${maxH}`)
    .attr('role', 'img')
    .attr('aria-label', 'Interactive world map for selecting source countries');

  const projection = d3.geoNaturalEarth1().fitSize([maxW, maxH], { type: 'FeatureCollection', features });
  const path = d3.geoPath(projection);

  const mapGroup = svg.append('g');

  mapGroup.selectAll('path')
    .data(features)
    .enter()
    .append('path')
    .attr('d', path)
    .each(function(d) {
      const p = d?.properties || {};
      const iso = normalizeIsoA3(p.ISO_A3 || p.iso_a3 || p.ADM0_A3 || p.id);
      d.__iso = iso;
      const name = p.NAME || p.name || null;
      d.__name = name;
    })
    .style('fill', d => {
      const iso = d.__iso;
      if (!iso) return '#f3f4f6';
      return selected.has(iso) ? '#dbeafe' : '#f3f4f6';
    })
    .style('stroke', d => (selected.has(d.__iso) ? '#111827' : '#e5e7eb'))
    .style('stroke-width', d => (selected.has(d.__iso) ? 1.6 : 0.8))
    .style('cursor', d => (d.__iso ? 'pointer' : 'default'))
    .on('click', (event, d) => {
      const iso = d.__iso;
      if (!iso) return;
      if (!isoLookup.has(iso)) {
        // The country list comes from the RiskMap API; if we can't match, still toggle.
      }
      if (onCountryToggle) onCountryToggle(iso);
    })
    .append('title')
    .text(d => {
      const iso = d.__iso;
      const name = isoLookup.get(iso)?.name || d.__name || iso || 'Unknown';
      const mark = selected.has(iso) ? ' (selected)' : '';
      return `${name}${mark}`;
    });

  const zoom = d3.zoom().scaleExtent([0.5, 8]).on('zoom', (event) => {
    mapGroup.attr('transform', event.transform);
  });

  svg.call(zoom);

  // Zoom controls
  const controls = svg.append('g').attr('transform', `translate(${maxW - 54}, 18)`);
  const btn = (y, label) => controls.append('g')
    .attr('transform', `translate(0, ${y})`)
    .style('cursor', 'pointer')
    .on('click', () => {
      if (label === '+') svg.transition().duration(200).call(zoom.scaleBy, 1.35);
      if (label === '−') svg.transition().duration(200).call(zoom.scaleBy, 1/1.35);
      if (label === '⟲') svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity);
    });

  const drawBtn = (g, label) => {
    g.append('rect')
      .attr('width', 36)
      .attr('height', 28)
      .attr('rx', 6)
      .attr('ry', 6)
      .style('fill', '#ffffff')
      .style('stroke', '#d1d5db');
    g.append('text')
      .attr('x', 18)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', '#111827')
      .text(label);
  };

  drawBtn(btn(0, '+'), '+');
  drawBtn(btn(34, '−'), '−');
  drawBtn(btn(68, '⟲'), '⟲');
}
