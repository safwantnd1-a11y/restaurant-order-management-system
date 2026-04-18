import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../../hooks/useSocket';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import {
  Plus, ShoppingCart, CheckCircle, Clock, LogOut, Search,
  Minus, X, Send, Utensils, ClipboardList, ChefHat, Wifi,
  WifiOff, AlertCircle, Phone, MapPin, FileText, Printer,
  PlusCircle, MessageSquare, RotateCcw, Eye, Receipt
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

/* ── Status Config ─────────────────────────────────────── */
const S_CFG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  pending:   { label: 'Pending',   dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24' },
  new:       { label: 'New',       dot: '#ef4444', bg: 'rgba(239,68,68,0.12)',   text: '#f87171' },
  preparing: { label: 'Preparing', dot: '#eab308', bg: 'rgba(234,179,8,0.12)',   text: '#facc15' },
  ready:     { label: 'Ready! 🍽', dot: '#22c55e', bg: 'rgba(34,197,94,0.12)',   text: '#4ade80' },
  served:    { label: 'Served',    dot: '#6366f1', bg: 'rgba(99,102,241,0.12)',  text: '#818cf8' },
  billing:   { label: 'Billing',   dot: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   text: '#22d3ee' },
  paid:      { label: 'Paid',      dot: '#10b981', bg: 'rgba(16,185,129,0.12)',  text: '#34d399' },
  cancelled: { label: 'Cancelled', dot: '#6b7280', bg: 'rgba(107,114,128,0.12)', text: '#9ca3af' },
};

/* ── Veg indicator dot ─────────────────────────────────── */
const VD = ({ veg }: { veg: boolean }) => (
  <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
    width:13, height:13, flexShrink:0, border:`1.5px solid ${veg?'#22c55e':'#ef4444'}`, borderRadius:2 }}>
    <span style={{ width:6, height:6, borderRadius:'50%', background:veg?'#22c55e':'#ef4444', display:'block' }} />
  </span>
);

