'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { recordFeatureUsage } from '@/lib/featureTracker';

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
  { href: '/dashboard', label: 'Dashboard', key: 'dashboard' },
  { href: '/inventory', label: 'Inventory', key: 'inventory' },
  { href: '/sales', label: 'POS Checkout', key: 'pos' },
  { href: '/utang', label: 'Utang & Credit Trust', key: 'utang' },
  { href: '/reports', label: 'Reports & Audits', key: 'reports' },
  { href: '/settings', label: 'Settings', key: 'settings' },
];

export default function SidebarClient({ session }: { session: SessionPayload }) {
  const pathname = usePathname();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifModal, setShowNotifModal] = useState(false);

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

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  const handleNavClick = (key: string) => {
    recordFeatureUsage(key);
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
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              background: 'var(--primary)',
              borderRadius: '7px',
              fontSize: '0.85rem',
              fontWeight: 800,
              color: '#fff'
            }}>
              S2
            </span>
            <span>SARI 2</span>
          </Link>

          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => handleNavClick(item.key)}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div style={{
          marginTop: '1.25rem',
          paddingTop: '1.1rem',
          borderTop: '1px solid var(--border-glass)',
        }}>
          {/* Notifications Quick Trigger */}
          <div
            onClick={() => setShowNotifModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.55rem 0.75rem',
              borderRadius: '8px',
              background: unreadNotifications.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.02)',
              border: unreadNotifications.length > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-glass)',
              cursor: 'pointer',
              marginBottom: '0.85rem',
              transition: 'var(--transition)'
            }}
          >
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>System Alerts</span>
            {unreadNotifications.length > 0 ? (
              <span className="badge badge-danger">
                {unreadNotifications.length} New
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>0</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{session.name}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Role: {session.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem' }}
            >
              Sign Out / Lock
            </button>
          </div>
        </div>
      </aside>

      {/* Notifications Modal */}
      {showNotifModal && (
        <div className="modal-overlay" onClick={() => setShowNotifModal(false)}>
          <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem' }}>System Alerts</h2>
              {unreadNotifications.length > 0 && (
                <button onClick={markAllAsRead} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}>
                  Mark all as read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem 0' }}>
                No notifications logged.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '55vh', overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      background: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(79, 70, 229, 0.08)',
                      borderLeft: `3px solid ${
                        n.type === 'LOW_STOCK' ? 'var(--warning)' : n.type === 'EXPIRATION' ? 'var(--danger)' : 'var(--primary)'
                      }`,
                      border: '1px solid var(--border-glass)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{n.title}</div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>{n.message}</p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setShowNotifModal(false)} className="btn btn-primary" style={{ padding: '0.45rem 1rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
