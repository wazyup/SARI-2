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

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function SettingsClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  
  // New entry states
  const [newCatName, setNewCatName] = useState('');
  const [newSupName, setNewSupName] = useState('');
  const [newSupContact, setNewSupContact] = useState('');
  const [newSupAddress, setNewSupAddress] = useState('');

  // New account states
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'STAFF' | 'ADMIN'>('STAFF');

  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [catRes, supRes, userRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/suppliers'),
        fetch('/api/users')
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (userRes.ok) setUsers(await userRes.json());
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
    if (!newCatName.trim()) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() })
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
    if (!newSupName.trim()) return;

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupName.trim(),
          contactInfo: newSupContact.trim(),
          address: newSupAddress.trim()
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) return;

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword.trim(),
          role: newUserRole
        })
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(prev => [...prev, data]);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        alert('Account created successfully.');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create user account');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Store Configuration & Accounts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Configure product categories, supplier contact memory, and staff profile access permissions.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowGuide(!showGuide)} className="btn btn-secondary">
            📖 {showGuide ? 'Hide Guide' : 'How to Use'}
          </button>
        </div>
      </div>

      {/* Tutorial / Quick Guide Box */}
      {showGuide && (
        <div className="tutorial-box">
          <span style={{ fontSize: '1.5rem' }}>💡</span>
          <div style={{ flex: 1 }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Settings & Access Management</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              1. <strong>Categories:</strong> Organize your products (Beverages, Canned Goods, Toiletries, etc.).<br />
              2. <strong>Supplier Memory:</strong> Save supplier addresses & phone numbers so the AI engine knows who delivers each product.<br />
              3. <strong>Account Access Management:</strong> Store Owners (ADMIN) can register Staff accounts for cashiers.
            </p>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left Column: Manage Categories & Users */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Categories */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', fontSize: '1.05rem' }}>Product Categories</h3>
            
            <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-control"
                placeholder="New category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.15rem' }}>
                Add
              </button>
            </form>

            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading categories...</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                {categories.map(c => (
                  <span key={c.id} className="badge badge-primary" style={{ fontSize: '0.82rem', padding: '0.45rem 0.7rem' }}>
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* User Account Access Management */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', fontSize: '1.05rem' }}>Account Profile & Access Management</h3>

            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Full Name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                />
                <input
                  type="email"
                  className="form-control"
                  placeholder="Email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                />
                <select
                  className="form-control"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                >
                  <option value="STAFF">Staff (Cashier / POS Only)</option>
                  <option value="ADMIN">Store Owner (Full Admin)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', padding: '0.5rem 1rem' }}>
                Create Store Account
              </button>
            </form>

            <div className="table-container" style={{ marginTop: '0.5rem' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'ADMIN' ? 'badge-primary' : 'badge-success'}`}>
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Manage Suppliers */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', fontSize: '1.05rem' }}>Supplier Memory Register</h3>
          
          <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Supplier / Store Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Puregold Wholesale, San Miguel"
                value={newSupName}
                onChange={(e) => setNewSupName(e.target.value)}
                required
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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
                <label className="form-label">Address / Location</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="City / Market"
                  value={newSupAddress}
                  onChange={(e) => setNewSupAddress(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', marginTop: '0.25rem' }}>
              Register Supplier
            </button>
          </form>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading suppliers...</p>
          ) : (
            <div className="table-container" style={{ marginTop: '0.5rem' }}>
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
