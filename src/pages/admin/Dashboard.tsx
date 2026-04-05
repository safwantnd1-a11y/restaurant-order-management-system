import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../../hooks/useSocket';
import {
  LayoutDashboard, Utensils, Users, ShoppingBag, CheckCircle2,
  LogOut, Plus, Trash2, Clock, Search, ChefHat, X, Wifi, Copy, Check,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'stats' | 'menu' | 'staff';

/* ---------- Animated Stat Card ---------- */
function StatCard({ icon, label, value, color, delay = 0 }: any) {
  const colors: Record<string, { bg: string; border: string; iconBg: string }> = {
    orange: { bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.15)',  iconBg: 'rgba(249,115,22,0.15)' },
    blue:   { bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.15)',  iconBg: 'rgba(96,165,250,0.15)' },
    green:  { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.15)',   iconBg: 'rgba(34,197,94,0.15)'  },
    violet: { bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.15)',  iconBg: 'rgba(139,92,246,0.15)' },
    cyan:   { bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.15)',   iconBg: 'rgba(6,182,212,0.15)'  },
  };
  const c = colors[color] || colors.orange;
  return (
    <motion.div
      className="rounded-3xl p-6 cursor-default"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
      initial={{ opacity: 0, y: 30, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 22 }}
      whileHover={{ scale: 1.04, border: `1px solid ${c.border.replace('0.15', '0.4')}`, boxShadow: `0 12px 40px ${c.bg}` }}
    >
      <div className="flex items-start justify-between mb-4">
        <motion.div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: c.iconBg }}
          whileHover={{ rotate: 8, scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 300 }}>
          {icon}
        </motion.div>
      </div>
      <motion.p className="text-3xl font-black text-white mb-1"
        key={value}
        initial={{ scale: 1.3, color: c.iconBg.replace('rgba(', 'rgb(').replace(', 0.15)', ')') }}
        animate={{ scale: 1, color: '#ffffff' }}
        transition={{ type: 'spring', stiffness: 400 }}>
        {value}
      </motion.p>
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const { logout, user } = useAuth();
  const { socket } = useSocket();
  const [stats, setStats] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [newStaffNames, setNewStaffNames] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'waiter' | 'kitchen'>('waiter');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [menuSearch, setMenuSearch] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ name: '', category: 'Main', description: '', preparation_time: '0', is_veg: true });

  useEffect(() => {
    fetchStats(); fetchMenu();
    if (socket) {
      socket.on('stats-update', fetchStats);
      socket.on('menu-updated', fetchMenu);
      socket.on('staff-status-updated', fetchStaff);
    }
    return () => {
      if (socket) {
        socket.off('stats-update', fetchStats);
        socket.off('menu-updated', fetchMenu);
        socket.off('staff-status-updated', fetchStaff);
      }
    };
  }, [socket]);

  useEffect(() => { if (activeTab === 'staff') fetchStaff(); }, [activeTab]);

  const fetchStats = async () => { const r = await axios.get('/api/admin/stats'); setStats(r.data); };
  const fetchMenu  = async () => { const r = await axios.get('/api/menu'); setMenu(r.data); };
  const fetchStaff = async () => { const r = await axios.get('/api/admin/staff'); setStaff(r.data); };

  const handleGenerateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = newStaffNames.split(/\r?\n/).map(n => n.trim()).filter(Boolean);
    if (!names.length) return;
    if (!newStaffPassword) { alert('Please set a password'); return; }
    const res = await axios.post('/api/admin/staff', {
      staff: names.map(name => ({ name, role: newStaffRole, password: newStaffPassword })),
    });
    const creds = res.data;
    alert(`✓ ${creds.length} ${newStaffRole} account(s) created!\n\nCredentials:\n${creds.map((c: any) => `${c.email} : ${newStaffPassword}`).join('\n')}`);
    setNewStaffNames(''); setNewStaffPassword('');
    fetchStaff();
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    await axios.post('/api/menu', {
      ...newItem,
      price: 0,
      half_price: 0,
      preparation_time: parseInt(newItem.preparation_time, 10),
      stock: 999,   // start as available
      is_veg: newItem.is_veg ? 1 : 0,
    });
    setNewItem({ name: '', category: 'Main', description: '', preparation_time: '0', is_veg: true });
    fetchMenu();
  };

  const handleDeleteMenuItem = async (id: number) => {
    setDeletingId(id);
    await axios.delete(`/api/menu/${id}`);
    fetchMenu(); setDeletingId(null);
  };

  const handleToggleStock = async (item: any) => {
    const newOut = !item.out_of_stock;
    await axios.patch(`/api/menu/${item.id}`, { stock: newOut ? 0 : Math.max(Number(item.stock) || 1, 1), out_of_stock: newOut });
    fetchMenu();
  };




  const handleRemoveStaff = async (id: number) => { await axios.delete(`/api/admin/staff/${id}`); fetchStaff(); };

  const copyEmail = async (email: string, id: number) => {
    await navigator.clipboard.writeText(email);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  const [menuVegFilter, setMenuVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');

  const filteredMenu = menu.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      (i.category || '').toLowerCase().includes(menuSearch.toLowerCase());
    const matchVeg = menuVegFilter === 'all' ? true : menuVegFilter === 'veg' ? !!i.is_veg : !i.is_veg;
    return matchSearch && matchVeg;
  });

  const navItems: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'stats', label: 'Dashboard',       icon: <LayoutDashboard size={18} /> },
    { key: 'menu',  label: 'Menu Management', icon: <Utensils size={18} /> },
    { key: 'staff', label: 'Staff',           icon: <Users size={18} /> },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0f', color: 'white' }}>
      {/* ===== SIDEBAR ===== */}
      <motion.aside
        className="w-64 flex-shrink-0 flex flex-col sticky top-0 h-screen"
        style={{ background: '#070710', borderRight: '1px solid rgba(255,255,255,0.05)' }}
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 26 }}
      >
        {/* Logo */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <motion.div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
              animate={{ boxShadow: ['0 4px 12px rgba(249,115,22,0.3)', '0 6px 24px rgba(249,115,22,0.6)', '0 4px 12px rgba(249,115,22,0.3)'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              whileHover={{ rotate: -8, scale: 1.1 }}>
              <ChefHat size={20} className="text-white" />
            </motion.div>
            <div>
              <h1 className="font-black text-white text-base">ROMS Admin</h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Management Panel</p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <AnimatePresence>
          {stats && (
            <motion.div className="mx-4 mb-4 p-4 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Orders', value: stats.totalOrders    || 0, color: '#f97316' },
                  { label: 'Active', value: stats.activeOrders   || 0, color: '#ef4444' },
                  { label: 'Done',   value: stats.completedOrders|| 0, color: '#22c55e' },
                  { label: 'Staff',  value: stats.totalStaff     || 0, color: '#8b5cf6' },
                ].map((s, i) => (
                  <motion.div key={s.label} className="text-center"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}>
                    <motion.p className="text-lg font-black" style={{ color: s.color }}
                      key={s.value} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400 }}>{s.value}</motion.p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item, i) => (
            <motion.button key={item.key} onClick={() => setActiveTab(item.key)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold relative"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.07 }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
              style={activeTab === item.key
                ? { background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.08))', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }
                : { color: 'rgba(255,255,255,0.4)' }}>
              {item.icon}
              {item.label}
              {item.key === 'menu' && (
                <motion.span key={menu.length}
                  initial={{ scale: 1.4 }} animate={{ scale: 1 }}
                  className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                  {menu.length}
                </motion.span>
              )}
            </motion.button>
          ))}
        </nav>

        {/* User */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl mb-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <motion.div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white' }}
              whileHover={{ scale: 1.1 }}>
              {user?.name?.[0]?.toUpperCase()}
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user?.name}</p>
              <div className="flex items-center gap-1">
                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Wifi size={8} style={{ color: '#4ade80' }} />
                </motion.div>
                <p className="text-xs" style={{ color: '#4ade80' }}>Administrator</p>
              </div>
            </div>
          </div>
          <motion.button onClick={logout} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}>
            <LogOut size={16} /> Sign Out
          </motion.button>
        </div>
      </motion.aside>

      {/* ===== MAIN ===== */}
      <main className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">

          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <motion.div key="stats" className="space-y-8 max-w-6xl"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}>
              <div>
                <motion.h2 className="text-3xl font-black text-white"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                  Dashboard Overview
                </motion.h2>
                <motion.p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                  Real-time restaurant performance metrics
                </motion.p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatCard icon={<ShoppingBag size={22} style={{ color: '#60a5fa' }} />} label="Total Orders"  value={stats?.totalOrders    || 0} color="blue"   delay={0} />
                <StatCard icon={<Clock size={22} style={{ color: '#f97316' }} />}         label="Active Orders" value={stats?.activeOrders   || 0} color="orange" delay={0.07} />
                <StatCard icon={<CheckCircle2 size={22} style={{ color: '#22c55e' }} />}  label="Completed"    value={stats?.completedOrders|| 0} color="green"  delay={0.14} />
                <StatCard icon={<Wifi size={22} style={{ color: '#06b6d4' }} />}          label="Active Staff"  value={stats?.activeStaff    || 0} color="cyan"   delay={0.21} />
                <StatCard icon={<Users size={22} style={{ color: '#8b5cf6' }} />}         label="Total Staff"  value={stats?.totalStaff     || 0} color="violet" delay={0.28} />
              </div>

              {/* System Status */}
              <motion.div className="rounded-3xl p-6"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h3 className="text-lg font-bold text-white mb-5">System Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Socket.IO Server', 'Database Engine', 'Real-time Updates', 'Auth Service'].map((label, i) => (
                    <motion.div key={label} className="flex items-center justify-between p-4 rounded-2xl"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                      initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 + i * 0.08 }}
                      whileHover={{ scale: 1.02 }}>
                      <div className="flex items-center gap-3">
                        <div className="relative w-2.5 h-2.5">
                          <div className="absolute inset-0 rounded-full bg-green-500" />
                          <motion.div className="absolute inset-0 rounded-full bg-green-500"
                            animate={{ scale: [1, 2], opacity: [0.6, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }} />
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
                      </div>
                      <motion.span className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.08 }}>
                        ONLINE
                      </motion.span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Mini grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    title: 'Menu Summary', icon: <Utensils size={18} style={{ color: '#f97316' }} />,
                    rows: [
                      { label: 'Total Items',  value: menu.length,                             col: 'white' },
                      { label: '🟢 Veg Items', value: menu.filter(i => i.is_veg).length,       col: '#4ade80' },
                      { label: '🔴 Non-Veg',   value: menu.filter(i => !i.is_veg).length,      col: '#f87171' },
                      { label: 'Out of Stock', value: menu.filter(i => i.out_of_stock).length, col: 'rgba(255,255,255,0.3)' },
                    ],
                  },
                  {
                    title: 'Staff Overview', icon: <Users size={18} style={{ color: '#8b5cf6' }} />,
                    rows: [
                      { label: 'Waiters',        value: staff.filter(s => s.role === 'waiter').length,  col: 'white' },
                      { label: 'Kitchen Staff',  value: staff.filter(s => s.role === 'kitchen').length, col: 'white' },
                      { label: 'Currently Online', value: stats?.activeStaff || 0,                     col: '#4ade80' },
                    ],
                  },
                ].map((card, ci) => (
                  <motion.div key={card.title} className="rounded-3xl p-6"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + ci * 0.1 }}
                    whileHover={{ scale: 1.02 }}>
                    <div className="flex items-center gap-2 mb-4">
                      {card.icon}
                      <h3 className="font-bold text-white">{card.title}</h3>
                    </div>
                    <div className="space-y-3">
                      {card.rows.map(row => (
                        <div key={row.label} className="flex justify-between text-sm">
                          <span style={{ color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                          <motion.span key={row.value} className="font-bold" style={{ color: row.col }}
                            initial={{ scale: 1.2 }} animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400 }}>{row.value}</motion.span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* MENU TAB */}
          {activeTab === 'menu' && (
            <motion.div key="menu" className="space-y-6 max-w-6xl"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}>
              <div>
                <h2 className="text-3xl font-black text-white">Menu Management</h2>
                <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Add, remove, and manage your restaurant menu items</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Add form */}
                <motion.div className="rounded-3xl p-6 h-fit"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                  <h3 className="font-bold text-white mb-5 flex items-center gap-2">
                    <Plus size={18} style={{ color: '#f97316' }} /> Add New Item
                  </h3>
                  <form onSubmit={handleAddMenuItem} className="space-y-4">
                    {[
                      { label: 'Item Name', node: <input type="text" required className="input-dark" placeholder="e.g. Butter Chicken" id="menu-item-name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} /> },
                      { label: 'Category', node: (
                          <select className="input-dark" value={newItem.category} id="menu-item-category" onChange={e => setNewItem({ ...newItem, category: e.target.value })}>
                            {['Starter','Main','Dessert','Drink'].map(c => <option key={c} style={{ background: '#111118' }}>{c}</option>)}
                          </select>
                        ) },
                      { label: 'Description', node: <textarea rows={2} className="input-dark resize-none" placeholder="Brief description..." id="menu-item-description" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} /> },
                      { label: 'Prep Time (min)', node: <input type="number" min="0" id="menu-item-prep-time" className="input-dark" value={newItem.preparation_time} onChange={e => setNewItem({ ...newItem, preparation_time: e.target.value })} /> },
                    ].map((field, i) => (
                      <motion.div key={field.label}
                        initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.07 }}>
                        <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>{field.label}</label>
                        {field.node}
                      </motion.div>
                    ))}


                    {/* Veg / Non-Veg Toggle */}
                    <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.47 }}>
                      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Type</label>
                      <div className="flex gap-2">
                        <motion.button type="button"
                          onClick={() => setNewItem({ ...newItem, is_veg: true })}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border transition-all"
                          style={newItem.is_veg
                            ? { background: 'rgba(34,197,94,0.15)', borderColor: '#22c55e', color: '#4ade80' }
                            : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, border: '1.5px solid #22c55e', borderRadius: 3 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'block' }} />
                          </span>
                          Veg
                        </motion.button>
                        <motion.button type="button"
                          onClick={() => setNewItem({ ...newItem, is_veg: false })}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border transition-all"
                          style={!newItem.is_veg
                            ? { background: 'rgba(239,68,68,0.15)', borderColor: '#ef4444', color: '#f87171' }
                            : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, border: '1.5px solid #ef4444', borderRadius: 3 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'block' }} />
                          </span>
                          Non-Veg
                        </motion.button>
                      </div>
                    </motion.div>

                    <motion.button type="submit" id="menu-item-submit"
                      className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 4px 20px rgba(249,115,22,0.35)' }}
                      whileHover={{ scale: 1.03, boxShadow: '0 8px 30px rgba(249,115,22,0.5)' }}
                      whileTap={{ scale: 0.96 }}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
                      <Plus size={18} /> Add to Menu
                    </motion.button>
                  </form>
                </motion.div>

                {/* Menu List */}
                <motion.div className="lg:col-span-2 rounded-3xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                  <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">{filteredMenu.length} of {menu.length} items</h3>
                      <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
                          ✓ {menu.filter(i => !i.out_of_stock).length} available
                        </span>
                        <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                          ✗ {menu.filter(i => i.out_of_stock).length} unavailable
                        </span>
                      </div>
                    </div>
                    {/* Veg / Non-Veg filter chips */}
                    <div className="flex gap-2 mb-4">
                      {[{ key: 'all', label: 'All Items' }, { key: 'veg', label: '🟢 Veg Only' }, { key: 'nonveg', label: '🔴 Non-Veg Only' }].map(f => (
                        <motion.button key={f.key} onClick={() => setMenuVegFilter(f.key as any)}
                          whileTap={{ scale: 0.94 }}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                          style={menuVegFilter === f.key
                            ? { background: 'rgba(249,115,22,0.18)', color: '#f97316', border: '1px solid rgba(249,115,22,0.4)' }
                            : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          {f.label}
                        </motion.button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Search size={15} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <input type="text" id="menu-search" placeholder="Search by name or category..."
                        value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'white' }} />
                      <AnimatePresence>
                        {menuSearch && <motion.button onClick={() => setMenuSearch('')} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><X size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /></motion.button>}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
                    <table className="w-full">
                      <thead className="sticky top-0" style={{ background: 'rgba(7,7,16,0.9)', backdropFilter: 'blur(10px)' }}>
                        <tr>
                          {['Item','Type','Category','Prep','Status',''].map(h => (
                            <th key={h} className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-widest"
                              style={{ color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence>
                          {filteredMenu.map((item, idx) => (
                            <motion.tr key={item.id} layout
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ delay: idx * 0.03 }}
                              className="transition-colors"
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                              whileHover={{ background: 'rgba(249,115,22,0.04)' }}>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  {/* Indian food indicator dot */}
                                  <span title={item.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      flexShrink: 0, width: 16, height: 16,
                                      border: `1.5px solid ${item.is_veg ? '#22c55e' : '#ef4444'}`,
                                      borderRadius: 3 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%',
                                      background: item.is_veg ? '#22c55e' : '#ef4444', display: 'block' }} />
                                  </span>
                                  <div>
                                    <p className="font-semibold text-sm text-white">{item.name}</p>
                                    {item.description && <p className="text-xs mt-0.5 truncate max-w-[160px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.description}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full`}
                                  style={item.is_veg
                                    ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                                    : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                                  {item.is_veg ? 'Veg' : 'Non-Veg'}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                                  {item.category}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                <Clock size={12} className="inline mr-1 opacity-50" />{item.preparation_time}m
                              </td>
                              <td className="px-5 py-4">
                                <motion.span className="text-xs font-bold px-2.5 py-1 rounded-full" key={String(item.out_of_stock)}
                                  initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                                  style={item.out_of_stock
                                    ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                                    : { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                                  {item.out_of_stock ? 'Out of Stock' : 'Available'}
                                </motion.span>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2 justify-end">
                                  <motion.button onClick={() => handleToggleStock(item)} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                                    className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                    {item.out_of_stock
                                      ? <ToggleRight size={16} style={{ color: '#4ade80' }} />
                                      : <ToggleLeft size={16} style={{ color: '#f87171' }} />}
                                  </motion.button>
                                  <motion.button onClick={() => handleDeleteMenuItem(item.id)} disabled={deletingId === item.id}
                                    whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.88 }}
                                    className="p-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
                                    {deletingId === item.id
                                      ? <motion.div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                                          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
                                      : <Trash2 size={15} />}
                                  </motion.button>
                                </div>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}



          {/* STAFF TAB */}
          {activeTab === 'staff' && (
            <motion.div key="staff" className="space-y-6 max-w-5xl"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}>
              <div>
                <h2 className="text-3xl font-black text-white">Staff Management</h2>
                <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Create and manage waiter & kitchen accounts</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Generate Form */}
                <motion.div className="lg:col-span-2 rounded-3xl p-6 h-fit"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                  <h3 className="font-bold text-white mb-5 flex items-center gap-2">
                    <Users size={18} style={{ color: '#8b5cf6' }} /> Generate Accounts
                  </h3>
                  <form onSubmit={handleGenerateStaff} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Role</label>
                      <div className="flex gap-2">
                        {(['waiter','kitchen'] as const).map(role => (
                          <motion.button key={role} type="button" onClick={() => setNewStaffRole(role)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize"
                            style={newStaffRole === role
                              ? { background: role === 'waiter' ? 'linear-gradient(135deg,#06b6d4,#0284c7)' : 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: 'white' }
                              : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
                            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
                            {role}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Staff Names</label>
                      <textarea rows={5} className="input-dark resize-none" id="staff-names"
                        placeholder={`One name per line:\nJohn Doe\nJane Smith`}
                        value={newStaffNames} onChange={e => setNewStaffNames(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Password</label>
                      <input type="password" required className="input-dark" id="staff-password"
                        placeholder="Shared password for all accounts"
                        value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} />
                    </div>
                    <motion.button type="submit" id="staff-generate-submit"
                      className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', boxShadow: '0 4px 20px rgba(139,92,246,0.35)' }}
                      whileHover={{ scale: 1.03, boxShadow: '0 8px 30px rgba(139,92,246,0.5)' }}
                      whileTap={{ scale: 0.96 }}>
                      <Plus size={16} /> Generate Credentials
                    </motion.button>
                  </form>
                </motion.div>

                {/* Staff List */}
                <div className="lg:col-span-3 space-y-3">
                  <motion.div className="flex items-center justify-between"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                    <h3 className="font-bold text-white">Current Staff ({staff.length})</h3>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>
                        {staff.filter(s => s.role === 'waiter').length} waiters
                      </span>
                      <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>
                        {staff.filter(s => s.role === 'kitchen').length} kitchen
                      </span>
                    </div>
                  </motion.div>

                  {staff.length === 0 ? (
                    <motion.div className="rounded-3xl p-12 text-center"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>
                        <Users size={40} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
                      </motion.div>
                      <p style={{ color: 'rgba(255,255,255,0.25)' }}>No staff accounts yet</p>
                    </motion.div>
                  ) : (
                    <motion.div className="space-y-3"
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
                      initial="hidden" animate="show">
                      <AnimatePresence>
                        {staff.map(member => (
                          <motion.div key={member.id} layout
                            className="rounded-3xl p-5"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                            exit={{ opacity: 0, x: 30, height: 0, marginBottom: 0 }}
                            whileHover={{ scale: 1.015, borderColor: 'rgba(255,255,255,0.1)' }}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <motion.div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0"
                                  style={member.role === 'waiter' ? { background: 'rgba(6,182,212,0.15)', color: '#06b6d4' } : { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}
                                  whileHover={{ scale: 1.1, rotate: 5 }}>
                                  {member.name[0]?.toUpperCase()}
                                </motion.div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-white truncate">{member.name}</p>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 capitalize"
                                      style={member.role === 'waiter' ? { background: 'rgba(6,182,212,0.12)', color: '#06b6d4' } : { background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>
                                      {member.role}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{member.email}</p>
                                    <motion.button onClick={() => copyEmail(member.email, member.id)} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }}>
                                      <AnimatePresence mode="wait">
                                        {copiedId === member.id
                                          ? <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={12} style={{ color: '#4ade80' }} /></motion.div>
                                          : <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy size={12} style={{ color: 'rgba(255,255,255,0.2)' }} /></motion.div>}
                                      </AnimatePresence>
                                    </motion.button>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <motion.span className="text-xs font-bold px-2.5 py-1 rounded-full key"
                                  key={String(member.active)}
                                  initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                                  style={member.active
                                    ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
                                  {member.active ? '● Online' : '○ Offline'}
                                </motion.span>
                                <motion.button onClick={() => handleRemoveStaff(member.id)}
                                  className="p-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
                                  whileHover={{ scale: 1.15, background: 'rgba(239,68,68,0.2)' }} whileTap={{ scale: 0.88 }}>
                                  <X size={15} />
                                </motion.button>
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-4 gap-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                              {[
                                { label: 'Logins',        value: member.login_count    || 0 },
                                { label: 'Active',        value: member.activeOrders   || 0 },
                                { label: 'Completed',     value: member.completedOrders|| 0 },
                                { label: 'Last Login',    value: member.last_login ? new Date(member.last_login).toLocaleDateString() : 'Never' },
                              ].map(stat => (
                                <div key={stat.label} className="text-center">
                                  <motion.p key={stat.value} className="font-bold text-sm text-white"
                                    initial={{ scale: 1.2 }} animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 400 }}>{stat.value}</motion.p>
                                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{stat.label}</p>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
