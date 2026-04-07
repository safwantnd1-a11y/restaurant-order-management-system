import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, UtensilsCrossed, Eye, EyeOff, AlertCircle, ChefHat, Users, Utensils, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (u: string, p: string) => { setEmail(u); setPassword(p); };

  const orbVariants = {
    animate: (i: number) => ({
      scale: [1, 1.15, 1],
      opacity: [0.15, 0.25, 0.15],
      transition: { duration: 4 + i * 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 },
    }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #0a0a0f 100%)' }}>

      {/* Animated Background Orbs */}
      <motion.div custom={0} variants={orbVariants} animate="animate"
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
      <motion.div custom={1} variants={orbVariants} animate="animate"
        className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
      <motion.div custom={2} variants={orbVariants} animate="animate"
        className="absolute top-[50%] left-[30%] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo — slides down */}
        <motion.div
          className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <motion.div
            className="relative mb-4"
            whileHover={{ scale: 1.08, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <motion.div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 4px 20px rgba(249,115,22,0.5)' }}
              animate={{ boxShadow: ['0 4px 20px rgba(249,115,22,0.4)', '0 8px 40px rgba(249,115,22,0.7)', '0 4px 20px rgba(249,115,22,0.4)'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <UtensilsCrossed className="text-white w-10 h-10" />
            </motion.div>
          </motion.div>
          <motion.h1
            className="text-3xl font-black text-white tracking-tight"
            initial={{ opacity: 0, letterSpacing: '0.3em' }}
            animate={{ opacity: 1, letterSpacing: '-0.02em' }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            ROMS
          </motion.h1>
          <motion.p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            Restaurant Order Management System
          </motion.p>
        </motion.div>

        {/* Card — slides up */}
        <motion.div
          className="glass rounded-3xl p-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        >
          <motion.h2 className="text-xl font-bold text-white mb-6"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
            Sign in to continue
          </motion.h2>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 p-4 rounded-2xl text-sm badge-new overflow-hidden"
              >
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fields stagger in */}
            {[
              {
                label: 'Email or Username',
                node: (
                  <input type="text" required className="input-dark" placeholder="admin / waiter@testy.com"
                    value={email} onChange={e => setEmail(e.target.value)} id="login-email" />
                ),
              },
              {
                label: 'Password',
                node: (
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} required className="input-dark pr-12"
                      placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} id="login-password" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ),
              },
            ].map((field, i) => (
              <motion.div key={field.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.12, duration: 0.4 }}>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>{field.label}</label>
                {field.node}
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.76 }}>
              <motion.button
                type="submit"
                disabled={loading}
                id="login-submit"
                className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 mt-2"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 30px rgba(249,115,22,0.4)' }}
                whileHover={{ scale: 1.03, boxShadow: '0 12px 40px rgba(249,115,22,0.6)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {loading ? (
                  <motion.div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                ) : (<><LogIn size={18} /> Sign In</>)}
              </motion.button>
            </motion.div>
          </form>

          {/* Quick Access */}
          <motion.div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-center mb-4"
              style={{ color: 'rgba(255,255,255,0.25)' }}>Quick Demo Access</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Admin',   icon: <Utensils size={14} />, user: 'admin',            pass: 'admin',       r: '249,115,22' },
                { label: 'Waiter',  icon: <Users size={14} />,    user: 'waiter@testy.com',  pass: 'password123', r: '6,182,212'  },
                { label: 'Kitchen', icon: <ChefHat size={14} />,  user: 'kitchen@testy.com', pass: 'password123', r: '139,92,246' },
                { label: 'Biller',  icon: <Receipt size={14} />,   user: 'biller@testy.com', pass: 'password123', r: '16,185,129' },
              ].map((item, i) => (
                <motion.button
                  key={item.label}
                  type="button"
                  onClick={() => quickFill(item.user, item.pass)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-semibold"
                  style={{
                    background:  `rgba(${item.r},0.08)`,
                    border:      `1px solid rgba(${item.r},0.2)`,
                    color:       `rgb(${item.r})`,
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.95 + i * 0.1 }}
                  whileHover={{ scale: 1.06, background: `rgba(${item.r},0.18)` }}
                  whileTap={{ scale: 0.93 }}
                >
                  {item.icon}
                  {item.label}
                </motion.button>
              ))}
            </div>
            <p className="text-center text-xs mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Click a role to auto-fill credentials
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
