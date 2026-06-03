import React, { useState } from 'react';
import { Sparkles, Database, Bell, LayoutGrid, CheckCircle2, ChevronRight } from 'lucide-react';
import SmartWidget from './SmartWidget';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { BusinessProfile } from '../types';

interface LandingPageProps {
  onNavigate: (screen: 'login' | 'about' | 'terms' | 'guest_invoice') => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [trialBusinessName, setTrialBusinessName] = useState('');
  const [trialPhone, setTrialPhone] = useState('');
  const [trialAddress, setTrialAddress] = useState('');

  // Custom Trial Invoice pdf compiler handler
  const handleSaveTrialInvoice = (parsedInvoice: any) => {
    const business: BusinessProfile = {
      businessName: trialBusinessName.trim() || 'YOUR BUSINESS NAME (TRIAL)',
      phone: trialPhone.trim() || '080-XXXXXXXX',
      address: trialAddress.trim() || 'Your Shop Address',
      invoiceTemplatePreference: 'modern_blue',
      businessLogo: '',
      customAccentColor: '#00A6FF',
      customFontSize: 'md',
      customFontFamily: 'sans',
      customShowLogo: false,
      customHeaderTitle: 'DEMO TRIAL INVOICE',
      customFooterNotes: 'This document acts as an immediate trial compiling copy.',
      customShadowStyle: 'sm'
    };

    const invoice = {
      id: 'TRIAL-' + Date.now().toString().slice(-4),
      customerName: parsedInvoice.customerName || 'Walk-in Customer',
      productName: parsedInvoice.productName || 'General Commodity',
      items: parsedInvoice.items || [],
      totalAmount: parsedInvoice.totalAmount,
      amountPaid: parsedInvoice.amountPaid,
      debtBalance: parsedInvoice.debtBalance,
      transactionType: parsedInvoice.transactionType || 'sale',
      createdAt: new Date().toISOString()
    };

    // Make sure we have at least one fallback item if items array is empty
    if (invoice.items.length === 0) {
      invoice.items = [{
        name: parsedInvoice.productName || 'General Commodity',
        quantity: 1,
        price: parsedInvoice.totalAmount,
        total: parsedInvoice.totalAmount
      }];
    }

    // Call standard PDF download with guest toggle active (4th argument = true)
    generateInvoicePDF(invoice, business, [], true);
    alert('🎉 Trial Invoice Compiled! Your official FIRS-formatted PDF has been compiled and downloaded successfully.');
  };

