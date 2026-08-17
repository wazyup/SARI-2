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
  currentStock: number;
  lowStockThreshold: number;
  forecastedWeeklyDemand: number;
  recommendedRestockQty: number;
  unit: string;
  supplierName: string;
}

interface ChartDataPoint {
  date: string;
  sales: number;
}

interface AnalyticsResponse {
  kpis: KPIState;
  fastMovers: Mover[];
  slowMovers: Mover[];
  recommendations: Recommendation[];
  salesChartData: ChartDataPoint[];
}

export default function DashboardClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  useEffect(() => {
    fetch('/api/analytics')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading Store Telemetry...</p>
      </div>
    );
  }

  const { kpis, fastMovers, slowMovers, recommendations, salesChartData } = data;

  // Chart configuration
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
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#12182b',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255,255,255,0.03)',
        },
        ticks: {
          color: '#94a3b8',
        }
      },
      y: {
        grid: {
          color: 'rgba(255,255,255,0.03)',
        },
        ticks: {
          color: '#94a3b8',
        }
      }
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Store Dashboard</h1>
        <div className="header-actions">
          <Link href="/sales" className="btn btn-primary">
            🛒 POS Checkout
          </Link>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="kpi-grid">
        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="kpi-title">Today's Sales</div>
          <div className="kpi-value">₱{kpis.todaySales.toLocaleString()}</div>
          <div className="kpi-desc">Real-time revenue updates</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
          <div className="kpi-title">Month's Sales</div>
          <div className="kpi-value">₱{kpis.monthSales.toLocaleString()}</div>
          <div className="kpi-desc">Monthly running total</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="kpi-title">Low Stock Alerts</div>
          <div className="kpi-value">{kpis.lowStockCount}</div>
          <div className="kpi-desc">Items needing replenishment</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="kpi-title">Expired Items</div>
          <div className="kpi-value">{kpis.expiringCount}</div>
          <div className="kpi-desc">Items expiring soon/expired</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="kpi-title">Outstanding Credits (Utang)</div>
          <div className="kpi-value">₱{kpis.totalUtang.toLocaleString()}</div>
          <div className="kpi-desc">Total collectible customer debts</div>
        </div>
      </div>

      {/* Main dashboard content */}
      <div className="dashboard-grid">
        {/* Left column - Sales chart & restocking recommendations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Sales Chart */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Sales Revenue Trend (Last 7 Days)</h3>
            <div style={{ height: '240px', position: 'relative' }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* AI Restocking Suggestions */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem' }}>🤖 AI Restocking Recommendations</h3>
              <span className="badge badge-primary">Predictive Analytics</span>
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
                      <th>Recommended Buy</th>
                      <th>Suggested Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map(r => (
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

        {/* Right column - Fast & Slow movers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Fast Movers */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🔥 Fast-Moving Products
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {fastMovers.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No sales data yet</p>
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
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No inventory data yet</p>
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
    </div>
  );
}