/* ── Bill Print Component ──────────────────────────────── */
function BillPreview({ order, onClose }: { order: any; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w || !content) return;
    w.document.write(`
      <html><head><title>Bill — ${order.table_number}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 10px; }
        h2 { text-align:center; font-size:14px; margin-bottom:4px; }
        .sub { text-align:center; font-size:11px; color:#555; margin-bottom:10px; }
        table { width:100%; border-collapse:collapse; }
        td { padding:3px 0; vertical-align:top; }
        .right { text-align:right; }
        hr { border:none; border-top:1px dashed #333; margin:8px 0; }
        .total { font-weight:bold; font-size:13px; }
        .footer { text-align:center; margin-top:10px; font-size:11px; color:#888; }
        .notes { font-style:italic; font-size:10px; color:#666; }
      </style></head><body>${content}
      <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>
    `);
    w.document.close();
  };

  const sub = (i: any) => (i.portion ==='half' ? (i.half_price||i.price/2) : i.price) * i.quantity;

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-end justify-center"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-md rounded-t-3xl flex flex-col"
        style={{ background:'#111118', border:'1px solid rgba(255,255,255,0.08)', maxHeight:'90vh' }}
        initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', stiffness:280, damping:30 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <Receipt size={18} style={{ color:'#f97316' }} />
            <span className="font-black text-white">Bill Preview</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:'rgba(249,115,22,0.15)', color:'#f97316' }}>
              {order.table_number}
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:'rgba(255,255,255,0.06)' }}>
            <X size={16} style={{ color:'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* Bill content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div ref={printRef}>
            <h2>🍽 Restaurant</h2>
            <div className="sub">
              {order.table_number} &nbsp;|&nbsp; Order #{order.id}<br/>
              {new Date(order.created_at).toLocaleString()}
            </div>
            <hr/>
            <table>
              <tbody>
                {order.items.map((it: any, i: number) => (
                  <React.Fragment key={i}>
                    <tr>
                      <td>{it.quantity}× {it.item_name}</td>
                      <td className="right">₹{sub(it).toFixed(0)}</td>
                    </tr>
                    {it.notes && <tr><td colSpan={2} className="notes">  ↳ {it.notes}</td></tr>}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <hr/>
            {order.notes && <p className="notes" style={{ marginBottom:6 }}>Note: {order.notes}</p>}
            <table>
              <tbody>
                <tr className="total"><td>TOTAL</td><td className="right">₹{Number(order.total_price).toFixed(2)}</td></tr>
              </tbody>
            </table>
            <hr/>
            <div className="footer">Thank you for dining with us! 🙏</div>
          </div>
        </div>

        {/* Print button */}
        <div className="px-6 py-4" style={{ borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <motion.button onClick={handlePrint}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-white"
            style={{ background:'linear-gradient(135deg,#f97316,#ea580c)', boxShadow:'0 8px 25px rgba(249,115,22,0.4)' }}
            whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}>
            <Printer size={18} /> Print Bill
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Add Items Modal ───────────────────────────────────── */
function AddItemsModal({ order, menu, onClose, onDone }: any) {
  const [cart, setCart] = useState<any[]>([]);
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
  const [orderNote, setOrderNote] = useState(order.notes || '');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const addItem = (item: any, portion: string) => {
    const key = `${item.id}_${portion}`;
    setCart(prev => {
      const ex = prev.find(c => c.key === key);
      if (ex) return prev.map(c => c.key === key ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { key, menu_id: item.id, name: item.name, price: item.price, half_price: item.half_price, portion, qty: 1 }];
    });
  };

  const updateQty = (key: string, d: number) => {
    setCart(prev => {
      const it = prev.find(c => c.key === key);
      if (!it) return prev;
      if (it.qty + d <= 0) return prev.filter(c => c.key !== key);
      return prev.map(c => c.key === key ? { ...c, qty: c.qty + d } : c);
    });
  };

  const submit = async () => {
    if (!cart.length) return;
    setSaving(true);
    try {
      await axios.post(`/api/orders/${order.id}/add-items`, {
        items: cart.map(c => ({
          menu_id: c.menu_id, quantity: c.qty, portion: c.portion,
          notes: itemNotes[c.menu_id] || ''
        })),
        notes: orderNote,
      });
      onDone();
      onClose();
    } catch (e: any) { alert('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const filtered = menu.filter((i: any) =>
    i.name.toLowerCase().includes(search.toLowerCase()) && !i.out_of_stock
  );

  const cartTotal = cart.reduce((s, c) => s + c.qty, 0);
  const cartValue = cart.reduce((s, c) => {
    const p = c.portion === 'half' ? (c.half_price || c.price / 2) : c.price;
    return s + p * c.qty;
  }, 0);

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-end justify-center"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-md rounded-t-3xl flex flex-col"
        style={{ background:'#111118', border:'1px solid rgba(255,255,255,0.08)', maxHeight:'90vh' }}
        initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', stiffness:280, damping:30 }}>

        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p className="font-black text-white flex items-center gap-2"><PlusCircle size={16} style={{ color:'#f97316' }} /> Add to Order #{order.id}</p>
            <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.35)' }}>{order.table_number}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:'rgba(255,255,255,0.06)' }}>
            <X size={16} style={{ color:'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <Search size={13} style={{ color:'rgba(255,255,255,0.3)' }} />
            <input type="text" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm flex-1" style={{ color:'white' }} />
          </div>

          {/* Cart summary */}
          {cart.length > 0 && (
            <div className="p-3 rounded-2xl space-y-2" style={{ background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.2)' }}>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color:'#f97316' }}>Adding ({cartTotal} items · ₹{cartValue.toFixed(0)})</p>
              {cart.map(c => (
                <div key={c.key} className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-white truncate">{c.name} <span style={{ color:'rgba(255,255,255,0.4)' }}>({c.portion})</span></span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(c.key,-1)} className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background:'rgba(255,255,255,0.08)' }}><Minus size={9}/></button>
                    <span className="text-xs font-bold w-4 text-center text-white">{c.qty}</span>
                    <button onClick={() => updateQty(c.key,1)} className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background:'rgba(249,115,22,0.2)' }}><Plus size={9} style={{ color:'#f97316' }}/></button>
                  </div>
                  <input value={itemNotes[c.menu_id]||''} onChange={e => setItemNotes(n=>({...n,[c.menu_id]:e.target.value}))}
                    className="text-[10px] bg-transparent outline-none px-2 py-1 rounded-lg w-24 flex-shrink-0"
                    style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'white' }} placeholder="e.g. No onion" />
                </div>
              ))}
            </div>
          )}

          {/* Menu items */}
          {filtered.map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
              {item.image_url
                ? <img src={item.image_url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" alt={item.name} />
                : <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'rgba(249,115,22,0.08)' }}><ChefHat size={18} style={{ color:'#f97316' }}/></div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5"><VD veg={!!item.is_veg} /><p className="font-semibold text-sm text-white truncate">{item.name}</p></div>
                <p className="text-xs font-bold" style={{ color:'#f97316' }}>₹{item.price}{Number(item.half_price)>0 && <span style={{ color:'#a78bfa' }}> · ½₹{item.half_price}</span>}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => addItem(item,'full')}
                  className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold"
                  style={{ background:'rgba(249,115,22,0.15)', color:'#f97316', border:'1px solid rgba(249,115,22,0.25)' }}>+Full</button>
                {Number(item.half_price)>0 && (
                  <button onClick={() => addItem(item,'half')}
                    className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold"
                    style={{ background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.2)' }}>+½</button>
                )}
              </div>
            </div>
          ))}

          {/* Order note */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest block mb-1" style={{ color:'rgba(255,255,255,0.3)' }}>Order Note</label>
            <textarea rows={2} value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="e.g. Customer allergic to nuts, no spice..."
              className="w-full bg-transparent outline-none text-sm px-3 py-2.5 rounded-2xl resize-none"
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'white' }} />
          </div>
        </div>

        <div className="px-4 py-4" style={{ borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <motion.button onClick={submit} disabled={!cart.length || saving}
            className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
            style={cart.length ? { background:'linear-gradient(135deg,#f97316,#ea580c)', boxShadow:'0 8px 25px rgba(249,115,22,0.4)' } : { background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.3)' }}
            whileHover={cart.length ? { scale:1.02 } : {}} whileTap={cart.length ? { scale:0.97 } : {}}>
            {saving ? <motion.div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" animate={{ rotate:360 }} transition={{ duration:0.8, repeat:Infinity, ease:'linear' }} />
              : <><Send size={16} /> Add {cartTotal} Item{cartTotal!==1?'s':''} to Order</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Order Note Edit Modal ─────────────────────────────── */
function NoteModal({ order, onClose, onDone }: any) {
  const [note, setNote] = useState(order.notes || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await axios.patch(`/api/orders/${order.id}/notes`, { notes: note });
    onDone(); onClose();
    setSaving(false);
  };
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-6"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-sm rounded-3xl p-6"
        style={{ background:'#111118', border:'1px solid rgba(255,255,255,0.1)' }}
        initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }}>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={18} style={{ color:'#f97316' }} />
          <span className="font-black text-white">Order Note</span>
        </div>
        <textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Special request, allergy info, preferences..."
          className="w-full bg-transparent outline-none text-sm px-4 py-3 rounded-2xl resize-none mb-4"
          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'white' }} />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl font-bold text-sm" style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)' }}>Cancel</button>
          <motion.button onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
            style={{ background:'linear-gradient(135deg,#f97316,#ea580c)' }}
            whileTap={{ scale:0.97 }}>
            {saving ? '...' : 'Save Note'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function WaiterDashboard() {
  const { logout, user } = useAuth();
  const { socket } = useSocket();
  const { isOnline, pendingCount, saveOrderLocally, syncing } = useOfflineSync();

  const [menu,          setMenu]         = useState<any[]>([]);
  const [tables,        setTables]       = useState<any[]>([]);
  const [orders,        setOrders]       = useState<any[]>([]);
  const [historyOrders, setHistory]      = useState<any[]>([]);
  const [cart,          setCart]         = useState<any[]>([]);
  const [selectedTable, setSelTable]     = useState<number|null>(null);
  const [view,          setView]         = useState<'floor'|'menu'|'orders'|'history'>('floor');
  const [menuSearch,    setMSearch]      = useState('');
  const [cartOpen,      setCartOpen]     = useState(false);
  const [placing,       setPlacing]      = useState(false);
  const [activeCategory,setActiveCat]   = useState('All');
  const [vegFilter,     setVegFilter]   = useState<'all'|'veg'|'nonveg'>('all');
  const [selPortions,   setSelPortions] = useState<Record<number,string>>({});
  const [itemNotesMap,  setItemNotes]   = useState<Record<number,string>>({});
  const [orderNote,     setOrderNote]   = useState('');
  const [showNoteInput, setShowNote]    = useState(false);
  const [fetchError,    setFetchErr]    = useState<string|null>(null);
  const [customerPhone, setCustPhone]   = useState('');
  const [customerName,  setCustName]    = useState('');
  const [showCustForm,  setShowCust]    = useState(false);
  const [now,           setNow]         = useState(Date.now());
  const [billOrder,     setBillOrder]   = useState<any|null>(null);
  const [addOrder,      setAddOrder]    = useState<any|null>(null);
  const [noteOrder,     setNoteOrder]   = useState<any|null>(null);
  const [floorSearch,   setFloorSearch] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchData();
    if (socket) {
      socket.on('new-order', fetchData);
      socket.on('order-status-updated', fetchData);
      socket.on('menu-updated', fetchData);
      socket.on('staff-status-updated', fetchData);
    }
    return () => {
      if (socket) {
        socket.off('new-order', fetchData);
        socket.off('order-status-updated', fetchData);
        socket.off('menu-updated', fetchData);
        socket.off('staff-status-updated', fetchData);
      }
    };
  }, [socket]);

  const fetchData = async () => {
    setFetchErr(null);
    const tok = localStorage.getItem('token');
    if (tok) axios.defaults.headers.common['Authorization'] = `Bearer ${tok}`;
    try { const r = await axios.get('/api/menu'); setMenu(Array.isArray(r.data)?r.data:[]); } catch { setMenu([]); }
    try {
      const r = await axios.get('/api/waiter/my-tables');
      setTables(Array.isArray(r.data)?r.data:[]);
    } catch (e: any) {
      setTables([]);
      const s = e?.response?.status;
      if (s===401||s===403) setFetchErr('Session expired — please logout');
      else setFetchErr(e.response?.data?.error||e.message||'Could not load tables');
    }
    try { const r = await axios.get('/api/orders'); setOrders(Array.isArray(r.data)?r.data:[]); } catch { setOrders([]); }
    try { const r = await axios.get('/api/orders?history=true'); setHistory(Array.isArray(r.data)?r.data:[]); } catch { setHistory([]); }
  };

  /* ── Cart ─────────────────────────────────────────── */
  const addToCart = (item: any, portion: string) => {
    const k = `${item.id}_${portion}`;
    setCart(prev => {
      const ex = prev.find(c => c.cartKey===k);
      if (ex) return prev.map(c => c.cartKey===k ? {...c, quantity:c.quantity+1} : c);
      return [...prev, {...item, cartKey:k, menu_id:item.id, quantity:1, portion}];
    });
  };
  const updateQty = (cartKey: string, d: number) =>
    setCart(prev => {
      const it = prev.find(c => c.cartKey===cartKey);
      if (!it) return prev;
      if (it.quantity+d<=0) return prev.filter(c => c.cartKey!==cartKey);
      return prev.map(c => c.cartKey===cartKey ? {...c, quantity:c.quantity+d} : c);
    });
  const removeFromCart = (k: string) => setCart(prev => prev.filter(c => c.cartKey!==k));

  const cartTotal   = cart.reduce((s,i) => s+i.quantity, 0);
  const cartRevenue = cart.reduce((s,i) => {
    const p = i.portion==='half' ? (i.half_price||i.price/2) : i.price;
    return s + p*i.quantity;
  }, 0);

  /* ── Place Order ──────────────────────────────────── */
  const placeOrder = async () => {
    if (!selectedTable || !cart.length) return;
    setPlacing(true);
    try {
      const payload = {
        table_id: selectedTable,
        items: cart.map(i => ({
          menu_id: i.menu_id, quantity: i.quantity,
          portion: i.portion||'full',
          notes: itemNotesMap[i.menu_id]||'',
        })),
        customer_phone: customerPhone||undefined,
        customer_name:  customerName||undefined,
        notes: orderNote||undefined,
      };
      if (!isOnline) {
        saveOrderLocally(payload);
        alert(`⚠️ Offline — order saved (${pendingCount+1} pending)`);
      } else {
        await axios.post('/api/orders', payload);
      }
      setCart([]); setSelTable(null); setCartOpen(false);
      setCustPhone(''); setCustName(''); setShowCust(false);
      setOrderNote(''); setItemNotes({}); setShowNote(false);
      setView('orders'); fetchData();
    } catch (e: any) {
      alert('Failed: ' + (e.response?.data?.error||e.message));
    } finally { setPlacing(false); }
  };

  /* ── Order Actions ────────────────────────────────── */
  const markServed  = (id: number) => axios.put(`/api/orders/${id}/status`, { status:'served' }).then(fetchData);
  const reqBilling  = (id: number) => axios.put(`/api/orders/${id}/status`, { status:'billing' }).then(fetchData);

  /* ── Filter ───────────────────────────────────────── */
  const categories  = ['All', ...Array.from(new Set(menu.map(i => i.category).filter(Boolean)))];
  const filteredMenu = menu.filter(item => {
    const cat  = activeCategory==='All' || item.category===activeCategory;
    const srch = item.name.toLowerCase().includes(menuSearch.toLowerCase());
    const veg  = vegFilter==='all' ? true : vegFilter==='veg' ? !!item.is_veg : !item.is_veg;
    return cat && srch && veg;
  });

  /* ── Table with order status ──────────────────────── */
  const tableStatus = (tableId: number) => {
    const tOrders = orders.filter(o => o.table_id===tableId && !['paid','cancelled'].includes(o.status));
    if (!tOrders.length) return 'free';
    if (tOrders.some(o => o.status==='ready'))     return 'ready';
    if (tOrders.some(o => o.status==='billing'))   return 'billing';
    if (tOrders.some(o => o.status==='preparing')) return 'preparing';
    if (tOrders.some(o => o.status==='pending'))   return 'pending';
    return 'occupied';
  };

  const TABLE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
    free:      { bg:'rgba(34,197,94,0.08)',   border:'rgba(34,197,94,0.25)',  text:'#4ade80', label:'Free' },
    occupied:  { bg:'rgba(249,115,22,0.1)',   border:'rgba(249,115,22,0.3)',  text:'#fb923c', label:'Occupied' },
    pending:   { bg:'rgba(245,158,11,0.1)',   border:'rgba(245,158,11,0.35)', text:'#fbbf24', label:'Pending' },
    preparing: { bg:'rgba(234,179,8,0.1)',    border:'rgba(234,179,8,0.35)',  text:'#facc15', label:'Cooking' },
    ready:     { bg:'rgba(16,185,129,0.12)',  border:'rgba(16,185,129,0.4)',  text:'#34d399', label:'Ready! 🍽' },
    billing:   { bg:'rgba(6,182,212,0.1)',    border:'rgba(6,182,212,0.35)', text:'#22d3ee',  label:'Billing' },
  };

  const pendingApprovalCount = orders.filter(o => o.status==='pending').length;
  const readyCount = orders.filter(o => o.status==='ready').length;

  return (
    <div className="min-h-screen pb-32" style={{ background:'#0a0a0f', color:'white' }}>

      {/* ── Top Bar ───────────────────────────────── */}
      <motion.header className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
        style={{ background:'rgba(10,10,15,0.95)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}
        initial={{ y:-60, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ type:'spring', stiffness:200, damping:25 }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#f97316,#ea580c)' }}>
            <Utensils size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">Waiter Panel</p>
            <p className="text-xs" style={{ color:'rgba(255,255,255,0.35)' }}>{user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Alert badges */}
          {readyCount > 0 && (
            <motion.div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-black"
              style={{ background:'rgba(34,197,94,0.15)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.3)' }}
              animate={{ scale:[1,1.08,1] }} transition={{ duration:1.5, repeat:Infinity }}>
              🍽 {readyCount} Ready
            </motion.div>
          )}
          <motion.div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold"
            style={isOnline
              ? { background:'rgba(34,197,94,0.1)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.2)' }
              : { background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)' }}>
            {isOnline ? <Wifi size={10}/> : <WifiOff size={10}/>}
            {isOnline ? (syncing?'Syncing...':'Online') : `Offline${pendingCount>0?` (${pendingCount})`:''}`}
          </motion.div>
          <motion.button onClick={fetchData} whileTap={{ scale:0.9 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <RotateCcw size={15} style={{ color:'rgba(255,255,255,0.4)' }} />
          </motion.button>
          <motion.button onClick={logout} whileTap={{ scale:0.9 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <LogOut size={15} style={{ color:'rgba(255,255,255,0.4)' }} />
          </motion.button>
        </div>
      </motion.header>

      {/* ── Nav Tabs ──────────────────────────────── */}
      <motion.div className="px-4 pt-4 pb-2" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}>
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
          {[
            { key:'floor',   label:'Floor',   icon:<MapPin size={13}/>,          badge: null },
            { key:'menu',    label:'New Order',icon:<Utensils size={13}/>,        badge: null },
            { key:'orders',  label:'Active',  icon:<ClipboardList size={13}/>,   badge: orders.filter(o=>!['served','paid','cancelled'].includes(o.status)).length },
            { key:'history', label:'History', icon:<Clock size={13}/>,            badge: null },
          ].map(tab => (
            <motion.button key={tab.key} onClick={() => setView(tab.key as any)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold relative"
              whileTap={{ scale:0.97 }}
              style={view===tab.key
                ? { background:'linear-gradient(135deg,#f97316,#ea580c)', color:'white', boxShadow:'0 4px 15px rgba(249,115,22,0.3)' }
                : { color:'rgba(255,255,255,0.4)' }}>
              {tab.icon}{tab.label}
              <AnimatePresence>
                {tab.badge != null && tab.badge > 0 && (
                  <motion.span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-white"
                    style={{ background:'#ef4444' }}
                    initial={{ scale:0 }} animate={{ scale:1 }} exit={{ scale:0 }}>
                    {tab.badge}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ══ FLOOR VIEW ══════════════════════════════ */}
        {view==='floor' && (
          <motion.div key="floor" className="px-4 pt-3 pb-8"
            initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-15 }}>

            {/* Legend */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <p className="text-xs font-black uppercase tracking-widest mr-2" style={{ color:'rgba(255,255,255,0.25)' }}>Status:</p>
              {Object.entries(TABLE_COLORS).map(([k,v]) => (
                <div key={k} className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                  style={{ background:v.bg, border:`1px solid ${v.border}`, color:v.text }}>
                  {v.label}
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl mb-4" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <Search size={13} style={{ color:'rgba(255,255,255,0.3)' }} />
              <input type="text" placeholder="Search table..." value={floorSearch} onChange={e => setFloorSearch(e.target.value)}
                className="bg-transparent outline-none text-sm flex-1" style={{ color:'white' }} />
            </div>

            {fetchError ? (
              <div className="p-6 rounded-2xl text-center" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={24} className="mx-auto mb-2 text-red-400" />
                <p className="font-bold text-red-400 text-sm">{fetchError}</p>
                <button onClick={fetchData} className="mt-2 text-xs text-red-300 underline">Retry</button>
              </div>
            ) : tables.length===0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <MapPin size={40} className="mb-3" style={{ color:'rgba(255,255,255,0.15)' }} />
                <p className="font-bold" style={{ color:'rgba(255,255,255,0.3)' }}>No tables assigned yet</p>
                <p className="text-xs mt-1" style={{ color:'rgba(255,255,255,0.15)' }}>Admin will assign your tables</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {tables.filter(t => (t.table_number||'').toLowerCase().includes(floorSearch.toLowerCase())).map((t, idx) => {
                  const st  = tableStatus(t.id);
                  const tc  = TABLE_COLORS[st];
                  const num = (t.table_number||'').replace('Table ','');
                  const tblOrders = orders.filter(o => o.table_id===t.id && !['paid','cancelled'].includes(o.status));
                  const isSelected = selectedTable===t.id;

                  return (
                    <motion.div key={t.id}
                      className="rounded-3xl p-4 cursor-pointer relative overflow-hidden"
                      style={{ background:tc.bg, border:`1.5px solid ${isSelected?'#f97316':tc.border}` }}
                      initial={{ opacity:0, scale:0.85, y:20 }}
                      animate={{ opacity:1, scale:1, y:0 }}
                      transition={{ delay:idx*0.04, type:'spring', stiffness:250, damping:22 }}
                      whileHover={{ scale:1.04 }}
                      whileTap={{ scale:0.96 }}
                      onClick={() => { setSelTable(t.id); if(st==='free') setView('menu'); }}>

                      {/* Animated pulse for ready */}
                      {st==='ready' && (
                        <motion.div className="absolute inset-0 rounded-3xl" style={{ background:'rgba(34,197,94,0.06)' }}
                          animate={{ opacity:[0,0.6,0] }} transition={{ duration:1.5, repeat:Infinity }} />
                      )}

                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-black text-white text-lg leading-none">T{num}</p>
                          <p className="text-[10px] font-bold mt-0.5" style={{ color:tc.text }}>{tc.label}</p>
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full mt-1" style={{ background:tc.text }} />
                      </div>

                      {tblOrders.length > 0 && (
                        <div className="space-y-1 mb-3">
                          {tblOrders.slice(0,2).map(o => (
                            <div key={o.id} className="text-[10px] font-semibold px-2 py-1 rounded-lg truncate"
                              style={{ background:'rgba(0,0,0,0.25)', color:'rgba(255,255,255,0.6)' }}>
                              #{o.id} · {o.items?.length||0} items · ₹{Number(o.total_price).toFixed(0)}
                            </div>
                          ))}
                          {tblOrders.length > 2 && <p className="text-[10px]" style={{ color:'rgba(255,255,255,0.3)' }}>+{tblOrders.length-2} more orders</p>}
                        </div>
                      )}

                      <div className="flex gap-1.5">
                        <button onClick={e => { e.stopPropagation(); setSelTable(t.id); setView('menu'); }}
                          className="flex-1 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-1"
                          style={{ background:'rgba(249,115,22,0.2)', color:'#f97316', border:'1px solid rgba(249,115,22,0.3)' }}>
                          <Plus size={10}/> Order
                        </button>
                        {tblOrders.length > 0 && (
                          <button onClick={e => { e.stopPropagation(); setView('orders'); }}
                            className="flex-1 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-1"
                            style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(255,255,255,0.08)' }}>
                            <Eye size={10}/> View
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ══ MENU / NEW ORDER VIEW ═══════════════════ */}
        {view==='menu' && (
          <motion.div key="menu" className="px-4 pb-36 space-y-4"
            initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }}>

            {/* Table selector */}
            <section className="pt-3">
              <p className="text-xs font-black uppercase tracking-widest mb-2.5" style={{ color:'rgba(255,255,255,0.3)' }}>Select Table</p>
              {fetchError ? (
                <div className="p-4 rounded-2xl text-xs text-center" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171' }}>
                  {fetchError} <button onClick={fetchData} className="underline ml-1">Retry</button>
                </div>
              ) : tables.length===0 ? (
                <div className="p-4 rounded-2xl text-xs text-center" style={{ background:'rgba(249,115,22,0.05)', border:'1px solid rgba(249,115,22,0.1)', color:'#fb923c' }}>
                  <AlertCircle size={20} className="mx-auto mb-1 opacity-50"/>
                  No tables assigned yet
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {tables.map(t => {
                    const num = (t.table_number||'').replace('Table ','');
                    const st  = tableStatus(t.id);
                    const tc  = TABLE_COLORS[st];
                    const sel = selectedTable===t.id;
                    return (
                      <motion.button key={t.id} onClick={() => setSelTable(t.id)}
                        whileHover={{ scale:1.05 }} whileTap={{ scale:0.9 }}
                        className="py-3 rounded-2xl font-black text-sm relative"
                        style={sel
                          ? { background:'linear-gradient(135deg,#f97316,#ea580c)', color:'white', boxShadow:'0 4px 15px rgba(249,115,22,0.4)' }
                          : { background:tc.bg, border:`1px solid ${tc.border}`, color:tc.text }}>
                        {num}
                        {st!=='free' && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background:tc.text }} />}
                      </motion.button>
                    );
                  })}
                </div>
              )}
              {selectedTable && (
                <p className="mt-2 text-xs font-bold" style={{ color:'#fb923c' }}>
                  ✓ {tables.find(t=>t.id===selectedTable)?.table_number} selected
                </p>
              )}
            </section>

            {/* Search */}
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
              <Search size={14} style={{ color:'rgba(255,255,255,0.3)' }} />
              <input type="text" placeholder="Search dishes..." value={menuSearch} onChange={e => setMSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm" style={{ color:'white' }} />
              {menuSearch && <button onClick={() => setMSearch('')}><X size={13} style={{ color:'rgba(255,255,255,0.3)' }}/></button>}
            </div>

            {/* Category + Veg filter */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
              {categories.map(cat => (
                <motion.button key={cat} onClick={() => setActiveCat(cat)}
                  className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold"
                  style={activeCategory===cat ? { background:'#f97316', color:'white' } : { background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.08)' }}>
                  {cat}
                </motion.button>
              ))}
            </div>
            <div className="flex gap-2">
              {[{k:'all',l:'All'},{k:'veg',l:'🟢 Veg'},{k:'nonveg',l:'🔴 Non-Veg'}].map(f => (
                <motion.button key={f.k} onClick={() => setVegFilter(f.k as any)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold"
                  style={vegFilter===f.k ? { background:'rgba(249,115,22,0.15)', color:'#f97316', border:'1px solid rgba(249,115,22,0.3)' } : { background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.35)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  {f.l}
                </motion.button>
              ))}
            </div>

            {/* Menu Items */}
            <div className="space-y-3">
              {filteredMenu.length===0 ? (
                <div className="text-center py-12" style={{ color:'rgba(255,255,255,0.2)' }}>
                  <Utensils size={36} className="mx-auto mb-2 opacity-25" />
                  <p className="text-sm">No items found</p>
                </div>
              ) : filteredMenu.map(item => {
                const inFull = cart.find(c => c.cartKey===`${item.id}_full`);
                const inHalf = cart.find(c => c.cartKey===`${item.id}_half`);
                const hasHalf = Number(item.half_price) > 0;

                return (
                  <motion.div key={item.id}
                    className="rounded-3xl overflow-hidden"
                    style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}
                    whileHover={{ borderColor:'rgba(249,115,22,0.2)' }}>

                    <div className="flex items-center gap-3 p-4">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"/>
                        : <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background:'rgba(249,115,22,0.1)' }}><ChefHat size={22} style={{ color:'#f97316' }}/></div>}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5"><VD veg={!!item.is_veg}/><p className="font-semibold text-white truncate">{item.name}</p></div>
                        {item.description && <p className="text-xs truncate" style={{ color:'rgba(255,255,255,0.35)' }}>{item.description}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-black text-sm" style={{ color:'#f97316' }}>₹{item.price}</span>
                          {hasHalf && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">½₹{item.half_price}</span>}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={!item.out_of_stock ? { background:'rgba(34,197,94,0.1)',color:'#4ade80' } : { background:'rgba(239,68,68,0.1)',color:'#f87171' }}>
                            {!item.out_of_stock?'Available':'Out of stock'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Item note input */}
                    {(inFull||inHalf) && (
                      <div className="px-4 pb-3">
                        <input placeholder="Item note: e.g. No onion, extra spicy..." value={itemNotesMap[item.id]||''}
                          onChange={e => setItemNotes(n=>({...n,[item.id]:e.target.value}))}
                          className="w-full bg-transparent outline-none text-xs px-3 py-2 rounded-xl"
                          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'white' }}/>
                      </div>
                    )}

                    {/* Cart controls */}
                    {!item.out_of_stock && (
                      <div className="flex border-t" style={{ borderColor:'rgba(255,255,255,0.05)' }}>
                        {/* Full portion */}
                        <div className="flex-1 flex items-center justify-center gap-2 p-3">
                          <span className="text-[10px] font-black" style={{ color:'rgba(255,255,255,0.3)' }}>FULL</span>
                          {inFull ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateQty(`${item.id}_full`,-1)} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:'rgba(255,255,255,0.08)' }}><Minus size={11}/></button>
                              <motion.span key={inFull.quantity} initial={{ scale:1.3 }} animate={{ scale:1 }} className="font-black text-sm text-white w-5 text-center">{inFull.quantity}</motion.span>
                              <button onClick={() => addToCart(item,'full')} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:'rgba(249,115,22,0.2)' }}><Plus size={11} style={{ color:'#f97316' }}/></button>
                            </div>
                          ) : (
                            <motion.button onClick={() => addToCart(item,'full')} whileTap={{ scale:0.88 }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
                              style={{ background:'rgba(249,115,22,0.15)', color:'#f97316', border:'1px solid rgba(249,115,22,0.3)' }}>
                              <Plus size={12}/> Add
                            </motion.button>
                          )}
                        </div>

                        {/* Half portion */}
                        {hasHalf && (
                          <div className="flex-1 flex items-center justify-center gap-2 p-3" style={{ borderLeft:'1px solid rgba(255,255,255,0.05)' }}>
                            <span className="text-[10px] font-black" style={{ color:'rgba(139,92,246,0.7)' }}>HALF</span>
                            {inHalf ? (
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateQty(`${item.id}_half`,-1)} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:'rgba(255,255,255,0.08)' }}><Minus size={11}/></button>
                                <motion.span key={inHalf.quantity} initial={{ scale:1.3 }} animate={{ scale:1 }} className="font-black text-sm text-white w-5 text-center">{inHalf.quantity}</motion.span>
                                <button onClick={() => addToCart(item,'half')} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:'rgba(139,92,246,0.15)' }}><Plus size={11} style={{ color:'#a78bfa' }}/></button>
                              </div>
                            ) : (
                              <motion.button onClick={() => addToCart(item,'half')} whileTap={{ scale:0.88 }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
                                style={{ background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.25)' }}>
                                <Plus size={12}/> Add
                              </motion.button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ══ ACTIVE ORDERS VIEW ══════════════════════ */}
        {view==='orders' && (
          <motion.div key="orders" className="px-4 pb-8 pt-3 space-y-3"
            initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>

            {orders.length===0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <motion.div animate={{ y:[0,-8,0] }} transition={{ duration:2.5, repeat:Infinity }}>
                  <Clock size={48} style={{ color:'rgba(255,255,255,0.15)' }} />
                </motion.div>
                <p className="font-semibold mt-4" style={{ color:'rgba(255,255,255,0.3)' }}>No active orders</p>
                <p className="text-xs mt-1" style={{ color:'rgba(255,255,255,0.18)' }}>Orders appear here in real-time</p>
              </div>
            ) : orders.map(order => {
              const sc  = S_CFG[order.status] || S_CFG['new'];
              const waited = Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 60000));
              const isUrgent = waited > 20 && !['served','billing','paid'].includes(order.status);

              return (
                <motion.div key={order.id}
                  className="rounded-3xl overflow-hidden"
                  style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${isUrgent?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.06)'}` }}
                  layout whileHover={{ scale:1.01 }}>

                  {/* Order header */}
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between" style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <motion.div className="w-2.5 h-2.5 rounded-full" style={{ background:sc.dot }}
                          animate={{ boxShadow:[`0 0 4px ${sc.dot}`,`0 0 12px ${sc.dot}`,`0 0 4px ${sc.dot}`] }}
                          transition={{ duration:1.8, repeat:Infinity }}/>
                        <h3 className="font-black text-white text-base">{order.table_number}</h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)' }}>
                          #{order.id}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>
                        {new Date(order.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                        &nbsp;·&nbsp;
                        <span style={{ color:isUrgent?'#f87171':'#fb923c', fontWeight:'bold' }}>
                          {isUrgent?'⚠️':'⏱'} {waited}m
                        </span>
                      </p>
                      {order.notes && (
                        <p className="text-xs mt-1 italic" style={{ color:'#fbbf24' }}>📝 {order.notes}</p>
                      )}
                    </div>
                    <span className="text-xs font-black px-3 py-1.5 rounded-full"
                      style={{ background:sc.bg, color:sc.text, border:`1px solid ${sc.dot}40` }}>
                      {sc.label}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="px-4 py-3">
                    <ul className="space-y-1.5">
                      {order.items.map((it: any, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="font-bold text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5" style={{ background:'rgba(249,115,22,0.15)', color:'#f97316' }}>{it.quantity}×</span>
                          {it.portion && <span className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5"
                            style={it.portion==='half' ? { background:'rgba(139,92,246,0.15)',color:'#a78bfa' } : { background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.4)' }}>
                            {it.portion==='half'?'½':'⚪'}
                          </span>}
                          <div>
                            <span style={{ color:'rgba(255,255,255,0.8)' }}>{it.item_name}</span>
                            {it.notes && <p className="text-[10px] italic mt-0.5" style={{ color:'rgba(255,193,7,0.7)' }}>↳ {it.notes}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-xs font-black uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.25)' }}>Total</span>
                      <span className="font-black text-lg" style={{ color:'#f97316' }}>₹{Number(order.total_price).toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Action buttons row */}
                  <div className="flex border-t" style={{ borderColor:'rgba(255,255,255,0.05)' }}>
                    {/* Add items */}
                    {!['paid','cancelled','billing'].includes(order.status) && (
                      <button onClick={() => setAddOrder(order)}
                        className="flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold"
                        style={{ color:'#f97316', borderRight:'1px solid rgba(255,255,255,0.05)' }}>
                        <PlusCircle size={13}/> Add Items
                      </button>
                    )}
                    {/* Note */}
                    <button onClick={() => setNoteOrder(order)}
                      className="flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold"
                      style={{ color:'rgba(255,255,255,0.4)', borderRight:'1px solid rgba(255,255,255,0.05)' }}>
                      <MessageSquare size={13}/> Note
                    </button>
                    {/* Bill preview */}
                    <button onClick={() => setBillOrder(order)}
                      className="flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold"
                      style={{ color:'#22d3ee' }}>
                      <FileText size={13}/> Bill
                    </button>
                  </div>

                  {/* Status actions */}
                  {order.status==='ready' && (
                    <motion.button onClick={() => markServed(order.id)}
                      className="w-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm"
                      style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'white' }}
                      whileTap={{ scale:0.98 }}>
                      <CheckCircle size={16}/> Mark as Served
                    </motion.button>
                  )}
                  {order.status==='served' && (
                    <motion.button onClick={() => reqBilling(order.id)}
                      className="w-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm"
                      style={{ background:'linear-gradient(135deg,#06b6d4,#0891b2)', color:'white' }}
                      whileTap={{ scale:0.98 }}>
                      <Receipt size={16}/> Request Billing
                    </motion.button>
                  )}
                  {order.status==='billing' && (
                    <div className="w-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm"
                      style={{ background:'rgba(6,182,212,0.08)', color:'#22d3ee' }}>
                      <Clock size={16}/> Billing in progress...
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ══ HISTORY VIEW ════════════════════════════ */}
        {view==='history' && (
          <motion.div key="history" className="px-4 pb-8 pt-3 space-y-3"
            initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}>
            {historyOrders.length===0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Clock size={48} style={{ color:'rgba(255,255,255,0.12)' }} className="mb-3"/>
                <p className="font-semibold" style={{ color:'rgba(255,255,255,0.3)' }}>No history yet</p>
              </div>
            ) : historyOrders.map(order => {
              const sc = S_CFG[order.status]||S_CFG['paid'];
              return (
                <motion.div key={order.id}
                  className="rounded-3xl overflow-hidden"
                  style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)' }}
                  layout>
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between" style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                    <div>
                      <p className="font-black text-white">{order.table_number} <span className="text-xs font-normal opacity-40">#{order.id}</span></p>
                      <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.25)' }}>
                        {new Date(order.created_at).toLocaleString()} · ₹{Number(order.total_price).toFixed(0)}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background:sc.bg, color:sc.text }}>{sc.label}</span>
                  </div>
                  <div className="px-4 py-3">
                    <ul className="space-y-1">
                      {order.items.map((it: any, i: number) => (
                        <li key={i} className="text-xs flex items-center gap-2 opacity-60">
                          <span className="font-bold">{it.quantity}×</span>
                          {it.portion==='half' && <span className="text-purple-400 font-bold text-[10px]">½</span>}
                          <span>{it.item_name}</span>
                          {it.notes && <span className="italic" style={{ color:'rgba(255,193,7,0.6)' }}>· {it.notes}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Quick reorder button */}
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => {
                        order.items.forEach((it: any) => {
                          const menuItem = menu.find(m => m.name===it.item_name);
                          if (menuItem) addToCart(menuItem, it.portion||'full');
                        });
                        setView('menu');
                      }}
                      className="w-full py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5"
                      style={{ background:'rgba(249,115,22,0.08)', color:'#f97316', border:'1px solid rgba(249,115,22,0.2)' }}>
                      <RotateCcw size={11}/> Quick Reorder
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Cart CTA ─────────────────────── */}
      <AnimatePresence>
        {view==='menu' && cartTotal>0 && (
          <motion.div className="fixed bottom-4 left-4 right-4 z-40"
            initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:80, opacity:0 }}
            transition={{ type:'spring', stiffness:300, damping:28 }}>
            <motion.button onClick={() => setCartOpen(true)}
              className="w-full py-4 rounded-2xl flex items-center justify-between px-6 font-bold"
              style={{ background:'linear-gradient(135deg,#f97316,#ea580c)', boxShadow:'0 8px 30px rgba(249,115,22,0.55)' }}
              whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-sm">{cartTotal}</div>
                <span className="text-white">View Order</span>
              </div>
              <span className="text-white font-black text-lg">₹{cartRevenue.toFixed(0)} →</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart Drawer ───────────────────────────── */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div className="fixed inset-0 z-50" style={{ background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)' }}
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setCartOpen(false)}/>
            <motion.div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col"
              style={{ background:'#111118', border:'1px solid rgba(255,255,255,0.08)', maxHeight:'88vh' }}
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', stiffness:260, damping:30 }}>

              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-white/15"/></div>
              <div className="flex items-center justify-between px-6 py-3">
                <div>
                  <h3 className="font-black text-xl text-white">Your Order</h3>
                  {selectedTable && <p className="text-sm mt-0.5" style={{ color:'#f97316' }}>{tables.find(t=>t.id===selectedTable)?.table_number}</p>}
                </div>
                <motion.button onClick={() => setCartOpen(false)} whileTap={{ scale:0.9 }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:'rgba(255,255,255,0.06)' }}>
                  <X size={16} style={{ color:'rgba(255,255,255,0.6)' }}/>
                </motion.button>
              </div>

              {!selectedTable && (
                <div className="mx-6 mb-3 px-4 py-3 rounded-2xl text-sm" style={{ background:'rgba(249,115,22,0.1)', color:'#fb923c', border:'1px solid rgba(249,115,22,0.2)' }}>
                  ⚠️ Please select a table first
                </div>
              )}

              <div className="overflow-y-auto flex-1 px-6 space-y-3 pb-2">
                <AnimatePresence>
                  {cart.map(item => (
                    <motion.div key={item.cartKey} layout
                      initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20, height:0 }}
                      className="flex items-center gap-3 p-3 rounded-2xl"
                      style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-sm text-white truncate">{item.name}</p>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                            style={item.portion==='half' ? { background:'rgba(139,92,246,0.2)',color:'#a78bfa' } : { background:'rgba(249,115,22,0.12)',color:'#f97316' }}>
                            {item.portion==='half'?'½ Half':'⚪ Full'}
                          </span>
                        </div>
                        <p className="text-xs font-bold" style={{ color:'#f97316' }}>
                          ₹{((item.portion==='half'?(item.half_price||item.price/2):item.price)*item.quantity).toFixed(0)}
                        </p>
                        {itemNotesMap[item.menu_id] && <p className="text-[10px] italic mt-0.5" style={{ color:'rgba(255,193,7,0.7)' }}>📝 {itemNotesMap[item.menu_id]}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.cartKey,-1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'rgba(255,255,255,0.08)' }}><Minus size={12}/></button>
                        <motion.span key={item.quantity} initial={{ scale:1.3 }} animate={{ scale:1 }} className="w-5 text-center font-black text-sm text-white">{item.quantity}</motion.span>
                        <button onClick={() => updateQty(item.cartKey,1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'rgba(249,115,22,0.2)' }}><Plus size={12} style={{ color:'#f97316' }}/></button>
                        <button onClick={() => removeFromCart(item.cartKey)} className="w-7 h-7 rounded-lg flex items-center justify-center ml-1" style={{ background:'rgba(239,68,68,0.1)' }}><X size={12} style={{ color:'#f87171' }}/></button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Order note */}
                <div>
                  <button onClick={() => setShowNote(v=>!v)} className="flex items-center gap-1.5 text-xs font-bold mb-2"
                    style={{ color:showNoteInput?'#fbbf24':'rgba(255,255,255,0.3)' }}>
                    <MessageSquare size={11}/> {showNoteInput?'Hide':'+ Order Note (allergy, preference...)'}
                  </button>
                  <AnimatePresence>
                    {showNoteInput && (
                      <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}>
                        <textarea rows={2} value={orderNote} onChange={e => setOrderNote(e.target.value)}
                          placeholder="e.g. No nuts for table 3, birthday cake arranged..."
                          className="w-full bg-transparent outline-none text-xs px-3 py-2.5 rounded-2xl resize-none"
                          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,193,7,0.25)', color:'white' }}/>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Customer */}
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:8 }}>
                  <button onClick={() => setShowCust(v=>!v)} className="flex items-center gap-1.5 text-xs font-bold mb-2"
                    style={{ color:showCustForm?'#f97316':'rgba(255,255,255,0.3)' }}>
                    <Phone size={11}/> {showCustForm?'Hide':'+ Link Customer (loyalty)'}
                  </button>
                  <AnimatePresence>
                    {showCustForm && (
                      <motion.div className="space-y-2" initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}>
                        <input type="text" placeholder="Customer Name" value={customerName} onChange={e => setCustName(e.target.value)}
                          className="w-full bg-transparent outline-none text-xs px-3 py-2.5 rounded-xl"
                          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'white' }}/>
                        <input type="tel" placeholder="Phone Number" value={customerPhone} onChange={e => setCustPhone(e.target.value)}
                          className="w-full bg-transparent outline-none text-xs px-3 py-2.5 rounded-xl"
                          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'white' }}/>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Total + Place Order */}
              <div className="px-6 py-4" style={{ borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                {!isOnline && (
                  <div className="mb-3 px-3 py-2 rounded-xl text-xs font-bold" style={{ background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)' }}>
                    ⚠️ Offline — order saves locally {pendingCount>0&&`(${pendingCount} pending)`}
                  </div>
                )}
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-black uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.3)' }}>Total</span>
                  <span className="font-black text-2xl" style={{ color:'#f97316' }}>₹{cartRevenue.toFixed(0)}</span>
                </div>
                <motion.button onClick={placeOrder} disabled={!selectedTable||placing}
                  className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-white"
                  style={selectedTable
                    ? { background:'linear-gradient(135deg,#f97316,#ea580c)', boxShadow:'0 8px 25px rgba(249,115,22,0.4)' }
                    : { background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.3)' }}
                  whileHover={selectedTable?{scale:1.02}:{}} whileTap={selectedTable?{scale:0.97}:{}}>
                  {placing
                    ? <motion.div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" animate={{ rotate:360 }} transition={{ duration:0.8, repeat:Infinity, ease:'linear' }}/>
                    : <><Send size={16}/>{selectedTable?(isOnline?'Send to Kitchen':'Save Offline'):'Select a Table First'}</>}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modals ────────────────────────────────── */}
      <AnimatePresence>
        {billOrder && <BillPreview order={billOrder} onClose={() => setBillOrder(null)} />}
        {addOrder  && <AddItemsModal order={addOrder} menu={menu} onClose={() => setAddOrder(null)} onDone={fetchData} />}
        {noteOrder && <NoteModal order={noteOrder} onClose={() => setNoteOrder(null)} onDone={fetchData} />}
      </AnimatePresence>
    </div>
  );
}
