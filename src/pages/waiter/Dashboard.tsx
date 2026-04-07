import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../../hooks/useSocket';
import { Plus, ShoppingCart, CheckCircle, Clock, LogOut, Search, Minus, X, Send, Utensils, ClipboardList, ChefHat, Wifi, DollarSign, Receipt } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  new:      { label: 'New Order', className: 'badge-new',      dot: '#ef4444' },
  preparing:{ label: 'Preparing', className: 'badge-preparing', dot: '#eab308' },
  ready:    { label: 'Ready!',    className: 'badge-ready',    dot: '#22c55e' },
  served:   { label: 'Served',   className: 'badge-served',   dot: '#6366f1' },
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchData();
    if (socket) {
      socket.on('new-order', fetchData);
      socket.on('order-status-updated', fetchData);
      socket.on('menu-updated', fetchData);
      socket.on('stats-update', fetchData);
    }
    return () => {
      if (socket) {
        socket.off('new-order', fetchData);
        socket.off('order-status-updated', fetchData);
        socket.off('menu-updated', fetchData);
        socket.off('stats-update', fetchData);
      }
    };
  }, [socket]);

  const fetchData = async () => {
    try {
      const [menuRes, tablesRes, ordersRes, historyRes] = await Promise.all([
        axios.get('/api/menu'),
        axios.get('/api/tables'),
        axios.get('/api/orders'),
        axios.get('/api/orders?history=true')
      ]);
      setMenu(menuRes.data);
      setTables(tablesRes.data);
      setOrders(ordersRes.data);
      setHistoryOrders(historyRes.data);
    } catch (err) {
      console.error('fetchData error', err);
    }
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
        total_price: 0,
      });
      setCart([]);
      setSelectedTable(null);
      setCartOpen(false);
      setView('orders');
      fetchData();
    } catch {
      alert('Failed to place order');
    } finally {
      setPlacingOrder(false);
    }
  };

  const markAsServed = async (orderId: number) => {
    await axios.put(`/api/orders/${orderId}/status`, { status: 'served' });
    fetchData();
  };

  const undoOrder = async (orderIds: number | number[]) => {
    if(window.confirm('Are you sure you want to move the order(s) back to ready?')) {
      const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
      await Promise.all(ids.map(id => axios.put(`/api/orders/${id}/status`, { status: 'ready' })));
      fetchData();
      setView('orders');
    }
  };

  const deleteOrder = async (orderIds: number | number[]) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
        await Promise.all(ids.map(id => axios.delete(`/api/orders/${id}`)));
        fetchData();
      } catch (err: any) {
        alert('Failed to delete order(s): ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const requestBill = async (tableId: number) => {
    if (window.confirm('Request bill for this table? This will notify the admin.')) {
      try {
         await axios.put(`/api/tables/${tableId}/request-bill`);
         alert('Bill requested successfully!');
         fetchData();
      } catch (err) {
         alert('Failed to request bill.');
      }
    }
  };


  const FIXED_CATEGORIES = ['All', 'Main', 'Starter', 'Drink', 'Chinese'];
  const cartTotal = cart.reduce((sum, i) => sum + i.quantity, 0);

  const filteredMenu = menu.filter(item => {
    const catMatch  = activeCategory === 'All' || item.category === activeCategory;
    const srchMatch = item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                      (item.category || '').toLowerCase().includes(menuSearch.toLowerCase());
    const vegMatch  = vegFilter === 'all' ? true : vegFilter === 'veg' ? !!item.is_veg : !item.is_veg;
    return catMatch && srchMatch && vegMatch;
  });

  // Group filtered items by category for section display
  const groupedMenu = FIXED_CATEGORIES.slice(1).reduce((acc, cat) => {
    const items = filteredMenu.filter(i => i.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, any[]>);

  // Items that don't belong to any of the 4 fixed categories
  const otherItems = filteredMenu.filter(i => !FIXED_CATEGORIES.slice(1).includes(i.category));
  if (otherItems.length > 0) groupedMenu['Other'] = otherItems;

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
            { key: 'orders', label: 'Active',  icon: <ClipboardList size={14} />, badge: orders.length },
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
                {tables.map(t => {
                  const num = t.table_number.split(' ')[1] || t.table_number;
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
                    ✓ {tables.find(t => t.id === selectedTable)?.table_number} selected
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

            {/* Category Tabs — fixed 4 categories */}
            <motion.div className="flex gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
              {[
                { key: 'All',     label: 'All Items', icon: '🍽️' },
                { key: 'Main',    label: 'Main',      icon: '🍛' },
                { key: 'Starter', label: 'Starter',   icon: '🥗' },
                { key: 'Drink',   label: 'Drink',     icon: '🥤' },
                { key: 'Chinese', label: 'Chinese',   icon: '🍜' },
              ].map((cat, i) => (
                <motion.button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold"
                  style={activeCategory === cat.key
                    ? { background: 'linear-gradient(135deg,#f97316,#ea580c)', color: 'white', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 + i * 0.05 }}>
                  <span>{cat.icon}</span>
                  {cat.label}
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

            {/* Menu Items — grouped by category */}
            {filteredMenu.length === 0 ? (
              <motion.div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Utensils size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No items found</p>
              </motion.div>
            ) : (
              <div className="space-y-6">
                {Object.entries(activeCategory === 'All' ? groupedMenu : { [activeCategory]: filteredMenu }).map(([catName, items]) => (
                  <motion.div key={catName} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    {/* Category Section Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-lg">
                        {catName === 'Main' ? '🍛' : catName === 'Starter' ? '🥗' : catName === 'Drink' ? '🥤' : catName === 'Chinese' ? '🍜' : '🍽️'}
                      </span>
                      <h3 className="font-black text-white text-base tracking-wide">{catName}</h3>
                      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                        {(items as any[]).length} items
                      </span>
                    </div>

                    {catName === 'Drink' ? (() => {
                      const subGroups: Record<string, any[]> = {};
                      (items as any[]).forEach((item: any) => {
                        const sub = (item.sub_category || '').trim();
                        if (!subGroups[sub]) subGroups[sub] = [];
                        subGroups[sub].push(item);
                      });
                      return (
                        <div className="space-y-4">
                          {Object.entries(subGroups).map(([sub, subItems]) => (
                            <div key={sub || '__default__'}>
                              {sub !== '' && (
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                                    style={{ background: 'rgba(56,189,248,0.1)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.2)' }}>
                                    💧 {sub}
                                  </span>
                                  <div className="flex-1 h-px" style={{ background: 'rgba(56,189,248,0.08)' }} />
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                {subItems.map((item: any) => {
                                  const hasHalf = Number(item.half_price) > 0;
                                  return (
                                    <motion.div key={item.id}
                                      className="rounded-2xl p-3 flex flex-col gap-2"
                                      style={{ background: item.out_of_stock ? 'rgba(255,255,255,0.02)' : 'rgba(56,189,248,0.04)', border: `1px solid ${item.out_of_stock ? 'rgba(255,255,255,0.04)' : 'rgba(56,189,248,0.12)'}`, opacity: item.out_of_stock ? 0.55 : 1 }}
                                      whileHover={!item.out_of_stock ? { scale: 1.02, borderColor: 'rgba(56,189,248,0.35)' } : {}}
                                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
                                      <div className="flex items-start gap-1.5">
                                        <span style={{ marginTop: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 13, height: 13, border: '1.5px solid #38bdf8', borderRadius: 2 }}>
                                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', display: 'block' }} />
                                        </span>
                                        <p className="font-semibold text-white text-sm leading-tight flex-1">{item.name}</p>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {Number(item.price) > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(56,189,248,0.1)', color: '#7dd3fc' }}>500ml ₹{item.price}</span>}
                                        {hasHalf && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(56,189,248,0.06)', color: '#93c5fd' }}>250ml ₹{item.half_price}</span>}
                                        {item.out_of_stock && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>Out of Stock</span>}
                                      </div>
                                      {!item.out_of_stock && (
                                        <div className="flex items-center gap-2 mt-auto">
                                          {hasHalf ? (
                                            <select className="flex-1 text-[11px] font-bold py-1.5 px-2 rounded-xl outline-none cursor-pointer"
                                              style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#7dd3fc' }}
                                              value={selectedPortions[item.id] || 'full'}
                                              onChange={e => setSelectedPortions({ ...selectedPortions, [item.id]: e.target.value })}>
                                              <option value="full">500 ml</option>
                                              <option value="half">250 ml</option>
                                            </select>
                                          ) : (
                                            <span className="flex-1 text-[10px] text-center font-bold py-1 rounded-xl" style={{ background: 'rgba(56,189,248,0.08)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.15)' }}>500 ml</span>
                                          )}
                                          <motion.button onClick={() => addToCart(item, (selectedPortions[item.id] || 'full').toLowerCase())}
                                            whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.08 }}
                                            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                                            style={{ background: 'rgba(56,189,248,0.15)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)' }}>
                                            <Plus size={15} />
                                          </motion.button>
                                        </div>
                                      )}
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })() : (
                      <div className="grid grid-cols-2 gap-3">
                        {(items as any[]).map((item: any) => {
                          const hasHalf = Number(item.half_price) > 0;
                          const isLiquid = item.item_type === 'liquid';
                          const dotColor = isLiquid ? '#38bdf8' : item.is_veg ? '#22c55e' : '#ef4444';
                          return (
                            <motion.div key={item.id}
                              className="rounded-2xl p-3 flex flex-col gap-2"
                              style={{ background: item.out_of_stock ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)', border: `1px solid ${item.out_of_stock ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'}`, opacity: item.out_of_stock ? 0.55 : 1 }}
                              whileHover={!item.out_of_stock ? { scale: 1.02, borderColor: 'rgba(249,115,22,0.3)' } : {}}
                              transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
                              <div className="flex items-start gap-1.5">
                                <span style={{ marginTop: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 13, height: 13, border: `1.5px solid ${dotColor}`, borderRadius: 2 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'block' }} />
                                </span>
                                <p className="font-semibold text-white text-sm leading-tight flex-1">{item.name}</p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {Number(item.price) > 0 && <span className="text-xs font-black" style={{ color: '#f97316' }}>₹{item.price}</span>}
                                {hasHalf && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(249,115,22,0.1)', color: '#fb923c' }}>½ ₹{item.half_price}</span>}
                                {item.out_of_stock && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>Out of Stock</span>}
                              </div>
                              {!item.out_of_stock && (
                                <div className="flex items-center gap-2 mt-auto">
                                  {hasHalf ? (
                                    <select className="flex-1 text-[11px] font-bold py-1.5 px-2 rounded-xl outline-none cursor-pointer"
                                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                                      value={selectedPortions[item.id] || 'full'}
                                      onChange={e => setSelectedPortions({ ...selectedPortions, [item.id]: e.target.value })}>
                                      <option value="full">Full</option>
                                      <option value="half">Half</option>
                                    </select>
                                  ) : (
                                    <span className="flex-1 text-[10px] text-center font-bold py-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)' }}>Full</span>
                                  )}
                                  <motion.button onClick={() => addToCart(item, (selectedPortions[item.id] || 'full').toLowerCase())}
                                    whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.08 }}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                                    style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316', border: '1px solid rgba(249,115,22,0.35)' }}>
                                    <Plus size={15} />
                                  </motion.button>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ===== ORDERS VIEW ===== */}
        {view === 'orders' && (
          <motion.div key="orders" className="px-4 pb-8 space-y-3 pt-4"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}>
            {orders.length === 0 ? (
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
                {(() => {
                  const activeByTable: Record<number, any> = {};
                  orders.forEach(order => {
                      if (!activeByTable[order.table_id]) {
                         activeByTable[order.table_id] = { ...order, orders: [] };
                      }
                      activeByTable[order.table_id].orders.push({ 
                        id: order.id, 
                        status: order.status, 
                        created_at: order.created_at,
                        items: order.items 
                      });
                  });
                  return Object.values(activeByTable).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                })().map((tableGroup: any) => (
                  <motion.div key={'grp_' + tableGroup.table_id} variants={itemVariants}
                    className="rounded-3xl overflow-hidden mb-4"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    layout whileHover={{ scale: 1.01 }}>
                    <div className="px-4 pt-4 pb-3 flex items-start justify-between"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-white text-lg">Table {tableGroup.table_number.split(' ')[1] || tableGroup.table_number}</h3>
                        </div>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {tableGroup.orders.length} active Ticket(s)
                        </p>
                      </div>
                        <div className="flex flex-col items-end gap-1">
                           <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase whitespace-nowrap">
                              Active
                           </span>
                           {(() => {
                              const tableInfo = tables.find(t => t.id === tableGroup.table_id);
                              if (tableInfo?.bill_requested) {
                                return (
                                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-500/20 text-green-400 uppercase tracking-widest mt-1">
                                    Bill Requested
                                  </span>
                                );
                              } else {
                                return (
                                  <button onClick={() => requestBill(tableGroup.table_id)} 
                                    className="text-[10px] font-bold px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 uppercase tracking-widest mt-1 border border-blue-500/20 transition-colors">
                                    Request Bill
                                  </button>
                                );
                              }
                           })()}
                        </div>
                    </div>
                    <div className="px-4 py-3 space-y-4">
                      {tableGroup.orders.map((subOrder: any) => {
                        const statusCfg = STATUS_CONFIG[subOrder.status] || STATUS_CONFIG['new'];
                        return (
                          <div key={subOrder.id} className="p-3 rounded-2xl bg-white/5 border border-white/5">
                             <div className="flex justify-between items-center mb-2 pb-1 border-b border-white/5">
                                <span className="text-[10px] font-bold opacity-40"># {subOrder.id} • {new Date(subOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${statusCfg.className}`}>
                                   {statusCfg.label}
                                </span>
                             </div>
                             <ul className="space-y-1.5">
                               {subOrder.items.map((item: any, idx: number) => (
                                 <li key={idx} className="flex items-center gap-2 text-sm">
                                   <span className="font-bold text-xs text-orange-500">{item.quantity}×</span>
                                   <span style={{ color: 'rgba(255,255,255,0.75)' }}>{item.item_name}</span>
                                   {item.portion && item.portion !== 'full' && <span className="text-[9px] opacity-40 capitalize">({item.portion})</span>}
                                 </li>
                               ))}
                             </ul>
                             <div className="mt-3 flex gap-2">
                                {subOrder.status === 'ready' && (
                                  <button onClick={() => markAsServed(subOrder.id)} className="flex-1 py-1.5 rounded-lg bg-green-500 text-white text-[10px] font-bold">SERVE</button>
                                )}
                                {subOrder.status === 'served' && (
                                  <button onClick={() => undoOrder(subOrder.id)} className="flex-1 py-1.5 rounded-lg bg-white/10 text-white text-[10px] font-bold">UNDO</button>
                                )}
                                <button onClick={() => deleteOrder(subOrder.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"><X size={12}/></button>
                             </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="px-4 pb-3">
                      <motion.button onClick={() => { setSelectedTable(tableGroup.table_id); setView('menu'); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                        className="w-full py-2.5 flex items-center justify-center gap-1.5 font-bold text-xs mt-1"
                        style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px dashed rgba(249,115,22,0.3)', borderRadius: '12px' }}
                        whileHover={{ background: 'rgba(249,115,22,0.15)' }}
                        whileTap={{ scale: 0.98 }}>
                        <Plus size={14} /> Add Items to Table
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== HISTORY VIEW ===== */}
      <AnimatePresence>
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
                      className="rounded-3xl overflow-hidden relative"
                      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
                      layout>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-bl-[100px] pointer-events-none" />
                      <div className="px-5 pt-5 pb-3 flex items-start justify-between"
                        style={{ borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-white text-lg">Table {order.table_number.split(' ')[1]}</h3>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                              #{order.id}
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            <Clock size={12} className="inline mr-1 opacity-60 relative -top-[1px]" />
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs mt-1 font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            Waiter: <span className="text-white opacity-70">{order.waiter_name}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider mt-1 inline-block ${statusCfg.className}`} style={{ opacity: 0.8 }}>
                            {statusCfg.label}
                          </span>
                        </div>
                      </div>
                      <div className="px-5 py-4 bg-black bg-opacity-20">
                        <ul className="space-y-2">
                          {order.items.map((item: any, idx: number) => {
                            return (
                              <li key={idx} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 opacity-80">
                                  <span className="font-bold text-xs" style={{ color: '#f97316' }}>{item.quantity}×</span>
                                  {item.portion && (
                                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-white border-opacity-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                      {item.portion === 'half' ? '½ Half' : '⚪ Full'}
                                    </span>
                                  )}
                                  <span className="text-white">{item.item_name}</span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div className="px-5 py-3 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                        <div className="flex-1 py-3 rounded-xl text-xs font-bold text-center"
                          style={{ background: 'rgba(99,102,241,0.08)', color: 'rgba(99,102,241,0.6)', border: '1px solid rgba(99,102,241,0.15)' }}>
                          ✓ Paid & Cleared
                        </div>
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
                        {tables.find(t => t.id === selectedTable)?.table_number}
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
