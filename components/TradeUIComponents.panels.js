// TradeUIComponents.panels.js
// Panel renderers with RiskMap-like styling (simple cards, clean inputs).

import { createSelectableWorldMap } from './TradeUIComponents.maps.js';
import { computeAllResults } from './TradeCalculator.js';

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
    <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
      <div style="margin-bottom: 20px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #1f2937; margin: 0 0 6px 0;">${title}</h2>
        ${subtitle ? `<div style="font-size: 14px; color: #6b7280;">${subtitle}</div>` : ''}
      </div>
      <div id="panelBody"></div>
    </div>
  `;
}

function fieldRow(label, id, hint = '') {
  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 6px; margin-bottom: 14px;">
      <label for="${id}" style="font-size: 13px; font-weight: 600; color: #374151;">${label}</label>
      ${hint ? `<div style="font-size: 12px; color: #6b7280;">${hint}</div>` : ''}
      <div id="${id}-wrap"></div>
    </div>
  `;
}

function makeTextInput({ placeholder = '', value = '', onChange }) {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.value = value;
  input.style.cssText = 'width:100%; padding:12px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; background-color:white;';
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

function makeNumberInput({ value = 0, min = 0, step = 'any', onChange }) {
  const input = document.createElement('input');
  input.type = 'number';
  input.style.cssText = 'width:100%; padding:12px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; background-color:white;';
  inputNumber(input, { min, step, value, onChange });
  return input;
}

function makeSelect({ options = [], value = '', placeholder = 'Select…', onChange }) {
  const select = document.createElement('select');
  select.style.cssText = 'width:100%; padding:12px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; background-color:white;';
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
    'Panel 1: Trade lanes and payment options',
    'Choose the destination country you source to, then click on the map to select origin countries.'
  );

  const body = container.querySelector('#panelBody');
  const mapId = `${containerId}-origins-map`;

  body.innerHTML = `
    ${fieldRow('Destination country (sourcing to)', 'destinationCountry', 'Used to contextualise the trade digitalisation opportunity for that lane.')}
    <div style="margin: 16px 0 10px 0; font-size: 13px; font-weight: 600; color: #374151;">Origin countries (sourcing from)</div>
    <div id="${mapId}"></div>
    <div id="selectedOrigins" style="margin-top: 12px;"></div>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 18px;">
      <div>${fieldRow('Shipments per year', 'shipmentsPerYear')}</div>
      <div>${fieldRow('Total annual shipment value (USD)', 'totalShipmentValueUSD')}</div>
      <div>${fieldRow('Transit & clearance time (days)', 'transitAndClearanceDays', 'Average days from shipment to delivery/clearance. Used in cash conversion timing.')}</div>
      <div>${fieldRow('Trade lane share of company cost of sale (%)', 'tradeCOGSSharePercent', 'What % of your annual cost of sale is represented by this trade lane? Used for working-capital impact.')}</div>
      <div>${fieldRow('Current average payment terms (days)', 'currentPaymentTermsDays', 'Average days from shipment/invoice to payment today.')}</div>
      <div>${fieldRow('Discount for payment at shipment (%)', 'discountAtShipmentPercent')}</div>
      <div>${fieldRow('Expected uptake of “pay at shipment” (%)', 'uptakeAtShipmentPercent', 'Share of shipments/value where the discount is actually taken.')}</div>
      <div>${fieldRow('Discount for payment after delivery (%)', 'discountAfterDeliveryPercent')}</div>
      <div>${fieldRow('Expected uptake of “pay after delivery” (%)', 'uptakeAfterDeliveryPercent', 'Share of shipments/value where the discount is actually taken.')}</div>
      <div>${fieldRow('Payment days after delivery (days)', 'paymentDaysAfterDelivery')}</div>
    </div>
  `;

  const destWrap = container.querySelector('#destinationCountry-wrap');
  const options = countries
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => ({ value: c.isoCode, label: c.name }));

  mount(destWrap, makeSelect({
    options,
    value: state.panel1.destinationCountry || '',
    placeholder: 'Select destination country…',
    onChange: (v) => onStateChange({
      panel1: { ...state.panel1, destinationCountry: v }
    })
  }));

  const updateSelectedOrigins = () => {
    const box = container.querySelector('#selectedOrigins');
    const selected = state.panel1.originCountries || [];
    if (!selected.length) {
      box.innerHTML = '<div style="color:#6b7280; font-size:13px; font-style:italic;">No origin countries selected yet.</div>';
      return;
    }
    const names = selected
      .map(code => countries.find(c => c.isoCode === code)?.name || code)
      .sort((a, b) => a.localeCompare(b));

    box.innerHTML = `
      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px;">
        <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Selected origins (${names.length})</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${names.map(n => `<span style="font-size:12px; padding:4px 10px; border-radius:999px; background:#eef2ff; color:#3730a3; border:1px solid #c7d2fe;">${n}</span>`).join('')}
        </div>
      </div>
    `;
  };

  // Render map
  createSelectableWorldMap(mapId, {
    countries,
    selectedCountries: state.panel1.originCountries || [],
    title: 'Click countries to select origins',
    subtitle: 'You can select multiple origin countries. Click again to deselect.',
    onCountryToggle: (iso3) => {
      const current = new Set(state.panel1.originCountries || []);
      if (current.has(iso3)) current.delete(iso3); else current.add(iso3);
      onStateChange({ panel1: { ...state.panel1, originCountries: Array.from(current) } });
      updateSelectedOrigins();
    },
    height: 420
  });

  updateSelectedOrigins();

  // Numeric fields
  const bind = (id, key) => {
    const wrap = container.querySelector(`#${id}-wrap`);
    mount(wrap, makeNumberInput({
      value: state.panel1[key] ?? 0,
      onChange: (val) => onStateChange({ panel1: { ...state.panel1, [key]: val } })
    }));
  };

  bind('shipmentsPerYear', 'shipmentsPerYear');
  bind('totalShipmentValueUSD', 'totalShipmentValueUSD');
  bind('transitAndClearanceDays', 'transitAndClearanceDays');
  bind('tradeCOGSSharePercent', 'tradeCOGSSharePercent');
  bind('currentPaymentTermsDays', 'currentPaymentTermsDays');
  bind('discountAtShipmentPercent', 'discountAtShipmentPercent');
  bind('uptakeAtShipmentPercent', 'uptakeAtShipmentPercent');
  bind('discountAfterDeliveryPercent', 'discountAfterDeliveryPercent');
  bind('uptakeAfterDeliveryPercent', 'uptakeAfterDeliveryPercent');
  bind('paymentDaysAfterDelivery', 'paymentDaysAfterDelivery');
}

