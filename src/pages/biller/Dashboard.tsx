import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import axios from 'axios';
import { LogOut, Receipt, Printer, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function BillerDashboard() {
  const { logout, user } = useAuth();
  const { socket } = useSocket();
  const [tables, setTables] = useState<any[]>([]);
  const [billingTable, setBillingTable] = useState<any>(null);
  const [billDetails, setBillDetails] = useState<any>(null);

  useEffect(() => {
    fetchTables();
    if (socket) {
      socket.on('new-order', fetchTables);
      socket.on('order-status-updated', fetchTables);
    }
    return () => {
      if (socket) {
        socket.off('new-order');
        socket.off('order-status-updated');
      }
    };
  }, [socket]);

  const fetchTables = async () => {
    const r = await axios.get('/api/tables');
    setTables(r.data);
  };

  const loadBill = async (table: any) => {
    setBillingTable(table);
    const res = await axios.get(`/api/tables/${table.id}/bill`);
    setBillDetails(res.data);
  };

  const markAsPaid = async (tableId: number) => {
    if(window.confirm('Mark this table as PAID and clear its orders?')) {
      try {
        await axios.post(`/api/tables/${tableId}/pay`);
        setBillingTable(null);
        setBillDetails(null);
        fetchTables();
      } catch (err) {
        alert('Failed to clear table');
      }
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
              return `
                <tr>
                  <td>${item.item_name} ${item.portion === 'half' ? '(½)' : ''}</td>
                  <td style="text-align: right;">${item.quantity}</td>
                  <td style="text-align: right;">$${(price * item.quantity).toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <hr style="border-top: 1px dashed black; margin: 10px 0;" />
        <div style="font-size: 12px; display: flex; justify-content: space-between;">
           <span>Subtotal:</span>
           <span>$${totalWithoutGst.toFixed(2)}</span>
        </div>
        <div style="font-size: 12px; display: flex; justify-content: space-between;">
           <span>CGST (2.5%):</span>
           <span>$${(gstAmount/2).toFixed(2)}</span>
        </div>
        <div style="font-size: 12px; display: flex; justify-content: space-between;">
           <span>SGST (2.5%):</span>
           <span>$${(gstAmount/2).toFixed(2)}</span>
        </div>
        <hr style="border-top: 1px dashed black; margin: 10px 0;" />
        <div style="font-size: 16px; font-weight: bold; display: flex; justify-content: space-between;">
           <span>Grand Total:</span>
           <span>$${grandTotal.toFixed(2)}</span>
        </div>
        <p style="text-align: center; font-size: 12px; margin-top: 20px;">Thank you for dining with us!</p>
      </div>
    `;

    const printWindow = window.open('', '', 'height=600,width=400');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Bill</title>');
      printWindow.document.write('</head><body style="margin:0;display:flex;justify-content:center;">');
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0f', color: 'white' }}>
      <header className="px-6 py-4 flex items-center justify-between" style={{ background: '#070710', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
             {user?.name[0]?.toUpperCase() || 'B'}
          </div>
          <div>
            <h1 className="font-black text-lg text-white">GST Billing Panel</h1>
            <p className="text-xs font-semibold text-white/40">Logged in as {user?.name}</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-400 bg-red-400/10 hover:bg-red-400/20 font-bold text-sm transition-colors">
          <LogOut size={16} /> Logout
        </button>
      </header>
      
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
         <h2 className="text-3xl font-black text-white mb-6">Billing Requests</h2>
         
         {tables.filter(t => t.active_orders_count > 0).length === 0 ? (
            <motion.div className="flex flex-col items-center justify-center py-24 text-center rounded-3xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
               <DollarSign size={52} className="mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
               <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>No tables to bill</p>
               <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Completed tabs are settled</p>
            </motion.div>
          ) : !billingTable ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {tables.filter(t => t.active_orders_count > 0).sort((a,b) => (b.bill_requested ? 1 : 0) - (a.bill_requested ? 1 : 0)).map(t => (
                <motion.button key={t.id} onClick={() => loadBill(t)}
                  className="p-5 rounded-3xl flex flex-col items-start relative overflow-hidden text-left"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', border: t.bill_requested ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)' }}
                  whileHover={{ background: 'rgba(255,255,255,0.09)', scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                    <Receipt size={28} className="mb-3" style={{ color: t.bill_requested ? '#ef4444' : '#4ade80' }} />
                    <span className="font-bold text-white text-xl">Table {t.table_number.split(' ')[1] || t.table_number}</span>
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
          ) : billDetails && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="mx-auto rounded-3xl overflow-hidden relative max-w-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-bl-[100px] pointer-events-none" />
              <div className="p-6 flex justify-between items-start" style={{ borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                 <div className="flex-1">
                   <button onClick={() => setBillingTable(null)} className="text-sm mb-3 font-semibold pb-1 pr-3 hover:text-orange-400 transition-colors" style={{ color: '#f97316' }}>← Back</button>
                   <h2 className="text-2xl font-bold text-white">Table {billingTable.table_number.split(' ')[1] || billingTable.table_number} Bill</h2>
                   <div className="flex items-center gap-3">
                      <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Merged {billDetails.orders.length} tickets</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <p className="text-3xl font-black text-white" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>${billDetails.total.toFixed(2)}</p>
                   <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: '#4ade80' }}>Total (Excl GST)</p>
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
      </main>
    </div>
  );
}
