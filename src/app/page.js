"use client";
import React, { useState } from 'react';
import { 
  Calculator, 
  BarChart2, 
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw
} from 'lucide-react';

const App = () => {
  // 核心数据 (现在可以由用户自定义修改)
  const [ticker, setTicker] = useState('NVDA');
  const [stockPrice, setStockPrice] = useState(120.50);
  const [currentIV, setCurrentIV] = useState(115); 
  const [historicalCrush, setHistoricalCrush] = useState(45); 
  const [impliedMove, setImpliedMove] = useState(8.5); 
  
  // API 获取状态
  const [isLoading, setIsLoading] = useState(false);

  // 用户交互滑块状态
  const [simulatedPriceChange, setSimulatedPriceChange] = useState(5); 
  const [simulatedIVDrop, setSimulatedIVDrop] = useState(40); 
  const [direction, setDirection] = useState('bullish'); // bullish, neutral, bearish

  // 获取真实股价 (对接 Finnhub)
  const fetchRealPrice = async () => {
    if (!ticker) return;
    setIsLoading(true);
    try {
      // ⚠️ 记得去 finnhub.io 注册并把下面的 YOUR_FINNHUB_API_KEY 换成你自己的！
      const API_KEY = "d6imqp9r01qm7dc84fcgd6imqp9r01qm7dc84fd0"; 
      const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`);
      const data = await response.json();
      
      if (data && data.c && data.c > 0) {
        setStockPrice(data.c);
      } else {
        alert("未能获取到该股票价格，请检查代码是否正确或稍后再试。");
      }
    } catch (err) {
      console.error("API获取失败", err);
      alert("请检查你的 API Key 是否已经替换成功！");
    }
    setIsLoading(false);
  };

  // --- Black-Scholes Pricing Model ---
  const normCDF = (x) => {
    const l = Math.abs(x);
    const k = 1.0 / (1.0 + 0.2316419 * l);
    const w = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-l * l / 2) * (0.31938153 * k - 0.356563782 * k * k + 1.781477937 * Math.pow(k, 3) - 1.821255978 * Math.pow(k, 4) + 1.330274429 * Math.pow(k, 5));
    return x < 0 ? 1.0 - w : w;
  };

  const bsPrice = (type, S, K, T, r, v) => {
    if (T <= 0) return Math.max(0, type === 'call' ? S - K : K - S); 
    const d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);
    if (type === 'call') {
      return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
    } else {
      return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
    }
  };

  // Comprehensive PnL Calculator based on BS Model
  const calculateStrategiesPnL = (priceChangePct, ivDrop) => {
    const S_initial = stockPrice;
    const S_new = S_initial * (1 + priceChangePct / 100);
    
    const v_initial = currentIV / 100;
    const v_new = Math.max(0.05, (currentIV - ivDrop) / 100); 
    
    const T_initial = 5 / 365; 
    const T_new = 4 / 365;     
    const r = 0.05;            

    const K_ATM = S_initial;
    const K_OTM_Call = S_initial * (1 + impliedMove / 100);
    const K_OTM_Put = S_initial * (1 - impliedMove / 100);
    const K_Far_Call = S_initial * (1 + (impliedMove + 2) / 100);
    const K_Far_Put = S_initial * (1 - (impliedMove + 2) / 100);

    const callAtmCost = bsPrice('call', S_initial, K_ATM, T_initial, r, v_initial);
    const callAtmValue = bsPrice('call', S_new, K_ATM, T_new, r, v_new);
    const putAtmCost = bsPrice('put', S_initial, K_ATM, T_initial, r, v_initial);
    const putAtmValue = bsPrice('put', S_new, K_ATM, T_new, r, v_new);

    const callOtmCost = bsPrice('call', S_initial, K_OTM_Call, T_initial, r, v_initial);
    const callOtmValue = bsPrice('call', S_new, K_OTM_Call, T_new, r, v_new);
    const putOtmCost = bsPrice('put', S_initial, K_OTM_Put, T_initial, r, v_initial);
    const putOtmValue = bsPrice('put', S_new, K_OTM_Put, T_new, r, v_new);

    const longCallPnL = ((callAtmValue - callAtmCost) / callAtmCost) * 100;
    const callSpreadCost = callAtmCost - callOtmCost;
    const callSpreadValue = callAtmValue - callOtmValue;
    const callSpreadPnL = ((callSpreadValue - callSpreadCost) / callSpreadCost) * 100;

    const longPutPnL = ((putAtmValue - putAtmCost) / putAtmCost) * 100;
    const putSpreadCost = putAtmCost - putOtmCost;
    const putSpreadValue = putAtmValue - putOtmValue;
    const putSpreadPnL = ((putSpreadValue - putSpreadCost) / putSpreadCost) * 100;

    const straddleCost = callAtmCost + putAtmCost;
    const straddleValue = callAtmValue + putAtmValue;
    const straddlePnL = ((straddleValue - straddleCost) / straddleCost) * 100;

    const condorCredit = 
      (callOtmCost - bsPrice('call', S_initial, K_Far_Call, T_initial, r, v_initial)) +
      (putOtmCost - bsPrice('put', S_initial, K_Far_Put, T_initial, r, v_initial));
    const condorValueNew = 
      (callOtmValue - bsPrice('call', S_new, K_Far_Call, T_new, r, v_new)) +
      (putOtmValue - bsPrice('put', S_new, K_Far_Put, T_new, r, v_new));
    const maxRiskCondor = (K_Far_Call - K_OTM_Call) - condorCredit; 
    const condorPnL = ((condorCredit - condorValueNew) / maxRiskCondor) * 100;

    const strangleCredit = callOtmCost + putOtmCost;
    const strangleValueNew = callOtmValue + putOtmValue;
    const strangleMargin = S_initial * 0.2; 
    const stranglePnL = ((strangleCredit - strangleValueNew) / strangleMargin) * 100;

    return {
      newPrice: S_new.toFixed(2),
      newIV: (v_new * 100).toFixed(1),
      bullish: [
        { name: 'Long Call', pnl: longCallPnL.toFixed(1), desc: 'Max vulnerability to IV Crush' },
        { name: 'Call Debit Spread', pnl: callSpreadPnL.toFixed(1), desc: 'Capped profit, hedged against IV drop' }
      ],
      bearish: [
        { name: 'Long Put', pnl: longPutPnL.toFixed(1), desc: 'Max vulnerability to IV Crush' },
        { name: 'Put Debit Spread', pnl: putSpreadPnL.toFixed(1), desc: 'Capped profit, hedged against IV drop' }
      ],
      neutral: [
        { name: 'Long Straddle', pnl: straddlePnL.toFixed(1), desc: 'Needs massive move to beat IV Crush' },
        { name: 'Iron Condor', pnl: condorPnL.toFixed(1), desc: 'Profits directly from IV Crush (Defined Risk)' },
        { name: 'Short Strangle', pnl: stranglePnL.toFixed(1), desc: 'Profits from IV Crush (Undefined Risk)' }
      ]
    };
  };

  const results = calculateStrategiesPnL(simulatedPriceChange, simulatedIVDrop);

  const getPnLColor = (val) => Number(val) > 0 ? 'text-green-500' : 'text-red-500';
  const getPnLBg = (val) => Number(val) > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header: 带价格获取按钮 */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-gray-800 gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Earnings Options PnL Sandbox</h1>
          </div>
          <div className="flex bg-gray-900 rounded p-1 border border-gray-800">
            <input 
              type="text" 
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="bg-transparent text-white px-2 py-1 w-20 outline-none font-bold text-center uppercase"
            />
            <button 
              onClick={fetchRealPrice}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Get Price'}
            </button>
          </div>
        </header>

        {/* 可编辑的沙盘参数区 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center transition-colors focus-within:border-blue-500">
            <div className="text-gray-500 text-xs mb-1 uppercase tracking-wider">Current Price</div>
            <div className="flex items-center justify-center text-xl font-bold text-white">
              $<input 
                type="number" 
                value={stockPrice}
                onChange={(e) => setStockPrice(Number(e.target.value))}
                className="bg-transparent w-full outline-none text-center"
              />
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center transition-colors focus-within:border-orange-500">
            <div className="text-gray-500 text-xs mb-1 uppercase tracking-wider">Current IV</div>
            <div className="flex items-center justify-center text-xl font-bold text-orange-400">
              <input 
                type="number" 
                value={currentIV}
                onChange={(e) => setCurrentIV(Number(e.target.value))}
                className="bg-transparent w-full outline-none text-center text-orange-400"
              />%
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center transition-colors focus-within:border-blue-500">
            <div className="text-gray-500 text-xs mb-1 uppercase tracking-wider">Implied Move</div>
            <div className="flex items-center justify-center text-xl font-bold text-blue-400">
              ±<input 
                type="number" 
                value={impliedMove}
                onChange={(e) => setImpliedMove(Number(e.target.value))}
                className="bg-transparent w-full outline-none text-center text-blue-400"
              />%
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center transition-colors focus-within:border-red-500">
            <div className="text-gray-500 text-xs mb-1 uppercase tracking-wider">Avg. IV Crush</div>
            <div className="flex items-center justify-center text-xl font-bold text-red-400">
              -<input 
                type="number" 
                value={historicalCrush}
                onChange={(e) => setHistoricalCrush(Number(e.target.value))}
                className="bg-transparent w-full outline-none text-center text-red-400"
              />%
            </div>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 text-center mb-6 mt-2">
          💡 Pro tip: Adjust the parameters above manually to match the real-time option chain data from your broker.
        </p>

        {/* Main Content Area: Sliders & Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left: Sliders */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm text-gray-400 font-semibold mb-5 flex items-center gap-2 uppercase tracking-wider">
              <Calculator className="w-4 h-4" />
              Scenario Simulation
            </h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-300">Simulated Price Change</label>
                  <span className={`font-mono font-bold ${simulatedPriceChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {simulatedPriceChange > 0 ? '+' : ''}{simulatedPriceChange}% 
                    <span className="text-xs text-gray-500 ml-1">(${results.newPrice})</span>
                  </span>
                </div>
                <input 
                  type="range" min="-30" max="30" step="1"
                  value={simulatedPriceChange}
                  onChange={(e) => setSimulatedPriceChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-300">Simulated IV Crush</label>
                  <span className="font-mono font-bold text-red-400">
                    -{simulatedIVDrop}% 
                    <span className="text-xs text-gray-500 ml-1">(Drops to {results.newIV}%)</span>
                  </span>
                </div>
                <input 
                  type="range" min="0" max="100" step="1"
                  value={simulatedIVDrop}
                  onChange={(e) => setSimulatedIVDrop(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
              </div>
            </div>
          </div>

          {/* Right: Strategy Results */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm text-gray-400 font-semibold flex items-center gap-2 uppercase tracking-wider">
                <BarChart2 className="w-4 h-4" />
                Estimated Strategy PnL
              </h2>
            </div>

            <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-800 mb-4">
              <button 
                onClick={() => setDirection('bullish')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-sm font-medium rounded-md transition-all ${direction === 'bullish' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <TrendingUp className="w-4 h-4" /> Bullish
              </button>
              <button 
                onClick={() => setDirection('neutral')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-sm font-medium rounded-md transition-all ${direction === 'neutral' ? 'bg-gray-700 text-white border border-gray-600' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Minus className="w-4 h-4" /> Neutral
              </button>
              <button 
                onClick={() => setDirection('bearish')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-sm font-medium rounded-md transition-all ${direction === 'bearish' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <TrendingDown className="w-4 h-4" /> Bearish
              </button>
            </div>
            
            <div className="space-y-3 flex-1">
              {results[direction].map((strat) => (
                <div key={strat.name} className={`flex justify-between items-center p-3 rounded-lg border ${getPnLBg(strat.pnl)}`}>
                  <div>
                    <span className="font-bold text-gray-200 text-sm">{strat.name}</span>
                    <div className="text-xs text-gray-500 mt-0.5">{strat.desc}</div>
                  </div>
                  <span className={`font-mono font-bold text-lg ${getPnLColor(strat.pnl)}`}>
                    {Number(strat.pnl) > 0 ? '+' : ''}{strat.pnl}%
                  </span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Affiliate CPA Link / 广告变现位 */}
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-xl text-center">
          <p className="text-base text-gray-200 mb-4">
            Ready to execute this <span className="font-bold text-white">{direction === 'neutral' ? 'Iron Condor' : 'Spread'}</span> strategy and beat the IV Crush?
          </p>
          <a 
            href="#" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block w-full md:w-auto px-8 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]"
          >
            Trade Commision-Free on Webull & Get 20 Free Shares 🎁
          </a>
          <p className="text-xs text-gray-500 mt-3">*Options trading entails significant risk and is not appropriate for all investors.</p>
        </div>

      </div>
    </div>
  );
};

export default App;