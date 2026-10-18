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
import { getTopFeatures, getRecentEdits, recordFeatureUsage, FeatureUsage, EditAuditRecord } from '@/lib/featureTracker';

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

interface AssociationItem {
  itemA: string;
  itemB: string;
  coPurchaseCount: number;
  confidenceAtoB: number;
  confidenceBtoA: number;
  insight: string;
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
  eoqQuantity: number;
  minTargetStock: number;
  maxTargetStock: number;
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
  fastMovers: Mover[];
  slowMovers: Mover[];
  trends: TrendItem[];
  associations: AssociationItem[];
  recommendations: Recommendation[];
  groceryShoppingList: GroceryShoppingList;
  storeSummary: StoreSummary;
  salesChartData: ChartDataPoint[];
}

const SEASONS = [
  { id: 'NORMAL', label: 'Standard Operations (1.00x)' },
  { id: 'PAYDAY', label: 'Salary Payday Cycle (1.15x)' },
  { id: 'CHRISTMAS', label: 'Christmas Season (1.35x)' },
  { id: 'NEW_YEAR', label: 'New Year Gatherings (1.30x)' },
  { id: 'VALENTINES', label: 'Valentines Cycle (1.10x)' },
  { id: 'HOLY_WEEK', label: 'Holy Week Essentials (1.10x)' },
  { id: 'ALL_SOULS_DAY', label: 'Undas Holiday (1.15x)' },
  { id: 'SUMMER', label: 'Summer Season (1.20x)' },
  { id: 'RAINY_SEASON', label: 'Rainy Season (1.15x)' },
];

