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
}

interface Mover {
  id: string;
  name: string;
  qty: number;
  sales: number;
}

interface Recommendation {
  productId: string;
  productName: string;
  categoryName: string;
  supplierName: string;
  currentStock: number;
  lowStockThreshold: number;
  unit: string;
  estimatedCost: number;
  forecastedWeeklyDemand: number;
  recommendedRestockQty: number;
  reason: string;
  isExpired?: boolean;
}

interface GroceryShoppingList {
  totalItemsCount: number;
  totalUnitsToBuy: number;
  totalEstimatedBudget: number;
  items: Recommendation[];
  groupedBySupplier: Record<string, Recommendation[]>;
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
  fastMovers: Mover[];
  slowMovers: Mover[];
  recommendations: Recommendation[];
  groceryShoppingList: GroceryShoppingList;
  salesChartData: ChartDataPoint[];
}

const SEASONS = [
  { id: 'NORMAL', label: 'Normal Days (1.0x)', icon: '📅' },
  { id: 'PAYDAY', label: 'Payday / Sweldo (1.35x)', icon: '💰' },
  { id: 'FIESTA_HOLIDAY', label: 'Fiesta / Holiday (1.60x)', icon: '🎉' },
  { id: 'RAINY_SEASON', label: 'Rainy Season (1.20x)', icon: '🌧️' },
  { id: 'WEEKEND', label: 'Weekend Rush (1.15x)', icon: '🛒' },
];

export default function DashboardClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [selectedSeason, setSelectedSeason] = useState('NORMAL');
  
  // Interactive Shopping List State
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'SHOPPING_LIST'>('ANALYTICS');

  const fetchAnalytics = (season: string) => {
    setLoading(true);
    fetch(`/api/analytics?season=${season}`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        // Initialize quantities
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
    fetchAnalytics(selectedSeason);
  }, [selectedSeason]);

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
      `🛒 SARI 2 GROCERY SHOPPING LIST (${selectedSeason})`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Total Restock Items: ${data.recommendations.length}`,
      '----------------------------------------',
    ];

    const grouped = data.groceryShoppingList?.groupedBySupplier || {};
    Object.keys(grouped).forEach(sup => {
      lines.push(`\n📍 SUPPLIER: ${sup}`);
      grouped[sup].forEach(item => {
        const qty = customQuantities[item.productId] || item.recommendedRestockQty;
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

  const { kpis, fastMovers, slowMovers, recommendations, salesChartData, engine, seasonalMultiplier } = data!;

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
          <h1 className="page-title">Store Telemetry & AI Restocking</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
              ⚡ Engine: {engine}
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              Multiplier: {seasonalMultiplier}x
            </span>
          </div>
        </div>

        <div className="header-actions" style={{ flexWrap: 'wrap' }}>
          {/* Season Selector */}
          <select
            className="form-control"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            style={{ width: '220px', padding: '0.6rem 0.85rem' }}
          >
            {SEASONS.map(s => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.label}
              </option>
            ))}
          </select>

          <Link href="/sales" className="btn btn-primary">
            🛒 POS Checkout
          </Link>
        </div>
      </div>

      {/* Navigation View Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
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
          📝 Grocery Shopping List ({recommendations.length})
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
          <div className="kpi-desc">Monthly total</div>
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
          <div className="kpi-desc">Collectible customer credits</div>
        </div>
      </div>

      {activeTab === 'SHOPPING_LIST' ? (
        /* ================= GROCERY SHOPPING LIST VIEW ================= */
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2>📝 Interactive Grocery Shopping List</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Auto-generated from 30-day sales moving average + seasonal event demand ({selectedSeason}).
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

          {recommendations.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              🎉 All stocks are healthy! No items need to be purchased right now.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {Object.entries(data!.groceryShoppingList?.groupedBySupplier || {}).map(([supplier, items]) => (
                <div key={supplier} style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(255,255,255,0.01)' }}>
                  <h3 style={{ color: 'var(--secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🏪 Supplier: {supplier}
                  </h3>

                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>Done</th>
                          <th>Product</th>
                          <th>Current Stock</th>
                          <th>Forecasted Demand</th>
                          <th>Recommended Buy</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => {
                          const isChecked = checkedItems[item.productId] || false;
                          const currentBuyQty = customQuantities[item.productId] ?? item.recommendedRestockQty;

                          return (
                            <tr key={item.productId} style={{ opacity: isChecked ? 0.4 : 1, textDecoration: isChecked ? 'line-through' : 'none' }}>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <button
                                    onClick={() => updateQuantity(item.productId, -1)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                    disabled={isChecked}
                                  >
                                    -
                                  </button>
                                  <span style={{ fontWeight: 800, color: 'var(--success)', minWidth: '40px', textAlign: 'center' }}>
                                    {currentBuyQty} {item.unit}
                                  </span>
                                  <button
                                    onClick={() => updateQuantity(item.productId, 1)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                    disabled={isChecked}
                                  >
                                    +
                                  </button>
                                </div>
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
              <div style={{ height: '240px', position: 'relative' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* AI Restocking Suggestions Preview */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem' }}>🤖 Predictive Restocking Recommendations</h3>
                <button onClick={() => setActiveTab('SHOPPING_LIST')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  View Full Grocery List →
                </button>
              </div>

              {recommendations.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                  All inventory levels are optimal. No restocks recommended.
                </p>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Current Stock</th>
                        <th>Forecasted Demand</th>
                        <th>Suggested Restock</th>
                        <th>Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.slice(0, 5).map(r => (
                        <tr key={r.productId}>
                          <td style={{ fontWeight: 600 }}>{r.productName}</td>
                          <td>
                            <span style={{ color: r.currentStock <= r.lowStockThreshold ? 'var(--danger)' : 'var(--text-primary)' }}>
                              {r.currentStock} {r.unit}s
                            </span>
                          </td>
                          <td>{r.forecastedWeeklyDemand} {r.unit}s/wk</td>
                          <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                            +{r.recommendedRestockQty} {r.unit}s
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{r.supplierName}</td>
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
            {/* Fast Movers */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🔥 Fast-Moving Products
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {fastMovers.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No sales data recorded</p>
                ) : (
                  fastMovers.map(item => (
                    <div key={item.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{item.qty} units sold</div>
                      </div>
                      <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.9rem' }}>
                        ₱{item.sales.toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Slow Movers */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ❄️ Slow-Moving Products
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {slowMovers.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No inventory telemetry yet</p>
                ) : (
                  slowMovers.map(item => (
                    <div key={item.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{item.qty} units sold</div>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
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
