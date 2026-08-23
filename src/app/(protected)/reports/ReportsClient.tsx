'use client';

import { useState, useEffect } from 'react';

interface SaleItem {
  id: string;
  quantity: number;
  priceAtSale: number;
  product: {
    name: string;
  };
}

interface Customer {
  name: string;
}

interface UtangRecord {
  customer: Customer;
}

interface Sale {
  id: string;
  saleDate: string;
  totalAmount: number;
  paymentMethod: string;
  receivedAmount: number;
  changeAmount: number;
  Items: SaleItem[];
  UtangRecords: UtangRecord[];
}

export default function ReportsClient() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRange, setFilterRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    fetch('/api/sales')
      .then(res => res.json())
      .then(data => {
        setSales(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const getFilteredSales = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return sales.filter(s => {
      const saleDate = new Date(s.saleDate);
      if (filterRange === 'TODAY') return saleDate >= startOfToday;
      if (filterRange === 'WEEK') return saleDate >= sevenDaysAgo;
      if (filterRange === 'MONTH') return saleDate >= startOfMonth;
      return true;
    });
  };

  const filteredSales = getFilteredSales();
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCashSales = filteredSales.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCreditSales = filteredSales.filter(s => s.paymentMethod === 'CREDIT').reduce((sum, s) => sum + s.totalAmount, 0);

  const handleExportCSV = () => {
    if (filteredSales.length === 0) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Transaction ID,Date/Time,Items,Payment Method,Amount Paid (₱)\n';

    filteredSales.forEach(s => {
      const itemsString = s.Items.map(item => `${item.product.name} (${item.quantity})`).join('; ');
      const date = new Date(s.saleDate).toLocaleString().replace(/,/g, '');
      csvContent += `"${s.id}","${date}","${itemsString}","${s.paymentMethod}",${s.totalAmount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SARI2_Sales_Report_${filterRange}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Store Reports & Audits</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Daily, weekly, and monthly sales telemetry with printable PDF reports and CSV export.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowGuide(!showGuide)} className="btn btn-secondary">
            📖 {showGuide ? 'Hide Guide' : 'How to Use'}
          </button>
          <button onClick={handleExportCSV} className="btn btn-secondary" disabled={filteredSales.length === 0}>
            📤 Export CSV
          </button>
          <button onClick={() => window.print()} className="btn btn-primary">
            📄 Print / Save Daily PDF
          </button>
        </div>
      </div>

      {/* Tutorial / Quick Guide Box */}
      {showGuide && (
        <div className="tutorial-box">
          <span style={{ fontSize: '1.5rem' }}>💡</span>
          <div style={{ flex: 1 }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Reports & PDF Export Guide</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              1. <strong>Filter by Time:</strong> Select <em>Today</em>, <em>Last 7 Days</em>, or <em>This Month</em> to isolate your revenue window.<br />
              2. <strong>Save Daily PDF Report:</strong> Click <em>Print / Save Daily PDF</em> to generate a formal summary document.<br />
              3. <strong>Cash vs Credit Breakdown:</strong> Compare liquid cash in the drawer vs outstanding customer utang created during the period.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="kpi-grid">
        <div className="glass-panel kpi-card">
          <div className="kpi-title">Selected Revenue ({filterRange})</div>
          <div className="kpi-value">₱{totalRevenue.toLocaleString()}</div>
          <div className="kpi-desc">Total sales within filter</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="kpi-title">Cash Sales</div>
          <div className="kpi-value">₱{totalCashSales.toLocaleString()}</div>
          <div className="kpi-desc">Liquid cash collected</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="kpi-title">Credit Sales (Utang)</div>
          <div className="kpi-value">₱{totalCreditSales.toLocaleString()}</div>
          <div className="kpi-desc">Credit posted to customer ledgers</div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="glass-panel" style={{ padding: '0.85rem', display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterRange('ALL')}
          className={`btn ${filterRange === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
        >
          All Time
        </button>
        <button
          onClick={() => setFilterRange('TODAY')}
          className={`btn ${filterRange === 'TODAY' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
        >
          Today
        </button>
        <button
          onClick={() => setFilterRange('WEEK')}
          className={`btn ${filterRange === 'WEEK' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setFilterRange('MONTH')}
          className={`btn ${filterRange === 'MONTH' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
        >
          This Month
        </button>
      </div>

      {/* Sales Logs Table */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading logs...</p>
      ) : (
        <div className="glass-panel table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Items Purchased</th>
                <th>Payment Method</th>
                <th>Customer (Credit Only)</th>
                <th>Total Price</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                    No sales recorded in this range
                  </td>
                </tr>
              ) : (
                filteredSales.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {new Date(s.saleDate).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {s.Items.map(item => (
                          <div key={item.id} style={{ fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600 }}>{item.product?.name}</span> × {item.quantity}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.paymentMethod === 'CASH' ? 'badge-success' : 'badge-warning'}`}>
                        {s.paymentMethod}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {s.paymentMethod === 'CREDIT' ? s.UtangRecords[0]?.customer?.name || 'Customer' : '—'}
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--secondary)' }}>
                      ₱{s.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
