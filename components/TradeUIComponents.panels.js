// TradeUIComponents.panels.js
// Panel renderers with RiskMap-like styling (simple cards, clean inputs).

import { createSelectableWorldMap } from './TradeUIComponents.maps.js';
import { computeAllResults } from './TradeCalculator.js';

// HTML escape utility
const escapeHTML = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const fmtUSD = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

const fmtNum = (v, digits = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
};

const inputNumber = (el, { min = 0, step = 'any', value, onChange }) => {
  el.value = value ?? '';
  el.min = `${min}`;
  el.step = `${step}`;
  el.addEventListener('input', () => {
    const parsed = Number(String(el.value).replace(/,/g, ''));
    onChange(Number.isFinite(parsed) ? parsed : 0);
  });
};

function cardShell(title, subtitle = '') {
  return `
    <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(15,23,42,0.08); border: 1px solid rgba(226,232,240,0.6);">
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; letter-spacing: -0.01em;">${title}</h2>
        ${subtitle ? `<div style="font-size: 14px; color: #64748b; line-height: 1.6;">${subtitle}</div>` : ''}
      </div>
      <div id="panelBody"></div>
    </div>
  `;
}

function fieldRow(label, id, hint = '') {
  return `
    <div style="margin-bottom: 18px;">
      <label for="${id}" style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 8px;">${label}</label>
      ${hint ? `<div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px; line-height: 1.4;">${hint}</div>` : ''}
      <div id="${id}-wrap"></div>
    </div>
  `;
}

function makeTextInput({ placeholder = '', value = '', onChange }) {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.value = value;
  input.style.cssText = 'width:100%; padding:11px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; background-color:white; transition: border-color 0.15s ease;';
  input.addEventListener('focus', () => {
    input.style.borderColor = '#3b82f6';
    input.style.outline = 'none';
    input.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = '#cbd5e1';
    input.style.boxShadow = 'none';
  });
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

function makeNumberInput({ value = 0, min = 0, step = 'any', onChange }) {
  const input = document.createElement('input');
  input.type = 'number';
  input.style.cssText = 'width:100%; padding:11px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; background-color:white; transition: border-color 0.15s ease;';
  input.addEventListener('focus', () => {
    input.style.borderColor = '#3b82f6';
    input.style.outline = 'none';
    input.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = '#cbd5e1';
    input.style.boxShadow = 'none';
  });
  inputNumber(input, { min, step, value, onChange });
  return input;
}

function makeSelect({ options = [], value = '', placeholder = 'Select…', onChange }) {
  const select = document.createElement('select');
  select.style.cssText = 'width:100%; padding:11px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; background-color:white; cursor:pointer; transition: border-color 0.15s ease;';
  select.addEventListener('focus', () => {
    select.style.borderColor = '#3b82f6';
    select.style.outline = 'none';
    select.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
  });
  select.addEventListener('blur', () => {
    select.style.borderColor = '#cbd5e1';
    select.style.boxShadow = 'none';
  });
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = placeholder;
  select.appendChild(empty);
  options.forEach(({ value: v, label }) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = label;
    select.appendChild(opt);
  });
  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function mount(el, node) {
  el.innerHTML = '';
  el.appendChild(node);
}

export function renderPanel1(containerId, { countries, state, onStateChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = cardShell(
    'Trade footprint',
    'Select your destination country and origin countries, then configure your trade volumes and payment terms.'
  );

  const body = container.querySelector('#panelBody');
  const mapId = `${containerId}-origins-map`;

  body.innerHTML = `
    <div style="display: grid; gap: 24px;">
      <!-- Destination Country Section -->
      <div style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
        ${fieldRow('Destination country (sourcing to)', 'destinationCountry', 'The country where goods are delivered.')}
      </div>

      <!-- Origins Map Section -->
      <div>
        <div style="margin-bottom: 12px;">
          <div style="font-size: 15px; font-weight: 600; color: #334155; margin-bottom: 4px;">Origin countries (sourcing from)</div>
          <div style="font-size: 13px; color: #64748b;">Click countries on the map to select or deselect them.</div>
        </div>
        <div id="${mapId}" style="margin-bottom: 12px;"></div>
        <div id="selectedOrigins"></div>
      </div>

      <!-- Trade Volume & Terms -->
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">Trade volume</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${fieldRow('Shipments per year', 'shipmentsPerYear', 'Total number of annual shipments on this trade lane.')}
          ${fieldRow('Total annual shipment value (USD)', 'totalShipmentValueUSD', 'Combined USD value of all shipments per year.')}
          ${fieldRow('Trade lane share of COGS (%)', 'tradeCOGSSharePercent', 'What % of your annual cost of goods sold is this trade lane? Used for working capital calculations.')}
        </div>
      </div>

      <!-- Timing -->
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">Timing & terms</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${fieldRow('Transit & clearance time (days)', 'transitAndClearanceDays', 'Average days from shipment to delivery and customs clearance.')}
          ${fieldRow('Current payment terms (days)', 'currentPaymentTermsDays', 'Average days from shipment/invoice to payment with current terms.')}
        </div>
      </div>

      <!-- Payment at Shipment -->
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">Payment at shipment option</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${fieldRow('Discount for payment at shipment (%)', 'discountAtShipmentPercent', 'Discount offered by suppliers if you pay immediately at shipment.')}
          ${fieldRow('Expected uptake of "pay at shipment" (%)', 'uptakeAtShipmentPercent', 'Estimated % of suppliers/value that would accept this payment option.')}
        </div>
      </div>

      <!-- Payment After Delivery -->
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">Payment after delivery option</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${fieldRow('Discount for payment after delivery (%)', 'discountAfterDeliveryPercent', 'Discount offered if you pay shortly after delivery (instead of standard terms).')}
          ${fieldRow('Payment days after delivery', 'paymentDaysAfterDelivery', 'Number of days after delivery you would make payment.')}
          ${fieldRow('Expected uptake of "pay after delivery" (%)', 'uptakeAfterDeliveryPercent', 'Estimated % of suppliers/value that would accept this payment option.')}
        </div>
      </div>
    </div>
  `;

  const destWrap = container.querySelector('#destinationCountry-wrap');
  const options = countries
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => ({ value: c.iso || c.isoCode, label: c.name }));

  mount(destWrap, makeSelect({
    options,
    value: state.panel1.destinationCountryIso || '',
    placeholder: 'Select destination country…',
    onChange: (v) => onStateChange('panel1', 'destinationCountryIso', v)
  }));

  const updateSelectedOrigins = () => {
    const box = container.querySelector('#selectedOrigins');
    if (!box) return;
    const selected = state.panel1.selectedSourceCountryIsos || [];
    if (!selected.length) {
      box.innerHTML = '<div style="color:#94a3b8; font-size:13px; font-style:italic; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">No origin countries selected yet. Click on the map above to select countries.</div>';
      return;
    }
    const names = selected
      .map(code => countries.find(c => (c.iso || c.isoCode) === code)?.name || code)
      .sort((a, b) => a.localeCompare(b));

    box.innerHTML = `
      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:14px;">
        <div style="font-size:13px; font-weight:600; color:#1e40af; margin-bottom:10px;">Selected origin countries (${names.length})</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${names.map(n => `<span style="font-size:13px; padding:6px 12px; border-radius:999px; background:white; color:#1e40af; border:1px solid #93c5fd; font-weight:500;">${escapeHTML(n)}</span>`).join('')}
        </div>
      </div>
    `;
  };

  // Render map asynchronously
  setTimeout(() => {
    createSelectableWorldMap(mapId, {
      countries,
      selectedCountries: state.panel1.selectedSourceCountryIsos || [],
      title: 'Select origin countries',
      subtitle: 'Click countries to select or deselect. Use map zoom controls to navigate.',
      onCountryToggle: (iso3) => {
        const current = new Set(state.panel1.selectedSourceCountryIsos || []);
        if (current.has(iso3)) current.delete(iso3); else current.add(iso3);
        onStateChange('panel1', 'selectedSourceCountryIsos', Array.from(current));
        updateSelectedOrigins();
      },
      height: 440,
      width: 960
    }).catch(err => {
      console.error('Map rendering failed:', err);
      const mapContainer = document.getElementById(mapId);
      if (mapContainer) {
        mapContainer.innerHTML = '<div style="padding: 20px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #991b1b; text-align: center;">Map could not be loaded. Please check your internet connection and refresh the page.</div>';
      }
    });
  }, 0);

  updateSelectedOrigins();

  // Bind numeric fields
  const bind = (id, key) => {
    const wrap = container.querySelector(`#${id}-wrap`);
    if (!wrap) return;
    mount(wrap, makeNumberInput({
      value: state.panel1[key] ?? 0,
      min: 0,
      onChange: (val) => onStateChange('panel1', key, val)
    }));
  };

  bind('shipmentsPerYear', 'shipmentsPerYear');
  bind('totalShipmentValueUSD', 'totalShipmentValueUSD');
  bind('tradeCOGSSharePercent', 'tradeCOGSSharePercent');
  bind('transitAndClearanceDays', 'transitAndClearanceDays');
  bind('currentPaymentTermsDays', 'currentPaymentTermsDays');
  bind('discountAtShipmentPercent', 'discountAtShipmentPercent');
  bind('uptakeAtShipmentPercent', 'uptakeAtShipmentPercent');
  bind('discountAfterDeliveryPercent', 'discountAfterDeliveryPercent');
  bind('paymentDaysAfterDelivery', 'paymentDaysAfterDelivery');
  bind('uptakeAfterDeliveryPercent', 'uptakeAfterDeliveryPercent');
}

