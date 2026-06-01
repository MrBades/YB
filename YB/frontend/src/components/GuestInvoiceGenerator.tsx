import React, { useState } from 'react';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { BusinessProfile } from '../types';
import { ArrowLeft } from 'lucide-react';
import SmartWidget from './SmartWidget';

export default function GuestInvoiceGenerator({ onFinish, onLimitReached, deviceFingerprint, isAuthenticated }: { onFinish: () => void, onLimitReached: () => void, deviceFingerprint: string, isAuthenticated: boolean }) {
  const [trialBusinessName, setTrialBusinessName] = useState('');
  const [trialPhone, setTrialPhone] = useState('');
  const [trialAddress, setTrialAddress] = useState('');

  const handleSaveTrialInvoice = (parsedInvoice: any) => {
    if (!isAuthenticated) {
      alert("Please log in to generate and download invoices.");
      // Explicitly clear guest state before redirecting
      setTrialBusinessName('');
      setTrialPhone('');
      setTrialAddress('');
      onLimitReached(); // Or redirect to login
      return;
    }
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

    // Fallback item if empty
    if (invoice.items.length === 0) {
      invoice.items = [{
        name: parsedInvoice.productName || 'General Commodity',
        quantity: 1,
        price: parsedInvoice.totalAmount,
        total: parsedInvoice.totalAmount
      }];
    }

    generateInvoicePDF(invoice, business, [], true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">

      <main className="flex-grow p-2 flex flex-col items-center">
        <div className="max-w-3xl w-full">
            
            {/* Unified Smart Invoice Arena Container (Card-based layout) */}
            <div className="bg-white rounded-[32px] p-4 md:p-6 shadow-sm border border-gray-150 space-y-4">
              
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
                <div className="space-y-3">
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
        </div>
      </main>
      
    </div>
  );
}
