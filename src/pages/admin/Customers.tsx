import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Phone, Star, Trash2, Search, Award, Edit2, Check, X } from 'lucide-react';

const BADGE_TIERS = [
  { min: 300, label: 'Gold',   emoji: '🥇', color: '#eab308', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.3)' },
  { min: 150, label: 'Silver', emoji: '🥈', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)' },
  { min: 50,  label: 'Bronze', emoji: '🥉', color: '#b45309', bg: 'rgba(180,83,9,0.1)',    border: 'rgba(180,83,9,0.3)' },
  { min: 0,   label: 'New',    emoji: '⭐', color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.3)' },
];
const getBadge = (pts: number) => BADGE_TIERS.find(t => pts >= t.min) || BADGE_TIERS[3];

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [editId,    setEditId]    = useState<number | null>(null);
  const [editPts,   setEditPts]   = useState<string>('');
  const [saving,    setSaving]    = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const r = await axios.get('/api/customers');
      setCustomers(Array.isArray(r.data) ? r.data : []);
    } catch { setCustomers([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleUpdatePoints = async (id: number) => {
    setSaving(true);
    try {
      await axios.patch(`/api/customers/${id}/points`, { points: Number(editPts) });
      setEditId(null);
      fetchCustomers();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this customer?')) return;
    setDeletingId(id);
    try {
      await axios.delete(`/api/customers/${id}`);
      setCustomers(c => c.filter(x => x.id !== id));
    } catch { } finally { setDeletingId(null); }
  };

  const filtered = customers.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  return (
    <motion.div className="space-y-6 max-w-6xl"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-black text-white">Customer CRM</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Loyalty program, visit tracking & customer profiles
          </p>
        </div>
        {/* Loyalty legend */}
        <div className="flex gap-2 flex-wrap">
          {BADGE_TIERS.map(t => (
            <span key={t.label} className="px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
              {t.emoji} {t.label} {t.min > 0 ? `≥${t.min}pts` : ''}
            </span>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Customers', value: customers.length,                                   color: '#a78bfa' },
          { label: 'Repeat Visitors', value: customers.filter(c => c.visits > 1).length,        color: '#34d399' },
          { label: 'Gold Members',    value: customers.filter(c => c.points >= 300).length,     color: '#eab308' },
        ].map((s, i) => (
          <motion.div key={s.label} className="rounded-2xl p-4 text-center"
            style={{ background: `${s.color}12`, border: `1px solid ${s.color}25` }}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.07 }}>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-widest mt-1"
              style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Search size={15} style={{ color: 'rgba(255,255,255,0.3)' }} />
        <input type="text" placeholder="Search by name or phone..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm text-white"
          style={{ color: 'white' }} />
        {search && (
          <button onClick={() => setSearch('')}>
            <X size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
          </button>
        )}
      </div>

      {/* Customer Table */}
      <motion.div className="rounded-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold uppercase tracking-widest"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
          <div className="col-span-4">Customer</div>
          <div className="col-span-2 text-center">Badge</div>
          <div className="col-span-2 text-center">Points</div>
          <div className="col-span-2 text-center">Visits</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <motion.div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"
              animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search ? 'No customers match your search' : 'No customers yet'}</p>
            <p className="text-xs mt-1 opacity-60">Customers appear when a waiter links a phone number during checkout</p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((c, i) => {
              const badge = getBadge(c.points || 0);
              const isEditing = editId === c.id;
              return (
                <motion.div key={c.id}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ background: 'rgba(255,255,255,0.02)' }}>

                  {/* Name + Phone */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm"
                      style={{ background: `${badge.color}20`, color: badge.color }}>
                      {(c.name || 'G')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{c.name || 'Guest'}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone size={10} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Badge */}
                  <div className="col-span-2 flex justify-center">
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold"
                      style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                      {badge.emoji} {badge.label}
                    </span>
                  </div>

                  {/* Points — editable */}
                  <div className="col-span-2 flex justify-center">
                    {isEditing ? (
                      <input type="number" value={editPts} min="0"
                        onChange={e => setEditPts(e.target.value)}
                        className="w-20 text-center rounded-lg px-2 py-1 text-sm font-bold text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(249,115,22,0.4)' }}
                        autoFocus />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Star size={12} style={{ color: '#eab308' }} />
                        <span className="font-bold text-white text-sm">{c.points || 0}</span>
                      </div>
                    )}
                  </div>

                  {/* Visits */}
                  <div className="col-span-2 text-center">
                    <span className="text-sm font-bold text-white">{c.visits || 0}</span>
                    <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>visits</span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end gap-2">
                    {isEditing ? (
                      <>
                        <motion.button onClick={() => handleUpdatePoints(c.id)} disabled={saving}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(34,197,94,0.15)' }}
                          whileTap={{ scale: 0.9 }}>
                          <Check size={13} style={{ color: '#4ade80' }} />
                        </motion.button>
                        <motion.button onClick={() => setEditId(null)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.06)' }}
                          whileTap={{ scale: 0.9 }}>
                          <X size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <motion.button onClick={() => { setEditId(c.id); setEditPts(String(c.points || 0)); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(99,102,241,0.12)' }}
                          whileTap={{ scale: 0.9 }} title="Edit Points">
                          <Edit2 size={12} style={{ color: '#818cf8' }} />
                        </motion.button>
                        <motion.button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(239,68,68,0.1)' }}
                          whileTap={{ scale: 0.9 }} title="Delete Customer">
                          {deletingId === c.id
                            ? <motion.div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full"
                                animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
                            : <Trash2 size={12} style={{ color: '#f87171' }} />}
                        </motion.button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </motion.div>

      <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.15)' }}>
        Points: 1 pt per ₹10 spent · Bronze ≥50 · Silver ≥150 · Gold ≥300
      </p>
    </motion.div>
  );
}