export function renderPanel2(containerId, { state, onStateChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = cardShell(
    'Process costs & efficiency',
    'Define your baseline process costs and the efficiency gains from digitalisation.'
  );

  const body = container.querySelector('#panelBody');

  const efficiency = clamp(num(state.panel2?.efficiencyPercent, 40), 0, 100);

  body.innerHTML = `
    <div style="display:grid; gap: 24px;">
      <!-- Baseline Costs -->
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">Baseline costs</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${fieldRow('Annual cost per person (USD)', 'costPerPerson', 'Fully-loaded annual cost (salary, benefits, overhead) per employee.')}
          ${fieldRow('Headcount: logistics & compliance', 'headcountLogisticsCompliance', 'Number of FTEs dedicated to logistics and compliance functions.')}
          ${fieldRow('Headcount: accounts payable', 'headcountAccountsPayable', 'Number of FTEs dedicated to accounts payable processing.')}
          ${fieldRow('Customs & compliance per shipment (USD)', 'customsAndComplianceCostPerShipment', 'Average cost for customs filings and compliance per shipment.')}
          ${fieldRow('Ancillary costs per shipment (USD)', 'ancillaryCostPerShipment', 'Other per-shipment costs (inspections, certifications, etc.).')}
        </div>
      </div>

      <!-- Efficiency Slider -->
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">Digitalisation efficiency gain</h3>
        <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
          <label for="efficiencySlider" style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 12px;">
            Expected efficiency improvement from digitalisation: 
            <span style="font-size: 24px; font-weight: 700; color: #1d4ed8; margin-left: 8px;">${efficiency}%</span>
          </label>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 16px;">
            Estimate the percentage reduction in process costs and time achieved through digital trade workflows.
          </div>
          <input 
            type="range" 
            id="efficiencySlider" 
            min="0" 
            max="100" 
            value="${efficiency}" 
            style="width: 100%; height: 8px; border-radius: 5px; background: linear-gradient(to right, #dbeafe 0%, #3b82f6 ${efficiency}%, #e2e8f0 ${efficiency}%, #e2e8f0 100%); outline: none; -webkit-appearance: none; appearance: none;"
          />
          <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #94a3b8;">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind inputs
  const bind = (id, key) => {
    const wrap = container.querySelector(`#${id}-wrap`);
    if (!wrap) return;
    mount(wrap, makeNumberInput({
      value: state.panel2[key] ?? 0,
      min: 0,
      onChange: (val) => onStateChange('panel2', key, val)
    }));
  };

  bind('costPerPerson', 'costPerPerson');
  bind('headcountLogisticsCompliance', 'headcountLogisticsCompliance');
  bind('headcountAccountsPayable', 'headcountAccountsPayable');
  bind('customsAndComplianceCostPerShipment', 'customsAndComplianceCostPerShipment');
  bind('ancillaryCostPerShipment', 'ancillaryCostPerShipment');

  // Efficiency slider
  const slider = container.querySelector('#efficiencySlider');
  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      onStateChange('panel2', 'efficiencyPercent', val);
      // Update background gradient
      e.target.style.background = `linear-gradient(to right, #dbeafe 0%, #3b82f6 ${val}%, #e2e8f0 ${val}%, #e2e8f0 100%)`;
      // Update display
      const label = container.querySelector('label[for="efficiencySlider"] span');
      if (label) label.textContent = `${val}%`;
    });
  }
}

