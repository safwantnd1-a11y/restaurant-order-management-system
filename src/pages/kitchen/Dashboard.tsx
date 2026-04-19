import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../../hooks/useSocket';
import { ChefHat, Clock, CheckCircle, Play, LogOut, Search, Wifi, Bell, X, ToggleLeft, ToggleRight, Layers } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { bg: string; border: string; header: string; headerText: string; label: string }> = {
  new:       { bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.35)',  header: 'linear-gradient(135deg,#ef4444,#dc2626)', headerText: 'white',   label: 'NEW' },
  preparing: { bg: 'rgba(234,179,8,0.07)',  border: 'rgba(234,179,8,0.35)',  header: 'linear-gradient(135deg,#eab308,#ca8a04)', headerText: '#1a1200', label: 'COOKING' },
  ready:     { bg: 'rgba(34,197,94,0.06)',  border: 'rgba(34,197,94,0.35)',  header: 'linear-gradient(135deg,#22c55e,#16a34a)', headerText: 'white',   label: 'READY' },
};

// ── Combine orders by table ───────────────────────────────────────────────────
// Priority: new > preparing > ready  (lowest status determines card status)
function groupByTable(orders: any[]) {
  const map = new Map<number, any>();
  for (const o of orders) {
    const tid = o.table_id;
    if (!map.has(tid)) {
      map.set(tid, {
        table_id: tid,
        table_number: o.table_number,
        waiter_name: o.waiter_name,
        orders: [],
        earliest: o.created_at,
      });
    }
    const g = map.get(tid)!;
    g.orders.push(o);
    if (new Date(o.created_at) < new Date(g.earliest)) g.earliest = o.created_at;
  }
  // Resolve combined status
  const priorityOf = (s: string) => ({ new: 0, preparing: 1, ready: 2 }[s] ?? 3);
  return Array.from(map.values()).map(g => {
    const statuses = g.orders.map((o: any) => o.status);
    const combined = statuses.reduce((lowest: string, s: string) =>
      priorityOf(s) < priorityOf(lowest) ? s : lowest, statuses[0]);
    return { ...g, combinedStatus: combined };
  });
}

export default function KitchenDashboard() {
  const { logout, user } = useAuth();
  const { socket } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [updatingTable, setUpdatingTable] = useState<number | null>(null);
  const prevOrderCount = useRef(0);

  useEffect(() => {
    fetchOrders();
    fetchMenu();
    if (socket) {
      socket.on('new-order', () => { fetchOrders(); triggerAlert(); });
      socket.on('order-status-updated', fetchOrders);
      socket.on('menu-updated', fetchMenu);
    }
    return () => {
      if (socket) {
        socket.off('new-order');
        socket.off('order-status-updated');
        socket.off('menu-updated');
      }
    };
  }, [socket]);

  const triggerAlert = () => {
    setNewOrderAlert(true);
    setTimeout(() => setNewOrderAlert(false), 4000);
  };

  const fetchOrders = async () => {
    try {
      const tok = localStorage.getItem('roms_token') || localStorage.getItem('token');
      if (tok) axios.defaults.headers.common['Authorization'] = `Bearer ${tok}`;
      const res = await axios.get('/api/orders');
      const data = Array.isArray(res.data) ? res.data : [];
      if (data.length > prevOrderCount.current && prevOrderCount.current > 0) triggerAlert();
      prevOrderCount.current = data.length;
      setOrders(data);
    } catch (e) {
      console.error('[Kitchen] fetchOrders failed:', e);
    }
  };

  const fetchMenu = async () => {
    const res = await axios.get('/api/menu');
    setMenu(res.data);
  };

  // Update ALL orders in a group to the next status
  const updateGroup = async (group: any) => {
    if (updatingTable !== null) return;
    setUpdatingTable(group.table_id);
    try {
      const nextStatus =
        group.combinedStatus === 'new' ? 'preparing' :
        group.combinedStatus === 'preparing' ? 'ready' : null;
      if (!nextStatus) return;
      // Update every order in the group (only if not already at/past nextStatus)
      await Promise.all(
        group.orders
          .filter((o: any) => {
            const priority = (s: string) => ({ new: 0, preparing: 1, ready: 2 }[s] ?? 3);
            return priority(o.status) < priority(nextStatus);
          })
          .map((o: any) => axios.put(`/api/orders/${o.id}/status`, { status: nextStatus }))
      );
      fetchOrders();
    } finally {
      setUpdatingTable(null);
    }
  };

  const toggleStock = async (item: any) => {
    const newOutOfStock = !item.out_of_stock;
    const updatedStock = newOutOfStock ? 0 : Math.max(Number(item.stock) || 1, 1);
    await axios.patch(`/api/menu/${item.id}`, { stock: updatedStock, out_of_stock: newOutOfStock });
    fetchMenu();
  };

  const activeOrders = orders.filter(o => ['new', 'preparing', 'ready'].includes(o.status));
  const tableGroups = groupByTable(activeOrders);

  const filteredMenu = menu.filter(item =>
    item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(menuSearch.toLowerCase())
  );

  const getElapsed = (createdAt: string) =>
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);

  // Header stats on individual orders (not groups)
  const newCount      = activeOrders.filter(o => o.status === 'new').length;
  const cookingCount  = activeOrders.filter(o => o.status === 'preparing').length;
  const readyCount    = activeOrders.filter(o => o.status === 'ready').length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#070710', color: 'white' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -70, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 26 }}
        className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: 'rgba(7,7,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

        <div className="flex items-center gap-4">
          <motion.div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
            animate={{ boxShadow: ['0 4px 16px rgba(249,115,22,0.3)','0 6px 28px rgba(249,115,22,0.6)','0 4px 16px rgba(249,115,22,0.3)'] }}
            transition={{ duration: 2.5, repeat: Infinity }} whileHover={{ scale: 1.1, rotate: -8 }}>
            <ChefHat size={22} className="text-white" />
          </motion.div>
          <div>
            <h1 className="font-black text-lg text-white tracking-tight">Kitchen Display</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {tableGroups.length} table{tableGroups.length !== 1 ? 's' : ''} active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live stat pills */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: 'New',     count: newCount,     color: '#ef4444' },
              { label: 'Cooking', count: cookingCount,  color: '#eab308' },
              { label: 'Ready',   count: readyCount,    color: '#22c55e' },
            ].map(stat => (
              <motion.div key={stat.label} className="flex items-center gap-2 text-xs" whileHover={{ scale: 1.1 }}>
                <motion.div className="w-2 h-2 rounded-full" style={{ background: stat.color }}
                  animate={{ boxShadow: [`0 0 4px ${stat.color}`,`0 0 12px ${stat.color}`,`0 0 4px ${stat.color}`] }}
                  transition={{ duration: 1.8, repeat: Infinity }} />
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</span>
                <motion.span key={stat.count} className="font-bold text-white"
                  initial={{ scale: 1.4, color: stat.color }} animate={{ scale: 1, color: '#ffffff' }}
                  transition={{ type: 'spring', stiffness: 400 }}>{stat.count}</motion.span>
              </motion.div>
            ))}
          </div>

          <motion.div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
            animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.2, repeat: Infinity }}>
            <Wifi size={10} /> {user?.name}
          </motion.div>

          <motion.button onClick={() => setShowMenu(!showMenu)} whileTap={{ scale: 0.92 }}
            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            animate={showMenu
              ? { background: 'rgba(249,115,22,0.2)', color: '#f97316', borderColor: 'rgba(249,115,22,0.3)' }
              : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.06)' }}
            style={{ border: '1px solid' }}>
            {showMenu ? <X size={14} /> : <ChefHat size={14} />}
            {showMenu ? 'Hide Menu' : 'Menu'}
          </motion.button>

          <motion.button onClick={logout} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <LogOut size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </motion.button>
        </div>
      </motion.header>

      {/* ── New Order Alert ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {newOrderAlert && (
          <motion.div className="px-4 py-3 flex items-center justify-center gap-3 font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: 'white' }}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
            <motion.div animate={{ rotate: [-15, 15, -15] }} transition={{ duration: 0.4, repeat: Infinity }}>
              <Bell size={16} />
            </motion.div>
            🔔 NEW ORDER RECEIVED — Check the queue!
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="flex-1 p-6 flex gap-6 min-h-0">

        {/* Orders */}
        <div className="flex-1 flex flex-col min-w-0">
          <motion.div className="flex items-center justify-between mb-5"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-xl font-black text-white flex items-center gap-3">
              Active Tables
              <AnimatePresence>
                {tableGroups.length > 0 && (
                  <motion.span key={tableGroups.length}
                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0 }}
                    className="text-sm font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                    {tableGroups.length} table{tableGroups.length !== 1 ? 's' : ''}
                  </motion.span>
                )}
              </AnimatePresence>
            </h2>
          </motion.div>

          {tableGroups.length === 0 ? (
            <motion.div className="flex-1 flex flex-col items-center justify-center rounded-3xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                <ChefHat size={64} style={{ color: 'rgba(255,255,255,0.08)' }} />
              </motion.div>
              <p className="text-xl font-bold mt-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Queue is empty</p>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.12)' }}>Waiting for new orders…</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto flex-1 pb-2 pr-1">
              <AnimatePresence mode="popLayout">
                {tableGroups.map(group => {
                  const cfg = STATUS_CFG[group.combinedStatus] || STATUS_CFG['new'];
                  const elapsed = getElapsed(group.earliest);
                  const isUpdating = updatingTable === group.table_id;
                  const multipleOrders = group.orders.length > 1;

                  return (
                    <motion.div key={group.table_id} layout
                      className="rounded-3xl flex flex-col overflow-hidden"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -15 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                      whileHover={{ scale: 1.015, boxShadow: `0 12px 40px ${cfg.border}` }}>

                      {/* Card Header */}
                      <div className="p-4 flex items-center justify-between" style={{ background: cfg.header }}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest opacity-70"
                              style={{ color: cfg.headerText }}>{cfg.label}</span>
                            {multipleOrders && (
                              <span className="text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: 'rgba(0,0,0,0.2)', color: cfg.headerText }}>
                                <Layers size={10} /> {group.orders.length} orders
                              </span>
                            )}
                          </div>
                          <h2 className="text-2xl font-black" style={{ color: cfg.headerText }}>
                            TABLE {group.table_number?.split(' ')[1] ?? group.table_number}
                          </h2>
                          <p className="text-xs opacity-70 mt-0.5" style={{ color: cfg.headerText }}>
                            Waiter: {group.waiter_name || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-xs font-bold justify-end"
                            style={{ color: cfg.headerText, opacity: 0.85 }}>
                            <Clock size={12} />
                            <motion.span key={elapsed} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 400 }}>
                              {elapsed}m ago
                            </motion.span>
                          </div>
                          {elapsed >= 15 && (
                            <motion.span className="text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                              style={{ background: 'rgba(0,0,0,0.2)', color: cfg.headerText }}
                              animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                              ⚠ Delayed
                            </motion.span>
                          )}
                        </div>
                      </div>

                      {/* All items from all orders */}
                      <div className="px-4 py-3 flex-1">
                        {group.orders.map((order: any, oi: number) => (
                          <div key={order.id}>
                            {/* Order sub-header (only if multiple orders) */}
                            {multipleOrders && (
                              <div className="flex items-center gap-2 mb-2 mt-2">
                                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                                <span className="text-[10px] font-black uppercase tracking-widest px-2"
                                  style={{ color: 'rgba(255,255,255,0.25)' }}>
                                  Order #{order.id}
                                  {' · '}
                                  <span style={{
                                    color: order.status === 'new' ? '#ef4444'
                                      : order.status === 'preparing' ? '#eab308' : '#22c55e'
                                  }}>
                                    {order.status.toUpperCase()}
                                  </span>
                                </span>
                                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                              </div>
                            )}
                            <ul className="space-y-2 mb-2">
                              {(order.items || []).map((item: any, idx: number) => (
                                <motion.li key={`${order.id}-${idx}`}
                                  className="flex items-center gap-3"
                                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: (oi * 5 + idx) * 0.04 }}>
                                  <span className="text-sm font-black px-2 py-1 rounded-lg min-w-[32px] text-center"
                                    style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316' }}>
                                    {item.quantity}
                                  </span>
                                  {item.portion === 'half' ? (
                                    <span className="text-xs font-black px-2 py-0.5 rounded-lg flex-shrink-0"
                                      style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                                      ½ HALF
                                    </span>
                                  ) : (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                                      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }}>
                                      FULL
                                    </span>
                                  )}
                                  <span title={item.is_veg ? 'Veg' : 'Non-Veg'}
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      flexShrink: 0, width: 13, height: 13,
                                      border: `1.5px solid ${item.is_veg ? '#22c55e' : '#ef4444'}`,
                                      borderRadius: 2, background: 'rgba(0,0,0,0.15)' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%',
                                      background: item.is_veg ? '#22c55e' : '#ef4444', display: 'block' }} />
                                  </span>
                                  <span className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                                    {item.item_name}
                                  </span>
                                  {item.notes && (
                                    <span className="text-xs italic ml-auto flex-shrink-0"
                                      style={{ color: 'rgba(255,255,255,0.35)' }}>📝 {item.notes}</span>
                                  )}
                                </motion.li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {/* Action button */}
                      <div className="p-4 pt-0">
                        {group.combinedStatus === 'new' && (
                          <motion.button
                            onClick={() => updateGroup(group)}
                            disabled={isUpdating}
                            className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                            style={{ background: isUpdating ? 'rgba(249,115,22,0.4)' : 'rgba(249,115,22,0.9)', color: 'white', boxShadow: '0 4px 15px rgba(249,115,22,0.3)' }}
                            whileHover={!isUpdating ? { scale: 1.03, boxShadow: '0 6px 20px rgba(249,115,22,0.5)' } : {}}
                            whileTap={!isUpdating ? { scale: 0.96 } : {}}>
                            {isUpdating ? (
                              <motion.div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent"
                                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }} />
                            ) : <Play size={16} className="fill-current" />}
                            {multipleOrders ? 'START PREPARING ALL' : 'START PREPARING'}
                          </motion.button>
                        )}
                        {group.combinedStatus === 'preparing' && (
                          <motion.button
                            onClick={() => updateGroup(group)}
                            disabled={isUpdating}
                            className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                            style={{ background: isUpdating ? 'rgba(34,197,94,0.4)' : 'rgba(34,197,94,0.9)', color: 'white', boxShadow: '0 4px 15px rgba(34,197,94,0.35)' }}
                            whileHover={!isUpdating ? { scale: 1.03, boxShadow: '0 6px 20px rgba(34,197,94,0.55)' } : {}}
                            whileTap={!isUpdating ? { scale: 0.96 } : {}}>
                            {isUpdating ? (
                              <motion.div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent"
                                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }} />
                            ) : <CheckCircle size={16} />}
                            {multipleOrders ? 'MARK ALL READY' : 'MARK AS READY'}
                          </motion.button>
                        )}
                        {group.combinedStatus === 'ready' && (
                          <motion.div
                            className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}
                            animate={{ opacity: [0.8, 1, 0.8] }} transition={{ duration: 1.5, repeat: Infinity }}>
                            <CheckCircle size={16} /> READY FOR PICKUP
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Menu Sidebar ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showMenu && (
            <motion.aside className="w-80 flex-shrink-0 flex flex-col rounded-3xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              initial={{ opacity: 0, x: 40, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: 40, width: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}>
              <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-white text-lg">Live Menu</h2>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{menu.length} items</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Search size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <input type="text" placeholder="Search menu..." value={menuSearch}
                    onChange={e => setMenuSearch(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'white' }} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <AnimatePresence>
                  {filteredMenu.map((item, i) => (
                    <motion.div key={item.id}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: i * 0.04 }}
                      className="p-3.5 rounded-2xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-white">{item.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.category}</p>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={item.out_of_stock
                            ? { background: 'rgba(239,68,68,0.12)', color: '#f87171' }
                            : { background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                          {item.out_of_stock ? 'Out' : 'In Stock'}
                        </span>
                      </div>
                      <motion.button onClick={() => toggleStock(item)}
                        className="mt-2.5 w-full py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                        style={item.out_of_stock
                          ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                          : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
                        {item.out_of_stock ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {item.out_of_stock ? 'Mark Available' : 'Mark Out of Stock'}
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
