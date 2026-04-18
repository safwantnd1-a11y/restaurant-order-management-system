import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNetwork } from './useNetwork';

const PENDING_KEY = 'roms_pending_orders';

interface PendingOrder {
  id: string;
  table_id: number;
  items: any[];
  customer_phone?: string;
  customer_name?: string;
  savedAt: number;
}

export const useOfflineSync = () => {
  const { isOnline } = useNetwork();
  const [pending, setPending] = useState<PendingOrder[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const loadPending = useCallback(() => {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      setPending(raw ? JSON.parse(raw) : []);
    } catch { setPending([]); }
  }, []);

  useEffect(() => { loadPending(); }, []);

  // Auto-sync when network comes back
  useEffect(() => {
    if (isOnline && pending.length > 0) {
      syncPendingOrders();
    }
  }, [isOnline]);

  const saveOrderLocally = useCallback((order: Omit<PendingOrder, 'id' | 'savedAt'>) => {
    const newOrder: PendingOrder = {
      ...order,
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      savedAt: Date.now(),
    };
    const current = (() => {
      try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
    })();
    const updated = [...current, newOrder];
    localStorage.setItem(PENDING_KEY, JSON.stringify(updated));
    setPending(updated);
    return newOrder.id;
  }, []);

  const syncPendingOrders = useCallback(async () => {
    const raw = localStorage.getItem(PENDING_KEY);
    const orders: PendingOrder[] = raw ? JSON.parse(raw) : [];
    if (!orders.length) return;

    setSyncing(true);
    const failed: PendingOrder[] = [];

    for (const order of orders) {
      try {
        await axios.post('/api/orders', {
          table_id: order.table_id,
          items: order.items,
          customer_phone: order.customer_phone,
          customer_name: order.customer_name,
        });
      } catch {
        failed.push(order);
      }
    }

    localStorage.setItem(PENDING_KEY, JSON.stringify(failed));
    setPending(failed);
    setSyncing(false);
    setLastSynced(new Date().toLocaleTimeString());
  }, []);

  return { isOnline, pending, syncing, lastSynced, saveOrderLocally, syncPendingOrders, pendingCount: pending.length };
};
