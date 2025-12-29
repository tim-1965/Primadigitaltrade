// TradeCalculator.js
// Pure calculation helpers for the Trade Digitalisation Benefits app.

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

export function computeFinancials({ revenue, costOfSale, operationalCosts }) {
  const r = num(revenue);
  const c = num(costOfSale);
  const o = num(operationalCosts);
  const grossProfit = r - c;
  const netProfit = grossProfit - o;
  return { revenue: r, costOfSale: c, grossProfit, operationalCosts: o, netProfit };
}

export function computeProcessSavings({
  shipmentsPerYear,
  costPerPerson,
  headcountLogisticsCompliance,
  headcountAccountsPayable,
  customsAndComplianceCostPerShipment,
  ancillaryCostPerShipment,
  efficiencyPercent
}) {
  const nShip = Math.max(0, num(shipmentsPerYear));
  const cpp = Math.max(0, num(costPerPerson));
  const hcLC = Math.max(0, num(headcountLogisticsCompliance));
  const hcAP = Math.max(0, num(headcountAccountsPayable));
  const perShipCustoms = Math.max(0, num(customsAndComplianceCostPerShipment));
  const perShipAnc = Math.max(0, num(ancillaryCostPerShipment));
  const eff = clamp(num(efficiencyPercent) / 100, 0, 1);

  const peopleCostBaseline = cpp * (hcLC + hcAP);
  const peopleSavings = peopleCostBaseline * eff;

  const perShipmentBaseline = (perShipCustoms + perShipAnc) * nShip;
  const perShipmentSavings = perShipmentBaseline * eff;

  return {
    efficiency: eff,
    peopleCostBaseline,
    peopleSavings,
    perShipmentBaseline,
    perShipmentSavings,
    totalProcessSavings: peopleSavings + perShipmentSavings
  };
}

// Finance delta is the incremental funding cost of paying earlier than the current terms.
// If paying later, delta becomes negative (a benefit).

export function computeCashConversionModel({ panel1, panel3, newDPO }) {
  const dso = Math.max(0, num(panel3.daysSalesOutstanding));
  const dio = Math.max(0, num(panel3.daysInventoryOutstanding));
  const currentDPO = Math.max(0, num(panel1.currentPaymentTermsDays));
  const dpoNew = Math.max(0, num(newDPO));

  const cccCurrent = dio + dso - currentDPO;
  const cccNew = dio + dso - dpoNew;
  const deltaCCC = cccNew - cccCurrent; // negative => improved (shorter cycle), positive => worse

  const sharePct = clamp(num(panel1.tradeCOGSSharePercent, 100), 0, 100) / 100;
  const annualCOGS = Math.max(0, num(panel3.costOfSale));
  const tradeCOGS = annualCOGS * sharePct;

  // Approximate working-capital impact from CCC change using trade-related COGS.
  // ΔNWC ≈ (COGS/365) * ΔCCC
  const workingCapitalChange = (tradeCOGS / 365) * deltaCCC; // positive => more capital tied up
  const cashReleased = -workingCapitalChange; // positive => cash freed, negative => cash required

  const rate = Math.max(0, num(panel3.fundingRatePercent)) / 100;
  // Funding impact: if cash is required (cashReleased negative), cost is positive.
  // If cash is released, this is a benefit (negative cost).
  const fundingImpact = -cashReleased * rate;

  return {
    dso,
    dio,
    currentDPO,
    newDPO: dpoNew,
    cccCurrent,
    cccNew,
    deltaCCC,
    annualCOGS,
    tradeCOGS,
    tradeCOGSSharePercent: sharePct * 100,
    workingCapitalChange,
    cashReleased,
    fundingImpact
  };
}



export function computeScenario({ label, discountPercent, uptakePercent, newDPO, panel1, panel2, panel3 }) {
  const totalValue = Math.max(0, num(panel1.totalShipmentValueUSD));
  const discount = Math.max(0, num(discountPercent)) / 100;
  const uptake = clamp(num(uptakePercent, 100), 0, 100) / 100;

  const process = computeProcessSavings({
    shipmentsPerYear: panel1.shipmentsPerYear,
    costPerPerson: panel2.costPerPerson,
    headcountLogisticsCompliance: panel2.headcountLogisticsCompliance,
    headcountAccountsPayable: panel2.headcountAccountsPayable,
    customsComplianceCostPerShipment: panel2.customsComplianceCostPerShipment,
    ancillaryCostPerShipment: panel2.ancillaryCostPerShipment,
    efficiencyPercent: panel2.efficiencyPercent
  });

  const discountBenefit = totalValue * discount * uptake;

  const cashConv = computeCashConversionModel({
    panel1,
    panel3,
    newDPO
  });

  // Net benefit of the payment option:
  // - discount benefit (if any), less the incremental funding impact implied by cash conversion change.
  const netFinancingBenefit = discountBenefit - cashConv.fundingImpact;

  const totalAnnualBenefit = process.processSavings + netFinancingBenefit;

  const fin = computeFinancials(panel3);
  const netProfitAfter = fin.netProfit + totalAnnualBenefit;

  const workings = {
    label,
    inputs: {
      totalShipmentValueUSD: totalValue,
      discountPercent: discountPercent,
      uptakePercent: uptakePercent,
      fundingRatePercent: panel3.fundingRatePercent,
      currentPaymentTermsDays: panel1.currentPaymentTermsDays,
      newDPO
    },
    process,
    discountBenefit,
    cashConversion: cashConv,
    netFinancingBenefit,
    totalAnnualBenefit,
    netProfitBefore: fin.netProfit,
    netProfitAfter
  };

  return {
    label,
    discountBenefit,
    fundingImpact: cashConv.fundingImpact,
    netFinancingBenefit,
    processSavings: process.processSavings,
    totalAnnualBenefit,
    netProfitBefore: fin.netProfit,
    netProfitAfter,
    workings
  };
}


export function computeAllResults(state) {
  const panel1 = state.panel1 ?? {};
  const panel2 = state.panel2 ?? {};
  const panel3 = state.panel3 ?? {};

  const accounting = computeFinancials(panel3);

  const transitDays = Math.max(0, num(panel1.transitAndClearanceDays));
  const afterDeliveryDays = Math.max(0, num(panel1.paymentDaysAfterDelivery));

  const atShipment = computeScenario({
    label: 'Payment at shipment',
    discountPercent: panel1.discountAtShipmentPercent,
    uptakePercent: panel1.uptakeAtShipmentPercent,
    newDPO: 0,
    panel1,
    panel2,
    panel3
  });

  const afterDelivery = computeScenario({
    label: 'Payment after delivery',
    discountPercent: panel1.discountAfterDeliveryPercent,
    uptakePercent: panel1.uptakeAfterDeliveryPercent,
    newDPO: transitDays + afterDeliveryDays,
    panel1,
    panel2,
    panel3
  });

  return {
    accounting,
    atShipment,
    afterDelivery,
    meta: {
      transitAndClearanceDays: transitDays
    }
  };
}
