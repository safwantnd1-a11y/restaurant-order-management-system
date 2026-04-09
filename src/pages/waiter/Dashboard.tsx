import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../../hooks/useSocket';
import { Plus, ShoppingCart, CheckCircle, Clock, LogOut, Search, Minus, X, Send, Utensils, ClipboardList, ChefHat, Wifi, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  new:      { label: 'New Order', className: 'badge-new',      dot: '#ef4444' },
  preparing:{ label: 'Preparing', className: 'badge-preparing', dot: '#eab308' },
  ready:    { label: 'Ready!',    className: 'badge-ready',    dot: '#22c55e' },
  served:   { label: 'Served',   className: 'badge-served',   dot: '#6366f1' },
  billing:  { label: 'Billing...', className: 'badge-billing',  dot: '#06b6d4' },
  paid:     { label: 'Paid',      className: 'badge-paid',      dot: '#10b981' },
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } },
};

export default function WaiterDashboard() {
  const { logout, user } = useAuth();
  const { socket } = useSocket();
  const [menu, setMenu] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [view, setView] = useState<'menu' | 'orders' | 'history'>('menu');
  const [menuSearch, setMenuSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [selectedPortions, setSelectedPortions] = useState<Record<number, string>>({});
   const [now, setNow] = useState(Date.now());
   const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchData();
    if (socket) {
      socket.on('order-status-updated', fetchData);
      socket.on('menu-updated', fetchData);
      // ✅ Real-time: when admin assigns/changes tables, auto-refresh waiter panel
      socket.on('staff-status-updated', fetchData);
    }
    return () => {
      if (socket) {
        socket.off('order-status-updated', fetchData);
        socket.off('menu-updated', fetchData);
        socket.off('staff-status-updated', fetchData);
      }
    };
  }, [socket]);

  const fetchData = async () => {
    setFetchError(null);

    // ✅ BULLETPROOF: Always inject fresh token before fetching
    // This works regardless of interceptor timing or HMR cache issues
    const freshToken = localStorage.getItem('token');
    if (freshToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${freshToken}`;
    }

    // Fetch menu independently (no auth needed)
    try {
      const menuRes = await axios.get('/api/menu');
      setMenu(Array.isArray(menuRes.data) ? menuRes.data : []);
    } catch { setMenu([]); }

    // Fetch tables — needs auth, handle separately
    try {
      const tablesRes = await axios.get('/api/waiter/my-tables');
      const tableData = Array.isArray(tablesRes.data) ? tablesRes.data : [];
      setTables(tableData);
      if (tableData.length === 0) {
        // Silently mark as empty — admin hasn't assigned yet
        setFetchError(null);
      }
    } catch (e: any) {
      setTables([]);
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        setFetchError('Session expired — please logout and login again');
      } else {
        setFetchError(e.response?.data?.error || e.message || 'Could not load tables');
      }
    }

    // Fetch active orders
    try {
      const ordersRes = await axios.get('/api/orders');
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
    } catch { setOrders([]); }

    // Fetch history
    try {
      const historyRes = await axios.get('/api/orders?history=true');
      setHistoryOrders(Array.isArray(historyRes.data) ? historyRes.data : []);
    } catch { setHistoryOrders([]); }
  };

  // Each cart entry has a unique key: `${menu_id}_${portion}`
  const addToCart = (item: any, portion: string) => {
    const cartKey = `${item.id}_${portion}`;
    setCart(prev => {
      const existing = prev.find(i => i.cartKey === cartKey);
      if (existing) return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, cartKey, menu_id: item.id, quantity: 1, portion }];
    });
  };

  const updateQty = (cartKey: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.cartKey === cartKey);
      if (!item) return prev;
      if (item.quantity + delta <= 0) return prev.filter(i => i.cartKey !== cartKey);
      return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + delta } : i);
    });
  };

  const removeFromCart = (cartKey: string) => setCart(prev => prev.filter(i => i.cartKey !== cartKey));

  const placeOrder = async () => {
    if (!selectedTable || cart.length === 0) return;
    setPlacingOrder(true);
    try {
      await axios.post('/api/orders', {
        table_id: selectedTable,
        items: cart.map(i => ({ menu_id: i.menu_id, quantity: i.quantity, portion: i.portion || 'full' })),
      });
      setCart([]);
      setSelectedTable(null);
      setCartOpen(false);
      setView('orders');
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Failed to place order: ' + (err.response?.data?.error || err.message));
    } finally {
      setPlacingOrder(false);
    }
  };

  const markAsServed = async (orderId: number) => {
    await axios.put(`/api/orders/${orderId}/status`, { status: 'served' });
    fetchData();
  };

  const requestBilling = async (orderId: number) => {
    await axios.put(`/api/orders/${orderId}/status`, { status: 'billing' });
    fetchData();
  };

  const categories = ['All', ...Array.from(new Set(menu.map(i => i.category).filter(Boolean)))];
  const cartTotal = cart.reduce((sum, i) => sum + i.quantity, 0);

  const filteredMenu = menu.filter(item => {
    const catMatch  = activeCategory === 'All' || item.category === activeCategory;
    const srchMatch = item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                      (item.category || '').toLowerCase().includes(menuSearch.toLowerCase());
    const vegMatch  = vegFilter === 'all' ? true : vegFilter === 'veg' ? !!item.is_veg : !item.is_veg;
    return catMatch && srchMatch && vegMatch;
  });

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f', color: 'white' }}>
      {/* Top Bar */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
            whileHover={{ scale: 1.1, rotate: 8 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Utensils size={16} className="text-white" />
          </motion.div>
          <div>
            <p className="font-bold text-white text-sm">Waiter Panel</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
            animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }}>
            <Wifi size={10} /> Online
          </motion.div>
          <motion.button onClick={fetchData} whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.1 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: 0 }} key={now}>
              <Plus size={16} style={{ color: 'rgba(255,255,255,0.5)', rotate: '45deg' }} />
            </motion.div>
          </motion.button>
          <motion.button onClick={logout} whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.1 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <LogOut size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </motion.button>
        </div>
      </motion.header>

      {/* Tab Switcher */}
      <motion.div className="px-4 pt-4 pb-2"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { key: 'menu',   label: 'New',     icon: <Utensils size={14} /> },
            { key: 'orders', label: 'Active',  icon: <ClipboardList size={14} />, badge: orders.filter(o => o.status !== 'served').length },
            { key: 'history', label: 'History', icon: <Clock size={14} /> },
          ].map(tab => (
            <motion.button
              key={tab.key}
              onClick={() => setView(tab.key as any)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold relative"
              whileTap={{ scale: 0.97 }}
              style={view === tab.key
                ? { background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', boxShadow: '0 4px 15px rgba(249,115,22,0.3)' }
                : { color: 'rgba(255,255,255,0.4)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              {tab.icon}
              {tab.label}
              <AnimatePresence>
                {tab.badge != null && tab.badge > 0 && (
                  <motion.span className="num-badge"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    style={{ background: view === tab.key ? 'rgba(255,255,255,0.25)' : 'rgba(249,115,22,0.8)', color: 'white' }}>
                    {tab.badge}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ===== MENU VIEW ===== */}
      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <motion.div key="menu" className="px-4 pb-32 space-y-5"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}>

            {/* Table Selection */}
            <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Select Table</p>
              <motion.div className="grid grid-cols-5 gap-2" variants={containerVariants} initial="hidden" animate="show">
                {fetchError ? (
                  <div className="col-span-5 p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center">
                    <p className="font-bold">Error loading tables</p>
                    <p className="opacity-60">{fetchError}</p>
                    <button onClick={fetchData} className="mt-2 px-4 py-1 bg-red-500/10 rounded-lg underline">Retry</button>
                  </div>
                ) : tables.length === 0 ? (
                  <div className="col-span-5 p-6 rounded-2xl bg-orange-500/5 border border-orange-500/10 text-orange-500 text-xs text-center flex flex-col items-center gap-2">
                    <AlertCircle size={24} className="opacity-50" />
                    <p className="font-bold">No tables assigned by admin yet.</p>
                    <p className="opacity-60 text-[10px]">Staff DB ID: {user?.id} | Name: {user?.name}</p>
                    <motion.button onClick={fetchData} className="mt-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-bold">
                      RELOAD TABLES
                    </motion.button>
                  </div>
                ) : (tables || []).map(t => {
                  const num = (t.table_number || '').split(' ')[1] || t.table_number || '?';
                  const isSelected = selectedTable === t.id;
                  return (
                    <motion.button key={t.id} variants={itemVariants}
                      onClick={() => setSelectedTable(t.id)}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
                      className="py-3 rounded-2xl font-bold text-sm"
                      style={isSelected
                        ? { background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', boxShadow: '0 4px 15px rgba(249,115,22,0.4)' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                      {num}
                    </motion.button>
                  );
                })}
              </motion.div>
              <AnimatePresence>
                {selectedTable && (
                  <motion.div className="mt-2 text-xs font-medium" style={{ color: '#fb923c' }}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                    ✓ Table {tables.find(t => t.id === selectedTable)?.table_number} selected
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

            {/* Search */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Search size={15} style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input type="text" placeholder="Search dishes..." value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'white' }} />
              <AnimatePresence>
                {menuSearch && (
                  <motion.button onClick={() => setMenuSearch('')} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <X size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Category Tabs */}
            <motion.div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
              {categories.map((cat, i) => (
                <motion.button key={cat} onClick={() => setActiveCategory(cat)}
                  className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold"
                  style={activeCategory === cat
                    ? { background: '#f97316', color: 'white' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.24 + i * 0.05 }}>
                  {cat}
                </motion.button>
              ))}
            </motion.div>

            {/* Veg / Non-Veg Filter */}
            <motion.div className="flex gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}>
              {[
                { key: 'all',    label: 'All',        color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)' },
                { key: 'veg',    label: '🟢 Veg',     color: '#4ade80',               bg: 'rgba(34,197,94,0.08)'  },
                { key: 'nonveg', label: '🔴 Non-Veg', color: '#f87171',               bg: 'rgba(239,68,68,0.08)'  },
              ].map(f => (
                <motion.button key={f.key} onClick={() => setVegFilter(f.key as any)}
                  className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold"
                  whileTap={{ scale: 0.93 }}
                  style={vegFilter === f.key
                    ? { background: f.bg, color: f.color, border: `1px solid ${f.color}` }
                    : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {f.label}
                </motion.button>
              ))}
            </motion.div>

            {/* Menu Items */}
            <motion.div className="space-y-3" variants={containerVariants} initial="hidden" animate="show">
              {filteredMenu.length === 0 ? (
                <motion.div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Utensils size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No items found</p>
                </motion.div>
              ) : filteredMenu.map(item => {
                const inCartHalf = cart.find(c => c.cartKey === `${item.id}_half`);
                const inCartFull = cart.find(c => c.cartKey === `${item.id}_full`);
                const hasHalf = Number(item.half_price) > 0;

                return (
                  <motion.div key={item.id} variants={itemVariants}
                    className="rounded-3xl p-4 flex items-center gap-4"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    whileHover={{ scale: 1.015, borderColor: 'rgba(249,115,22,0.2)' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}>

                    {/* Thumbnail */}
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(249,115,22,0.1)' }}>
                        <ChefHat size={22} style={{ color: '#f97316' }} />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{item.name}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.description || item.category}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-bold text-orange-400">₹{item.price}</p>
                        {Number(item.half_price) > 0 && (
                          <p className="text-[10px] font-bold py-0.5 px-1.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            ½ ₹{item.half_price}
                          </p>
                        )}
                      </div>
                      {/* Badges */}
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {/* Indian veg/non-veg indicator */}
                        <span title={item.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 14, height: 14, flexShrink: 0,
                            border: `1.5px solid ${item.is_veg ? '#22c55e' : '#ef4444'}`,
                            borderRadius: 2 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%',
                            background: item.is_veg ? '#22c55e' : '#ef4444', display: 'block' }} />
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={!item.out_of_stock
                            ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80' }
                            : { background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                          {!item.out_of_stock ? 'Available' : 'Out of stock'}
                        </span>
                      </div>
                    </div>

                    {/* Add-to-cart Controls */}
                    <div className="flex-shrink-0 flex flex-col gap-2 items-end">
                      <select 
                        title="Portion Dropdown"
                        className="input-dark text-[10px] font-bold py-1 px-1.5 rounded-lg outline-none cursor-pointer"
                        style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', width: '64px' }}
                        value={selectedPortions[item.id] || 'FULL'}
                        onChange={(e) => setSelectedPortions({...selectedPortions, [item.id]: e.target.value})}
                      >
                        <option value="FULL">FULL</option>
                        {Number(item.half_price) > 0 && <option value="HALF">HALF</option>}
                      </select>

                      {item.out_of_stock ? (
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center opacity-25"
                          style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <Plus size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        </div>
                      ) : (
                        <motion.button onClick={() => addToCart(item, (selectedPortions[item.id] || 'FULL').toLowerCase())} whileTap={{ scale: 0.85 }}
                          className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
                          style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
                          <Plus size={14} /> Add
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}

        {/* ===== ORDERS VIEW ===== */}
        {view === 'orders' && (
          <motion.div key="orders" className="px-4 pb-8 space-y-3 pt-4"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}>
            {(orders || []).length === 0 ? (
              <motion.div className="flex flex-col items-center justify-center py-24 text-center"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
                  <Clock size={52} className="mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
                </motion.div>
                <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>No active orders</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>New orders will appear here in real-time</p>
              </motion.div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
                  {(orders || []).map(order => {
                    const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['new'];
                    const sameTableOrders = (orders || []).filter(o => o.table_id === order.table_id && o.status !== 'served');
                    const orderSequence = sameTableOrders.length > 1 
                                          ? sameTableOrders.sort((a,b) => a.id - b.id).findIndex(o => o.id === order.id) + 1 
                                          : null;

                    return (
                      <motion.div key={order.id} variants={itemVariants}
                        className="rounded-3xl overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        layout whileHover={{ scale: 1.01 }}>
                        <div className="px-4 pt-4 pb-3 flex items-start justify-between"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <motion.div className="w-2.5 h-2.5 rounded-full"
                                style={{ background: statusCfg.dot }}
                                animate={{ boxShadow: [`0 0 4px ${statusCfg.dot}`, `0 0 12px ${statusCfg.dot}`, `0 0 4px ${statusCfg.dot}`] }}
                                transition={{ duration: 1.8, repeat: Infinity }} />
                              <h3 className="font-bold text-white">Table {(order.table_number || '').replace('Table ', '')}</h3>
                              {orderSequence && orderSequence > 0 && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                                  Order #{orderSequence}
                                </span>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              ID: #{order.id} · {new Date(order.created_at || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          {order.status !== 'served' && (
                            <p className="text-xs mt-0.5 font-bold" style={{ color: '#fb923c' }}>
                              ⏱ Wait time: {Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 60000))} mins
                            </p>
                          )}
                        </div>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <ul className="space-y-1.5">
                          {order.items.map((item: any, idx: number) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <span className="font-bold text-xs px-2 py-0.5 rounded-lg"
                                style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>{item.quantity}×</span>
                              {/* Portion badge */}
                              {item.portion && (
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded-lg"
                                  style={item.portion === 'half'
                                    ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }
                                    : { background: 'rgba(249,115,22,0.08)', color: 'rgba(249,115,22,0.6)' }}>
                                  {item.portion === 'half' ? '½' : '⚪'}
                                </span>
                              )}
                              <span style={{ color: 'rgba(255,255,255,0.75)' }}>{item.item_name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {order.status === 'ready' && (
                        <motion.button onClick={() => markAsServed(order.id)}
                          className="w-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm"
                          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}
                          whileTap={{ scale: 0.98 }}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <CheckCircle size={16} />
                          Mark as Served
                        </motion.button>
                      )}
                      {order.status === 'served' && (
                        <motion.button onClick={() => requestBilling(order.id)}
                          className="w-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm"
                          style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: 'white' }}
                          whileTap={{ scale: 0.98 }}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <ShoppingCart size={16} />
                          Request for Billing
                        </motion.button>
                      )}
                      {order.status === 'billing' && (
                        <div className="w-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm bg-cyan-500/10 text-cyan-500 border-t border-cyan-500/20 uppercase tracking-widest">
                          <Clock size={16} />
                          Billing...
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        )}
        {view === 'history' && (
          <motion.div key="history" className="px-4 pb-8 space-y-3 pt-4"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}>
            {historyOrders.length === 0 ? (
              <motion.div className="flex flex-col items-center justify-center py-24 text-center"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <Clock size={52} className="mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
                <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>No order history yet</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Completed orders will appear here</p>
              </motion.div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
                {historyOrders.map(order => {
                  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['new'];
                  return (
                    <motion.div key={order.id} variants={itemVariants}
                      className="rounded-3xl overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                      layout>
                      <div className="px-4 pt-4 pb-3 flex items-start justify-between"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-white">Table {order.table_number.split(' ')[1]}</h3>
                          </div>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            Order #{order.id} · {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs mt-0.5 font-semibold" style={{ color: 'rgba(255,255,255,0.2)' }}>
                            Served by {order.waiter_name}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <ul className="space-y-1.5">
                          {order.items.map((item: any, idx: number) => (
                            <li key={idx} className="flex items-center gap-2 text-sm opacity-60">
                              <span className="font-bold text-xs">{item.quantity}×</span>
                              {item.portion && (
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded-lg border border-white border-opacity-10">
                                  {item.portion === 'half' ? '½' : '⚪'}
                                </span>
                              )}
                              <span>{item.item_name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Cart Button */}
      <AnimatePresence>
        {view === 'menu' && cartTotal > 0 && (
          <motion.div className="fixed bottom-4 left-4 right-4 z-40"
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
            <motion.button onClick={() => setCartOpen(true)}
              className="w-full py-4 rounded-2xl flex items-center justify-between px-6 font-bold"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 30px rgba(249,115,22,0.5)' }}
              whileHover={{ scale: 1.02, boxShadow: '0 12px 40px rgba(249,115,22,0.7)' }}
              whileTap={{ scale: 0.97 }}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart size={20} className="text-white" />
                  <motion.span key={cartTotal}
                    initial={{ scale: 1.5 }} animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-white text-orange-600 rounded-full text-xs font-black flex items-center justify-center">
                    {cartTotal}
                  </motion.span>
                </div>
                <span className="text-white">{cartTotal} item{cartTotal > 1 ? 's' : ''} in cart</span>
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)} />
            <motion.div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6 max-h-[85vh] flex flex-col"
              style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.08)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-xl text-white">Your Order</h3>
                  <AnimatePresence>
                    {selectedTable && (
                      <motion.p className="text-sm mt-0.5" style={{ color: '#f97316' }}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                        Table {tables.find(t => t.id === selectedTable)?.table_number}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <motion.button onClick={() => setCartOpen(false)} whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <X size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
                </motion.button>
              </div>

              <AnimatePresence>
                {!selectedTable && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 p-3 rounded-xl mb-4 text-sm overflow-hidden"
                    style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', color: '#fb923c' }}>
                    Please select a table before placing the order
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                <AnimatePresence>
                  {cart.map(item => (
                    <motion.div key={item.cartKey} layout
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, height: 0 }}
                      className="flex items-center gap-3 p-3 rounded-2xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-white">{item.name}</p>
                          {/* Half / Full badge */}
                          <span className="text-xs font-black px-2 py-0.5 rounded-full"
                            style={item.portion === 'half'
                              ? { background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }
                              : { background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
                            {item.portion === 'half' ? '½ Half' : '⚪ Full'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.button onClick={() => updateQty(item.cartKey, -1)} whileTap={{ scale: 0.85 }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <Minus size={12} style={{ color: 'white' }} />
                        </motion.button>
                        <motion.span key={item.quantity} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                          className="w-6 text-center font-bold text-sm text-white">{item.quantity}</motion.span>
                        <motion.button onClick={() => updateQty(item.cartKey, 1)} whileTap={{ scale: 0.85 }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(249,115,22,0.2)' }}>
                          <Plus size={12} style={{ color: '#f97316' }} />
                        </motion.button>
                        <motion.button onClick={() => removeFromCart(item.cartKey)} whileTap={{ scale: 0.85 }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center ml-1"
                          style={{ background: 'rgba(239,68,68,0.1)' }}>
                          <X size={12} style={{ color: '#f87171' }} />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <motion.button onClick={placeOrder} disabled={!selectedTable || placingOrder}
                  className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-white"
                  style={selectedTable
                    ? { background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 25px rgba(249,115,22,0.4)' }
                    : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
                  whileHover={selectedTable ? { scale: 1.02 } : {}}
                  whileTap={selectedTable ? { scale: 0.97 } : {}}>
                  {placingOrder ? (
                    <motion.div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  ) : (<><Send size={16} />{selectedTable ? 'Send to Kitchen' : 'Select a Table First'}</>)}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
