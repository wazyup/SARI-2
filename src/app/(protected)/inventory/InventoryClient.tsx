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

interface Product {
  id: string;
  name: string;
  categoryId: string;
  category: Category;
  stockQty: number;
  price: number;
  unit: string;
  imageUrl?: string;
  expirationDate?: string;
  supplierId?: string;
  supplier?: Supplier;
  lowStockThreshold: number;
}

export default function InventoryClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [price, setPrice] = useState('0');
  const [unit, setUnit] = useState('pcs');
  const [imageUrl, setImageUrl] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [adjustmentReason, setAdjustmentReason] = useState('ADJUSTMENT');

  // Supplier & Category creation inside modal
  const [newCatName, setNewCatName] = useState('');
  const [newSupName, setNewSupName] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, supRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/suppliers')
      ]);

      if (prodRes.ok) setProducts(await prodRes.json());
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

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setStockQty('0');
    setPrice('0');
    setUnit('pcs');
    setImageUrl('');
    setExpirationDate('');
    setSupplierId('');
    setLowStockThreshold('5');
    setShowModal(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategoryId(product.categoryId);
    setStockQty(product.stockQty.toString());
    setPrice(product.price.toString());
    setUnit(product.unit);
    setImageUrl(product.imageUrl || '');
    setExpirationDate(product.expirationDate ? new Date(product.expirationDate).toISOString().split('T')[0] : '');
    setSupplierId(product.supplierId || '');
    setLowStockThreshold(product.lowStockThreshold.toString());
    setAdjustmentReason('RESTOCK');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      id: editingProduct?.id,
      name,
      categoryId,
      stockQty: parseFloat(stockQty),
      price: parseFloat(price),
      unit,
      imageUrl: imageUrl || null,
      expirationDate: expirationDate || null,
      supplierId: supplierId || null,
      lowStockThreshold: parseFloat(lowStockThreshold),
      adjustmentReason: editingProduct ? adjustmentReason : 'INITIAL_STOCK'
    };

    try {
      const url = '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(false);
        loadData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to save product');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCategory = async () => {
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
        setCategoryId(data.id);
        setNewCatName('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupName) return;
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSupName })
      });
      if (res.ok) {
        const data = await res.json();
        setSuppliers(prev => [...prev, data]);
        setSupplierId(data.id);
        setNewSupName('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtering
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.supplier?.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === '' || p.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getExpirationBadge = (dateStr?: string) => {
    if (!dateStr) return <span className="badge badge-primary">No Expiration</span>;
    
    const expDate = new Date(dateStr);
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="badge badge-danger">Expired</span>;
    } else if (diffDays <= 30) {
      return <span className="badge badge-warning">Expiring in {diffDays}d</span>;
    } else {
      return <span className="badge badge-success">Good ({diffDays}d left)</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Inventory Management</h1>
        <div className="header-actions">
          <button onClick={handleOpenAdd} className="btn btn-primary">
            ➕ Add Product
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Search products or suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />

        <select
          className="form-control"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ width: '200px' }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Products table */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading products database...</p>
      ) : (
        <div className="glass-panel table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Stock Qty</th>
                <th>Unit Price</th>
                <th>Supplier</th>
                <th>Expiration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                    No products found
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isLowStock = p.stockQty <= p.lowStockThreshold;
                  return (
                    <tr key={p.id}>
                      <td>
                        <img
                          src={p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=80'}
                          alt={p.name}
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>
                        <span className="badge badge-primary">{p.category?.name}</span>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          color: isLowStock ? 'var(--danger)' : 'var(--text-primary)'
                        }}>
                          {p.stockQty} {p.unit}(s)
                        </span>
                        {isLowStock && <div style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>Low Stock</div>}
                      </td>
                      <td style={{ fontWeight: 600 }}>₱{p.price.toLocaleString()}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.supplier?.name || '—'}</td>
                      <td>{getExpirationBadge(p.expirationDate)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleOpenEdit(p)} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
                            ✏️
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="btn btn-danger" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Category selector */}
              <div className="form-group">
                <label className="form-label">Category *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    className="form-control"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="New..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    style={{ width: '100px' }}
                  />
                  <button type="button" onClick={handleCreateCategory} className="btn btn-secondary">
                    Add
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Stock Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Low Stock Threshold</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                  />
                </div>
              </div>

              {/* Stock adjustment reason if editing */}
              {editingProduct && (
                <div className="form-group">
                  <label className="form-label">Reason for Stock Adjustment</label>
                  <select
                    className="form-control"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                  >
                    <option value="RESTOCK">Restock (Added New Supply)</option>
                    <option value="EXPIRED">Disposed Expired Goods</option>
                    <option value="ADJUSTMENT">Manual Inventory Correction</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Unit Price (₱) *</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unit (e.g. pcs, pack)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Product Image URL</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Expiration Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>

              {/* Supplier selector */}
              <div className="form-group">
                <label className="form-label">Supplier Memory Dropdown</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    className="form-control"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                  >
                    <option value="">No Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="New..."
                    value={newSupName}
                    onChange={(e) => setNewSupName(e.target.value)}
                    style={{ width: '100px' }}
                  />
                  <button type="button" onClick={handleCreateSupplier} className="btn btn-secondary">
                    Add
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
