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
  if (!container) {
    console.error('Map container not found:', containerId);
    return;
  }

  const loadingId = `${containerId}-loading`;
  const mapWrapperId = `${containerId}-map-wrapper`;

  const renderFallbackList = (errorMessage = '') => {
    const wrapper = document.getElementById(mapWrapperId);
    const loading = document.getElementById(loadingId);
    if (loading) loading.remove();

    if (!wrapper) return;

    const message = errorMessage || 'Map could not be loaded from the CDN. Select countries using the list below instead.';
    wrapper.innerHTML = `<div style="padding: 12px; color: #6b7280; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 16px;">${message}</div>`;
    const fallback = document.createElement('div');
    fallback.id = `${containerId}-fallback-list`;
    wrapper.appendChild(fallback);
    renderFallbackCountryList(fallback, {
      countries,
      selectedCountries,
      onCountryToggle,
      title,
      subtitle: 'Select countries from the list below'
    });
  };

  container.innerHTML = `
    <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(15,23,42,0.08); border: 1px solid rgba(226,232,240,0.6); text-align: center;">
      <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 6px; color: #334155;">${title}</h3>
      <div style="font-size: 13px; color: #64748b; margin-bottom: 16px;">${subtitle}</div>
      <div id="${loadingId}" style="padding: 30px; color: #64748b;">
        <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <style>
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
        <div style="margin-top: 12px;">Loading interactive map...</div>
      </div>
      <div id="${mapWrapperId}" style="width: 100%; display: flex; justify-content: center;"></div>
      <div style="margin-top: 12px; font-size: 12px; color: #94a3b8;">Tip: Use zoom controls on the map or Ctrl/Cmd+scroll to zoom.</div>
    </div>
  `;

  try {
    console.log('Loading D3 library...');
    await loadD3();
    console.log('D3 loaded successfully');
    
    console.log('Loading world topology data...');
    const world = await loadWorldData();
    console.log('World data loaded:', world?.type);
    
    if (world?.type === 'Topology') {
      console.log('Loading TopoJSON library...');
      try { 
        await loadTopoJSON(); 
        console.log('TopoJSON loaded');
      } catch (err) { 
        console.warn('TopoJSON loading failed, will try to continue:', err);
      }
    }

    const features = extractWorldFeatures(world);
    console.log('Extracted features:', features.length);
    
    const wrapper = document.getElementById(mapWrapperId);
    const loading = document.getElementById(loadingId);
    if (loading) loading.remove();

    if (!wrapper) {
      console.error('Map wrapper element not found');
      return;
    }

    if (features.length === 0) {
      console.error('No map features extracted');
      renderFallbackList('Unable to load map data. Using country list instead.');
      return;
    }

    const isoLookup = buildIsoLookup(countries);
    const selected = new Set((selectedCountries || []).map(c => String(c).toUpperCase()));

    // Estimate a reasonable width in the embed context.
    const maxW = Math.min(width, (container.clientWidth || width) - 48);
    const maxH = Math.max(320, height);

    console.log('Creating SVG map, dimensions:', maxW, 'x', maxH);

    const svg = d3.select(wrapper)
      .append('svg')
      .attr('width', maxW)
      .attr('height', maxH)
      .attr('viewBox', `0 0 ${maxW} ${maxH}`)
      .attr('role', 'img')
      .attr('aria-label', 'Interactive world map for selecting source countries')
      .style('background', '#f8fafc')
      .style('border-radius', '8px');

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
        if (!iso) return '#e2e8f0';
        return selected.has(iso) ? '#93c5fd' : '#f1f5f9';
      })
      .style('stroke', d => (selected.has(d.__iso) ? '#1e40af' : '#cbd5e1'))
      .style('stroke-width', d => (selected.has(d.__iso) ? 1.8 : 0.6))
      .style('cursor', d => (d.__iso ? 'pointer' : 'default'))
      .style('transition', 'all 0.2s ease')
      .on('mouseover', function(event, d) {
        if (!d.__iso) return;
        d3.select(this)
          .style('fill', selected.has(d.__iso) ? '#60a5fa' : '#e0e7ff')
          .style('stroke-width', 2);
      })
      .on('mouseout', function(event, d) {
        if (!d.__iso) return;
        d3.select(this)
          .style('fill', selected.has(d.__iso) ? '#93c5fd' : '#f1f5f9')
          .style('stroke-width', selected.has(d.__iso) ? 1.8 : 0.6);
      })
      .on('click', (event, d) => {
        const iso = d.__iso;
        if (!iso) return;
        console.log('Country clicked:', iso, isoLookup.get(iso)?.name);
        if (onCountryToggle) onCountryToggle(iso);
      })
      .append('title')
      .text(d => {
        const iso = d.__iso;
        const name = isoLookup.get(iso)?.name || d.__name || iso || 'Unknown';
        const mark = selected.has(iso) ? ' ✓ Selected' : ' (click to select)';
        return `${name}${mark}`;
      });

    const zoom = d3.zoom()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        mapGroup.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Zoom controls
    const controls = svg.append('g')
      .attr('transform', `translate(${maxW - 60}, 20)`);
    
    const createButton = (y, label, action) => {
      const g = controls.append('g')
        .attr('transform', `translate(0, ${y})`)
        .style('cursor', 'pointer')
        .on('click', action)
        .on('mouseover', function() {
          d3.select(this).select('rect').style('fill', '#f1f5f9');
        })
        .on('mouseout', function() {
          d3.select(this).select('rect').style('fill', '#ffffff');
        });
      
      g.append('rect')
        .attr('width', 40)
        .attr('height', 32)
        .attr('rx', 8)
        .attr('ry', 8)
        .style('fill', '#ffffff')
        .style('stroke', '#cbd5e1')
        .style('stroke-width', 1.5);
      
      g.append('text')
        .attr('x', 20)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '18px')
        .style('font-weight', '600')
        .style('fill', '#334155')
        .style('pointer-events', 'none')
        .text(label);
      
      return g;
    };

    createButton(0, '+', () => {
      svg.transition().duration(200).call(zoom.scaleBy, 1.4);
    });
    
    createButton(38, '−', () => {
      svg.transition().duration(200).call(zoom.scaleBy, 1/1.4);
    });
    
    createButton(76, '⟲', () => {
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    });

    console.log('Map rendered successfully');
  } catch (error) {
    console.error('Failed to render map:', error);
    renderFallbackList(`Map loading failed: ${error.message}. Using country list instead.`);
  }
}
