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

export default function SidebarClient({ session }: { session: SessionPayload }) {
  const pathname = usePathname();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, read: true } : n))
        );
      }
    } catch (e) {
      console.error(e);
    }
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
        marginTop: '2rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid var(--border-glass)',
        position: 'relative',
      }}>
        {/* Notification Bell */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Alerts</span>
          <div className="notification-bell" onClick={() => setShowNotifPanel(!showNotifPanel)}>
            <span style={{ fontSize: '1.25rem' }}>🔔</span>
            {unreadCount > 0 && <span className="notification-badge" />}
          </div>
        </div>

        {/* Notifications Panel */}
        {showNotifPanel && (
          <div className="glass-panel" style={{
            position: 'absolute',
            bottom: '100%',
            left: '0',
            width: '260px',
            maxHeight: '300px',
            overflowY: 'auto',
            marginBottom: '0.5rem',
            padding: '1rem',
            zIndex: 200,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-glass)',
              paddingBottom: '0.5rem',
              marginBottom: '0.5rem',
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
                No notifications
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notifications.slice(0, 10).map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markAsRead(n.id)}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '6px',
                      background: n.read ? 'transparent' : 'rgba(255, 255, 255, 0.03)',
                      borderLeft: `3px solid ${
                        n.type === 'LOW_STOCK' ? 'var(--warning)' : 'var(--danger)'
                      }`,
                      cursor: n.read ? 'default' : 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div style={{ fontWeight: n.read ? 500 : 700, color: 'var(--text-primary)' }}>{n.title}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>{n.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{session.name}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>{session.role.toLowerCase()}</p>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
