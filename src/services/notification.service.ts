export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'alert';
  module: 'patient' | 'queue' | 'lab' | 'pharmacy' | 'nurse' | 'billing' | 'owner';
  targetRoles: string[]; // e.g. ['doctor', 'nurse'], ['all'], ['pharmacist']
  targetUserId?: string;
  targetStaffName?: string;
  readBy: string[]; // user IDs or role names who read it
  createdAt: string;
  link?: string;
}

const STORAGE_KEY = 'ethiocare_notifications_store';
let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('ethiocare_notifications_channel');
  }
} catch {
  // BroadcastChannel unavailable
}

const listeners = new Set<(items: NotificationItem[]) => void>();

function getStoredNotifications(): NotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setStoredNotifications(items: NotificationItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100))); // keep latest 100
  } catch {
    // ignore
  }
}

function notifyListeners() {
  const items = getStoredNotifications();
  listeners.forEach(fn => {
    try { fn(items); } catch {}
  });
  if (channel) {
    try {
      channel.postMessage({ type: 'UPDATE' });
    } catch {}
  }
}

if (channel) {
  channel.onmessage = (evt) => {
    if (evt.data?.type === 'UPDATE') {
      const items = getStoredNotifications();
      listeners.forEach(fn => {
        try { fn(items); } catch {}
      });
    }
  };
}

export const notificationService = {
  getNotifications(role?: string, staffIdentifier?: string): NotificationItem[] {
    const all = getStoredNotifications();
    if (!role || role === 'owner' || role === 'admin') return all;
    return all.filter(n => {
      const roleMatches = n.targetRoles.includes('all') || n.targetRoles.includes(role);
      if (!roleMatches) return false;
      // If notification has a specific target staff, only show to them or unassigned
      if (n.targetUserId || n.targetStaffName) {
        if (!staffIdentifier) return true;
        const idMatches = n.targetUserId && n.targetUserId === staffIdentifier;
        const nameMatches = n.targetStaffName && (
          n.targetStaffName.toLowerCase().includes(staffIdentifier.toLowerCase()) ||
          staffIdentifier.toLowerCase().includes(n.targetStaffName.toLowerCase())
        );
        return idMatches || nameMatches;
      }
      return true;
    });
  },

  getUnreadCount(role?: string, staffIdentifier?: string): number {
    const notifs = this.getNotifications(role, staffIdentifier);
    const identifier = staffIdentifier || role || 'default';
    return notifs.filter(n => !n.readBy.includes(identifier) && !n.readBy.includes(role || 'default')).length;
  },

  dispatch(item: Omit<NotificationItem, 'id' | 'createdAt' | 'readBy'> & { readBy?: string[] }) {
    const current = getStoredNotifications();
    const newItem: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      readBy: item.readBy || []
    };
    // Avoid duplicate title + message within 1 minute
    const isDup = current.some(c =>
      c.title === newItem.title &&
      c.message === newItem.message &&
      (Date.now() - new Date(c.createdAt).getTime()) < 60000
    );
    if (!isDup) {
      setStoredNotifications([newItem, ...current]);
      notifyListeners();
    }
  },

  markAsRead(id: string, role: string = 'default') {
    const current = getStoredNotifications();
    const updated = current.map(item => {
      if (item.id === id && !item.readBy.includes(role)) {
        return { ...item, readBy: [...item.readBy, role] };
      }
      return item;
    });
    setStoredNotifications(updated);
    notifyListeners();
  },

  markAllAsRead(role: string = 'default') {
    const current = getStoredNotifications();
    const updated = current.map(item => {
      if (!item.readBy.includes(role)) {
        return { ...item, readBy: [...item.readBy, role] };
      }
      return item;
    });
    setStoredNotifications(updated);
    notifyListeners();
  },

  clearAll(role?: string) {
    if (!role || role === 'owner' || role === 'admin') {
      setStoredNotifications([]);
    } else {
      const current = getStoredNotifications();
      const updated = current.filter(n => !n.targetRoles.includes(role));
      setStoredNotifications(updated);
    }
    notifyListeners();
  },

  subscribe(listener: (items: NotificationItem[]) => void): () => void {
    listeners.add(listener);
    // Initial call
    listener(getStoredNotifications());
    return () => {
      listeners.delete(listener);
    };
  }
};
