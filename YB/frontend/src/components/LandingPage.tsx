import React from 'react';
import { 
  Sparkles, 
  Database, 
  Bell, 
  CheckCircle2, 
  ChevronRight, 
  ArrowRight,
  ShieldCheck, 
  Store, 
  MessageSquare, 
  TrendingUp, 
  Lock, 
  FileCheck,
  Layers,
  Users
} from 'lucide-react';
import PricingGrid from './PricingGrid';

interface LandingPageProps {
  onNavigate: (screen: 'login' | 'about' | 'terms' | 'guest_invoice') => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="space-y-16 py-4 animate-fadeIn">
      
      {/* 1. Hero Block */}
      <section className="text-center space-y-6 py-8 max-w-7xl mx-auto px-4">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00A6FF]/10 text-[#00A6FF] rounded-full text-[10px] font-black uppercase tracking-wider">
          <Sparkles size={11} className="animate-pulse" />
          Intelligent Trade Journals for Nigerian Retail & Wholesale
        </span>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-black text-[#0E1338] tracking-tight leading-tight">
          Simple Bookkeeping & <span className="text-[#00A6FF]">Invoicing</span> for Modern Merchant Hubs
        </h1>
        <p className="text-gray-550 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          Record cash flows, protect dealer profit margins, and manage outstanding debtor accounts safely. Generate professional FIRS-compliant template invoices in seconds from anywhere in Nigeria.
        </p>
        <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => onNavigate('login')}
            className="w-full sm:w-auto px-8 py-4 bg-[#0E1338] hover:bg-[#151c50] text-white font-bold rounded-xl text-xs md:text-sm shadow-md hover:shadow-lg hover:shadow-[#0E1338]/15 active:scale-[0.99] transition duration-300 flex items-center justify-center gap-2 group cursor-pointer"
          >
            Access Merchant Terminal 
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button
            onClick={() => onNavigate('guest_invoice')}
            className="w-full sm:w-auto px-8 py-4 bg-[#00A6FF] hover:bg-[#0095E6] text-white font-bold rounded-xl text-xs md:text-sm shadow-md hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.99] transition duration-300 flex items-center justify-center gap-2 cursor-pointer"
          >
            Launch Free Quick Invoice Generator <FileCheck size={16} />
          </button>
        </div>
      </section>

      {/* 1B. Highly Polished Spotlight Banner for Free Invoice Tool */}
      <section className="max-w-7xl mx-auto px-4 -mt-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="space-y-2 text-center md:text-left">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-650 rounded-full text-[9px] font-black uppercase tracking-wider">
              ⚡ NO SIGNUP REQUIRED
            </span>
            <h3 className="text-md sm:text-lg font-serif font-black text-[#0E1338] tracking-tight">
              Need to write a single invoice right away?
            </h3>
            <p className="text-gray-500 text-xs max-w-lg leading-relaxed">
              Use our sandboxed guest generator completely free. Instantly add custom items, compute Nigerian taxes automatically, and download a pristine PDF receipt on the spot.
            </p>
          </div>
          <button
            onClick={() => onNavigate('guest_invoice')}
            className="w-full md:w-auto shrink-0 px-6 py-3.5 bg-white hover:bg-slate-50 text-[#00A6FF] border border-[#00A6FF]/40 hover:border-[#0095E6] font-extrabold rounded-xl text-xs transition duration-200 active:scale-95 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            Create Quick Invoice <ArrowRight size={14} className="text-[#00A6FF]" />
          </button>
        </div>
      </section>

      {/* 2. Interactive Feature Showcase (Premium Bento-Grid style) */}
      <section className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#00A6FF] block">POWERFUL MERCHANT UTILITIES</span>
          <h2 className="text-2xl md:text-3xl font-serif font-extrabold text-[#0E1338]">All-In-One Automated Bookkeeping</h2>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">Skip complex manual spreadsheets. Yeedem books records raw trade streams and handles tax formulas automatically.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          
          {/* Card 1: FIRS Receipt Compliance */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150/80 hover:border-[#00A6FF]/40 hover:shadow-md transition duration-300 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00A6FF]/10 text-[#00A6FF] flex items-center justify-center">
                <FileCheck size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">FIRS Standard Compliance</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Automatically formats sales into templates compliant with Nigerian tax codes. Dynamically calculates sales percentages, withholding rates, and product classifications out of the box.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-[#00A6FF] font-black uppercase tracking-wider flex items-center gap-1">
              ✓ Compliant Formats <CheckCircle2 size={11} />
            </div>
          </div>

          {/* Card 2: Absolute Offline Security */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150/80 hover:border-[#00A6FF]/40 hover:shadow-md transition duration-300 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                <Database size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">Local Cache & Cloud Sync</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Log transactions offline when network speeds in open markets drop. Ledger data caches securely inside local browser files, auto-syncing soon as connectivity is restored.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-indigo-500 font-black uppercase tracking-wider flex items-center gap-1">
              ✓ Persistent Cache <CheckCircle2 size={11} />
            </div>
          </div>

          {/* Card 3: Debt Aging & Reminders */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150/80 hover:border-[#00A6FF]/40 hover:shadow-md transition duration-300 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">WhatsApp Debt Dispatch</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Draft professional pre-composed debt balance statements in seconds. Send polite ledger details instantly to distribution clients over WhatsApp to collect receivables faster.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-1">
              ✓ Fast Collection <CheckCircle2 size={11} />
            </div>
          </div>

          {/* Card 4: Automated Backups */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150/80 hover:border-[#00A6FF]/40 hover:shadow-md transition duration-300 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">Encrypted Cloud Backups</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Avoid ledger losses due to lost phones. Create manual snapshots or authorize automated backup triggers. Re-migrate complete catalogs with a single administrative restore token.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-emerald-500 font-black uppercase tracking-wider flex items-center gap-1">
              ✓ Failsafe Restores <CheckCircle2 size={11} />
            </div>
          </div>

          {/* Card 5: Delegated Operator Staff logins */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150/80 hover:border-[#00A6FF]/40 hover:shadow-md transition duration-300 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Users size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">Multi-Operator Clerk Roles</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Assign restricted logins to shop clerks or cashiers. Operators can record sales and print receipts, but only the business owner's primary PIN can delete records or view margins.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-purple-500 font-black uppercase tracking-wider flex items-center gap-1">
              ✓ Dual Role Securities <CheckCircle2 size={11} />
            </div>
          </div>

          {/* Card 6: Dynamic Analytics */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150/80 hover:border-[#00A6FF]/40 hover:shadow-md transition duration-300 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#0E1338] tracking-tight">Enterprise Margin Insights</h3>
              <p className="text-gray-450 text-[11px] leading-relaxed">
                Monitor live graphs of cash sales versus credit liabilities. Review daily trade trends, highlight top distributing clients, and see products with high wholesale turnover rates.
              </p>
            </div>
            <div className="pt-2 text-[10px] text-pink-500 font-black uppercase tracking-wider flex items-center gap-1">
              ✓ Dynamic Dashboards <CheckCircle2 size={11} />
            </div>
          </div>

        </div>
      </section>

      {/* 3. "How It Works" Step-by-Step Success Workflow */}
      <section className="bg-white rounded-[32px] p-8 md:p-12 border border-gray-150 max-w-6xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#00A6FF] block">SIMPLE LEDGER TRANSITION</span>
          <h2 className="text-xl md:text-2xl font-serif font-extrabold text-[#0E1338]">Streamlined Setup in 3 Simple Steps</h2>
          <p className="text-xs text-gray-450 max-w-lg mx-auto">Get your retail floor up and running on Yeedem in less than five minutes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
          {/* Step 1 */}
          <div className="relative space-y-3">
            <span className="absolute -top-6 -left-2 text-7xl font-sans font-black text-gray-50 select-none">1</span>
            <div className="relative pl-2">
              <Store className="w-5 h-5 text-[#00A6FF] mb-2" />
              <h4 className="text-xs md:text-sm font-bold text-[#0E1338]">Create Your Master Profile</h4>
              <p className="text-gray-450 text-[11px] leading-relaxed mt-1">
                Verify your email, upload your corporate logo, choose customizable background accents, and configure default headers.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative space-y-3">
            <span className="absolute -top-6 -left-2 text-7xl font-sans font-black text-gray-50 select-none">2</span>
            <div className="relative pl-2">
              <Layers className="w-5 h-5 text-[#00A6FF] mb-2" />
              <h4 className="text-xs md:text-sm font-bold text-[#0E1338]">Populate Your Catalogs</h4>
              <p className="text-gray-450 text-[11px] leading-relaxed mt-1">
                Quickly add stock items or distributor names. Easily handle multi-item purchases and record deposits or unpaid balances.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative space-y-3">
            <span className="absolute -top-6 -left-2 text-7xl font-sans font-black text-gray-50 select-none">3</span>
            <div className="relative pl-2">
              <Lock className="w-5 h-5 text-[#00A6FF] mb-2" />
              <h4 className="text-xs md:text-sm font-bold text-[#0E1338]">Lock & Rest Assured</h4>
              <p className="text-gray-450 text-[11px] leading-relaxed mt-1">
                Protect operations using high-defense storefront lock-screens and back up everything to secure servers automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Localized Pricing Plans (Naira ₦) */}
      <section className="max-w-7xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#00A6FF] block">FLEXIBLE COMMERCIAL SUBSCRIPTIONS</span>
          <h2 className="text-2xl md:text-3xl font-serif font-extrabold text-[#0E1338]">Tailored Workspace Pricing Plans</h2>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">Choose a plan that fits your business scale. No setup fees, cancel anytime.</p>
        </div>
        <PricingGrid onNavigate={onNavigate} />
      </section>

      {/* 5. Honest Nigerian Market Testimonials */}
      <section className="bg-[#0E1338] text-white rounded-[32px] p-8 md:p-12 max-w-6xl mx-auto px-4 space-y-10 relative overflow-hidden">
        {/* Subtle background glow decorative lines */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full filter blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00A6FF]/5 rounded-full filter blur-3xl pointer-events-none"></div>

        <div className="text-center space-y-2 relative z-10">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#00A6FF]">TRUSTED ACROSS COMMERCE HUBS</span>
          <h2 className="text-2xl font-serif font-black tracking-tight">Success Stories From Registered Merchants</h2>
          <p className="text-xs text-gray-300 max-w-md mx-auto">See how other distributors are optimizing outstanding debtor collections easily.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          {/* Testimonial 1 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-xs text-gray-200 italic leading-relaxed">
              "Managing three warehouse operations in Alaba was a constant headache of duplications and lost cashier books. In Yeedem, my storeboys key-in incoming sales on their phones even when network drops, and I audit our ledger reports instantly from home. Highly recommended!"
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#00A6FF]/20 flex items-center justify-center text-xs font-black text-[#00A6FF]">
                ON
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-white">Chief Okey N.</h4>
                <p className="text-[9px] text-[#00A6FF] uppercase font-bold tracking-wider">Alaba International Market, Lagos</p>
              </div>
            </div>
          </div>

          {/* Testimonial 2 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-xs text-gray-200 italic leading-relaxed">
              "The automated PDF invoices downloaded are perfectly clean. But our ultimate feature is the WhatsApp debtor trigger! We sent preformatted balance cards to our retailers last Tuesday and reclaimed over ₦450,000 in outstanding credit payments in under 48 hours."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#00A6FF]/20 flex items-center justify-center text-xs font-black text-[#00A6FF]">
                LK
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-white">Alhaji Lawal K.</h4>
                <p className="text-[9px] text-[#00A6FF] uppercase font-bold tracking-wider">Kano Textile Market</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Mini Footer Invitation */}
      <section className="bg-white rounded-3xl p-8 border border-gray-150 text-center space-y-4 max-w-7xl mx-auto px-4">
        <h3 className="text-md sm:text-lg font-bold text-[#0E1338]">Ready to Protect Wholesaler Profits?</h3>
        <p className="text-gray-400 text-xs max-w-lg mx-auto">
          Start recording high-accuracy transaction ledgers. Secure your credentials, register an administrative PIN, and start downloading compliant invoices today.
        </p>
        <button
          onClick={() => onNavigate('login')}
          className="px-6 py-3 bg-[#00A6FF] hover:bg-[#0095E6] text-white text-xs font-bold rounded-xl transition shadow duration-300 flex items-center gap-2 mx-auto"
        >
          Begin Free Ledger Account <ArrowRight size={13} />
        </button>
      </section>

    </div>
  );
}