export function renderPanel2(containerId, { state, onStateChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = cardShell(
    'Panel 2: Current process costs and digitalisation efficiency',
    'Enter your baseline costs and set the expected efficiency from digitalisation.'
  );

  const body = container.querySelector('#panelBody');

  body.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr; gap: 16px;">
      <div style="display:grid; grid-template-columns: 1fr; gap: 14px;">
        <div style="font-weight:700; color:#374151;">Column 1: Baseline costs</div>
        ${fieldRow('Annual cost per person (USD)', 'costPerPerson')}
        ${fieldRow('Headcount: logistics & compliance', 'headcountLogisticsCompliance')}
        ${fieldRow('Headcount: accounts payable', 'headcountAccountsPayable')}
        ${fieldRow('Customs filings & compliance cost per shipment (USD)', 'customsAndComplianceCostPerShipment')}
        ${fieldRow('Ancillary cost per shipment (USD)', 'ancillaryCostPerShipment')}
      </div>

      <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:16px;">
        <div style="font-weight:700; color:#374151; margin-bottom:8px;">Column 2: Efficiency achieved</div>
        <div style="font-size:13px; color:#6b7280; margin-bottom:10px;">Slide to set the % reduction in baseline process costs enabled by trade digitalisation.</div>
        <div style="display:flex; align-items:center; gap: 12px;">
          <input id="efficiencySlider" type="range" min="0" max="100" step="1" style="width:100%;" value="${state.panel2.efficiencyPercent ?? 40}" />
          <div id="efficiencyValue" style="min-width:64px; font-weight:700; color:#111827;">${state.panel2.efficiencyPercent ?? 40}%</div>
        </div>
      </div>
    </div>
  `;

  const bind = (id, key, fallback = 0) => {
    const wrap = container.querySelector(`#${id}-wrap`);
    mount(wrap, makeNumberInput({
      value: state.panel2[key] ?? fallback,
      onChange: (val) => onStateChange({ panel2: { ...state.panel2, [key]: val } })
    }));
  };

  bind('costPerPerson', 'costPerPerson');
  bind('headcountLogisticsCompliance', 'headcountLogisticsCompliance');
  bind('headcountAccountsPayable', 'headcountAccountsPayable');
  bind('customsAndComplianceCostPerShipment', 'customsAndComplianceCostPerShipment');
  bind('ancillaryCostPerShipment', 'ancillaryCostPerShipment');

  const slider = container.querySelector('#efficiencySlider');
  const valueEl = container.querySelector('#efficiencyValue');
  const update = (v) => {
    const val = Number(v);
    valueEl.textContent = `${val}%`;
    onStateChange({ panel2: { ...state.panel2, efficiencyPercent: val } });
  };
  slider.addEventListener('input', () => update(slider.value));
}