export default function DashboardClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [selectedSeason, setSelectedSeason] = useState('NORMAL');
  const [topFeatures, setTopFeatures] = useState<FeatureUsage[]>([]);
  const [recentEdits, setRecentEdits] = useState<EditAuditRecord[]>([]);
  
  // Interactive Shopping List State
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'SHOPPING_LIST' | 'AUDIT'>('ANALYTICS');

  const fetchAnalytics = (season: string) => {
    setLoading(true);
    fetch(`/api/analytics?season=${season}`)
      .then(res => res.json())
      .then(json => {
        setData(json);
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
    setTopFeatures(getTopFeatures(4));
    setRecentEdits(getRecentEdits(8));
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
      `SARI 2 Restock Procurement List (${selectedSeason})`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Total Restock Line Items: ${data.groceryShoppingList?.totalItemsCount || 0}`,
      `Estimated Procurement Budget: ₱${data.groceryShoppingList?.totalEstimatedBudget?.toLocaleString() || 0}`,
      '----------------------------------------',
    ];

    const grouped = data.groceryShoppingList?.groupedBySupplier || {};
    Object.keys(grouped).forEach(sup => {
      lines.push(`\nSupplier: ${sup}`);
      grouped[sup].forEach(item => {
        const qty = customQuantities[item.productId] ?? item.recommendedRestockQty;
        const checked = checkedItems[item.productId] ? '[X]' : '[ ]';
        lines.push(`  ${checked} ${item.productName} — ${qty} ${item.unit}(s) (Stock: ${item.currentStock}, EOQ: ${item.eoqQuantity})`);
      });
    });

    navigator.clipboard.writeText(lines.join('\n'));
    alert('Restock Procurement List copied to clipboard.');
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Calculating EOQ & Dynamic Inventory Telemetry...</p>
      </div>
    );
  }

  const {
    kpis,
    fastMovers,
    slowMovers,
    trends,
    associations,
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
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14, 165, 233, 0.08)',
        tension: 0.35,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111a2e',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
      }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#94a3b8' } },
      y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#94a3b8' } }
    }
  };

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.85rem' }}>
        <div>
          <h1 className="page-title">Store Operations & Predictive Replenishment</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
              Engine: {engine}
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
              Pacing Factor: {seasonalMultiplier.toFixed(2)}x
            </span>
          </div>
        </div>

        <div className="header-actions" style={{ flexWrap: 'wrap' }}>
          {/* Calibrated Season Selector */}
          <select
            className="form-control"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            style={{ width: '240px', padding: '0.55rem 0.75rem' }}
          >
            {SEASONS.map(s => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <Link href="/sales" onClick={() => recordFeatureUsage('pos')} className="btn btn-primary">
            New Sale (POS)
          </Link>
        </div>
      </div>

      {/* FREQUENTLY USED FEATURES SPACE */}
      {topFeatures.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.45rem' }}>
            Frequently Used Shortcuts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.65rem' }}>
            {topFeatures.map(f => (
              <Link
                key={f.key}
                href={f.href}
                onClick={() => recordFeatureUsage(f.key)}
                className="quick-feature-card"
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{f.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Used {f.count} times</div>
                </div>
                <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem' }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* EXECUTIVE STORE SUMMARY BANNER */}
      {storeSummary && (
        <div className="prominent-alert-banner">
          <div style={{ flex: 1, paddingRight: '1rem' }}>
            <div className="prominent-alert-title" style={{ color: '#818cf8', marginBottom: '0.25rem' }}>
              <span>{storeSummary.headline}</span>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: 1.45 }}>
              {storeSummary.summaryText}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexShrink: 0 }}>
            <button onClick={() => setActiveTab('SHOPPING_LIST')} className="btn btn-primary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
              Restock List ({storeSummary.restockCount})
            </button>
          </div>
        </div>
      )}

      {/* Navigation View Tabs */}
      <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '1.15rem' }}>
        <button
          onClick={() => setActiveTab('ANALYTICS')}
          className={`btn ${activeTab === 'ANALYTICS' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Operations & Demand
        </button>
        <button
          onClick={() => setActiveTab('SHOPPING_LIST')}
          className={`btn ${activeTab === 'SHOPPING_LIST' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Restock Procurement List ({recommendations.filter(r => r.action === 'RESTOCK' || r.action === 'DISPOSE_EXPIRED').length})
        </button>
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`btn ${activeTab === 'AUDIT' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Frequent Audit Log ({recentEdits.length})
        </button>
      </div>

      {/* Store KPIs Grid */}
      <div className="kpi-grid">
        <div className="glass-panel kpi-card" style={{ borderLeft: '3px solid var(--primary)' }}>
          <div className="kpi-title">Today's Sales</div>
          <div className="kpi-value">₱{kpis.todaySales.toLocaleString()}</div>
          <div className="kpi-desc">Real-time revenue</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '3px solid var(--secondary)' }}>
          <div className="kpi-title">Month's Sales</div>
          <div className="kpi-value">₱{kpis.monthSales.toLocaleString()}</div>
          <div className="kpi-desc">Monthly running total</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <div className="kpi-title">Restock Alerts</div>
          <div className="kpi-value">{kpis.lowStockCount}</div>
          <div className="kpi-desc">Reached Min threshold</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '3px solid var(--danger)' }}>
          <div className="kpi-title">Expiring Items</div>
          <div className="kpi-value">{kpis.expiringCount}</div>
          <div className="kpi-desc">Expired / 30-day window</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '3px solid var(--success)' }}>
          <div className="kpi-title">Total Utang</div>
          <div className="kpi-value">₱{kpis.totalUtang.toLocaleString()}</div>
          <div className="kpi-desc">Receivable customer credit</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '3px solid #818cf8' }}>
          <div className="kpi-title">Inventory Capital Profit</div>
          <div className="kpi-value">₱{(kpis.potentialProfit || 0).toLocaleString()}</div>
          <div className="kpi-desc">Total unrealized stock profit</div>
        </div>
      </div>

      {activeTab === 'SHOPPING_LIST' ? (
        /* ================= RESTOCK PROCUREMENT LIST ================= */
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem', flexWrap: 'wrap', gap: '0.85rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Restock Procurement List (EOQ & Min-Max Optimized)</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Quantities calibrated via Economic Order Quantity and Weighted Moving Average demand.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button onClick={copyShoppingListText} className="btn btn-secondary">
                Copy Text
              </button>
              <button onClick={() => window.print()} className="btn btn-primary">
                Print List
              </button>
            </div>
          </div>

          {data!.groceryShoppingList?.items?.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              All inventory levels are above Min safety buffers. No restock needed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {Object.entries(data!.groceryShoppingList?.groupedBySupplier || {}).map(([supplier, items]) => (
                <div key={supplier} style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '1.15rem', background: 'rgba(255,255,255,0.01)' }}>
                  <h3 style={{ color: 'var(--secondary)', marginBottom: '0.75rem', fontSize: '1rem' }}>
                    Supplier: {supplier}
                  </h3>

                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>Done</th>
                          <th>Product</th>
                          <th>Current Stock</th>
                          <th>Min / Max Target</th>
                          <th>Optimal EOQ</th>
                          <th>Order Qty</th>
                          <th>Estimated Cost</th>
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
                                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                />
                              </td>
                              <td style={{ fontWeight: 600 }}>{item.productName}</td>
                              <td>
                                <span style={{ color: item.currentStock <= item.lowStockThreshold ? 'var(--danger)' : 'var(--text-primary)' }}>
                                  {item.currentStock} {item.unit}(s)
                                </span>
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                Min: {item.minTargetStock} | Max: {item.maxTargetStock}
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                {item.eoqQuantity} {item.unit}s
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <button
                                    onClick={() => updateQuantity(item.productId, -1)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.15rem 0.4rem', fontSize: '0.78rem' }}
                                    disabled={isChecked}
                                  >
                                    -
                                  </button>
                                  <span style={{ fontWeight: 800, color: 'var(--success)', minWidth: '30px', textAlign: 'center' }}>
                                    {currentBuyQty}
                                  </span>
                                  <button
                                    onClick={() => updateQuantity(item.productId, 1)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.15rem 0.4rem', fontSize: '0.78rem' }}
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
      ) : activeTab === 'AUDIT' ? (
        /* ================= FREQUENT EDITS AUDIT VIEW ================= */
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Frequent Edit History & Adjustments</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Logs recent price revisions, stock audits, customer utang transactions, and loss records.
              </p>
            </div>
          </div>

          {recentEdits.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2.5rem 0' }}>
              No edits recorded yet. Edits from inventory counting, price updates, and utang will appear here.
            </p>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Module</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEdits.map(edit => (
                    <tr key={edit.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(edit.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge badge-primary">{edit.module}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{edit.action}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{edit.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ================= ANALYTICS & TRENDS VIEW ================= */
        <div className="dashboard-grid">
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Sales Chart */}
            <div className="glass-panel" style={{ padding: '1.35rem' }}>
              <h3 style={{ marginBottom: '0.85rem', fontSize: '1.05rem' }}>Sales Revenue Trend (7-Day EMA Window)</h3>
              <div style={{ height: '220px', position: 'relative' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Smart Velocity + Expiration Synthesis Recommendations */}
            <div className="glass-panel" style={{ padding: '1.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.45rem' }}>
                <h3 style={{ fontSize: '1.02rem' }}>Inventory Actions (Velocity & Dynamic Min-Max)</h3>
                <button onClick={() => setActiveTab('SHOPPING_LIST')} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}>
                  Procurement List →
                </button>
              </div>

              {recommendations.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                  Inventory levels are balanced. No urgent actions needed.
                </p>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Product</th>
                        <th>Stock / Expiration</th>
                        <th>Recommendation & Instruction</th>
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
                              {r.action === 'PRIORITIZE_SELLING' ? 'SELL OUT' : r.action === 'DISPOSE_EXPIRED' ? 'EXPIRED' : 'RESTOCK'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{r.productName}</td>
                          <td>
                            <div>{r.currentStock} {r.unit}s in stock</div>
                            {r.daysUntilExpiry !== undefined && r.daysUntilExpiry !== null && (
                              <div style={{ fontSize: '0.72rem', color: r.daysUntilExpiry <= 0 ? 'var(--danger)' : 'var(--warning)' }}>
                                {r.daysUntilExpiry <= 0 ? 'Expired' : `${r.daysUntilExpiry} days left`}
                              </div>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            {r.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* FP-Growth Co-Purchasing Association Patterns */}
            {associations.length > 0 && (
              <div className="glass-panel" style={{ padding: '1.35rem' }}>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '1.02rem', color: 'var(--secondary)' }}>
                  Frequent Item Bundles (Basket Co-Purchasing)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {associations.map((assoc, idx) => (
                    <div key={idx} style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-glass)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <strong>{assoc.itemA}</strong> + <strong>{assoc.itemB}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{assoc.insight}</div>
                      </div>
                      <span className="badge badge-primary">{assoc.coPurchaseCount} Baskets</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Sales Trends Cards */}
            {trends.length > 0 && (
              <div className="glass-panel" style={{ padding: '1.15rem' }}>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '0.98rem', color: '#60a5fa' }}>
                  Velocity Trends (15-Day Changes)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {trends.map(t => (
                    <div key={t.productId} style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      background: t.trendStatus === 'INCREASING' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                      borderLeft: `3px solid ${t.trendStatus === 'INCREASING' ? 'var(--success)' : 'var(--danger)'}`
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: t.trendStatus === 'INCREASING' ? 'var(--success)' : 'var(--danger)' }}>
                        {t.trendStatus === 'INCREASING' ? 'Surge' : 'Decline'}: {t.trendPct > 0 ? `+${t.trendPct}%` : `${t.trendPct}%`}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {t.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fast Movers */}
            <div className="glass-panel" style={{ padding: '1.15rem' }}>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '0.98rem', color: '#34d399' }}>
                Fast-Moving Products
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {fastMovers.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>No sales telemetry recorded</p>
                ) : (
                  fastMovers.map(item => (
                    <div key={item.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.55rem 0.7rem',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '7px',
                      border: '1px solid var(--border-glass)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{item.qty} units sold</div>
                      </div>
                      <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem' }}>
                        ₱{item.sales.toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Slow Movers */}
            <div className="glass-panel" style={{ padding: '1.15rem' }}>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '0.98rem', color: '#f87171' }}>
                Slow-Moving Products
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {slowMovers.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>No inventory telemetry yet</p>
                ) : (
                  slowMovers.map(item => (
                    <div key={item.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.55rem 0.7rem',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '7px',
                      border: '1px solid var(--border-glass)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{item.qty} units sold</div>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>
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
