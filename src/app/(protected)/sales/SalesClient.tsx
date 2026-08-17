'use client';

import { useState, useEffect } from 'react';

interface Category {
  id: string;
  name: string;
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
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  balance: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function SalesClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Checkout states
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT'>('CASH');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, custRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/customers')
      ]);

      if (prodRes.ok) setProducts(await prodRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addToCart = (product: Product) => {
    if (product.stockQty <= 0) {
      alert('Product is out of stock!');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQty) {
          alert(`Cannot add more. Only ${product.stockQty} ${product.unit}(s) available.`);
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, qty: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
      return;
    }

    if (qty > product.stockQty) {
      alert(`Only ${product.stockQty} ${product.unit}(s) available.`);
      return;
    }

    setCart(prev => prev.map(item => 
      item.product.id === productId 
        ? { ...item, quantity: qty }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName) return;
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomerName, phone: newCustomerPhone })
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(prev => [...prev, data]);
        setCustomerId(data.id);
        setNewCustomerName('');
        setNewCustomerPhone('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const changeAmount = paymentMethod === 'CASH' && receivedAmount 
    ? parseFloat(receivedAmount) - totalAmount 
    : 0;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (paymentMethod === 'CASH') {
      if (!receivedAmount || parseFloat(receivedAmount) < totalAmount) {
        alert('Insufficient cash received');
        return;
      }
    }

    if (paymentMethod === 'CREDIT' && !customerId) {
      alert('Please select a customer for credit (utang) purchase');
      return;
    }

    const payload = {
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      })),
      paymentMethod,
      receivedAmount: paymentMethod === 'CASH' ? parseFloat(receivedAmount) : 0,
      changeAmount: paymentMethod === 'CASH' ? changeAmount : 0,
      customerId: paymentMethod === 'CREDIT' ? customerId : null
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Transaction completed successfully!');
        setCart([]);
        setReceivedAmount('');
        setCustomerId('');
        loadData(); // Reload products stock levels
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to complete checkout');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to the server');
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === '' || p.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Point of Sale (POS)</h1>
      </div>

      <div className="pos-layout">
        {/* Products List Pane */}
        <div className="pos-products">
          <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="form-control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading POS products...</p>
          ) : (
            <div className="pos-grid">
              {filteredProducts.map(p => (
                <div key={p.id} className="glass-panel pos-card" onClick={() => addToCart(p)}>
                  <img
                    src={p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150'}
                    alt={p.name}
                    className="pos-card-img"
                  />
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <span style={{ fontWeight: 800, color: 'var(--secondary)' }}>₱{p.price}</span>
                    <span style={{ fontSize: '0.7rem', color: p.stockQty <= 5 ? 'var(--danger)' : 'var(--text-dim)' }}>
                      Stock: {p.stockQty}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout Cart Pane */}
        <div className="glass-panel pos-cart">
          <div>
            <h3 style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>Active Cart</h3>
            
            {cart.length === 0 ? (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-dim)' }}>
                Cart is empty. Select products on the left.
              </div>
            ) : (
              <div className="pos-cart-items">
                {cart.map(item => (
                  <div key={item.product.id} className="cart-item">
                    <div style={{ flex: 1, minWidth: 0, marginRight: '0.5rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.product.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ₱{item.product.price} × {item.quantity}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="number"
                        className="form-control"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 0)}
                        style={{ width: '60px', padding: '0.25rem 0.5rem', textAlign: 'center' }}
                      />
                      <button onClick={() => removeFromCart(item.product.id)} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout controls */}
          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>
              <span>Total:</span>
              <span style={{ color: 'var(--secondary)' }}>₱{totalAmount.toLocaleString()}</span>
            </div>

            {cart.length > 0 && (
              <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className={`btn ${paymentMethod === 'CASH' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPaymentMethod('CASH')}
                      style={{ flex: 1 }}
                    >
                      💵 Cash
                    </button>
                    <button
                      type="button"
                      className={`btn ${paymentMethod === 'CREDIT' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPaymentMethod('CREDIT')}
                      style={{ flex: 1 }}
                    >
                      📝 Credit (Utang)
                    </button>
                  </div>
                </div>

                {paymentMethod === 'CASH' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Cash Received (₱)</label>
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        value={receivedAmount}
                        onChange={(e) => setReceivedAmount(e.target.value)}
                        required
                        placeholder="0"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Change (₱)</label>
                      <div className="form-control" style={{ background: 'rgba(255,255,255,0.02)', fontWeight: 700, color: changeAmount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        ₱{changeAmount >= 0 ? changeAmount.toLocaleString() : '0'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Select Debtor Customer</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select
                        className="form-control"
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        required
                      >
                        <option value="">Select Customer</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} (Bal: ₱{c.balance})</option>
                        ))}
                      </select>
                    </div>
                    {/* Add Customer shortcut */}
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Add customer name..."
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                      />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Phone..."
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        style={{ fontSize: '0.85rem', width: '100px' }}
                      />
                      <button type="button" onClick={handleCreateCustomer} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                        Create
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }}>
                  Complete Checkout
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
