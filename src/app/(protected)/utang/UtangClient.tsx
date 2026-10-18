'use client';

import { useState, useEffect } from 'react';
import { recordFeatureUsage, logStoreEdit } from '@/lib/featureTracker';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  balance: number;
}

interface UtangRecord {
  id: string;
  type: 'CREDIT' | 'PAYMENT';
  amount: number;
  description?: string;
  date: string;
}

interface TrustScoreDetails {
  score: number;
  tier: 'GREEN' | 'YELLOW' | 'RED';
  tierLabel: string;
  totalBalance: number;
  totalCreditVolume: number;
  totalPaymentsVolume: number;
  creditTransactionsCount: number;
  paymentTransactionsCount: number;
  repaymentRatio: number;
  avgDaysToRepay: number;
  frequencyOfPartialPayments: number;
  lastPaymentDate: string | null;
  reliabilityRecommendation: string;
}

interface ScoredCustomer {
  id: string;
  name: string;
  phone?: string;
  balance: number;
  trustScore: TrustScoreDetails;
}

export default function UtangClient() {
  const [customers, setCustomers] = useState<ScoredCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [ledger, setLedger] = useState<UtangRecord[]>([]);
  const [search, setSearch] = useState('');
  
  // Create customer form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [recordType, setRecordType] = useState<'PAYMENT' | 'CREDIT'>('PAYMENT');

  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers/credit-score');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
        const savedId = localStorage.getItem('sari2_last_customer_id');
        if (savedId && data.some((c: ScoredCustomer) => c.id === savedId)) {
          setSelectedCustomerId(savedId);
        } else if (data.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (id: string) => {
    if (!id) return;
    try {
      setLedgerLoading(true);
      const res = await fetch(`/api/utang?customerId=${id}`);
      if (res.ok) {
        setLedger(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    recordFeatureUsage('utang');
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      localStorage.setItem('sari2_last_customer_id', selectedCustomerId);
      loadLedger(selectedCustomerId);
    } else {
      setLedger([]);
    }
  }, [selectedCustomerId]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() })
      });

      if (res.ok) {
        const newCust = await res.json();
        logStoreEdit('Utang & Palista', 'Created Customer', `Registered customer: ${newCust.name}`, 'UTANG');
        loadCustomers();
        setSelectedCustomerId(newCust.id);
        setName('');
        setPhone('');
        setShowAddCustomer(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    if (!confirm(`Are you sure you want to remove customer "${selectedCustomer.name}"?`)) return;

    try {
      const res = await fetch(`/api/customers?id=${selectedCustomer.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        logStoreEdit('Utang & Palista', 'Removed Customer', `Deleted customer: ${selectedCustomer.name}`, 'UTANG');
        alert('Customer removed successfully.');
        setSelectedCustomerId('');
        loadCustomers();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to remove customer');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !paymentAmount) return;

    try {
      const val = parseFloat(paymentAmount);
      const res = await fetch('/api/utang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          type: recordType,
          amount: val,
          description: paymentDesc
        })
      });

      if (res.ok) {
        logStoreEdit(
          'Utang & Palista',
          recordType === 'PAYMENT' ? 'Payment Recorded' : 'Credit Added',
          `₱${val.toLocaleString()} for ${selectedCustomer?.name || 'Customer'} (${paymentDesc || 'No notes'})`,
          'UTANG'
        );
        setPaymentAmount('');
        setPaymentDesc('');
        loadCustomers();
        loadLedger(selectedCustomerId);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save transaction');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const getScoreBadge = (tier: 'GREEN' | 'YELLOW' | 'RED') => {
    if (tier === 'GREEN') {
      return <span className="badge badge-success">Trust: High (Green)</span>;
    } else if (tier === 'YELLOW') {
      return <span className="badge badge-warning">Trust: Moderate (Yellow)</span>;
    } else {
      return <span className="badge badge-danger">Trust: Restricted (Red)</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Utang & Palista Credit Scoring</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Heuristic credit reliability assessment, ledger statements, and debt collection tracking.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowGuide(!showGuide)} className="btn btn-secondary">
            {showGuide ? 'Hide Guide' : 'How It Works'}
          </button>
          <button onClick={() => setShowAddCustomer(!showAddCustomer)} className="btn btn-primary">
            Add Customer
          </button>
        </div>
      </div>

      {/* Guide Box */}
      {showGuide && (
        <div className="tutorial-box">
          <div style={{ flex: 1 }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Heuristic Palista Credit Scoring</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.45 }}>
              The system calculates an automated <strong>Trust Score (0–100)</strong> for each customer by evaluating:
              <br />• <strong>Repayment Ratio:</strong> Proportion of credit repaid vs total debt borrowed.
              <br />• <strong>Outstanding Balance:</strong> Debt ceiling pressure.
              <br />• <strong>Payment Recency:</strong> Frequency and consistency of partial payments.
              <br />• <strong>Tiers:</strong> Green (Reliable), Yellow (Moderate/Watchlist), Red (High Risk - Collect Before Credit).
            </p>
          </div>
        </div>
      )}

      {showAddCustomer && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.25rem', maxWidth: '480px' }}>
          <h3 style={{ marginBottom: '0.85rem', fontSize: '1.05rem' }}>Register Customer</h3>
          <form onSubmit={handleCreateCustomer}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button type="submit" className="btn btn-success">
                Create Customer
              </button>
              <button type="button" onClick={() => setShowAddCustomer(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1.15fr 2fr' }}>
        {/* Left Column: Customers Directory with Trust Scores */}
        <div className="glass-panel" style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem' }}>Customer Ledger Directory</h3>
            <span className="badge badge-primary">{customers.length}</span>
          </div>

          {/* Search Bar */}
          <div className="search-bar-container">
            <input
              type="text"
              className="form-control"
              placeholder="Search customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-secondary" style={{ padding: '0.6rem 0.8rem' }}>
              Search
            </button>
          </div>
          
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Evaluating customer reliability scores...</p>
          ) : filteredCustomers.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem 0' }}>No matching customers</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '62vh', overflowY: 'auto' }}>
              {filteredCustomers.map(c => {
                const isSelected = c.id === selectedCustomerId;
                const trust = c.trustScore;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    style={{
                      padding: '0.75rem 0.95rem',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(79, 70, 229, 0.12)' : 'rgba(255,255,255,0.01)',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: trust?.tier === 'GREEN' ? 'var(--success)' : trust?.tier === 'YELLOW' ? 'var(--warning)' : 'var(--danger)'
                        }} />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Score: {trust?.score ?? 100}/100
                        </span>
                      </div>
                    </div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      color: c.balance > 0 ? 'var(--danger)' : 'var(--success)'
                    }}>
                      ₱{c.balance.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Customer Details, Trust Breakdown & Ledger Statement */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {selectedCustomer ? (
            <>
              {/* Customer Trust Profile Card */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.85rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <h2 style={{ fontSize: '1.35rem' }}>{selectedCustomer.name}</h2>
                      {getScoreBadge(selectedCustomer.trustScore.tier)}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                      Phone: {selectedCustomer.phone || 'N/A'} • Score: <strong>{selectedCustomer.trustScore.score}/100</strong>
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Balance Due</div>
                      <div style={{ fontSize: '1.65rem', fontWeight: 800, color: selectedCustomer.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        ₱{selectedCustomer.balance.toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={handleDeleteCustomer}
                      className="btn btn-danger"
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem' }}
                      title="Remove customer from system"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Reliability Metrics Breakdown */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.65rem',
                  marginTop: '1rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid var(--border-glass)'
                }}>
                  <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Repayment Ratio</div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {Math.round(selectedCustomer.trustScore.repaymentRatio * 100)}%
                    </div>
                  </div>
                  <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Partial Payments</div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {selectedCustomer.trustScore.frequencyOfPartialPayments} recorded
                    </div>
                  </div>
                  <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Credit Granted</div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      ₱{selectedCustomer.trustScore.totalCreditVolume.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avg Days to Repay</div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      ~{selectedCustomer.trustScore.avgDaysToRepay} days
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Recommendation: {selectedCustomer.trustScore.reliabilityRecommendation}
                </div>
              </div>

              {/* Record Payment / Debt Form */}
              <div className="glass-panel" style={{ padding: '1.15rem' }}>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '0.98rem' }}>Record Payment / Debt Adjustment</h3>
                
                <form onSubmit={handleRecordTransaction} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ width: '150px', marginBottom: 0 }}>
                    <label className="form-label">Type</label>
                    <select
                      className="form-control"
                      value={recordType}
                      onChange={(e) => setRecordType(e.target.value as any)}
                    >
                      <option value="PAYMENT">Record Payment</option>
                      <option value="CREDIT">Manual Debt</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ width: '130px', marginBottom: 0 }}>
                    <label className="form-label">Amount (₱)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      placeholder="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1, minWidth: '160px', marginBottom: 0 }}>
                    <label className="form-label">Description / Remarks</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Paid cash at store"
                      value={paymentDesc}
                      onChange={(e) => setPaymentDesc(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.15rem' }}>
                    Post
                  </button>
                </form>
              </div>

              {/* Ledger Statement */}
              <div className="glass-panel" style={{ padding: '1.15rem' }}>
                <h3 style={{ marginBottom: '0.85rem', fontSize: '0.98rem' }}>Ledger Statement</h3>
                
                {ledgerLoading ? (
                  <p style={{ color: 'var(--text-muted)' }}>Loading statement...</p>
                ) : ledger.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem 0' }}>No transactions posted</p>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map(r => (
                          <tr key={r.id}>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {new Date(r.date).toLocaleString()}
                            </td>
                            <td>
                              <span className={`badge ${r.type === 'PAYMENT' ? 'badge-success' : 'badge-danger'}`}>
                                {r.type}
                              </span>
                            </td>
                            <td>{r.description || '—'}</td>
                            <td style={{
                              fontWeight: 700,
                              color: r.type === 'PAYMENT' ? 'var(--success)' : 'var(--danger)'
                            }}>
                              {r.type === 'PAYMENT' ? '-' : '+'}₱{r.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass-panel" style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              Select a customer from the directory to review their heuristic trust score and credit statement.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
