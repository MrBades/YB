import React, { useState } from 'react';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { BusinessProfile } from '../types';
import { Sparkles, ArrowLeft } from 'lucide-react';

export default function GuestInvoiceGenerator({ onFinish, onLimitReached, deviceFingerprint }: { onFinish: () => void, onLimitReached: () => void, deviceFingerprint: string }) {
  const [prompt, setPrompt] = useState('');
  const [customer, setCustomer] = useState('');
  const [product, setProduct] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);

  const [trialBusinessName, setTrialBusinessName] = useState('');
  const [trialPhone, setTrialPhone] = useState('');
  const [trialAddress, setTrialAddress] = useState('');

  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);

  const generate = async (isMagic: boolean) => {
    try {
      const res = await fetch('/api/guest/invoice-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-fingerprint': deviceFingerprint
        },
        body: JSON.stringify({ device_fingerprint_hash: deviceFingerprint })
      });

      if (res.status === 403) {
        setIsLimitModalOpen(true);
        return;
      }
    } catch (err) {
      console.error("Trial tracker failed:", err);
    }
    
    const business: BusinessProfile = {
      businessName: trialBusinessName.trim() || 'YOUR BUSINESS NAME (TRIAL)',
      phone: trialPhone.trim() || '080-XXXXXXXX',
      address: trialAddress.trim() || 'Your Shop Address',
      invoiceTemplatePreference: 'classic',
    } as any;
    
    // Minimal mock invoice
    const invoice = {
        id: 'TRIAL-' + Date.now().toString().slice(-4),
        customerName: isMagic ? 'Guest Magic' : customer,
        productName: isMagic ? prompt : product,
        items: [{ 
            name: isMagic ? prompt : product, 
            quantity: isMagic ? 1 : qty, 
            price: isMagic ? 0 : price, 
            total: isMagic ? 0 : (qty * price) 
        }],
        totalAmount: isMagic ? 0 : (qty * price),
        amountPaid: 0,
        debtBalance: isMagic ? 0 : (qty * price),
        transactionType: 'sale',
        createdAt: new Date().toISOString()
    } as any;

    generateInvoicePDF(invoice, business, [], true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="flex justify-between items-center p-6 lg:px-12 border-b border-slate-900">
        <button onClick={onFinish} className="flex items-center gap-2 text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-black tracking-tighter">Yeedem Books</h1>
        <div className="w-16"></div> {/* Spacer */}
      </header>

      <main className="flex-grow p-6 lg:px-12 flex flex-col items-center">
        <div className="max-w-2xl w-full space-y-8">
            <h2 className="text-3xl font-bold text-center">Trial Invoice Generator</h2>

            <div className="bg-slate-900 p-6 rounded-3xl space-y-4">
                <h3 className="font-bold text-[#00A6FF] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A6FF] animate-pulse"></span>
                  Custom Store Headers
                </h3>
                <p className="text-xs text-slate-400">Complete these optional fields to replace default template headers with your own custom business context.</p>
                <div className="space-y-3">
                  <input 
                    value={trialBusinessName} 
                    onChange={e => setTrialBusinessName(e.target.value)} 
                    placeholder="Business / Store Name" 
                    className="w-full p-4 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-700" 
                  />
                  <div className="flex gap-4">
                    <input 
                      value={trialPhone} 
                      onChange={e => setTrialPhone(e.target.value)} 
                      placeholder="Store Phone Contact" 
                      className="flex-1 p-4 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-700" 
                    />
                    <input 
                      value={trialAddress} 
                      onChange={e => setTrialAddress(e.target.value)} 
                      placeholder="Store Location Address" 
                      className="flex-1 p-4 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-700" 
                    />
                  </div>
                </div>
            </div>
            
            <div className="bg-slate-900 p-6 rounded-3xl space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 color-[#00A6FF]" /> Magic Mode</h3>
                <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. 5 bags of sugar to Musa" className="w-full p-4 rounded-xl bg-slate-800 text-slate-100 border border-slate-700" />
                <button onClick={() => generate(true)} className="w-full bg-[#00A6FF] py-3 rounded-xl font-bold hover:bg-blue-600">Generate Magic</button>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl space-y-4">
                <h3 className="font-bold">Manual Mode</h3>
                <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer Name" className="w-full p-4 rounded-xl bg-slate-800 text-slate-100 border border-slate-700" />
                <input value={product} onChange={e => setProduct(e.target.value)} placeholder="Product Name" className="w-full p-4 rounded-xl bg-slate-800 text-slate-100 border border-slate-700" />
                <div className="flex gap-4">
                    <input type="number" value={qty} onChange={e => setQty(parseInt(e.target.value))} placeholder="Qty" className="flex-1 p-4 rounded-xl bg-slate-800 text-slate-100 border border-slate-700" />
                    <input type="number" value={price} onChange={e => setPrice(parseInt(e.target.value))} placeholder="Price" className="flex-1 p-4 rounded-xl bg-slate-800 text-slate-100 border border-slate-700" />
                </div>
                <button onClick={() => generate(false)} className="w-full bg-slate-700 py-3 rounded-xl font-bold hover:bg-slate-600">Generate Manual Invoice</button>
            </div>
        </div>
      </main>
      
      <footer className="p-8 text-center text-slate-600 text-xs border-t border-slate-900 mx-auto w-full max-w-4xl">
        <p>© 2026 Yeedem Tech. Optimized for Nigerian SMEs. Business Identity: Yeedem Tech | Team: Suleman & Sesan</p>
      </footer>

      {isLimitModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-700 text-center space-y-6">
            <h2 className="text-2xl font-bold text-white">Trial Limit Reached</h2>
            <p className="text-slate-400">You have generated 2 free trial invoices. To continue generating unlimited professional invoices and managing your ledger securely, please sign up for an account.</p>
            <button onClick={onLimitReached} className="w-full bg-[#00A6FF] text-white py-4 rounded-xl font-bold hover:bg-blue-600 shadow-lg shadow-blue-500/20">Sign Up Now</button>
          </div>
        </div>
      )}
    </div>
  );
}
