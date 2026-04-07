import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../../hooks/useSocket';
import {
  LayoutDashboard, Utensils, Users, ShoppingBag, CheckCircle2,
  LogOut, Plus, Trash2, Clock, Search, ChefHat, X, Wifi, Copy, Check,
  ToggleLeft, ToggleRight, DollarSign, Receipt, Table as TableIcon, Printer,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'stats' | 'menu' | 'staff' | 'billing' | 'tables';

/* ---------- Animated Stat Card ---------- */
function StatCard({ icon, label, value, color, delay = 0, onClick }: any) {
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
      onClick={onClick}
      className={`rounded-3xl p-6 ${onClick ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}`}
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
  const [newStaffRole, setNewStaffRole] = useState<'waiter' | 'kitchen' | 'biller'>('waiter');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [menuSearch, setMenuSearch] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ name: '', category: 'Main', sub_category: '', description: '', preparation_time: '0', is_veg: true, item_type: 'veg', price: '', half_price: '' });
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [billingTable, setBillingTable] = useState<any>(null);
  const [billDetails, setBillDetails] = useState<any>(null);
  const [statModal, setStatModal] = useState<'totalOrders' | 'activeOrders' | 'completedOrders' | 'activeStaff' | 'totalStaff' | null>(null);
  const [newTableNum, setNewTableNum] = useState('');
  const [tableAssignMap, setTableAssignMap] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchStats(); fetchMenu(); fetchActiveOrders(); fetchTables();
    if (socket) {
      socket.on('stats-update', fetchStats);
      socket.on('menu-updated', fetchMenu);
      socket.on('staff-status-updated', fetchStaff);
      socket.on('new-order', () => { fetchActiveOrders(); fetchTables(); });
      socket.on('order-status-updated', () => { fetchActiveOrders(); fetchTables(); });
    }
    return () => {
      if (socket) {
        socket.off('stats-update', fetchStats);
        socket.off('menu-updated', fetchMenu);
        socket.off('staff-status-updated', fetchStaff);
        socket.off('new-order');
        socket.off('order-status-updated');
      }
    };
  }, [socket]);

  useEffect(() => { if (activeTab === 'staff') fetchStaff(); }, [activeTab]);

  const fetchStats = async () => { const r = await axios.get('/api/admin/stats'); setStats(r.data); };
  const fetchMenu  = async () => { const r = await axios.get('/api/menu'); setMenu(r.data); };
  const fetchStaff = async () => { const r = await axios.get('/api/admin/staff'); setStaff(r.data); };
  const fetchActiveOrders = async () => { const r = await axios.get('/api/orders'); setActiveOrders(r.data); };
  const fetchTables = async () => { const r = await axios.get('/api/tables'); setTables(r.data); };

  const loadBill = async (table: any) => {
    setBillingTable(table);
    const res = await axios.get(`/api/tables/${table.id}/bill`);
    setBillDetails(res.data);
  };

  const markAsPaid = async (tableId: number) => {
    if(window.confirm('Mark this table as PAID and clear its orders?')) {
      await axios.post(`/api/tables/${tableId}/pay`);
      fetchStats(); fetchActiveOrders(); fetchTables();
      setBillingTable(null);
      setBillDetails(null);
    }
  };

  const handlePrint = () => {
    if (!billDetails || !billingTable) return;
    const gstRate = 0.05; // 5% GST
    const totalWithoutGst = billDetails.total;
    const gstAmount = totalWithoutGst * gstRate;
    const grandTotal = totalWithoutGst + gstAmount;

    const printContents = `
      <div style="font-family: monospace; width: 300px; padding: 20px; color: black; background: white;">
        <h2 style="text-align: center; margin-bottom: 5px;">RESTAURANT GST BILL</h2>
        <p style="text-align: center; margin: 0; font-size: 12px;">GSTIN: 29ABCDE1234F1Z5</p>
        <p style="text-align: center; margin: 0; font-size: 12px;">Table: ${billingTable.table_number.split(' ')[1] || billingTable.table_number}</p>
        <hr style="border-top: 1px dashed black; margin: 10px 0;" />
        <table style="width: 100%; font-size: 12px; text-align: left;">
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: right;">Qty</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${billDetails.items.map((item: any) => {
              const price = item.portion === 'half' && item.half_price ? item.half_price : item.price;
              return `<tr>
                  <td>${item.item_name} ${item.portion === 'half' ? '(½)' : ''}</td>
                  <td style="text-align: right;">${item.quantity}</td>
                  <td style="text-align: right;">$${(price * item.quantity).toFixed(2)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
        <hr style="border-top: 1px dashed black; margin: 10px 0;" />
        <div style="font-size: 12px; display: flex; justify-content: space-between;">
           <span>Subtotal:</span>
           <span>$\${totalWithoutGst.toFixed(2)}</span>
        </div>
        <div style="font-size: 12px; display: flex; justify-content: space-between;">
           <span>CGST (2.5%):</span>
           <span>$\${(gstAmount/2).toFixed(2)}</span>
        </div>
        <div style="font-size: 12px; display: flex; justify-content: space-between;">
           <span>SGST (2.5%):</span>
           <span>$\${(gstAmount/2).toFixed(2)}</span>
        </div>
        <hr style="border-top: 1px dashed black; margin: 10px 0;" />
        <div style="font-size: 16px; font-weight: bold; display: flex; justify-content: space-between;">
           <span>Grand Total:</span>
           <span>$\${grandTotal.toFixed(2)}</span>
        </div>
        <p style="text-align: center; font-size: 12px; margin-top: 20px;">Thank you for dining with us!</p>
      </div>
    `;

    const printWindow = window.open('', '', 'height=600,width=400');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Bill</title></head><body style="margin:0;display:flex;justify-content:center;">');
      printWindow.document.write(printContents);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

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
    if (!newItem.price || Number(newItem.price) <= 0) { alert('Please enter a valid price'); return; }
    await axios.post('/api/menu', {
      ...newItem,
      price: Number(newItem.price),
      half_price: newItem.half_price ? Number(newItem.half_price) : 0,
      preparation_time: parseInt(newItem.preparation_time, 10),
      stock: 999,
      is_veg: newItem.item_type === 'veg' ? 1 : 0,
      item_type: newItem.item_type,
      sub_category: newItem.category === 'Drink' ? newItem.sub_category.trim() : '',
    });
    setNewItem({ name: '', category: 'Main', sub_category: '', description: '', preparation_time: '0', is_veg: true, item_type: 'veg', price: '', half_price: '' });
    fetchMenu();
  };

  const handleDeleteMenuItem = async (id: number) => {
    if (!window.confirm('Delete this menu item?')) return;
    try {
      setDeletingId(id);
      await axios.delete(`/api/menu/${id}`);
      fetchMenu();
    } catch (err: any) {
      alert('Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStock = async (item: any) => {
    try {
      const newOut = !item.out_of_stock;
      await axios.patch(`/api/menu/${item.id}`, { stock: newOut ? 0 : Math.max(Number(item.stock) || 1, 1), out_of_stock: newOut });
      fetchMenu();
    } catch (err: any) {
      alert('Failed to update stock');
    }
  };




  const handleRemoveStaff = async (id: number) => {
    if (window.confirm('Remove this staff member?')) {
      try {
        await axios.delete(`/api/admin/staff/${id}`);
        fetchStaff();
      } catch (err: any) {
        alert('Failed to remove staff member');
      }
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;
    try {
      await axios.post('/api/tables', { table_number: newTableNum });
      setNewTableNum('');
      fetchTables();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add table');
    }
  };

  const handleRemoveTable = async (id: number) => {
    if(window.confirm('Delete this table?')) {
      try {
        await axios.delete(`/api/tables/${id}`);
        fetchTables();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to delete table');
      }
    }
  };

  const handleAssignWaiter = async (tableId: number, waiterId: number | '') => {
    try {
      await axios.put(`/api/tables/${tableId}/assign`, { waiter_id: waiterId === '' ? null : Number(waiterId) });
      fetchTables();
    } catch (err) {
      alert('Failed to assign waiter');
    }
  };

  const copyEmail = async (email: string, id: number) => {
    await navigator.clipboard.writeText(email);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  const [menuVegFilter, setMenuVegFilter] = useState<'all' | 'veg' | 'nonveg' | 'liquid'>('all');

  const filteredMenu = menu.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      (i.category || '').toLowerCase().includes(menuSearch.toLowerCase());
    const matchVeg = menuVegFilter === 'all' ? true : 
                     menuVegFilter === 'veg' ? i.item_type === 'veg' || (i.is_veg && i.item_type !== 'nonveg' && i.item_type !== 'liquid') : 
                     menuVegFilter === 'nonveg' ? i.item_type === 'nonveg' || (!i.is_veg && i.item_type !== 'liquid') : 
                     i.item_type === 'liquid';
    return matchSearch && matchVeg;
  });

  const navItems: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'stats', label: 'Dashboard',       icon: <LayoutDashboard size={18} /> },
    { key: 'menu',  label: 'Menu Management', icon: <Utensils size={18} /> },
    { key: 'staff', label: 'Staff',           icon: <Users size={18} /> },
    { key: 'tables',label: 'Tables',          icon: <TableIcon size={18} /> },
    { key: 'billing', label: 'Billing Requests', icon: <Receipt size={18} />, badge: tables.filter(t => t.bill_requested).length },
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
              {item.key === 'billing' && item.badge ? (
                <motion.span key={item.badge}
                  initial={{ scale: 1.4 }} animate={{ scale: 1 }}
                  className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#ef4444', color: 'white' }}>
                  {item.badge}
                </motion.span>
              ) : null}
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
                <StatCard icon={<ShoppingBag size={22} style={{ color: '#60a5fa' }} />} label="Total Orders"  value={stats?.totalOrders    || 0} color="blue"   delay={0} onClick={() => setStatModal('totalOrders')} />
                <StatCard icon={<Clock size={22} style={{ color: '#f97316' }} />}       label="Active Orders" value={stats?.activeOrders   || 0} color="orange" delay={0.07} onClick={() => setStatModal('activeOrders')} />
                <StatCard icon={<CheckCircle2 size={22} style={{ color: '#22c55e' }} />}label="Completed"    value={stats?.completedOrders|| 0} color="green"  delay={0.14} onClick={() => setStatModal('completedOrders')} />
                <StatCard icon={<Wifi size={22} style={{ color: '#06b6d4' }} />}        label="Active Staff"  value={stats?.activeStaff    || 0} color="cyan"   delay={0.21} onClick={() => setStatModal('activeStaff')} />
                <StatCard icon={<Users size={22} style={{ color: '#8b5cf6' }} />}       label="Total Staff"  value={stats?.totalStaff     || 0} color="violet" delay={0.28} onClick={() => setStatModal('totalStaff')} />
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

              {/* Live Orders Grid (Admin View) */}
              <motion.div className="rounded-3xl p-6"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                       <ShoppingBag size={20} style={{ color: '#f97316' }} /> Live Order Monitor
                    </h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-white/5 text-white/40">{activeOrders.filter(o => o.status !== 'served').length} Pending</span>
                 </div>
                 
                 {activeOrders.filter(o => o.status !== 'served').length === 0 ? (
                   <p className="text-center py-10 text-white/20 font-medium">No live preparation underway</p>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeOrders.filter(o => o.status !== 'served').map(order => (
                        <div key={order.id} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                           <div className="flex justify-between items-start mb-3">
                              <div>
                                 <p className="text-[10px] font-bold text-white/40 mb-1">TABLE {order.table_number.split(' ')[1] || order.table_number}</p>
                                 <p className="text-sm font-black text-white">Order #{order.id}</p>
                              </div>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                order.status === 'new' ? 'bg-red-500/20 text-red-400' :
                                order.status === 'preparing' ? 'bg-yellow-500/20 text-yellow-500' : 
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {order.status}
                              </span>
                           </div>
                           <ul className="space-y-1 mb-3">
                              {order.items.slice(0, 3).map((it: any, i: number) => (
                                <li key={i} className="text-xs text-white/60 truncate">
                                   {it.quantity}× {it.item_name}
                                </li>
                              ))}
                              {order.items.length > 3 && <li className="text-[10px] text-white/30">+ {order.items.length - 3} more items</li>}
                           </ul>
                           <div className="flex justify-between items-center pt-2 border-t border-white/5">
                              <span className="text-[10px] text-white/20">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="text-[10px] font-bold text-white/40 italic">By {order.waiter_name}</span>
                           </div>
                        </div>
                      ))}
                   </div>
                 )}
              </motion.div>

              {/* Mini grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    title: 'Menu Summary', icon: <Utensils size={18} style={{ color: '#f97316' }} />,
                    rows: [
                      { label: 'Total Items',  value: menu.length,                                                                    col: 'white' },
                      { label: '🟢 Veg',       value: menu.filter(i => i.item_type === 'veg' || (!i.item_type && i.is_veg)).length,  col: '#4ade80' },
                      { label: '🔴 Non-Veg',   value: menu.filter(i => i.item_type === 'nonveg' || (!i.item_type && !i.is_veg)).length, col: '#f87171' },
                      { label: '💧 Liquid',    value: menu.filter(i => i.item_type === 'liquid').length,                               col: '#7dd3fc' },
                      { label: 'Out of Stock', value: menu.filter(i => i.out_of_stock).length,                                        col: 'rgba(255,255,255,0.3)' },
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
                      { label: 'Item Name',     node: <input type="text" required className="input-dark" placeholder="e.g. Butter Chicken" id="menu-item-name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} /> },
                      { label: 'Category',      node: (
                          <div className="space-y-2">
                            <select className="input-dark" value={newItem.category} id="menu-item-category" onChange={e => setNewItem({ ...newItem, category: e.target.value, sub_category: '' })}>
                              {['Main', 'Starter', 'Drink', 'Chinese'].map(c => <option key={c} value={c} style={{ background: '#111118' }}>{c}</option>)}
                            </select>
                            {newItem.category === 'Drink' && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(56,189,248,0.7)' }}>💧 Sub-category (e.g. Juice, Shake, Cola...)</label>
                                <input
                                  type="text"
                                  className="input-dark"
                                  placeholder="Type sub-category by hand e.g. Fresh Juice"
                                  value={newItem.sub_category}
                                  onChange={e => setNewItem({ ...newItem, sub_category: e.target.value })}
                                  style={{ borderColor: 'rgba(56,189,248,0.25)' }}
                                />
                              </motion.div>
                            )}
                          </div>
                        ) },
                      { label: 'Description',   node: <textarea rows={2} className="input-dark resize-none" placeholder="Brief description..." id="menu-item-description" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} /> },
                      { label: 'Full Price (₹)', node: <input type="number" min="0" step="0.01" required id="menu-item-price" className="input-dark" placeholder="e.g. 299" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} /> },
                      { label: 'Half Price (₹) — optional', node: <input type="number" min="0" step="0.01" id="menu-item-half-price" className="input-dark" placeholder="e.g. 149 (leave blank if no half)" value={newItem.half_price} onChange={e => setNewItem({ ...newItem, half_price: e.target.value })} /> },
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
                          onClick={() => setNewItem({ ...newItem, item_type: 'veg', is_veg: true })}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border transition-all"
                          style={newItem.item_type === 'veg'
                            ? { background: 'rgba(34,197,94,0.15)', borderColor: '#22c55e', color: '#4ade80' }
                            : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, border: '1.5px solid #22c55e', borderRadius: 3 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'block' }} />
                          </span>
                          Veg
                        </motion.button>
                        <motion.button type="button"
                          onClick={() => setNewItem({ ...newItem, item_type: 'nonveg', is_veg: false })}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border transition-all"
                          style={newItem.item_type === 'nonveg'
                            ? { background: 'rgba(239,68,68,0.15)', borderColor: '#ef4444', color: '#f87171' }
                            : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, border: '1.5px solid #ef4444', borderRadius: 3 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'block' }} />
                          </span>
                          Non-Veg
                        </motion.button>
                        <motion.button type="button"
                          onClick={() => setNewItem({ ...newItem, item_type: 'liquid', is_veg: true })}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border transition-all"
                          style={newItem.item_type === 'liquid'
                            ? { background: 'rgba(56,189,248,0.15)', borderColor: '#38bdf8', color: '#7dd3fc' }
                            : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, border: '1.5px solid #38bdf8', borderRadius: 3 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', display: 'block' }} />
                          </span>
                          Liquid
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
                      {[{ key: 'all', label: 'All Items' }, { key: 'veg', label: '🟢 Veg Only' }, { key: 'nonveg', label: '🔴 Non-Veg Only' }, { key: 'liquid', label: '💧 Liquid' }].map(f => (
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
                                  {/* Indian food indicator dot - supports veg, nonveg, liquid */}
                                  <span
                                    title={item.item_type === 'liquid' ? 'Liquid / Drink' : item.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      flexShrink: 0, width: 16, height: 16,
                                      border: `1.5px solid ${item.item_type === 'liquid' ? '#38bdf8' : item.is_veg ? '#22c55e' : '#ef4444'}`,
                                      borderRadius: 3 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%',
                                      background: item.item_type === 'liquid' ? '#38bdf8' : item.is_veg ? '#22c55e' : '#ef4444', display: 'block' }} />
                                  </span>
                                  <div>
                                    <p className="font-semibold text-sm text-white">{item.name}</p>
                                    {item.description && <p className="text-xs mt-0.5 truncate max-w-[160px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.description}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                {(() => {
                                  const type = item.item_type || (item.is_veg ? 'veg' : 'nonveg');
                                  const typeConfig: Record<string, { bg: string; color: string; border: string; label: string; icon: string }> = {
                                    veg:    { bg: 'rgba(34,197,94,0.1)',   color: '#4ade80', border: 'rgba(34,197,94,0.25)',   label: 'Veg',     icon: '🟢' },
                                    nonveg: { bg: 'rgba(239,68,68,0.1)',   color: '#f87171', border: 'rgba(239,68,68,0.25)',   label: 'Non-Veg', icon: '🔴' },
                                    liquid: { bg: 'rgba(56,189,248,0.1)',  color: '#7dd3fc', border: 'rgba(56,189,248,0.25)',  label: 'Liquid',  icon: '💧' },
                                  };
                                  const cfg = typeConfig[type] || typeConfig.veg;
                                  return (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"
                                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                      <span>{cfg.icon}</span>{cfg.label}
                                    </span>
                                  );
                                })()}
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
                        {(['waiter','kitchen','biller'] as const).map(role => (
                          <motion.button key={role} type="button" onClick={() => setNewStaffRole(role)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize"
                            style={newStaffRole === role
                              ? { background: role === 'waiter' ? 'linear-gradient(135deg,#06b6d4,#0284c7)' : role === 'kitchen' ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white' }
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
                      <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>
                        {staff.filter(s => s.role === 'biller').length} billers
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
                                  style={member.role === 'waiter' ? { background: 'rgba(6,182,212,0.15)', color: '#06b6d4' } : member.role === 'kitchen' ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' } : { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}
                                  whileHover={{ scale: 1.1, rotate: 5 }}>
                                  {member.name[0]?.toUpperCase()}
                                </motion.div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-white truncate">{member.name}</p>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 capitalize"
                                      style={member.role === 'waiter' ? { background: 'rgba(6,182,212,0.12)', color: '#06b6d4' } : member.role === 'kitchen' ? { background: 'rgba(139,92,246,0.12)', color: '#a78bfa' } : { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>
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

          {/* BILLING TAB */}
          {activeTab === 'billing' && (
            <motion.div key="billing" className="space-y-6 max-w-5xl"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div>
                <h2 className="text-3xl font-black text-white">Billing Requests</h2>
                <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Manage table bills and clear payments</p>
              </div>

              {tables.filter(t => t.active_orders_count > 0).length === 0 ? (
                <motion.div className="flex flex-col items-center justify-center py-24 text-center rounded-3xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                   <DollarSign size={52} className="mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
                   <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>No tables to bill</p>
                   <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Completed tabs are settled</p>
                </motion.div>
              ) : !billingTable ? (
                <div>
                   <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                     {tables.filter(t => t.active_orders_count > 0).sort((a,b) => (b.bill_requested ? 1 : 0) - (a.bill_requested ? 1 : 0)).map(t => (
                       <motion.button key={t.id} onClick={() => loadBill(t)}
                         className="p-5 rounded-3xl flex flex-col items-start relative overflow-hidden"
                         style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', border: t.bill_requested ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)' }}
                         whileHover={{ background: 'rgba(255,255,255,0.09)', scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                           <Receipt size={28} className="mb-3" style={{ color: t.bill_requested ? '#ef4444' : '#4ade80' }} />
                           <span className="font-bold text-white text-xl">Table {t.table_number.split(' ')[1]}</span>
                           <span className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                             {t.active_orders_count} Unpaid Order{t.active_orders_count > 1 ? 's' : ''}
                           </span>
                           {t.bill_requested ? (
                             <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded bg-red-500/20 text-red-400 uppercase tracking-widest animate-pulse">
                               Requested
                             </span>
                           ) : null}
                       </motion.button>
                     ))}
                   </div>
                </div>
              ) : billDetails && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl overflow-hidden relative max-w-2xl"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-bl-[100px] pointer-events-none" />
                  <div className="p-6 flex justify-between items-start" style={{ borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                     <div className="flex-1">
                       <button onClick={() => setBillingTable(null)} className="text-sm mb-3 font-semibold pb-1 pr-3" style={{ color: '#f97316' }}>← Back</button>
                       <h2 className="text-2xl font-bold text-white">Table {billingTable.table_number.split(' ')[1]} Bill</h2>
                       <div className="flex items-center gap-3">
                          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Merged {billDetails.orders.length} tickets</p>
                       </div>
                     </div>
                     <div className="text-right">
                       <p className="text-3xl font-black text-white" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>${billDetails.total.toFixed(2)}</p>
                       <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: '#4ade80' }}>Total Due</p>
                     </div>
                  </div>
                  <div className="p-6 bg-black bg-opacity-20 max-h-[50vh] overflow-y-auto">
                     <ul className="space-y-4">
                       {billDetails.items.map((item: any, idx: number) => {
                          const price = item.portion === 'half' && item.half_price ? item.half_price : item.price;
                          return (
                            <li key={idx} className="flex justify-between items-center text-base">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-sm px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>{item.quantity}×</span>
                                {item.portion && (
                                  <span className="text-xs uppercase font-bold text-white opacity-50 px-1 py-0.5 border border-white border-opacity-10 rounded">{item.portion === 'half' ? '½ Half' : 'Full'}</span>
                                )}
                                <span className="text-white opacity-90 font-medium">{item.item_name}</span>
                              </div>
                              <span className="text-white font-semibold opacity-60">${(price * item.quantity).toFixed(2)}</span>
                            </li>
                          )
                       })}
                     </ul>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <motion.button onClick={handlePrint}
                      className="py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-black text-lg bg-white"
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Printer size={20} /> Print GST Bill
                    </motion.button>
                    <motion.button onClick={() => markAsPaid(billingTable.id)}
                      className="py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-white text-lg"
                      style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 15px rgba(34,197,94,0.2)' }}
                      whileHover={{ scale: 1.02, boxShadow: '0 6px 20px rgba(34,197,94,0.3)' }} whileTap={{ scale: 0.98 }}>
                      <DollarSign size={20} /> Mark Paid
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}


          {/* TABLES TAB */}
          {activeTab === 'tables' && (
            <motion.div key="tables" className="space-y-6 max-w-5xl"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div>
                <h2 className="text-3xl font-black text-white">Table Management</h2>
                <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Add, remove, and assign tables to waiters</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Create New Table */}
                 <motion.div className="col-span-1 rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-3 mb-5">
                       <div className="p-2 rounded-xl" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}><TableIcon size={18}/></div>
                       <h3 className="font-bold text-white">Create Table</h3>
                    </div>
                    <form onSubmit={handleAddTable} className="space-y-4">
                       <div>
                         <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Table Number / Name</label>
                         <input type="text" value={newTableNum} onChange={e => setNewTableNum(e.target.value)} required
                           className="w-full bg-black bg-opacity-30 border border-white border-opacity-10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-opacity-30"
                           placeholder="e.g. Table 16" />
                       </div>
                       <motion.button type="submit" whileTap={{ scale: 0.98 }}
                          className="w-full py-3 rounded-xl font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors border border-blue-500/20 shadow-[0_4px_12px_rgba(96,165,250,0.15)] flex items-center justify-center gap-2">
                          <Plus size={16} /> Add Table
                       </motion.button>
                    </form>
                 </motion.div>

                 {/* Existing Tables List */}
                 <div className="col-span-1 md:col-span-2 rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center justify-between mb-5">
                       <h3 className="font-bold text-white">All Tables ({tables.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                        {tables.map(t => (
                           <div key={t.id} className="p-4 rounded-2xl flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div className="flex justify-between items-center">
                                 <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{t.table_number}</span>
                                    {t.active_orders_count > 0 && (
                                       <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
                                          {t.active_orders_count} Active
                                       </span>
                                    )}
                                 </div>
                                 <button onClick={() => handleRemoveTable(t.id)} 
                                   className="text-red-400/50 hover:text-red-400 transition-colors p-1" title="Delete Table">
                                   <Trash2 size={14} />
                                 </button>
                              </div>
                              <div className="pt-2 border-t border-white/5 flex flex-col gap-1">
                                 <label className="text-[10px] uppercase font-bold text-white/30 mb-1">Assigned Waiter</label>
                                 <div className="flex items-center gap-1">
                                   <select 
                                     className="bg-black/40 border border-white/10 rounded-lg text-xs p-2 text-white/80 focus:outline-none flex-1"
                                     value={tableAssignMap[t.id] ?? (t.waiter_id || '')}
                                     onChange={e => setTableAssignMap({ ...tableAssignMap, [t.id]: e.target.value })}
                                   >
                                      <option value="">Unassigned (Any)</option>
                                      {staff.filter(s => s.role === 'waiter').map(s => (
                                         <option key={s.id} value={s.id}>{s.name}</option>
                                      ))}
                                   </select>
                                   <button 
                                     onClick={() => handleAssignWaiter(t.id, tableAssignMap[t.id] ?? (t.waiter_id || ''))}
                                     className="py-1.5 px-3 rounded-lg text-[10px] font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors">
                                     Assign
                                   </button>
                                 </div>
                              </div>
                           </div>
                        ))}
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

      {/* STAT MODAL */}
      <AnimatePresence>
        {statModal && (
          <>
            <motion.div className="fixed inset-0 z-[100] pointer-events-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setStatModal(null)} />
            <motion.div className="fixed top-1/2 left-1/2 z-[100] w-full max-w-2xl max-h-[85vh] rounded-3xl p-6 flex flex-col pointer-events-auto overflow-hidden shadow-2xl"
              style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.08)', x: '-50%', y: '-50%' }}
              initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-45%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-45%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-xl text-white capitalize">
                    {statModal.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                </div>
                <motion.button onClick={() => setStatModal(null)} whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <X size={16} className="text-white/60 hover:text-white" />
                </motion.button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                {(() => {
                  let list: any[] = [];
                  let renderItem: (item: any, i: number) => React.ReactNode;
                  
                  if (statModal.includes('Order')) {
                    if (statModal === 'totalOrders') list = activeOrders;
                    if (statModal === 'activeOrders') list = activeOrders.filter(o => o.status !== 'served');
                    if (statModal === 'completedOrders') list = activeOrders.filter(o => o.status === 'served');
                    
                    if (list.length === 0) return <p className="text-white/40 text-center py-10">No orders found.</p>;
                    renderItem = (o, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-3 flex justify-between items-center transition-colors hover:bg-white/10">
                        <div>
                          <p className="font-bold text-white text-sm">Order #{o.id}</p>
                          <p className="text-xs text-white/40 mt-1">Table {o.table_number.split(' ')[1] || o.table_number} • Waiter: {o.waiter_name}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{new Date(o.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                            o.status === 'new' ? 'bg-red-500/20 text-red-400' :
                            o.status === 'preparing' ? 'bg-yellow-500/20 text-yellow-500' : 
                            o.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                            'bg-indigo-500/20 text-indigo-400'
                          }`}>
                          {o.status}
                        </span>
                      </div>
                    );
                  } else if (statModal.includes('Staff')) {
                    if (statModal === 'totalStaff') list = staff;
                    if (statModal === 'activeStaff') list = staff.filter(s => s.active);
                    
                    if (list.length === 0) return <p className="text-white/40 text-center py-10">No staff found.</p>;
                    renderItem = (s, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-3 flex justify-between items-center transition-colors hover:bg-white/10">
                        <div className="flex gap-3 items-center">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm"
                               style={{ background: s.role === 'waiter' ? 'rgba(6,182,212,0.4)' : 'rgba(139,92,246,0.4)' }}>
                            {s.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm flex items-center gap-2">{s.name}</p>
                            <p className="text-xs text-white/40 mt-0.5 capitalize">{s.role}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${s.active ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40'}`}>
                          {s.active ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    );
                  }
                  
                  return list.map((item, i) => renderItem(item, i));
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </main>
    </div>
  );
}
