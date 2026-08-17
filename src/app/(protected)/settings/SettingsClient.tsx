'use client';

import { useState, useEffect } from 'react';

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
  contactInfo?: string;
  address?: string;
}

export default function SettingsClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // New entry states
  const [newCatName, setNewCatName] = useState('');
  const [newSupName, setNewSupName] = useState('');
  const [newSupContact, setNewSupContact] = useState('');
  const [newSupAddress, setNewSupAddress] = useState('');

  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [catRes, supRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/suppliers')
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName })
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(prev => [...prev, data]);
        setNewCatName('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName) return;

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupName,
          contactInfo: newSupContact,
          address: newSupAddress
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSuppliers(prev => [...prev, data]);
        setNewSupName('');
        setNewSupContact('');
        setNewSupAddress('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Store Settings</h1>
      </div>

      <div className="dashboard-grid">
        {/* Left Column: Manage Categories */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>Product Categories</h3>
          
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="New category name..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }}>
              Add
            </button>
          </form>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading categories...</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {categories.map(c => (
                <span key={c.id} className="badge badge-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Manage Suppliers */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>Supplier Memory Register</h3>
          
          <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Supplier Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. San Miguel Distributing"
                value={newSupName}
                onChange={(e) => setNewSupName(e.target.value)}
                required
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Contact Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="0917-xxx-xxxx"
                  value={newSupContact}
                  onChange={(e) => setNewSupContact(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="City/Region"
                  value={newSupAddress}
                  onChange={(e) => setNewSupAddress(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', marginTop: '0.5rem' }}>
              Register Supplier
            </button>
          </form>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading suppliers...</p>
          ) : (
            <div className="table-container" style={{ marginTop: '1rem' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Contact Info</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.contactInfo || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
