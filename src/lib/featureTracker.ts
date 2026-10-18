// In-browser and persistent telemetry tracker for feature usage and frequent edits

export interface FeatureUsage {
  key: string;
  label: string;
  icon: string;
  href: string;
  count: number;
  lastUsed: string;
}

export interface EditAuditRecord {
  id: string;
  timestamp: string;
  module: string;
  action: string;
  details: string;
  type: 'STOCK' | 'PRICE' | 'UTANG' | 'LOSS' | 'PRODUCT';
}

const STORAGE_KEY_FEATURES = 'sari2_feature_usage';
const STORAGE_KEY_EDITS = 'sari2_recent_edits';

const DEFAULT_FEATURES: Record<string, { label: string; icon: string; href: string }> = {
  pos: { label: 'Point of Sale (POS)', icon: '🛒', href: '/sales' },
  inventory: { label: 'Inventory Management', icon: '📦', href: '/inventory' },
  quick_audit: { label: 'Fast Inventory Count', icon: '⚡', href: '/inventory?tab=AUDIT' },
  utang: { label: 'Utang & Credit Scoring', icon: '📝', href: '/utang' },
  shopping_list: { label: 'Restock Shopping List', icon: '📋', href: '/dashboard?tab=SHOPPING_LIST' },
  reports: { label: 'Sales & Audit Reports', icon: '📊', href: '/reports' },
  losses: { label: 'Loss & Damage Logging', icon: '⚠️', href: '/inventory?tab=LOSSES' },
  settings: { label: 'Settings & Suppliers', icon: '⚙️', href: '/settings' },
};

export function recordFeatureUsage(featureKey: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FEATURES);
    const data: Record<string, FeatureUsage> = raw ? JSON.parse(raw) : {};

    const meta = DEFAULT_FEATURES[featureKey] || {
      label: featureKey,
      icon: '⚡',
      href: '/dashboard',
    };

    if (!data[featureKey]) {
      data[featureKey] = {
        key: featureKey,
        label: meta.label,
        icon: meta.icon,
        href: meta.href,
        count: 1,
        lastUsed: new Date().toISOString(),
      };
    } else {
      data[featureKey].count += 1;
      data[featureKey].lastUsed = new Date().toISOString();
    }

    localStorage.setItem(STORAGE_KEY_FEATURES, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to log feature usage', err);
  }
}

export function getTopFeatures(limit = 4): FeatureUsage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FEATURES);
    if (!raw) {
      // Return defaults with initial seeds
      return [
        { key: 'pos', ...DEFAULT_FEATURES.pos, count: 5, lastUsed: new Date().toISOString() },
        { key: 'quick_audit', ...DEFAULT_FEATURES.quick_audit, count: 4, lastUsed: new Date().toISOString() },
        { key: 'inventory', ...DEFAULT_FEATURES.inventory, count: 3, lastUsed: new Date().toISOString() },
        { key: 'utang', ...DEFAULT_FEATURES.utang, count: 2, lastUsed: new Date().toISOString() },
      ];
    }
    const data: Record<string, FeatureUsage> = JSON.parse(raw);
    return Object.values(data)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function logStoreEdit(
  module: string,
  action: string,
  details: string,
  type: 'STOCK' | 'PRICE' | 'UTANG' | 'LOSS' | 'PRODUCT' = 'STOCK'
) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EDITS);
    const edits: EditAuditRecord[] = raw ? JSON.parse(raw) : [];

    const newRecord: EditAuditRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      module,
      action,
      details,
      type,
    };

    const updated = [newRecord, ...edits].slice(0, 50); // Keep last 50 edits
    localStorage.setItem(STORAGE_KEY_EDITS, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to log store edit', err);
  }
}

export function getRecentEdits(limit = 10): EditAuditRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EDITS);
    if (!raw) return [];
    const edits: EditAuditRecord[] = JSON.parse(raw);
    return edits.slice(0, limit);
  } catch {
    return [];
  }
}
