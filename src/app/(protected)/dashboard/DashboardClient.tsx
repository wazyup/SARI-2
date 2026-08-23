'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface KPIState {
  todaySales: number;
  monthSales: number;
  lowStockCount: number;
  expiringCount: number;
  totalUtang: number;
  totalInventoryValue: number;
  totalInventoryCost: number;
  potentialProfit: number;
}

interface Mover {
  id: string;
  name: string;
  qty: number;
  sales: number;
}

interface TrendItem {
  productId: string;
  productName: string;
  trendStatus: 'INCREASING' | 'DECLINING';
  trendPct: number;
  message: string;
}

interface Recommendation {
  productId: string;
  productName: string;
  categoryName: string;
  supplierName: string;
  currentStock: number;
  costPrice: number;
  transpoFee: number;
  unitPrice: number;
  profitPerUnit: number;
  profitMarginPct: number;
  lowStockThreshold: number;
  unit: string;
  action: 'RESTOCK' | 'PRIORITIZE_SELLING' | 'DISPOSE_EXPIRED' | 'MONITOR';
  recommendedRestockQty: number;
  estimatedCost: number;
  forecastedWeeklyDemand: number;
  expectedSalesBeforeExpiry?: number;
  daysUntilExpiry?: number;
  isExpired?: boolean;
  salesTrendPct?: number;
  message: string;
  reason: string;
}

interface GroceryShoppingList {
  totalItemsCount: number;
  totalUnitsToBuy: number;
  totalEstimatedBudget: number;
  items: Recommendation[];
  groupedBySupplier: Record<string, Recommendation[]>;
}

interface StoreSummary {
  headline: string;
  restockCount: number;
  expiryRiskCount: number;
  summaryText: string;
  trends: TrendItem[];
}

interface ChartDataPoint {
  date: string;
  sales: number;
}

interface AnalyticsResponse {
  kpis: KPIState;
  engine: string;
  seasonalMultiplier: number;
  seasonalFactorName: string;
  weatherFactorName: string;
  fastMovers: Mover[];
  slowMovers: Mover[];
  trends: TrendItem[];
  recommendations: Recommendation[];
  groceryShoppingList: GroceryShoppingList;
  storeSummary: StoreSummary;
  salesChartData: ChartDataPoint[];
}

const SEASONS = [
  { id: 'NORMAL', label: 'Normal Days (1.0x)', icon: '📅' },
  { id: 'PAYDAY', label: 'Payday / Sweldo (1.35x)', icon: '💰' },
  { id: 'CHRISTMAS', label: 'Christmas Season (1.75x)', icon: '🎄' },
  { id: 'NEW_YEAR', label: 'New Year Rush (1.80x)', icon: '🎆' },
  { id: 'VALENTINES', label: 'Valentine\'s Day (1.30x)', icon: '❤️' },
  { id: 'HOLY_WEEK', label: 'Holy Week (1.25x)', icon: '⛪' },
  { id: 'ALL_SOULS_DAY', label: 'All Souls\' Day / Undas (1.40x)', icon: '🕯️' },
  { id: 'SUMMER', label: 'Summer Heat (1.45x)', icon: '☀️' },
  { id: 'RAINY_SEASON', label: 'Rainy Season (1.30x)', icon: '🌧️' },
];

const WEATHERS = [
  { id: 'HOT_SUNNY', label: '☀️ Hot & Sunny' },
  { id: 'RAINY', label: '🌧️ Rainy' },
  { id: 'STORMY', label: '⛈️ Stormy' },
  { id: 'NORMAL', label: '🌤️ Normal' }
];