export function renderPanel3(containerId, { state, onStateChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const revenue = num(state.panel3?.revenue, 0);
  const costOfSale = num(state.panel3?.costOfSale, 0);
  const operationalCosts = num(state.panel3?.operationalCosts, 0);
  const grossProfit = revenue - costOfSale;
  const netProfit = grossProfit - operationalCosts;

  container.innerHTML = cardShell(
    'Accounting & funding',
    'Provide your company financial metrics and supply chain finance funding rate.'
  );

  const body = container.querySelector('#panelBody');

  body.innerHTML = `
    <div style="display:grid; gap: 24px;">
      <!-- Income Statement -->
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">Income statement</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${fieldRow('Annual revenue (USD)', 'revenue', 'Total company revenue for the year.')}
          ${fieldRow('Annual cost of goods sold (USD)', 'costOfSale', 'Total direct costs of producing/acquiring goods sold.')}
          <div style="padding: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
            <div style="font-size:13px; font-weight:600; color:#15803d; margin-bottom:6px;">Gross profit (calculated)</div>
            <div style="font-size:20px; font-weight:700; color:#15803d;">${fmtUSD(grossProfit)}</div>
          </div>
          ${fieldRow('Annual operational costs (USD)', 'operationalCosts', 'Total operating expenses (SG&A, R&D, etc.).')}
          <div style="padding: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
            <div style="font-size:13px; font-weight:600; color:#1e40af; margin-bottom:6px;">Net profit (calculated)</div>
            <div style="font-size:20px; font-weight:700; color:#1e40af;">${fmtUSD(netProfit)}</div>
          </div>
        </div>
      </div>

      <!-- Working Capital -->
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">Working capital metrics</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${fieldRow('Days sales outstanding - DSO (days)', 'daysSalesOutstanding', 'Average days to collect customer receivables.')}
          ${fieldRow('Days inventory outstanding - DIO (days)', 'daysInventoryOutstanding', 'Average days inventory is held before sale.')}
        </div>
      </div>

      <!-- Funding -->
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">Supply chain finance rate</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${fieldRow('Annual funding rate (%)', 'fundingRatePercent', 'Interest rate you would pay for supply chain finance or early payment programs.')}
        </div>
      </div>
    </div>
  `;

  const bind = (id, key) => {
    const wrap = container.querySelector(`#${id}-wrap`);
    if (!wrap) return;
    mount(wrap, makeNumberInput({
      value: state.panel3[key] ?? 0,
      min: 0,
      onChange: (val) => onStateChange('panel3', key, val)
    }));
  };

  bind('revenue', 'revenue');
  bind('costOfSale', 'costOfSale');
  bind('operationalCosts', 'operationalCosts');
  bind('daysSalesOutstanding', 'daysSalesOutstanding');
  bind('daysInventoryOutstanding', 'daysInventoryOutstanding');
  bind('fundingRatePercent', 'fundingRatePercent');
}

export function renderPanel4(containerId, { countries, state }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const results = computeAllResults(state);
  const { accounting, atShipment, afterDelivery, meta } = results;

  const lane = state.panel1 ?? {};
  const proc = state.panel2 ?? {};
  const fin = state.panel3 ?? {};

  // Fixed: use c.iso instead of c.iso3
  const countryName = (iso) => {
    if (!iso) return '—';
    const country = countries.find(c => (c.iso || c.isoCode) === iso);
    return country ? country.name : iso;
  };
  
  const destName = lane.destinationCountryIso ? countryName(lane.destinationCountryIso) : '—';
  const originNames = (lane.selectedSourceCountryIsos ?? []).map(countryName).filter(n => n && n !== '—');

  const metricRow = (label, value) => `
    <div style="display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-top:1px solid #f1f5f9;">
      <div style="color:#64748b; font-size: 13px;">${label}</div>
      <div style="font-weight:600; text-align:right; color:#0f172a;">${value}</div>
    </div>
  `;

  const scenarioCard = (title, s, color) => {
    const cc = s.workings.cashConversion;
    const gradient = color === 'blue' 
      ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)'
      : 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)';
    const borderColor = color === 'blue' ? '#3b82f6' : '#10b981';
    
    return `
      <div style="border:2px solid ${borderColor}; border-radius: 14px; padding: 20px; background: ${gradient};">
        <div style="font-size: 18px; font-weight:800; margin-bottom: 16px; color: #0f172a;">${title}</div>
        
        <div style="background: white; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Key benefits</div>
          ${metricRow('Process savings', fmtUSD(s.processSavings))}
          ${metricRow('Discount benefit (uptake-adjusted)', fmtUSD(s.discountBenefit))}
          ${metricRow('Funding impact from CCC change', fmtUSD(s.fundingImpact))}
          <div style="border-top: 2px solid #e2e8f0; margin: 12px 0;"></div>
          ${metricRow('Net financing benefit', `<span style="font-weight:700; color:${borderColor};">${fmtUSD(s.netFinancingBenefit)}</span>`)}
          ${metricRow('Total annual benefit', `<span style="font-size:18px; font-weight:800; color:${borderColor};">${fmtUSD(s.totalAnnualBenefit)}</span>`)}
        </div>

        <div style="background: white; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Profit impact</div>
          ${metricRow('Net profit (before)', fmtUSD(s.netProfitBefore))}
          ${metricRow('Net profit (after)', `<span style="font-weight:700; color:${borderColor};">${fmtUSD(s.netProfitAfter)}</span>`)}
          ${metricRow('Improvement', `<span style="font-weight:700; color:${borderColor};">+${fmtNum((s.netProfitAfter / s.netProfitBefore - 1) * 100, 1)}%</span>`)}
        </div>

        <details style="background: white; border-radius: 10px; padding: 16px;">
          <summary style="cursor:pointer; font-size: 13px; font-weight:700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Cash conversion details</summary>
          <div style="margin-top: 12px;">
            ${metricRow('DPO today (days)', `${Math.round(cc.currentDPO)}`)}
            ${metricRow('DPO in scenario (days)', `${Math.round(cc.newDPO)}`)}
            ${metricRow('CCC today (days)', `${Math.round(cc.cccCurrent)}`)}
            ${metricRow('CCC in scenario (days)', `${Math.round(cc.cccNew)}`)}
            ${metricRow('ΔCCC (days)', `<span style="font-weight:700;">${cc.deltaCCC >= 0 ? '+' : ''}${Math.round(cc.deltaCCC)}</span>`)}
            ${metricRow('Trade COGS allocated', fmtUSD(cc.tradeCOGS))}
          </div>
        </details>
      </div>
    `;
  };

  container.innerHTML = cardShell(
    'Results',
    'Compare the financial impact of payment at shipment vs. payment after delivery.'
  );

  const body = container.querySelector('#panelBody');

  body.innerHTML = `
    <div style="display:grid; gap: 24px;">
      <!-- Summary Card -->
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border:2px solid #cbd5e1; border-radius: 14px; padding: 20px;">
        <div style="font-size: 18px; font-weight:800; color: #0f172a; margin-bottom: 12px;">Inputs summary</div>
        <div style="font-size: 14px; color:#475569; line-height: 1.8;">
          <strong>Destination:</strong> ${escapeHTML(destName)}
          ${originNames.length ? ` <span style="color: #94a3b8;">•</span> <strong>Origins (${originNames.length}):</strong> ${escapeHTML(originNames.join(', '))}` : ''}
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 20px;">
          <!-- Process Costs -->
          <div style="background: white; border:1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
            <div style="font-size: 13px; font-weight:700; color: #334155; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Process costs</div>
            ${metricRow('Cost per person', fmtUSD(proc.costPerPerson))}
            ${metricRow('Headcount (L&C)', `${num(proc.headcountLogisticsCompliance)}`)}
            ${metricRow('Headcount (AP)', `${num(proc.headcountAccountsPayable)}`)}
            ${metricRow('Customs/shipment', fmtUSD(proc.customsAndComplianceCostPerShipment))}
            ${metricRow('Ancillary/shipment', fmtUSD(proc.ancillaryCostPerShipment))}
            ${metricRow('Efficiency gain', `${clamp(num(proc.efficiencyPercent, 40), 0, 100)}%`)}
          </div>

          <!-- Trade Parameters -->
          <div style="background: white; border:1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
            <div style="font-size: 13px; font-weight:700; color: #334155; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Trade parameters</div>
            ${metricRow('Shipments/year', `${fmtNum(num(lane.shipmentsPerYear))}`)}
            ${metricRow('Annual value', fmtUSD(lane.totalShipmentValueUSD))}
            ${metricRow('Transit (days)', `${num(lane.transitAndClearanceDays)}`)}
            ${metricRow('Current terms (days)', `${num(lane.currentPaymentTermsDays)}`)}
            ${metricRow('COGS share', `${clamp(num(lane.tradeCOGSSharePercent, 100), 0, 100)}%`)}
          </div>

          <!-- Company Financials -->
          <div style="background: white; border:1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
            <div style="font-size: 13px; font-weight:700; color: #334155; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Company financials</div>
            ${metricRow('Revenue', fmtUSD(fin.revenue))}
            ${metricRow('COGS', fmtUSD(fin.costOfSale))}
            ${metricRow('Op costs', fmtUSD(fin.operationalCosts))}
            ${metricRow('DSO (days)', `${num(fin.daysSalesOutstanding)}`)}
            ${metricRow('DIO (days)', `${num(fin.daysInventoryOutstanding)}`)}
            ${metricRow('Funding rate', `${num(fin.fundingRatePercent)}%`)}
          </div>
        </div>
      </div>

      <!-- Scenarios -->
      <div>
        <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">Payment scenarios</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 20px;">
          ${scenarioCard('(a) Payment at shipment', atShipment, 'blue')}
          ${scenarioCard('(b) Payment after delivery', afterDelivery, 'green')}
        </div>
      </div>

      <!-- Workings -->
      <details style="border:1px solid #e2e8f0; border-radius: 14px; padding: 18px; background: white;">
        <summary style="cursor:pointer; font-size: 15px; font-weight:700; color: #334155;">Show detailed workings</summary>
        <div style="margin-top: 16px; font-size: 13px; color:#0f172a;">
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <div style="font-weight:700; margin-bottom: 10px;">Calculation methodology</div>
            <ul style="margin:0 0 0 20px; padding: 0; color:#475569; line-height: 1.8;">
              <li><strong>Process savings</strong> = baseline process cost × efficiency %</li>
              <li><strong>Discount benefit</strong> = total shipment value × discount % × uptake %</li>
              <li><strong>Cash conversion cycle (CCC)</strong> = DIO + DSO − DPO</li>
              <li><strong>Working capital change (ΔNWC)</strong> ≈ (trade COGS / 365) × ΔCCC</li>
              <li><strong>Funding impact</strong> = −ΔNWC × funding rate (positive means cost, negative means benefit)</li>
              <li><strong>Net financing benefit</strong> = discount benefit − funding impact</li>
            </ul>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 16px;">
            <div>
              <div style="font-weight:700; margin-bottom: 8px; color: #3b82f6;">Payment at shipment - Full JSON</div>
              <pre style="margin:0; padding:14px; border:1px solid #e2e8f0; border-radius: 10px; background:#f8fafc; overflow:auto; font-size: 11px; line-height: 1.4;">${escapeHTML(JSON.stringify(atShipment.workings, null, 2))}</pre>
            </div>
            <div>
              <div style="font-weight:700; margin-bottom: 8px; color: #10b981;">Payment after delivery - Full JSON</div>
              <pre style="margin:0; padding:14px; border:1px solid #e2e8f0; border-radius: 10px; background:#f8fafc; overflow:auto; font-size: 11px; line-height: 1.4;">${escapeHTML(JSON.stringify(afterDelivery.workings, null, 2))}</pre>
            </div>
          </div>
        </div>
      </details>
    </div>
  `;
}
