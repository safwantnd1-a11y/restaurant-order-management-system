import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Eye, EyeOff, AlertCircle, Wifi, Search, Utensils, ShieldBan, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function WaiterLogin() {
  const { login } = useAuth();
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [serverUrl, setServerUrl] = useState(
    localStorage.getItem('__roms_server_ip') || ''
  );
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [step,     setStep]     = useState<'server' | 'login'>(() =>
    localStorage.getItem('__roms_server_ip') ? 'login' : 'server'
  );

  // Auto-scan local network for ROMS server
  const autoScan = async () => {
    setScanning(true);
    setError('');
    const subnets = ['192.168.1', '192.168.0', '192.168.29', '192.168.100', '10.0.0'];
    let found = '';
    for (const subnet of subnets) {
      if (found) break;
      const promises = Array.from({ length: 49 }, (_, i) => {
        const ip = `http://${subnet}.${i + 2}:3000`;
        return axios.get(`${ip}/api/public/menu`, { timeout: 1200 }).then(() => ip).catch(() => null);
      });
      const results = await Promise.all(promises);
      found = results.find(ip => ip !== null) || '';
    }
    if (found) {
      setServerUrl(found);
      setError('');
      setStep('login');
    } else {
      setError('Server not found. Make sure you are on the same WiFi as the restaurant PC and the ROMS app is running.');
    }
    setScanning(false);
  };

  const handleServerConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim()) { setError('Please enter the server IP.'); return; }
    let url = serverUrl.trim();
    if (!url.startsWith('http')) url = 'http://' + url;
    if (!url.includes(':', 6) && url.split('.').length === 4) url = url + ':3000';
    localStorage.setItem('__roms_server_ip', url);
    axios.defaults.baseURL = url;
    setServerUrl(url);
    setStep('login');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // Set base URL from saved server IP
    const savedUrl = localStorage.getItem('__roms_server_ip');
    if (savedUrl) axios.defaults.baseURL = savedUrl;

    try {
      await login(email, password);
      // After login, check role — only waiter allowed
      const rawUser = localStorage.getItem('user');
      const userData = rawUser ? JSON.parse(rawUser) : null;
      if (userData && userData.role !== 'waiter') {
        // Not a waiter — block and log out
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setError('Access Denied. Only Waiter accounts are allowed in this app.');
        setLoading(false);
        return;
      }
      // Success — go to waiter dashboard
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Wrong username or password.');
    } finally {
      setLoading(false);
    }
  };

  const resetServer = () => {
    localStorage.removeItem('__roms_server_ip');
    axios.defaults.baseURL = '';
    setServerUrl('');
    setStep('server');
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-5"
      style={{ background: 'linear-gradient(160deg, #0a0a14 0%, #0f0f1f 60%, #0a0a14 100%)' }}>

      {/* Animated Background Orbs */}
      {[
        { top: '-15%', left: '-10%',  size: 500, color: '#f97316' },
        { top: '60%',  right: '-10%', size: 400, color: '#6366f1' },
        { top: '30%',  left: '40%',   size: 250, color: '#06b6d4' },
      ].map((orb, i) => (
        <motion.div key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: orb.size, height: orb.size,
            top: orb.top, left: 'left' in orb ? orb.left : undefined,
            right: 'right' in orb ? orb.right : undefined,
            background: `radial-gradient(circle, ${orb.color}28 0%, transparent 70%)`,
          }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 5 + i * 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.9 }}
        />
      ))}

      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
          backgroundSize: '55px 55px',
        }} />

      <div className="relative z-10 w-full max-w-sm">

        {/* Logo Section */}
        <motion.div className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}>
          <motion.div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 relative"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
            animate={{ boxShadow: ['0 4px 20px rgba(249,115,22,0.4)', '0 8px 42px rgba(249,115,22,0.7)', '0 4px 20px rgba(249,115,22,0.4)'] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            whileHover={{ rotate: 8, scale: 1.08 }}>
            <Utensils size={34} className="text-white" />
          </motion.div>
          <motion.h1 className="text-3xl font-black text-white tracking-tight"
            initial={{ opacity: 0, letterSpacing: '0.25em' }}
            animate={{ opacity: 1, letterSpacing: '-0.02em' }}
            transition={{ duration: 0.7, delay: 0.2 }}>
            Waiter App
          </motion.h1>
          <motion.p className="text-sm mt-1.5 font-semibold"
            style={{ color: '#f97316' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            ROMS · Restaurant Order System
          </motion.p>
          {/* Server URL indicator */}
          {step === 'login' && serverUrl && (
            <motion.div className="flex items-center gap-2 mt-3 px-4 py-2 rounded-full"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-green-400 truncate max-w-[200px]">
                {serverUrl.replace('http://', '')}
              </span>
              <button onClick={resetServer} title="Change server">
                <RefreshCw size={11} className="text-green-400 opacity-60 hover:opacity-100" />
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* Card */}
        <motion.div className="rounded-3xl p-7"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}>

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div className="flex items-start gap-3 p-4 rounded-2xl mb-5 text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}>
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── STEP 1: Server Connection ─── */}
          <AnimatePresence mode="wait">
            {step === 'server' && (
              <motion.div key="server-step"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                <h2 className="text-lg font-bold text-white mb-1">Connect to Server</h2>
                <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Enter the IP address of the restaurant PC running ROMS, or auto-scan your WiFi.
                </p>

                <form onSubmit={handleServerConnect} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>Server IP Address</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="e.g. 192.168.1.5:3000"
                        value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-sm px-4 py-3.5 rounded-2xl"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                      <motion.button type="button" onClick={autoScan} disabled={scanning}
                        className="px-4 rounded-2xl flex items-center justify-center font-bold text-sm"
                        style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', minWidth: 52 }}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
                        title="Auto-scan WiFi network">
                        {scanning
                          ? <motion.div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full"
                              animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
                          : <Search size={18} />}
                      </motion.button>
                    </div>
                    {scanning && (
                      <motion.p className="text-xs mt-2" style={{ color: 'rgba(249,115,22,0.7)' }}
                        animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity }}>
                        🔍 Scanning network... please wait
                      </motion.p>
                    )}
                  </div>

                  <motion.button type="submit"
                    className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 6px 24px rgba(249,115,22,0.4)' }}
                    whileHover={{ scale: 1.03, boxShadow: '0 10px 36px rgba(249,115,22,0.6)' }}
                    whileTap={{ scale: 0.97 }}>
                    <Wifi size={17} /> Connect
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ─── STEP 2: Waiter Login ─── */}
            {step === 'login' && (
              <motion.div key="login-step"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-white">Waiter Sign In</h2>
                  {/* Waiter-only badge */}
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                    style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
                    <Utensils size={9} /> Waiter Only
                  </span>
                </div>
                <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Only Waiter accounts can log in here. Admin/Kitchen access is blocked.
                </p>

                {/* Blocked role warning */}
                <motion.div className="flex items-center gap-2 p-3 rounded-2xl mb-5 text-xs font-semibold"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: 'rgba(248,113,113,0.7)' }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <ShieldBan size={13} />
                  Admin and Kitchen accounts are NOT allowed in this app
                </motion.div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>Email or Username</label>
                    <input type="text" required placeholder="waiter@testy.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full bg-transparent outline-none text-sm px-4 py-3.5 rounded-2xl"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>Password</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} required placeholder="••••••••"
                        value={password} onChange={e => setPassword(e.target.value)}
                        className="w-full bg-transparent outline-none text-sm px-4 py-3.5 rounded-2xl pr-12"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                        style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <motion.button type="submit" disabled={loading}
                    className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 mt-2"
                    style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 28px rgba(249,115,22,0.45)' }}
                    whileHover={{ scale: 1.03, boxShadow: '0 12px 36px rgba(249,115,22,0.65)' }}
                    whileTap={{ scale: 0.97 }}>
                    {loading
                      ? <motion.div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                      : <><LogIn size={18} /> Sign In</>}
                  </motion.button>
                </form>

                {/* Change server link */}
                <motion.button onClick={resetServer}
                  className="w-full mt-5 text-xs font-semibold flex items-center justify-center gap-1.5"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                  whileHover={{ color: 'rgba(255,255,255,0.5)' }}>
                  <RefreshCw size={11} /> Change Server / Reconnect
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <motion.p className="text-center text-xs mt-6 font-medium"
          style={{ color: 'rgba(255,255,255,0.15)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
          ROMS Waiter App · Powered by Restaurant Order Management System
        </motion.p>
      </div>
    </div>
  );
}