export default function DashboardClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [selectedSeason, setSelectedSeason] = useState('NORMAL');
  const [selectedWeather, setSelectedWeather] = useState('NORMAL');
  const [showGuide, setShowGuide] = useState(false);
  
  // Interactive Shopping List State
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'SHOPPING_LIST'>('ANALYTICS');

  const fetchAnalytics = (season: string, weather: string) => {
    setLoading(true);
    fetch(`/api/analytics?season=${season}&weather=${weather}`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        if (json.weatherFactorName) {
          setSelectedWeather(json.weatherFactorName);
        }
        if (json.recommendations) {
          const qtys: Record<string, number> = {};
          json.recommendations.forEach((r: Recommendation) => {
            qtys[r.productId] = r.recommendedRestockQty;
          });
          setCustomQuantities(qtys);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAnalytics(selectedSeason, selectedWeather);
  }, [selectedSeason, selectedWeather]);

  const toggleCheckItem = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCustomQuantities(prev => {
      const current = prev[id] || 1;
      const nextVal = Math.max(1, current + delta);
      return { ...prev, [id]: nextVal };
    });
  };

  const copyShoppingListText = () => {
    if (!data?.recommendations) return;
    const lines = [
      `🛒 SARI 2 GROCERY SHOPPING LIST (${selectedSeason} | Weather: ${selectedWeather})`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Total Restock Items: ${data.groceryShoppingList?.totalItemsCount || 0}`,
      `Estimated Capital Needed: ₱${data.groceryShoppingList?.totalEstimatedBudget?.toLocaleString() || 0}`,
      '----------------------------------------',
    ];

    const grouped = data.groceryShoppingList?.groupedBySupplier || {};
    Object.keys(grouped).forEach(sup => {
      lines.push(`\n📍 SUPPLIER: ${sup}`);
      grouped[sup].forEach(item => {
        const qty = customQuantities[item.productId] ?? item.recommendedRestockQty;
        const checked = checkedItems[item.productId] ? '[X]' : '[ ]';
        lines.push(`  ${checked} ${item.productName} — ${qty} ${item.unit}(s) (Stock: ${item.currentStock})`);
      });
    });

    navigator.clipboard.writeText(lines.join('\n'));
    alert('Grocery Shopping List copied to clipboard!');
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Running Python Predictive Analytics Engine...</p>
      </div>
    );
  }

  const {
    kpis,
    fastMovers,
    slowMovers,
    trends,
    recommendations,
    salesChartData,
    engine,
    seasonalMultiplier,
    storeSummary
  } = data!;

  const chartData = {
    labels: salesChartData.map(d => d.date),
    datasets: [
      {
        fill: true,
        label: 'Sales (₱)',
        data: salesChartData.map(d => d.sales),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#12182b',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
      }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8' } },
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8' } }
    }
  };

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Store Telemetry & Predictive AI</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
              ⚡ {engine}
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              Multiplier: {seasonalMultiplier}x
            </span>
            <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
              Weather: {selectedWeather}
            </span>
          </div>
        </div>

        <div className="header-actions" style={{ flexWrap: 'wrap' }}>
          {/* Weather Selector */}
          <select
            className="form-control"
            value={selectedWeather}
            onChange={(e) => setSelectedWeather(e.target.value)}
            style={{ width: '150px', padding: '0.55rem 0.75rem' }}
          >
            {WEATHERS.map(w => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>

          {/* Season Selector */}
          <select
            className="form-control"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            style={{ width: '220px', padding: '0.55rem 0.75rem' }}
          >
            {SEASONS.map(s => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.label}
              </option>
            ))}
          </select>

          <button onClick={() => setShowGuide(!showGuide)} className="btn btn-secondary">
            📖 {showGuide ? 'Hide Guide' : 'How to Use'}
          </button>

          <Link href="/sales" className="btn btn-primary">
            🛒 POS Checkout
          </Link>
        </div>
      </div>

      {/* Tutorial / Quick Guide Box */}
      {showGuide && (
        <div className="tutorial-box">
          <span style={{ fontSize: '1.5rem' }}>💡</span>
          <div style={{ flex: 1 }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Dashboard & Predictive AI Guide</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              1. <strong>Weekly AI Summary:</strong> Automatically provides an executive situation overview of sales, fast movers, and expiration risks.<br />
              2. <strong>Seasonal Multipliers:</strong> Select upcoming events (e.g. Christmas, Payday, Rainy Season) to automatically adjust restock advice.<br />
              3. <strong>Velocity + Expiration Synthesis:</strong> If an item is near expiry and unlikely to sell in time, the system advises <em>Prioritize Selling</em> instead of restocking.<br />
              4. <strong>Grocery Shopping List Tab:</strong> Open the shopping list tab to check off items at the wholesaler and adjust quantities with <code>+</code> / <code>-</code>.
            </p>
          </div>
        </div>
      )}

      {/* AUTOMATED STORE AI EXECUTIVE SUMMARY BANNER */}
      {storeSummary && (
        <div className="prominent-alert-banner" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.15))', borderColor: 'rgba(99, 102, 241, 0.35)' }}>
          <div style={{ flex: 1 }}>
            <div className="prominent-alert-title" style={{ color: '#818cf8', marginBottom: '0.35rem' }}>
              <span>🤖</span>
              <span>{storeSummary.headline}</span>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.92rem', lineHeight: 1.5 }}>
              {storeSummary.summaryText}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button onClick={() => setActiveTab('SHOPPING_LIST')} className="btn btn-primary" style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}>
              View Restock List ({storeSummary.restockCount})
            </button>
          </div>
        </div>
      )}

      {/* Navigation View Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setActiveTab('ANALYTICS')}
          className={`btn ${activeTab === 'ANALYTICS' ? 'btn-primary' : 'btn-secondary'}`}
        >
          📊 Dashboard & Trends
        </button>
        <button
          onClick={() => setActiveTab('SHOPPING_LIST')}
          className={`btn ${activeTab === 'SHOPPING_LIST' ? 'btn-primary' : 'btn-secondary'}`}
        >
          📝 Grocery Shopping List ({recommendations.filter(r => r.action === 'RESTOCK' || r.action === 'DISPOSE_EXPIRED').length})
        </button>
      </div>

      {/* Store KPIs Grid */}
      <div className="kpi-grid">
        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="kpi-title">Today's Sales</div>
          <div className="kpi-value">₱{kpis.todaySales.toLocaleString()}</div>
          <div className="kpi-desc">Real-time revenue</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
          <div className="kpi-title">Month's Sales</div>
          <div className="kpi-value">₱{kpis.monthSales.toLocaleString()}</div>
          <div className="kpi-desc">Monthly running total</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="kpi-title">Low Stock Alerts</div>
          <div className="kpi-value">{kpis.lowStockCount}</div>
          <div className="kpi-desc">Items to reorder</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="kpi-title">Expired Items</div>
          <div className="kpi-value">{kpis.expiringCount}</div>
          <div className="kpi-desc">Expired / expiring soon</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="kpi-title">Total Utang</div>
          <div className="kpi-value">₱{kpis.totalUtang.toLocaleString()}</div>
          <div className="kpi-desc">Collectible customer debt</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div className="kpi-title">Estimated Stock Profit</div>
          <div className="kpi-value">₱{(kpis.potentialProfit || 0).toLocaleString()}</div>
          <div className="kpi-desc">Capital profit in inventory</div>
        </div>
      </div>

      {activeTab === 'SHOPPING_LIST' ? (
        /* ================= GROCERY SHOPPING LIST VIEW ================= */
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2>📝 Interactive Grocery Shopping List</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Auto-generated from 30-day velocity + {selectedSeason} demand + {selectedWeather} weather factor.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={copyShoppingListText} className="btn btn-secondary">
                📋 Copy Text
              </button>
              <button onClick={() => window.print()} className="btn btn-primary">
                🖨️ Print List
              </button>
            </div>
          </div>

          {data!.groceryShoppingList?.items?.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              🎉 All stocks are healthy! No items need to be purchased right now.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {Object.entries(data!.groceryShoppingList?.groupedBySupplier || {}).map(([supplier, items]) => (
                <div key={supplier} style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(255,255,255,0.01)' }}>
                  <h3 style={{ color: 'var(--secondary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                    🏪 Supplier: {supplier}
                  </h3>

                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: '45px' }}>Done</th>
                          <th>Product</th>
                          <th>Current Stock</th>
                          <th>Forecasted Demand</th>
                          <th>Recommended Buy</th>
                          <th>Estimated Capital</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => {
                          const isChecked = checkedItems[item.productId] || false;
                          const currentBuyQty = customQuantities[item.productId] ?? item.recommendedRestockQty;
                          const totalCost = (item.costPrice + item.transpoFee) * currentBuyQty;

                          return (
                            <tr key={item.productId} style={{ opacity: isChecked ? 0.35 : 1, textDecoration: isChecked ? 'line-through' : 'none' }}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCheckItem(item.productId)}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                />
                              </td>
                              <td style={{ fontWeight: 600 }}>{item.productName}</td>
                              <td>
                                <span style={{ color: item.currentStock <= item.lowStockThreshold ? 'var(--danger)' : 'var(--text-primary)' }}>
                                  {item.currentStock} {item.unit}(s)
                                </span>
                              </td>
                              <td>{item.forecastedWeeklyDemand} {item.unit}s/wk</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <button
                                    onClick={() => updateQuantity(item.productId, -1)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.8rem' }}
                                    disabled={isChecked}
                                  >
                                    -
                                  </button>
                                  <span style={{ fontWeight: 800, color: 'var(--success)', minWidth: '35px', textAlign: 'center' }}>
                                    {currentBuyQty} {item.unit}
                                  </span>
                                  <button
                                    onClick={() => updateQuantity(item.productId, 1)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.8rem' }}
                                    disabled={isChecked}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                ₱{totalCost.toFixed(2)}
                              </td>
                              <td>
                                <span className={`badge ${item.isExpired ? 'badge-danger' : 'badge-warning'}`}>
                                  {item.reason}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ================= ANALYTICS & CHARTS VIEW ================= */
        <div className="dashboard-grid">
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Sales Chart */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Sales Revenue Trend (Last 7 Days)</h3>
              <div style={{ height: '230px', position: 'relative' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Smart Expiration + Restocking Action Table */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.05rem' }}>🤖 Smart Recommendations (Velocity + Expiration Synthesis)</h3>
                <button onClick={() => setActiveTab('SHOPPING_LIST')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                  Shopping List →
                </button>
              </div>

              {recommendations.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                  All inventory levels are optimal. No immediate actions needed.
                </p>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Product</th>
                        <th>Stock / Expiration Status</th>
                        <th>AI Recommendation & Instruction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.map(r => (
                        <tr key={r.productId}>
                          <td>
                            <span className={`badge ${
                              r.action === 'PRIORITIZE_SELLING'
                                ? 'badge-warning'
                                : r.action === 'DISPOSE_EXPIRED'
                                ? 'badge-danger'
                                : 'badge-success'
                            }`}>
                              {r.action === 'PRIORITIZE_SELLING' ? '🔥 SELL OUT' : r.action === 'DISPOSE_EXPIRED' ? '⚠️ EXPIRED' : '📦 RESTOCK'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{r.productName}</td>
                          <td>
                            <div>{r.currentStock} {r.unit}s in stock</div>
                            {r.daysUntilExpiry !== undefined && r.daysUntilExpiry !== null && (
                              <div style={{ fontSize: '0.75rem', color: r.daysUntilExpiry <= 0 ? 'var(--danger)' : 'var(--warning)' }}>
                                {r.daysUntilExpiry <= 0 ? 'Expired' : `${r.daysUntilExpiry} days left`}
                              </div>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                            {r.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Sales Trends Cards */}
            {trends.length > 0 && (
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '0.85rem', fontSize: '1.05rem', color: '#60a5fa' }}>
                  📈 Velocity Trends (15-Day Changes)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {trends.map(t => (
                    <div key={t.productId} style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: t.trendStatus === 'INCREASING' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      borderLeft: `3px solid ${t.trendStatus === 'INCREASING' ? 'var(--success)' : 'var(--danger)'}`
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: t.trendStatus === 'INCREASING' ? 'var(--success)' : 'var(--danger)' }}>
                        {t.trendStatus === 'INCREASING' ? '▲ Surge' : '▼ Decline'}: {t.trendPct > 0 ? `+${t.trendPct}%` : `${t.trendPct}%`}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {t.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fast Movers */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginBottom: '0.85rem', fontSize: '1.05rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🔥 Fast-Moving Products
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {fastMovers.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No sales data recorded</p>
                ) : (
                  fastMovers.map(item => (
                    <div key={item.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.65rem 0.75rem',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>{item.qty} units sold</div>
                      </div>
                      <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.88rem' }}>
                        ₱{item.sales.toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Slow Movers */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginBottom: '0.85rem', fontSize: '1.05rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ❄️ Slow-Moving Products
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {slowMovers.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No inventory telemetry yet</p>
                ) : (
                  slowMovers.map(item => (
                    <div key={item.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.65rem 0.75rem',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>{item.qty} units sold</div>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.88rem' }}>
                        ₱{item.sales.toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
