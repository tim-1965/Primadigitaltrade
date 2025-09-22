import React, { useState, useEffect } from 'react';
import { Globe, TrendingUp, DollarSign, Package, Clock, FileText } from 'lucide-react';

const TradeDigitalizationApp = () => {
  const [selectedDestination, setSelectedDestination] = useState('');
  const [selectedSources, setSelectedSources] = useState([]);
  const [activeTab, setActiveTab] = useState('setup');
  const [tradeData, setTradeData] = useState({});
  const [calculations, setCalculations] = useState(null);

  // Available countries with their regions for better organization
  const countries = {
    'North America': ['United States', 'Canada', 'Mexico'],
    'Europe': ['Germany', 'United Kingdom', 'France', 'Netherlands', 'Italy', 'Spain'],
    'Asia': ['China', 'Japan', 'South Korea', 'Singapore', 'Hong Kong', 'India', 'Vietnam', 'Thailand'],
    'Others': ['Australia', 'Brazil', 'Turkey', 'South Africa']
  };

  // Sample default data that would come from CSV files in production
  const defaultData = {
    countries: {
      'United States': { 
        apLabor: 85000, logisticsLabor: 75000, customsLabor: 95000,
        seaPaperwork: 250, roadPaperwork: 150, airPaperwork: 350,
        customsFiling: 125
      },
      'Germany': { 
        apLabor: 78000, logisticsLabor: 70000, customsLabor: 88000,
        seaPaperwork: 280, roadPaperwork: 180, airPaperwork: 380,
        customsFiling: 150
      },
      'United Kingdom': { 
        apLabor: 72000, logisticsLabor: 68000, customsLabor: 85000,
        seaPaperwork: 275, roadPaperwork: 175, airPaperwork: 375,
        customsFiling: 140
      },
      'Japan': { 
        apLabor: 82000, logisticsLabor: 77000, customsLabor: 92000,
        seaPaperwork: 290, roadPaperwork: 190, airPaperwork: 390,
        customsFiling: 160
      },
      'Canada': { 
        apLabor: 75000, logisticsLabor: 70000, customsLabor: 80000,
        seaPaperwork: 240, roadPaperwork: 140, airPaperwork: 340,
        customsFiling: 115
      },
      'Singapore': { 
        apLabor: 70000, logisticsLabor: 65000, customsLabor: 75000,
        seaPaperwork: 200, roadPaperwork: 120, airPaperwork: 300,
        customsFiling: 100
      }
    },
    sourceCountries: {
      'China': { earlyPaymentDiscount: 2.5, scfBenefit: 1.8, scfAvailability: 75, scfTakeup: 60 },
      'Vietnam': { earlyPaymentDiscount: 2.0, scfBenefit: 1.5, scfAvailability: 45, scfTakeup: 30 },
      'India': { earlyPaymentDiscount: 2.2, scfBenefit: 1.6, scfAvailability: 55, scfTakeup: 40 },
      'Mexico': { earlyPaymentDiscount: 1.8, scfBenefit: 1.3, scfAvailability: 65, scfTakeup: 50 },
      'Turkey': { earlyPaymentDiscount: 2.1, scfBenefit: 1.4, scfAvailability: 50, scfTakeup: 35 },
      'Thailand': { earlyPaymentDiscount: 1.9, scfBenefit: 1.4, scfAvailability: 40, scfTakeup: 25 },
      'South Korea': { earlyPaymentDiscount: 1.7, scfBenefit: 1.2, scfAvailability: 60, scfTakeup: 45 },
      'Brazil': { earlyPaymentDiscount: 2.3, scfBenefit: 1.7, scfAvailability: 35, scfTakeup: 20 }
    },
    shippingTimes: {
      analog: {
        sea: { base: 25, variance: 10 },
        air: { base: 4, variance: 2 },
        road: { base: 8, variance: 3 }
      },
      digital: {
        sea: { base: 18, variance: 5 },
        air: { base: 2, variance: 1 },
        road: { base: 6, variance: 2 }
      }
    },
    invoiceApproval: {
      analog: 14,
      digital: 7
    }
  };

  const handleDestinationSelect = (country) => {
    setSelectedDestination(country);
    if (selectedSources.includes(country)) {
      setSelectedSources(selectedSources.filter(c => c !== country));
    }
  };

  const handleSourceSelect = (country) => {
    if (country === selectedDestination) return;
    
    if (selectedSources.includes(country)) {
      setSelectedSources(selectedSources.filter(c => c !== country));
    } else {
      setSelectedSources([...selectedSources, country]);
    }
  };

  const handleTradeDataSubmit = (sourceCountry, data) => {
    setTradeData(prev => ({
      ...prev,
      [sourceCountry]: data
    }));
  };

  const calculateShippingDays = (mode, isDigital = false) => {
    const config = isDigital ? defaultData.shippingTimes.digital : defaultData.shippingTimes.analog;
    return config[mode].base + Math.random() * config[mode].variance;
  };

  const calculateBenefits = () => {
    if (!selectedDestination || selectedSources.length === 0) return;

    const destData = defaultData.countries[selectedDestination] || defaultData.countries['United States'];
    let totalAnalogCosts = 0;
    let totalDigitalCosts = 0;
    let totalBenefits = 0;

    const results = {
      destination: selectedDestination,
      sources: [],
      totals: {}
    };

    selectedSources.forEach(source => {
      const trade = tradeData[source] || {};
      const sourceData = defaultData.sourceCountries[source] || defaultData.sourceCountries['China'];
      
      const monthlyValue = parseFloat(trade.monthlyValue) || 500000;
      const monthlyShipments = parseFloat(trade.monthlyShipments) || 25;
      const paymentTerm = parseFloat(trade.paymentTerm) || 30;
      
      const seaPct = parseFloat(trade.seaPct) || 70;
      const airPct = parseFloat(trade.airPct) || 25;
      const roadPct = parseFloat(trade.roadPct) || 5;

      // Annual calculations
      const annualValue = monthlyValue * 12;
      const annualShipments = monthlyShipments * 12;

      // Labor costs (allocated based on shipment volume)
      const laborAllocation = Math.min(annualShipments / 500, 2); // Cap at 2x baseline
      const analogLaborCost = (destData.apLabor + destData.logisticsLabor + destData.customsLabor) * laborAllocation;
      const digitalLaborCost = analogLaborCost * 0.65; // 35% reduction

      // Paperwork costs
      const analogPaperworkCost = (
        (seaPct/100) * annualShipments * destData.seaPaperwork +
        (airPct/100) * annualShipments * destData.airPaperwork +
        (roadPct/100) * annualShipments * destData.roadPaperwork
      );
      const digitalPaperworkCost = analogPaperworkCost * 0.3; // 70% reduction

      // Customs filing costs
      const customsCost = annualShipments * destData.customsFiling;
      const digitalCustomsCost = customsCost * 0.75; // 25% reduction

      // Working capital benefits
      const avgAnalogShippingDays = (
        (seaPct/100) * calculateShippingDays('sea', false) +
        (airPct/100) * calculateShippingDays('air', false) +
        (roadPct/100) * calculateShippingDays('road', false)
      );
      
      const avgDigitalShippingDays = (
        (seaPct/100) * calculateShippingDays('sea', true) +
        (airPct/100) * calculateShippingDays('air', true) +
        (roadPct/100) * calculateShippingDays('road', true)
      );

      const analogCashCycleDays = avgAnalogShippingDays + defaultData.invoiceApproval.analog + paymentTerm;
      const digitalCashCycleDays = avgDigitalShippingDays + defaultData.invoiceApproval.digital + paymentTerm;
      const cashCycleSavings = (analogCashCycleDays - digitalCashCycleDays) * (annualValue / 365) * 0.06; // 6% cost of capital

      // Early payment benefits
      const earlyPaymentBenefit = annualValue * (sourceData.earlyPaymentDiscount / 100) * 0.7; // 70% take-up rate

      // Supply chain finance benefits
      const scfBenefit = annualValue * (sourceData.scfBenefit / 100) * 
                        (sourceData.scfAvailability / 100) * 
                        (sourceData.scfTakeup / 100);

      const sourceResult = {
        country: source,
        tradeVolume: {
          annualValue,
          annualShipments,
          avgAnalogCycleDays: Math.round(analogCashCycleDays),
          avgDigitalCycleDays: Math.round(digitalCashCycleDays)
        },
        analog: {
          labor: analogLaborCost,
          paperwork: analogPaperworkCost,
          customs: customsCost,
          total: analogLaborCost + analogPaperworkCost + customsCost
        },
        digital: {
          labor: digitalLaborCost,
          paperwork: digitalPaperworkCost,
          customs: digitalCustomsCost,
          total: digitalLaborCost + digitalPaperworkCost + digitalCustomsCost
        },
        benefits: {
          laborSavings: analogLaborCost - digitalLaborCost,
          paperworkSavings: analogPaperworkCost - digitalPaperworkCost,
          customsSavings: customsCost - digitalCustomsCost,
          cashCycleSavings: Math.max(0, cashCycleSavings),
          earlyPayment: earlyPaymentBenefit,
          scf: scfBenefit,
          total: (analogLaborCost - digitalLaborCost) + (analogPaperworkCost - digitalPaperworkCost) + 
                 (customsCost - digitalCustomsCost) + Math.max(0, cashCycleSavings) + earlyPaymentBenefit + scfBenefit
        }
      };

      results.sources.push(sourceResult);
      totalAnalogCosts += sourceResult.analog.total;
      totalDigitalCosts += sourceResult.digital.total;
      totalBenefits += sourceResult.benefits.total;
    });

    results.totals = {
      analogCosts: totalAnalogCosts,
      digitalCosts: totalDigitalCosts,
      totalBenefits: totalBenefits,
      netBenefit: totalBenefits,
      costSavings: totalAnalogCosts - totalDigitalCosts,
      roi: totalBenefits / (totalDigitalCosts || 1) * 100
    };

    setCalculations(results);
    setActiveTab('results');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Globe className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">
              Trade Digitalization ROI Calculator
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Quantify the financial benefits of digitalizing your global supply chain operations
          </p>
        </header>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <nav className="flex border-b border-gray-200">
            {[
              { id: 'setup', label: 'Country Selection', icon: Globe },
              { id: 'data-entry', label: 'Trade Data', icon: Package },
              { id: 'results', label: 'Benefits Analysis', icon: TrendingUp }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 py-4 px-6 text-center font-medium flex items-center justify-center space-x-2 ${
                  activeTab === id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                } transition-all duration-200`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {activeTab === 'setup' && (
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-3xl font-semibold mb-4 text-gray-800">Build Your Supply Chain</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-blue-800">Setup Instructions:</h3>
                      <ol className="list-decimal list-inside space-y-2 text-blue-700">
                        <li>Select your destination country (where you import goods to)</li>
                        <li>Choose source countries (where you import goods from)</li>
                        <li>Review your selection and proceed to data entry</li>
                      </ol>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">Destination:</span>
                          <span className="text-blue-600 font-semibold">
                            {selectedDestination || 'Not selected'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">Source Countries:</span>
                          <span className="text-green-600 font-semibold">
                            {selectedSources.length} selected
                          </span>
                        </div>
                        {selectedSources.length > 0 && (
                          <div className="text-sm text-gray-600 mt-2">
                            {selectedSources.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <DollarSign className="w-6 h-6 mr-2 text-blue-500" />
                    Select Destination Country
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Object.values(countries).flat().map((country) => (
                      <button
                        key={country}
                        onClick={() => handleDestinationSelect(country)}
                        className={`p-3 text-left rounded-lg border-2 transition-all duration-200 ${
                          selectedDestination === country
                            ? 'bg-blue-500 text-white border-blue-500 shadow-lg'
                            : 'bg-white hover:bg-blue-50 border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{country}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDestination && (
                  <div>
                    <h3 className="text-xl font-semibold mb-4 flex items-center">
                      <Package className="w-6 h-6 mr-2 text-green-500" />
                      Select Source Countries
                    </h3>
                    {Object.entries(countries).map(([region, regionCountries]) => (
                      <div key={region} className="mb-6">
                        <h4 className="text-lg font-medium mb-3 text-gray-700">{region}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {regionCountries
                            .filter(country => country !== selectedDestination)
                            .map((country) => (
                            <button
                              key={country}
                              onClick={() => handleSourceSelect(country)}
                              className={`p-3 text-left rounded-lg border-2 transition-all duration-200 ${
                                selectedSources.includes(country)
                                  ? 'bg-green-500 text-white border-green-500 shadow-lg'
                                  : 'bg-white hover:bg-green-50 border-gray-200 hover:border-green-300'
                              }`}
                            >
                              <div className="font-medium text-sm">{country}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedDestination && selectedSources.length > 0 && (
                <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
                  <div className="text-center">
                    <h4 className="text-lg font-semibold mb-2">Ready to Continue!</h4>
                    <p className="text-gray-600 mb-4">
                      You've selected {selectedSources.length} source countries importing to {selectedDestination}
                    </p>
                    <button
                      onClick={() => setActiveTab('data-entry')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
                    >
                      <span>Enter Trade Data</span>
                      <Package className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'data-entry' && (
            <div className="p-8">
              <h2 className="text-3xl font-semibold mb-6 text-gray-800 flex items-center">
                <FileText className="w-8 h-8 mr-3 text-blue-500" />
                Trade Data Entry
              </h2>
              
              {!selectedDestination || selectedSources.length === 0 ? (
                <div className="text-center py-12">
                  <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">No Countries Selected</h3>
                  <p className="text-gray-500 mb-6">
                    Please go back to Country Selection and choose your destination and source countries first.
                  </p>
                  <button
                    onClick={() => setActiveTab('setup')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Go to Country Selection
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-800 mb-2">Supply Chain Overview</h3>
                    <p className="text-blue-700">
                      <strong>Destination:</strong> {selectedDestination} | 
                      <strong> Sources:</strong> {selectedSources.join(', ')} ({selectedSources.length} countries)
                    </p>
                  </div>
                  
                  <div className="space-y-8">
                    {selectedSources.map((source) => (
                      <TradeDataForm
                        key={source}
                        sourceCountry={source}
                        destinationCountry={selectedDestination}
                        onSubmit={handleTradeDataSubmit}
                        existingData={tradeData[source]}
                      />
                    ))}
                  </div>

                  <div className="mt-8 text-center">
                    <button
                      onClick={calculateBenefits}
                      className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg font-medium transition-colors inline-flex items-center space-x-2 text-lg"
                    >
                      <TrendingUp className="w-6 h-6" />
                      <span>Calculate Benefits</span>
                    </button>
                    <p className="text-sm text-gray-600 mt-2">
                      You can calculate benefits with default values, or customize the trade data above first
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'results' && calculations && (
            <ResultsDashboard calculations={calculations} />
          )}
        </div>
      </div>
    </div>
  );
};

const TradeDataForm = ({ sourceCountry, destinationCountry, onSubmit, existingData }) => {
  const [formData, setFormData] = useState(existingData || {
    monthlyValue: '500000',
    monthlyShipments: '25',
    seaPct: '70',
    airPct: '25',
    roadPct: '5',
    paymentTerm: '30'
  });

  const [isSaved, setIsSaved] = useState(!!existingData);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleSave = () => {
    // Validate percentages sum to 100
    const total = parseFloat(formData.seaPct || 0) + parseFloat(formData.airPct || 0) + parseFloat(formData.roadPct || 0);
    if (Math.abs(total - 100) > 1) {
      alert('Transport percentages must sum to 100%');
      return;
    }

    onSubmit(sourceCountry, formData);
    setIsSaved(true);
  };

  return (
    <div className={`border-2 rounded-xl p-6 transition-all duration-200 ${
      isSaved ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-800 flex items-center">
          <Package className="w-6 h-6 mr-2 text-blue-500" />
          {sourceCountry} → {destinationCountry}
        </h3>
        {isSaved && (
          <div className="text-green-600 font-medium flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            Saved
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Monthly Import Value (USD)
          </label>
          <input
            type="number"
            value={formData.monthlyValue}
            onChange={(e) => handleChange('monthlyValue', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="500000"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Monthly Shipments
          </label>
          <input
            type="number"
            value={formData.monthlyShipments}
            onChange={(e) => handleChange('monthlyShipments', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="25"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Payment Terms (Days)
          </label>
          <input
            type="number"
            value={formData.paymentTerm}
            onChange={(e) => handleChange('paymentTerm', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="30"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Sea Transport (%)
          </label>
          <input
            type="number"
            value={formData.seaPct}
            onChange={(e) => handleChange('seaPct', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="70"
            min="0"
            max="100"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Air Transport (%)
          </label>
          <input
            type="number"
            value={formData.airPct}
            onChange={(e) => handleChange('airPct', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="25"
            min="0"
            max="100"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Road Transport (%)
          </label>
          <input
            type="number"
            value={formData.roadPct}
            onChange={(e) => handleChange('roadPct', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="5"
            min="0"
            max="100"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Transport total: {(parseFloat(formData.seaPct || 0) + parseFloat(formData.airPct || 0) + parseFloat(formData.roadPct || 0)).toFixed(1)}%
        </div>
        <button
          onClick={handleSave}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isSaved 
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isSaved ? 'Saved ✓' : 'Save Data'}
        </button>
      </div>
    </div>
  );
};

const ResultsDashboard = ({ calculations }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (percent) => {
    return `${percent.toFixed(1)}%`;
  };

  return (
    <div className="p-8">
      <h2 className="text-3xl font-semibold mb-8 text-gray-800 flex items-center">
        <TrendingUp className="w-8 h-8 mr-3 text-green-500" />
        Digitalization Benefits Analysis
      </h2>

      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium opacity-90 mb-1">Current Annual Costs</h3>
              <p className="text-3xl font-bold">
                {formatCurrency(calculations.totals.analogCosts)}
              </p>
            </div>
            <FileText className="w-8 h-8 opacity-75" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium opacity-90 mb-1">Digital Costs</h3>
              <p className="text-3xl font-bold">
                {formatCurrency(calculations.totals.digitalCosts)}
              </p>
            </div>
            <Globe className="w-8 h-8 opacity-75" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium opacity-90 mb-1">Total Annual Benefits</h3>
              <p className="text-3xl font-bold">
                {formatCurrency(calculations.totals.totalBenefits)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 opacity-75" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium opacity-90 mb-1">ROI</h3>
              <p className="text-3xl font-bold">
                {formatPercent(calculations.totals.roi)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 opacity-75" />
          </div>
        </div>
      </div>

      {/* Country-by-Country Breakdown */}
      <div className="space-y-8">
        <h3 className="text-2xl font-semibold text-gray-800">Country Analysis</h3>
        
        {calculations.sources.map((source) => (
          <div key={source.country} className="bg-white border border-gray-200 rounded-xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xl font-semibold text-gray-800">
                {source.country} → {calculations.destination}
              </h4>
              <div className="text-sm text-gray-600 text-right">
                <div>Annual Volume: {formatCurrency(source.tradeVolume.annualValue)}</div>
                <div>{source.tradeVolume.annualShipments} shipments/year</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cost Comparison */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h5 className="text-lg font-semibold mb-4 text-gray-700">Cost Comparison</h5>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-red-100 rounded-lg">
                    <span className="font-medium">Current (Analog):</span>
                    <span className="font-bold text-red-700">
                      {formatCurrency(source.analog.total)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-100 rounded-lg">
                    <span className="font-medium">Digital:</span>
                    <span className="font-bold text-blue-700">
                      {formatCurrency(source.digital.total)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg border-2 border-green-300">
                    <span className="font-semibold">Direct Savings:</span>
                    <span className="font-bold text-green-700 text-lg">
                      {formatCurrency(source.analog.total - source.digital.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Benefits Breakdown */}
              <div className="bg-green-50 rounded-lg p-6">
                <h5 className="text-lg font-semibold mb-4 text-gray-700">Additional Benefits</h5>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Working Capital Savings:</span>
                    <span className="font-semibold">{formatCurrency(source.benefits.cashCycleSavings)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Early Payment Discounts:</span>
                    <span className="font-semibold">{formatCurrency(source.benefits.earlyPayment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Supply Chain Finance:</span>
                    <span className="font-semibold">{formatCurrency(source.benefits.scf)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3 mt-4">
                    <span className="font-bold">Total Benefits:</span>
                    <span className="font-bold text-green-600 text-lg">{formatCurrency(source.benefits.total)}</span>
                  </div>
                </div>
              </div>

              {/* Process Improvements */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h5 className="text-lg font-semibold mb-4 text-gray-700">Process Improvements</h5>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Cash Cycle (Current):</span>
                    <span className="font-semibold">{source.tradeVolume.avgAnalogCycleDays} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash Cycle (Digital):</span>
                    <span className="font-semibold text-blue-600">{source.tradeVolume.avgDigitalCycleDays} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cycle Improvement:</span>
                    <span className="font-semibold text-green-600">
                      -{source.tradeVolume.avgAnalogCycleDays - source.tradeVolume.avgDigitalCycleDays} days
                    </span>
                  </div>
                  <div className="border-t pt-3 mt-4">
                    <div className="text-xs text-gray-600 mb-2">Cost Reduction by Category:</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Labor:</span>
                        <span>-35%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Paperwork:</span>
                        <span>-70%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Customs:</span>
                        <span>-25%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Investment Summary */}
      <div className="mt-10 p-8 bg-gradient-to-r from-blue-50 via-green-50 to-purple-50 rounded-xl border-2 border-gray-200">
        <h3 className="text-2xl font-semibold mb-6 text-center text-gray-800">Investment Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {formatCurrency(calculations.totals.costSavings)}
            </div>
            <div className="text-sm text-gray-600">Direct Cost Savings</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {formatCurrency(calculations.totals.totalBenefits - calculations.totals.costSavings)}
            </div>
            <div className="text-sm text-gray-600">Working Capital & Financial Benefits</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {formatCurrency(calculations.totals.netBenefit)}
            </div>
            <div className="text-sm text-gray-600">Total Annual Value</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">
              {formatPercent(calculations.totals.roi)}
            </div>
            <div className="text-sm text-gray-600">Return on Investment</div>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-gray-700 text-lg">
            <strong>Payback Period:</strong> {calculations.totals.roi > 100 ? '<1 year' : Math.ceil(100 / calculations.totals.roi * 12) + ' months'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TradeDigitalizationApp;