export function renderPanel3(containerId, { state, onStateChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = cardShell(
    'Panel 3: Company financials and funding rate',
    'Used to compute gross profit, net profit, and funding costs for supply chain finance.'
  );

  const body = container.querySelector('#panelBody');

  const revenue = Number(state.panel3.revenue ?? 0);
  const costOfSale = Number(state.panel3.costOfSale ?? 0);
  const operationalCosts = Number(state.panel3.operationalCosts ?? 0);
  const grossProfit = revenue - costOfSale;
  const netProfit = grossProfit - operationalCosts;

  body.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
      <div>${fieldRow('Revenue (USD)', 'revenue')}</div>
      <div>${fieldRow('Cost of sale (USD)', 'costOfSale')}</div>
      <div>
        <div style="font-size:13px; font-weight:600; color:#374151; margin-bottom:6px;">Gross profit (calculated)</div>
        <div style="padding:12px; border:1px solid #e5e7eb; border-radius:6px; background:#f9fafb; font-weight:700;">${fmtUSD(grossProfit)}</div>
      </div>
      <div>${fieldRow('Operational costs (USD)', 'operationalCosts')}</div>
      <div>${fieldRow('Days sales outstanding (DSO)', 'daysSalesOutstanding', 'Average days to collect receivables. Used to compute cash conversion cycle.')}</div>
      <div>${fieldRow('Days inventory outstanding (DIO)', 'daysInventoryOutstanding', 'Average days inventory is held. Used to compute cash conversion cycle.')}</div>
      <div>
        <div style="font-size:13px; font-weight:600; color:#374151; margin-bottom:6px;">Net profit (calculated)</div>
        <div style="padding:12px; border:1px solid #e5e7eb; border-radius:6px; background:#f9fafb; font-weight:700;">${fmtUSD(netProfit)}</div>
      </div>
      <div>${fieldRow('Annual funding rate for supply chain finance (%)', 'fundingRatePercent')}</div>
    </div>
  `;

  const bind = (id, key) => {
    const wrap = container.querySelector(`#${id}-wrap`);
    mount(wrap, makeNumberInput({
      value: state.panel3[key] ?? 0,
      onChange: (val) => onStateChange({ panel3: { ...state.panel3, [key]: val } })
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

  const countryName = (iso) => (countries.find(c => c.iso3 === iso)?.name ?? iso ?? '');
  const destName = lane.destinationCountryIso ? countryName(lane.destinationCountryIso) : '—';
  const originNames = (lane.selectedSourceCountryIsos ?? []).map(countryName).filter(Boolean);

  const metricRow = (label, value) => `
    <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-top:1px solid #f3f4f6;">
      <div style="color:#4b5563; font-size: 13px;">${label}</div>
      <div style="font-weight:700; text-align:right;">${value}</div>
    </div>
  `;

  const scenarioCard = (title, s) => {
    const cc = s.workings.cashConversion;
    return `
      <div style="border:1px solid #e5e7eb; border-radius: 16px; padding: 16px; background: white;">
        <div style="font-weight:800; margin-bottom: 10px;">${title}</div>
        ${metricRow('Process savings', fmtUSD(s.processSavings))}
        ${metricRow('Discount benefit (uptake-adjusted)', fmtUSD(s.discountBenefit))}
        ${metricRow('Funding impact from CCC change', fmtUSD(s.fundingImpact))}
        ${metricRow('Net financing benefit', fmtUSD(s.netFinancingBenefit))}
        ${metricRow('Total annual benefit', `<span style="font-size:16px;">${fmtUSD(s.totalAnnualBenefit)}</span>`)}
        ${metricRow('Net profit (before)', fmtUSD(s.netProfitBefore))}
        ${metricRow('Net profit (after)', fmtUSD(s.netProfitAfter))}
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e5e7eb;">
          <div style="font-size: 12px; color:#6b7280; font-weight:700; margin-bottom: 6px;">Cash conversion details</div>
          ${metricRow('DPO today (days)', `${Math.round(cc.currentDPO)}`)}
          ${metricRow('DPO in scenario (days)', `${Math.round(cc.newDPO)}`)}
          ${metricRow('CCC today (days)', `${Math.round(cc.cccCurrent)}`)}
          ${metricRow('CCC in scenario (days)', `${Math.round(cc.cccNew)}`)}
          ${metricRow('ΔCCC (days)', `${cc.deltaCCC >= 0 ? '+' : ''}${Math.round(cc.deltaCCC)}`)}
          ${metricRow('Trade COGS used', fmtUSD(cc.tradeCOGS))}
        </div>
      </div>
    `;
  };

  container.innerHTML = cardShell(
    'Panel 4: Results',
    'Results are shown for (a) payment at shipment and (b) payment after delivery. Workings are shown below.'
  );

  const body = container.querySelector('#panelBody');

  body.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr; gap: 14px;">
      <div style="border:1px solid #e5e7eb; border-radius: 16px; padding: 16px; background: #f9fafb;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 12px;">
          <div>
            <div style="font-weight:800;">Inputs (summary)</div>
            <div style="font-size: 12px; color:#6b7280; margin-top: 2px;">
              Destination: <b>${escapeHTML(destName)}</b>
              ${originNames.length ? ` • Origins: <b>${escapeHTML(originNames.join(', '))}</b>` : ''}
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-top: 12px;">
          <div style="border:1px solid #e5e7eb; border-radius: 14px; padding: 12px; background:white;">
            <div style="font-weight:800; margin-bottom: 6px;">Process cost inputs</div>
            ${metricRow('Annual cost per person', fmtUSD(proc.costPerPerson))}
            ${metricRow('Headcount (logistics & compliance)', `${num(proc.headcountLogisticsCompliance)}`)}
            ${metricRow('Headcount (accounts payable)', `${num(proc.headcountAccountsPayable)}`)}
            ${metricRow('Customs/compliance per shipment', fmtUSD(proc.customsComplianceCostPerShipment))}
            ${metricRow('Ancillary per shipment', fmtUSD(proc.ancillaryCostPerShipment))}
            ${metricRow('Efficiency from digitalisation', `${clamp(num(proc.efficiencyPercent, 40), 0, 100)}%`)}
          </div>

          <div style="border:1px solid #e5e7eb; border-radius: 14px; padding: 12px; background:white;">
            <div style="font-weight:800; margin-bottom: 6px;">Trade & payment inputs</div>
            ${metricRow('Shipments per year', `${num(lane.shipmentsPerYear)}`)}
            ${metricRow('Annual shipment value', fmtUSD(lane.totalShipmentValueUSD))}
            ${metricRow('Transit & clearance (days)', `${num(lane.transitAndClearanceDays)}`)}
            ${metricRow('Current payment terms (days from shipment)', `${num(lane.currentPaymentTermsDays)}`)}
            ${metricRow('Trade lane share of COGS', `${clamp(num(lane.tradeCOGSSharePercent, 100), 0, 100)}%`)}
          </div>

          <div style="border:1px solid #e5e7eb; border-radius: 14px; padding: 12px; background:white;">
            <div style="font-weight:800; margin-bottom: 6px;">Company funding inputs</div>
            ${metricRow('Revenue', fmtUSD(fin.revenue))}
            ${metricRow('Cost of sale', fmtUSD(fin.costOfSale))}
            ${metricRow('Operational costs', fmtUSD(fin.operationalCosts))}
            ${metricRow('DSO (days)', `${num(fin.daysSalesOutstanding)}`)}
            ${metricRow('DIO (days)', `${num(fin.daysInventoryOutstanding)}`)}
            ${metricRow('Funding rate', `${num(fin.fundingRatePercent)}%`)}
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
        ${scenarioCard('Payment at shipment', atShipment)}
        ${scenarioCard('Payment after delivery', afterDelivery)}
      </div>

      <details style="border:1px solid #e5e7eb; border-radius: 16px; padding: 14px; background: white;">
        <summary style="cursor:pointer; font-weight:800;">Show workings</summary>
        <div style="margin-top: 12px; font-size: 13px; color:#111827;">
          <div style="font-weight:800; margin-bottom: 8px;">Calculation notes</div>
          <ul style="margin:0 0 10px 18px; color:#374151;">
            <li><b>Process savings</b> = baseline process cost × efficiency.</li>
            <li><b>Discount benefit</b> = total shipment value × discount% × uptake%.</li>
            <li><b>Cash conversion</b> uses CCC = DIO + DSO − DPO, and approximates ΔNWC ≈ (trade COGS / 365) × ΔCCC.</li>
            <li><b>Funding impact</b> = (cash required or released) × funding rate.</li>
          </ul>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px;">
            <pre style="margin:0; padding:12px; border:1px solid #f3f4f6; border-radius: 12px; background:#f9fafb; overflow:auto;">${escapeHTML(JSON.stringify(atShipment.workings, null, 2))}</pre>
            <pre style="margin:0; padding:12px; border:1px solid #f3f4f6; border-radius: 12px; background:#f9fafb; overflow:auto;">${escapeHTML(JSON.stringify(afterDelivery.workings, null, 2))}</pre>
          </div>
        </div>
      </details>
    </div>
  `;
}
