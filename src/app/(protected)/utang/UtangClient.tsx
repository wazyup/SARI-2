'use client';

import { useState, useEffect } from 'react';

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

export default function UtangClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [ledger, setLedger] = useState<UtangRecord[]>([]);
  
  // Create customer form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [recordType, setRecordType] = useState<'PAYMENT' | 'CREDIT'>('PAYMENT');

  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
        if (data.length > 0 && !selectedCustomerId) {
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
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadLedger(selectedCustomerId);
    } else {
      setLedger([]);
    }
  }, [selectedCustomerId]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      });

      if (res.ok) {
        const newCust = await res.json();
        setCustomers(prev => [...prev, newCust]);
        setSelectedCustomerId(newCust.id);
        setName('');
        setPhone('');
        setShowAddCustomer(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !paymentAmount) return;

    try {
      const res = await fetch('/api/utang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          type: recordType,
          amount: parseFloat(paymentAmount),
          description: paymentDesc
        })
      });

      if (res.ok) {
        setPaymentAmount('');
        setPaymentDesc('');
        // Reload customer balances and this ledger
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

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Utang (Credit Ledger)</h1>
        <div className="header-actions">
          <button onClick={() => setShowAddCustomer(!showAddCustomer)} className="btn btn-primary">
            👤 Add Customer
          </button>
        </div>
      </div>

      {showAddCustomer && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', maxWidth: '500px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Register Customer</h3>
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
            <div style={{ display: 'flex', gap: '1rem' }}>
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

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* Left - Customers Directory */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>Customer Directory</h3>
          
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading customers...</p>
          ) : customers.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem 0' }}>No customers registered</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
              {customers.map(c => {
                const isSelected = c.id === selectedCustomerId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.01)',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone || 'No phone'}</div>
                    </div>
                    <div style={{
                      fontWeight: 800,
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

        {/* Right - Selected Customer Ledger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {selectedCustomer ? (
            <>
              {/* Ledger Summary */}
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem' }}>{selectedCustomer.name}</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Phone: {selectedCustomer.phone || 'N/A'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Balance Due</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: selectedCustomer.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    ₱{selectedCustomer.balance.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Record manual transaction */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Post Payment / Credit Adjustment</h3>
                
                <form onSubmit={handleRecordTransaction} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ width: '150px', marginBottom: 0 }}>
                    <label className="form-label">Type</label>
                    <select
                      className="form-control"
                      value={recordType}
                      onChange={(e) => setRecordType(e.target.value as any)}
                    >
                      <option value="PAYMENT">💵 Record Payment</option>
                      <option value="CREDIT">📝 Manual Debt</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ width: '150px', marginBottom: 0 }}>
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

                  <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                    <label className="form-label">Description / Remarks</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Paid cash at store"
                      value={paymentDesc}
                      onChange={(e) => setPaymentDesc(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                    Post Transaction
                  </button>
                </form>
              </div>

              {/* Ledger Statement */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Ledger Statement</h3>
                
                {ledgerLoading ? (
                  <p style={{ color: 'var(--text-muted)' }}>Loading statement...</p>
                ) : ledger.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem 0' }}>No ledger statements posted</p>
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
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
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
              Select or register a customer to view credit records.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