  return (
    <div className="space-y-12 animate-fadeIn">
      {/* 1. Hero Block */}
      <section className="text-center space-y-6 py-6 max-w-4xl mx-auto">
        <span className="px-3.5 py-1.5 bg-[#00A6FF]/10 text-[#00A6FF] rounded-full text-[10px] font-black uppercase tracking-wider">
          💡 Intelligent Trade Journals for Nigerian Retail
        </span>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-black text-[#0E1338] tracking-tight leading-tighter">
          Simple Accounting & <span className="text-[#00A6FF]">Invoicing</span> for Your Business
        </h1>
        <p className="text-gray-550 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          Create beautiful, tax-compliant invoice templates in seconds using just plain text. Re-structure store operations and protect wholesale profit margins with zero complex forms required.
        </p>
        <div className="pt-2">
          <button
            onClick={() => onNavigate('login')}
            className="px-6 py-3 bg-[#0E1338] hover:bg-slate-900 text-white font-bold rounded-xl text-xs md:text-sm shadow-md hover:shadow-lg transition flex items-center gap-2 mx-auto"
          >
            Create Your Store Profile <ChevronRight size={16} />
          </button>
        </div>
      </section>

      {/* 2. Unified Smart Invoice Arena Container (Replicating exact dashboard card specs) */}
      <section className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-gray-150/80 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-2">
            <div>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-[#00A6FF] rounded-full text-[9px] font-extrabold uppercase tracking-wide border border-blue-100">
                ⚡ LIVE INTERACTIVE SANDBOX
              </span>
              <h2 className="text-md sm:text-lg font-bold text-[#0E1338] mt-1">Smart Invoice Engine (Fuse Mode)</h2>
            </div>
            <span className="text-[10px] text-gray-400 italic">2 Free Trials Remaining</span>
          </div>

          <div className="text-gray-600 text-xs py-1 leading-relaxed">
            Test the live compiler below! Type an order query (e.g., <span className="font-mono text-blue-600 font-bold bg-blue-50 px-1 py-0.5 rounded">6 sacks of flour to Alao for 32k each, paid 120k</span>) or click the <span className="font-bold text-[#0E1338]">Manual</span> tab to input details manually. Click "Commit Ledger" to instantly download your trial receipt.
          </div>

          {/* Dynamic Context Form for Business Profile Customization */}
          <div className="bg-[#F8FAFC] p-5 rounded-2xl border border-gray-150 space-y-3 mt-2 text-left">
            <h3 className="text-[11px] font-bold text-[#0E1338] uppercase tracking-wider flex items-center gap-1.5 justify-start">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Enter Your Company Details (Trial Invoice Headers)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] uppercase font-black text-gray-400 mb-1 tracking-wider">Business Name</label>
                <input
                  type="text"
                  value={trialBusinessName}
                  onChange={e => setTrialBusinessName(e.target.value)}
                  placeholder="e.g. ALABA FLOUR DEPOT"
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#00a6ff]"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-black text-gray-400 mb-1 tracking-wider">Phone Number</label>
                <input
                  type="text"
                  value={trialPhone}
                  onChange={e => setTrialPhone(e.target.value)}
                  placeholder="e.g. +234 812-345-6789"
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#00a6ff]"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-black text-gray-400 mb-1 tracking-wider">Location Address</label>
                <input
                  type="text"
                  value={trialAddress}
                  onChange={e => setTrialAddress(e.target.value)}
                  placeholder="e.g. Shop 4, SME Complex, Lagos"
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#00a6ff]"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 leading-snug">
              * The dynamic details typed above will instantly overwrite the default layout template headers on your compiled PDF.
            </p>
          </div>

          <div id="smart-widget" className="pt-2">
            <SmartWidget onSaveParsedInvoice={handleSaveTrialInvoice} />
          </div>
        </div>
      </section>

      {/* 3. Features Grid (Structured exactly like dashboard's metrics cards) */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold font-serif text-[#0E1338]">Why Hundreds of Wholesalers Choose Yeedem</h2>
          <p className="text-xs text-gray-400">Streamlined tools built purely to improve retail cash flow retention.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto pt-2">
          {/* Card 1 */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 space-y-4 hover:border-blue-200 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00A6FF]/10 text-[#00A6FF] flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">Quick Sales AI Input</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Record sound files, snap phone pictures of receipts, or type raw messages. Our parsing pipeline compiles tax lines instantly.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-[#00A6FF] font-black uppercase tracking-wider flex items-center gap-1">
              ✓ Compliant format <CheckCircle2 size={10} />
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 space-y-4 hover:border-blue-200 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Database size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">Offline Lock Security</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Log transactions offline inside local structures. Sessions cache securely and sync with primary cloud databases upon network reconnect.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-emerald-500 font-black uppercase tracking-wider flex items-center gap-1">
              ✓ Persistent Storage <CheckCircle2 size={10} />
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 space-y-4 hover:border-blue-200 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Bell size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">Outstanding Debt Aging</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Gain deep visibility over client ledgers. Promptly dispatch polite pre-composed debt balance reminders directly over WhatsApp.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-1">
              ✓ Automated warnings <CheckCircle2 size={10} />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Mini Footer Invitation */}
      <section className="bg-white rounded-3xl p-8 border border-gray-100 text-center space-y-4 max-w-3xl mx-auto">
        <h3 className="text-md sm:text-lg font-bold text-[#0E1338]">Ready to Elevate Your Retail Enterprise?</h3>
        <p className="text-gray-400 text-xs max-w-lg mx-auto">
          Start recording secure transaction ledgers and generating official FIRS compliant trade reports. 14-day free trial on registered merchant workspaces.
        </p>
        <button
          onClick={() => onNavigate('login')}
          className="px-5 py-2.5 bg-[#00A6FF] hover:bg-opacity-95 text-white text-xs font-bold rounded-xl transition shadow"
        >
          Begin Free Ledger Account
        </button>
      </section>

    </div>
  );
}
