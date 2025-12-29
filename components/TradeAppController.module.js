// TradeAppController.module.js

import { COUNTRIES } from './countries.js';
import {
  renderPanel1,
  renderPanel2,
  renderPanel3,
  renderPanel4
} from './TradeUIComponents.panels.js';

const STORAGE_KEY = 'tradeDigitalisationBenefitsState.v1';

const PANEL_LABELS = {
  1: 'Trade footprint',
  2: 'Process costs & efficiency',
  3: 'Accounting & funding',
  4: 'Results'
};

function safeJSONParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function renderStepHeader(activePanel) {
  const steps = [1, 2, 3, 4];
  return `
    <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
      ${steps.map(step => {
        const active = step === activePanel;
        return `
          <button data-panel="${step}" class="trade-step-btn" style="
            border:1px solid ${active ? '#1d4ed8' : 'rgba(226,232,240,0.9)'};
            background:${active ? '#1d4ed8' : 'white'};
            color:${active ? 'white' : '#111827'};
            padding:10px 12px;
            border-radius:12px;
            font-weight:600;
            cursor:pointer;
            box-shadow:${active ? '0 10px 20px rgba(29,78,216,0.18)' : '0 6px 16px rgba(15,23,42,0.06)'};
          ">
            ${step}. ${PANEL_LABELS[step]}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

export class TradeAppController {
  constructor() {
    this.containerElement = null;
    this.state = {
      loading: false,
      error: null,
      activePanel: 1,
      countries: [],
      // Panel state
      panel1: {
        destinationCountryIso: '',
        selectedSourceCountryIsos: [],
        shipmentsPerYear: 1000,
        totalShipmentValueUSD: 5000000,
        transitAndClearanceDays: 20,
        currentPaymentTermsDays: 60,
        tradeCOGSSharePercent: 100,
        discountAtShipmentPercent: 1.5,
        uptakeAtShipmentPercent: 60,
        discountAfterDeliveryPercent: 0.75,
        uptakeAfterDeliveryPercent: 60,
        paymentDaysAfterDelivery: 10
      },
      panel2: {
        costPerPerson: 80000,
        headcountLogisticsCompliance: 4,
        headcountAccountsPayable: 2,
        customsAndComplianceCostPerShipment: 25,
        ancillaryCostPerShipment: 10,
        efficiencyPercent: 40
      },
      panel3: {
        revenue: 100000000,
        costOfSale: 70000000,
        operationalCosts: 25000000,
        fundingRatePercent: 8
      }
    };

    if (typeof window !== 'undefined') {
      window.tradeDigitalisationApp = this;
    }
  }

  saveState() {
    try {
      if (typeof localStorage === 'undefined') return;
      const serializable = {
        activePanel: this.state.activePanel,
        panel1: this.state.panel1,
        panel2: this.state.panel2,
        panel3: this.state.panel3
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // ignore
    }
  }

  loadSavedState() {
    try {
      if (typeof localStorage === 'undefined') return false;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = safeJSONParse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      if (parsed.activePanel) this.state.activePanel = parsed.activePanel;
      if (parsed.panel1) this.state.panel1 = { ...this.state.panel1, ...parsed.panel1 };
      if (parsed.panel2) this.state.panel2 = { ...this.state.panel2, ...parsed.panel2 };
      if (parsed.panel3) this.state.panel3 = { ...this.state.panel3, ...parsed.panel3 };

      return true;
    } catch {
      return false;
    }
  }

  async initialize(containerId) {
    this.containerElement = document.getElementById(containerId);
    if (!this.containerElement) throw new Error('Container not found: ' + containerId);

    this.state.loading = true;
    this.render();

    this.loadSavedState();

    try {
      const countries = COUNTRIES;
      this.state.countries = Array.isArray(countries) ? countries : [];
      this.state.loading = false;
      this.state.error = null;
      this.render();
    } catch (err) {
      this.state.loading = false;
      this.state.error = 'Failed to load countries: ' + (err?.message || 'Unknown error');
      this.render();
    }
  }

  setActivePanel(panelNumber) {
    const next = Number(panelNumber);
    if (![1, 2, 3, 4].includes(next)) return;
    this.state.activePanel = next;
    this.saveState();
    this.render();
  }

  updatePanel(path, value) {
    // path like ['panel1', 'shipmentsPerYear']
    const [panelKey, field] = path;
    if (!this.state[panelKey] || typeof this.state[panelKey] !== 'object') return;
    this.state[panelKey] = { ...this.state[panelKey], [field]: value };
    this.saveState();
  }

  toggleSourceCountry(iso) {
    const current = new Set(this.state.panel1.selectedSourceCountryIsos || []);
    if (current.has(iso)) current.delete(iso); else current.add(iso);
    this.state.panel1 = { ...this.state.panel1, selectedSourceCountryIsos: Array.from(current) };
    this.saveState();
    this.render();
  }

  render() {
    if (!this.containerElement) return;

    const { loading, error, activePanel } = this.state;

    this.containerElement.innerHTML = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#0f172a;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px;">
          <div>
            <div style="font-size:22px; font-weight:800; letter-spacing:-0.02em;">Trade digitalisation benefits calculator</div>
            <div style="margin-top:6px; color:#4b5563; font-size:14px; line-height:1.5; max-width:72ch;">
              Model potential savings from process efficiency plus working-capital benefits from earlier (discounted) payments.
            </div>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <button id="trade-reset" style="border:1px solid rgba(226,232,240,0.9); background:white; padding:10px 12px; border-radius:12px; font-weight:600; cursor:pointer;">Reset</button>
          </div>
        </div>

        ${renderStepHeader(activePanel)}

        <div style="margin-top:14px;">
          ${loading ? `<div style="padding:18px; background:rgba(255,255,255,0.9); border:1px solid rgba(226,232,240,0.9); border-radius:12px; box-shadow:0 6px 16px rgba(15,23,42,0.06);">Loading…</div>` : ''}
          ${error ? `<div style="margin-top:12px; padding:14px 16px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; border-radius:12px;">${error}</div>` : ''}

          <div id="trade-panel-root"></div>

          <div style="display:flex; justify-content:space-between; margin-top:14px; gap:12px; flex-wrap:wrap;">
            <button id="trade-prev" style="border:1px solid rgba(226,232,240,0.9); background:white; padding:10px 12px; border-radius:12px; font-weight:700; cursor:pointer;">← Back</button>
            <button id="trade-next" style="border:1px solid #1d4ed8; background:#1d4ed8; color:white; padding:10px 12px; border-radius:12px; font-weight:700; cursor:pointer;">Next →</button>
          </div>
        </div>
      </div>
    `;

    // Header nav handlers
    this.containerElement.querySelectorAll('.trade-step-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setActivePanel(btn.dataset.panel));
    });

    // Reset
    const resetBtn = this.containerElement.querySelector('#trade-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        const fresh = new TradeAppController();
        Object.assign(this, fresh);
        this.containerElement = document.getElementById('app');
        this.initialize('app');
      });
    }

    // Panel render
    const root = this.containerElement.querySelector('#trade-panel-root');
    if (!root) return;

    const ctx = {
      state: this.state,
      setActivePanel: (n) => this.setActivePanel(n),
      update: (panelKey, field, value) => {
        this.updatePanel([panelKey, field], value);
        // For immediate recalculations, re-render
        this.render();
      },
      toggleSourceCountry: (iso) => this.toggleSourceCountry(iso)
    };

    if (!loading) {
      // Panels render into the placeholder div.
      root.innerHTML = '';
      if (activePanel === 1) {
        renderPanel1('trade-panel-root', {
          countries: this.state.countries,
          state: this.state,
          onStateChange: (panelKey, field, value) => ctx.update(panelKey, field, value)
        });
      } else if (activePanel === 2) {
        renderPanel2('trade-panel-root', {
          state: this.state,
          onStateChange: (panelKey, field, value) => ctx.update(panelKey, field, value)
        });
      } else if (activePanel === 3) {
        renderPanel3('trade-panel-root', {
          state: this.state,
          onStateChange: (panelKey, field, value) => ctx.update(panelKey, field, value)
        });
      } else {
        renderPanel4('trade-panel-root', {
          countries: this.state.countries,
          state: this.state
        });
      }
    }

    // Prev/Next
    const prev = this.containerElement.querySelector('#trade-prev');
    const next = this.containerElement.querySelector('#trade-next');
    if (prev) {
      prev.disabled = activePanel === 1;
      prev.style.opacity = activePanel === 1 ? '0.5' : '1';
      prev.addEventListener('click', () => this.setActivePanel(Math.max(1, activePanel - 1)));
    }
    if (next) {
      next.textContent = activePanel === 4 ? 'Done' : 'Next →';
      next.disabled = activePanel === 4;
      next.style.opacity = activePanel === 4 ? '0.5' : '1';
      next.addEventListener('click', () => this.setActivePanel(Math.min(4, activePanel + 1)));
    }
  }
}

export default TradeAppController;
