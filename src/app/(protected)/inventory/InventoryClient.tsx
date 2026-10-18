'use client';

import { useState, useEffect } from 'react';
import { recordFeatureUsage, logStoreEdit } from '@/lib/featureTracker';

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
  costPrice: number;
  price: number;
  transpoFee: number;
  unit: string;
  imageUrl?: string;
  expirationDate?: string;
  supplierId?: string;
  supplier?: Supplier;
  lowStockThreshold: number;
}

interface StockHistoryItem {
  id: string;
  productId: string;
  product: Product;
  type: string;
  quantity: number;
  costPrice?: number;
  transpoFee?: number;
  supplier?: Supplier;
  reason?: string;
  createdAt: string;
}

export default function InventoryClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [history, setHistory] = useState<StockHistoryItem[]>([]);
  
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'AUDIT' | 'HISTORY' | 'LOSSES'>('PRODUCTS');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Fast Count / Rapid Audit State
  const [countAuditMap, setCountAuditMap] = useState<Record<string, number>>({});
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [lossProduct, setLossProduct] = useState<Product | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [costPrice, setCostPrice] = useState('0');
  const [price, setPrice] = useState('0');
  const [transpoFee, setTranspoFee] = useState('0');
  const [unit, setUnit] = useState('pcs');
  const [imageUrl, setImageUrl] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [adjustmentReason, setAdjustmentReason] = useState('RESTOCK');

  // Loss recording form
  const [lossQty, setLossQty] = useState('1');
  const [lossReason, setLossReason] = useState('DAMAGED');

  // Supplier & Category inline creation
  const [newCatName, setNewCatName] = useState('');
  const [newSupName, setNewSupName] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, supRes, histRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/suppliers'),
        fetch('/api/stock-history')
      ]);

      if (prodRes.ok) {
        const prodData: Product[] = await prodRes.json();
        setProducts(prodData);
        // Initialize fast count map with current physical quantities
        const countMap: Record<string, number> = {};
        prodData.forEach(p => {
          countMap[p.id] = p.stockQty;
        });
        setCountAuditMap(countMap);
      }
      if (catRes.ok) setCategories(await catRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (histRes.ok) setHistory(await histRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    recordFeatureUsage('inventory');
    loadData();

    // Check query params for tab navigation (e.g. from shortcut)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'AUDIT' || tabParam === 'LOSSES' || tabParam === 'HISTORY') {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setStockQty('0');
    setCostPrice('0');
    setPrice('0');
    setTranspoFee('0');
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
    setCostPrice(product.costPrice?.toString() || '0');
    setPrice(product.price.toString());
    setTranspoFee(product.transpoFee?.toString() || '0');
    setUnit(product.unit);
    setImageUrl(product.imageUrl || '');
    setExpirationDate(product.expirationDate ? new Date(product.expirationDate).toISOString().split('T')[0] : '');
    setSupplierId(product.supplierId || '');
    setLowStockThreshold(product.lowStockThreshold.toString());
    setAdjustmentReason('RESTOCK');
    setShowModal(true);
  };

  const handleOpenLossModal = (product: Product) => {
    setLossProduct(product);
    setLossQty('1');
    setLossReason('DAMAGED');
    setShowLossModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      id: editingProduct?.id,
      name,
      categoryId,
      stockQty: parseFloat(stockQty),
      costPrice: parseFloat(costPrice),
      price: parseFloat(price),
      transpoFee: parseFloat(transpoFee),
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
        logStoreEdit(
          'Inventory',
          editingProduct ? 'Updated Product & Price' : 'Created Product',
          `${name} — Price: ₱${price}, Cost: ₱${costPrice}, Transpo: ₱${transpoFee}, Stock: ${stockQty}`,
          editingProduct ? 'PRICE' : 'PRODUCT'
        );
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

  const handleSaveLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lossProduct) return;

    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lossProduct.id,
          isLossRecording: true,
          lossQuantity: parseFloat(lossQty),
          adjustmentReason: lossReason
        })
      });

      if (res.ok) {
        logStoreEdit(
          'Inventory Loss',
          `Loss: ${lossReason}`,
          `${lossQty} ${lossProduct.unit}(s) of ${lossProduct.name}`,
          'LOSS'
        );
        alert('Stock loss recorded.');
        setShowLossModal(false);
        loadData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to record loss');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    const p = products.find(prod => prod.id === id);
    if (!confirm(`Are you sure you want to delete ${p?.name || 'this product'}?`)) return;

    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        logStoreEdit('Inventory', 'Deleted Product', `Deleted item: ${p?.name || id}`, 'PRODUCT');
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fast Counting Batch Submission
  const handleQuickCountChange = (productId: string, val: string) => {
    const parsed = parseFloat(val);
    setCountAuditMap(prev => ({
      ...prev,
      [productId]: isNaN(parsed) ? 0 : parsed
    }));
  };

  const handleStepCount = (productId: string, delta: number) => {
    setCountAuditMap(prev => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] ?? 0) + delta)
    }));
  };

  const handleSaveBatchAudit = async () => {
    const countsPayload = Object.entries(countAuditMap).map(([productId, countedQty]) => ({
      productId,
      countedQty
    }));

    if (countsPayload.length === 0) return;

    try {
      setIsSubmittingAudit(true);
      const res = await fetch('/api/products/batch-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counts: countsPayload,
          auditReason: 'FAST_INVENTORY_COUNT_AUDIT'
        })
      });

      if (res.ok) {
        const data = await res.json();
        logStoreEdit(
          'Inventory Fast Count',
          'Batch Count Audited',
          `Adjusted ${data.updatedCount} products during physical shelf count`,
          'STOCK'
        );
        alert(`Physical stock count updated successfully (${data.updatedCount} product adjustments saved).`);
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update stock count');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingAudit(false);
    }
  };

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
      return <span className="badge badge-danger">Expired ({Math.abs(diffDays)}d ago)</span>;
    } else if (diffDays <= 30) {
      return <span className="badge badge-warning">Expiring in {diffDays}d</span>;
    } else {
      return <span className="badge badge-success">Good ({diffDays}d)</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory & Sourcing</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Product catalog, fast physical count audit, cost margins, and damaged stock tracking.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => { setActiveTab('AUDIT'); recordFeatureUsage('quick_audit'); }} className="btn btn-secondary">
            Fast Count
          </button>
          <button onClick={handleOpenAdd} className="btn btn-primary">
            Add Product
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '1.15rem' }}>
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`btn ${activeTab === 'PRODUCTS' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Product Catalog ({products.length})
        </button>
        <button
          onClick={() => { setActiveTab('AUDIT'); recordFeatureUsage('quick_audit'); }}
          className={`btn ${activeTab === 'AUDIT' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Fast Count & Audit
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`btn ${activeTab === 'HISTORY' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Restocking Log
        </button>
        <button
          onClick={() => setActiveTab('LOSSES')}
          className={`btn ${activeTab === 'LOSSES' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Loss & Damaged ({history.filter(h => h.type === 'LOSS').length})
        </button>
      </div>

      {activeTab === 'PRODUCTS' && (
        <>
          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '0.85rem', display: 'flex', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div className="search-bar-container" style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search products or suppliers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn btn-secondary" style={{ padding: '0.6rem 0.8rem' }}>
                Search
              </button>
            </div>

            <select
              className="form-control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Products Table */}
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading product catalog...</p>
          ) : (
            <div className="glass-panel table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Stock Qty</th>
                    <th>Cost / Selling Price</th>
                    <th>Profit / Unit</th>
                    <th>Supplier</th>
                    <th>Expiration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                        No products found
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => {
                      const isLowStock = p.stockQty <= p.lowStockThreshold;
                      const totalCost = (p.costPrice || 0) + (p.transpoFee || 0);
                      const profit = p.price - totalCost;

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
                            {isLowStock && <div style={{ fontSize: '0.68rem', color: 'var(--danger)' }}>Low Stock</div>}
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem' }}>
                              <span style={{ color: 'var(--text-dim)' }}>Cost: ₱{totalCost}</span> → <strong style={{ color: 'var(--secondary)' }}>₱{p.price}</strong>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, color: profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              +₱{profit.toFixed(2)}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{p.supplier?.name || '—'}</td>
                          <td>{getExpirationBadge(p.expirationDate)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button onClick={() => handleOpenEdit(p)} className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.72rem' }}>
                                Edit
                              </button>
                              <button onClick={() => handleOpenLossModal(p)} className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.72rem' }}>
                                Loss
                              </button>
                              <button onClick={() => handleDelete(p.id)} className="btn btn-danger" style={{ padding: '0.3rem 0.5rem', fontSize: '0.72rem' }}>
                                Del
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
        </>
      )}

      {/* FAST INVENTORY COUNT & RAPID SHELF AUDIT */}
      {activeTab === 'AUDIT' && (
        <div className="glass-panel" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Fast Inventory Counting (Shelf Audit)</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Quickly walk your shelves, adjust counted quantities using the quick +/- buttons, and commit all updates in one click.
              </p>
            </div>
            <button
              onClick={handleSaveBatchAudit}
              disabled={isSubmittingAudit}
              className="btn btn-success"
              style={{ padding: '0.6rem 1.25rem' }}
            >
              {isSubmittingAudit ? 'Saving Audit...' : 'Save Physical Count'}
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>System Stock</th>
                  <th>Physical Shelf Count</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const counted = countAuditMap[p.id] ?? p.stockQty;
                  const variance = counted - p.stockQty;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td><span className="badge badge-primary">{p.category?.name}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.stockQty} {p.unit}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <button
                            onClick={() => handleStepCount(p.id, -1)}
                            className="btn btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="any"
                            className="form-control"
                            value={counted}
                            onChange={(e) => handleQuickCountChange(p.id, e.target.value)}
                            style={{ width: '70px', padding: '0.3rem 0.5rem', textAlign: 'center', fontWeight: 700 }}
                          />
                          <button
                            onClick={() => handleStepCount(p.id, 1)}
                            className="btn btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                          >
                            +
                          </button>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{p.unit}</span>
                        </div>
                      </td>
                      <td>
                        {variance === 0 ? (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Match</span>
                        ) : variance > 0 ? (
                          <span style={{ color: 'var(--success)', fontWeight: 700 }}>+{variance} Surplus</span>
                        ) : (
                          <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{variance} Missing</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RESTOCKING HISTORY TAB */}
      {activeTab === 'HISTORY' && (
        <div className="glass-panel table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Product</th>
                <th>Supplier</th>
                <th>Quantity Added</th>
                <th>Cost Price</th>
                <th>Transpo Fee</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.filter(h => h.type === 'ADD').length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                    No restocking history recorded.
                  </td>
                </tr>
              ) : (
                history.filter(h => h.type === 'ADD').map(h => (
                  <tr key={h.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(h.createdAt).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600 }}>{h.product?.name}</td>
                    <td>{h.supplier?.name || 'Direct Wholesale'}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                      +{h.quantity} {h.product?.unit}
                    </td>
                    <td>₱{h.costPrice || 0}</td>
                    <td>₱{h.transpoFee || 0}</td>
                    <td>
                      <span className="badge badge-success">{h.reason || 'RESTOCK'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* LOSSES TAB */}
      {activeTab === 'LOSSES' && (
        <div className="glass-panel table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Product</th>
                <th>Quantity Lost</th>
                <th>Cost Impact</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {history.filter(h => h.type === 'LOSS').length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                    No loss or damage records registered.
                  </td>
                </tr>
              ) : (
                history.filter(h => h.type === 'LOSS').map(h => (
                  <tr key={h.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(h.createdAt).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600 }}>{h.product?.name}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 700 }}>
                      -{h.quantity} {h.product?.unit}
                    </td>
                    <td style={{ color: 'var(--danger)' }}>
                      ₱{((h.costPrice || 0) * h.quantity).toFixed(2)}
                    </td>
                    <td>
                      <span className="badge badge-danger">{h.reason}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '1.15rem', fontSize: '1.25rem' }}>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>

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
                <div style={{ display: 'flex', gap: '0.45rem' }}>
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
                    style={{ width: '90px' }}
                  />
                  <button type="button" onClick={() => {}} className="btn btn-secondary">
                    Add
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                  <label className="form-label">Min Threshold (Safety)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                  />
                </div>
              </div>

              {/* Pricing & Transpo Margins */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Cost Price (₱)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    placeholder="Capital"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Transpo Fee (₱)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    placeholder="Delivery"
                    value={transpoFee}
                    onChange={(e) => setTranspoFee(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Selling Price (₱) *</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Unit (e.g. pcs, pack, can, bottle)</label>
                <input
                  type="text"
                  className="form-control"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                />
              </div>

              {/* Camera & File Upload Image */}
              <div className="form-group">
                <label className="form-label">Product Photo (From Camera or File)</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="form-control"
                  onChange={handleImageFileUpload}
                  style={{ padding: '0.45rem' }}
                />
                {imageUrl && (
                  <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <img src={imageUrl} alt="Preview" style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover' }} />
                    <button type="button" onClick={() => setImageUrl('')} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                      Remove Photo
                    </button>
                  </div>
                )}
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

              {/* Supplier Selector */}
              <div className="form-group">
                <label className="form-label">Supplier Memory Dropdown</label>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
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
                    style={{ width: '90px' }}
                  />
                  <button type="button" onClick={() => {}} className="btn btn-secondary">
                    Add
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.5rem' }}>
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

      {/* Record Loss / Damage Modal */}
      {showLossModal && lossProduct && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '440px' }}>
            <h2 style={{ marginBottom: '0.45rem', color: '#f87171', fontSize: '1.15rem' }}>Record Loss / Stock Reduction</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.15rem' }}>
              Product: <strong>{lossProduct.name}</strong> (Available: {lossProduct.stockQty} {lossProduct.unit}s)
            </p>

            <form onSubmit={handleSaveLoss}>
              <div className="form-group">
                <label className="form-label">Quantity Lost / Reduced *</label>
                <input
                  type="number"
                  step="any"
                  max={lossProduct.stockQty}
                  min="0.1"
                  className="form-control"
                  value={lossQty}
                  onChange={(e) => setLossQty(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason / Classification *</label>
                <select
                  className="form-control"
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                >
                  <option value="DAMAGED">Damaged Goods</option>
                  <option value="EXPIRED">Expired Products (Disposed)</option>
                  <option value="LOST">Lost / Missing</option>
                  <option value="GIVEN_AWAY">Given Away / Personal Consumption</option>
                  <option value="MANUAL_CORRECTION">Audit Correction</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setShowLossModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Confirm Loss
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
