'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/inventory', label: 'Inventory', icon: '📦' },
  { href: '/sales', label: 'Sales (POS)', icon: '🛍️' },
  { href: '/utang', label: 'Utang Ledger', icon: '📝' },
  { href: '/reports', label: 'Reports', icon: '📈' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

const WEATHER_OPTIONS = [
  { id: 'HOT_SUNNY', label: '☀️ Hot & Sunny', desc: 'Higher demand for cold drinks, ice & refreshments' },
  { id: 'RAINY', label: '🌧️ Rainy Day', desc: 'Higher demand for instant noodles, coffee & hot soups' },
  { id: 'STORMY', label: '⛈️ Stormy / Typhoon', desc: 'Higher demand for canned goods, noodles & essentials' },
  { id: 'NORMAL', label: '🌤️ Normal Weather', desc: 'Standard baseline daily operations' }
];

export default function SidebarClient({ session }: { session: SessionPayload }) {
  const pathname = usePathname();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  
  // Weather prompt state
  const [showWeatherPrompt, setShowWeatherPrompt] = useState(false);
  const [selectedWeather, setSelectedWeather] = useState('HOT_SUNNY');

  const unreadNotifications = notifications.filter(n => !n.read);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkDailyWeather = async () => {
    try {
      const res = await fetch('/api/weather');
      if (res.ok) {
        const data = await res.json();
        if (!data.hasLoggedToday) {
          setShowWeatherPrompt(true);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    checkDailyWeather();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveWeather = async () => {
    try {
      await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weather: selectedWeather })
      });
      setShowWeatherPrompt(false);
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readAll: true }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <aside className="sidebar">
        <div>
          <Link href="/dashboard" className="sidebar-logo">
            <span>🏪</span> SARI 2
          </Link>

          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-glass)',
        }}>
          {/* Notifications Quick Trigger */}
          <div
            onClick={() => setShowNotifModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              background: unreadNotifications.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.03)',
              border: unreadNotifications.length > 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-glass)',
              cursor: 'pointer',
              marginBottom: '1rem',
              transition: 'var(--transition)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
              <span>🔔</span>
              <span>Alerts</span>
            </div>
            {unreadNotifications.length > 0 ? (
              <span className="badge badge-danger">
                {unreadNotifications.length} NEW
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>0</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{session.name}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Role: {session.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}
            >
              🔒 Lock / Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Large Notifications Modal */}
      {showNotifModal && (
        <div className="modal-overlay" onClick={() => setShowNotifModal(false)}>
          <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2>🔔 System Alerts & Notifications</h2>
              {unreadNotifications.length > 0 && (
                <button onClick={markAllAsRead} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                  Mark all as read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem 0' }}>
                No notifications logged.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '55vh', overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      background: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(99, 102, 241, 0.1)',
                      borderLeft: `4px solid ${
                        n.type === 'LOW_STOCK' ? 'var(--warning)' : n.type === 'EXPIRATION' ? 'var(--danger)' : 'var(--primary)'
                      }`,
                      border: '1px solid var(--border-glass)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{n.title}</div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>{n.message}</p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setShowNotifModal(false)} className="btn btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Weather Morning Question Modal */}
      {showWeatherPrompt && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.4rem' }}>🌤️ Good Morning! What's the weather today?</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                SARI 2 will adapt product restock recommendations and predictive demand based on today's forecast.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {WEATHER_OPTIONS.map(w => (
                <div
                  key={w.id}
                  onClick={() => setSelectedWeather(w.id)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: selectedWeather === w.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                    border: selectedWeather === w.id ? '1.5px solid var(--primary)' : '1px solid var(--border-glass)',
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{w.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{w.desc}</div>
                </div>
              ))}
            </div>

            <button onClick={handleSaveWeather} className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }}>
              Save Weather & Open Store Engine
            </button>
          </div>
        </div>
      )}
    </>
  );
}
