import { useState, FormEvent } from 'react';
import { BookOpen, Sparkles, UserCheck, ArrowRight, HelpCircle, CheckCircle2, Info } from 'lucide-react';

interface OnboardingProps {
  onCompleteOnboarding: (businessName: string, phone: string, address: string, businessType: 'buy_and_sell' | 'service', template: 'classic' | 'modern_blue' | 'kiosk_compact') => void;
}

export default function Onboarding({ onCompleteOnboarding }: OnboardingProps) {
  const [step, setStep] = useState(1); // 1: Welcome/Signup, 2: Business details
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [businessType, setBusinessType] = useState<'buy_and_sell' | 'service'>('buy_and_sell');
  const [selectedTemplate, setSelectedTemplate] = useState<'classic' | 'modern_blue' | 'kiosk_compact'>('classic');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Dynamic progress calculation based on user input state
  const calculateProgress = () => {
    let score = 15; // base percentage
    if (step === 1) {
      if (username.trim()) score += 20;
      if (email.trim().includes('@')) score += 20;
    } else {
      score = 55; // automatically higher on step 2
      if (businessName.trim()) score += 25;
      if (selectedTemplate) score += 20;
    }
    return score;
  };

  const currentPercent = calculateProgress();

  const handleNext = (e: FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!email || !username) {
        alert("Please complete all registration parameters.");
        return;
      }
      setStep(2);
    } else {
      if (!businessName || !phone || !address) {
        alert("Please specify a trading name, phone, and address for your digital ledger store.");
        return;
      }
      onCompleteOnboarding(businessName, phone, address, businessType, selectedTemplate);
    }
  };

  const toggleTooltip = (fieldId: string) => {
    if (activeTooltip === fieldId) {
      setActiveTooltip(null);
    } else {
      setActiveTooltip(fieldId);
    }
  };

  return (
    <div className="bg-white max-w-lg mx-auto rounded-[32px] border border-gray-150 shadow-2xl overflow-hidden mt-8 text-xs text-[#0E1338] animate-fadeIn">
      
      {/* Visual Header with Cohesive Deep Navy Theme */}
      <div className="bg-[#0E1338] px-8 py-10 text-white text-center space-y-3 relative overflow-hidden">
        {/* Abstract background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00A6FF]/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="w-14 h-14 bg-white/10 text-[#00A6FF] rounded-2xl flex items-center justify-center mx-auto border border-white/15 shadow-inner">
          <BookOpen className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-display font-extrabold tracking-tight">Yeedem Books Setup</h1>
        <p className="text-gray-300 max-w-xs mx-auto text-[11px] leading-relaxed">
          The premier AI-First Accounting & Invoicing Ledger built for micro-traders and shop managers.
        </p>
      </div>

      <div className="p-8 space-y-6">
        
        {/* Dynamic Interactive Progress Bar Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 tracking-wider uppercase">
            <span>Setup Progress</span>
            <span className="text-[#00A6FF] font-mono">{currentPercent}% Done</span>
          </div>
          
          {/* Animated Progress Bar */}
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden p-[1px] border border-gray-150">
            <div 
              className="h-full bg-gradient-to-r from-[#0E1338] to-[#00A6FF] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${currentPercent}%` }}
            ></div>
          </div>

          {/* Stepper Steps Row */}
          <div className="grid grid-cols-2 gap-4 pt-1 text-[11px]">
            <div className={`flex items-center gap-2 pb-1 border-b-2 transition ${step >= 1 ? 'border-[#00A6FF]' : 'border-gray-100'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                step >= 1 ? 'bg-[#0E1338] text-white' : 'bg-gray-150 text-gray-500'
              }`}>1</span>
              <span className={`font-bold uppercase tracking-wider ${step === 1 ? 'text-[#0E1338]' : 'text-gray-400'}`}>
                Merchant Key
              </span>
            </div>
            
            <div className={`flex items-center gap-2 pb-1 border-b-2 transition ${step === 2 ? 'border-[#00A6FF]' : 'border-gray-100'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                step === 2 ? 'bg-[#0E1338] text-white' : 'bg-gray-150 text-gray-500'
              }`}>2</span>
              <span className={`font-bold uppercase tracking-wider ${step === 2 ? 'text-[#0E1338]' : 'text-gray-400'}`}>
                Ledger Settings
              </span>
            </div>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={handleNext} className="space-y-5">
            <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
              <h2 className="text-sm font-extrabold text-[#0E1338] flex items-center gap-1.5 leading-none">
                <Sparkles className="w-4 h-4 text-[#00A6FF]" />
                Create Private Merchant Key Account
              </h2>
              <p className="text-gray-500 text-[11px] leading-relaxed pt-0.5">
                Get synced across standard digital bookkeeping databases instantly.
              </p>
            </div>

            <div className="space-y-4">
              
              {/* Input 1: Username */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px]">
                    Username Handle
                  </label>
                  
                  {/* Tooltip trigger */}
                  <div className="relative">
                    <button 
                      type="button"
                      onMouseEnter={() => setActiveTooltip('username')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => toggleTooltip('username')}
                      className="p-1 hover:bg-gray-100 rounded-full text-[#00A6FF] transition cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    
                    {/* Floating Tooltip design */}
                    {(activeTooltip === 'username') && (
                      <div className="absolute right-0 bottom-6 z-20 w-64 bg-[#0E1338] text-white text-[11px] p-3 rounded-xl shadow-xl border border-white/10 animate-fadeIn">
                        <p className="font-bold mb-1 text-[#00A6FF]">Why a Username Handler?</p>
                        <p className="text-gray-300 leading-normal">
                          This acts as your unique business handle key. Customers will see this identifier when they review receipts or debt ledger reports.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. emeka_stores"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 bg-gray-50/50 text-[#0E1338] transition font-semibold"
                  required
                />
              </div>

              {/* Input 2: Business Email Contacts */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px]">
                    Business Email Contacts
                  </label>
                  
                  {/* Tooltip trigger */}
                  <div className="relative">
                    <button 
                      type="button"
                      onMouseEnter={() => setActiveTooltip('email')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => toggleTooltip('email')}
                      className="p-1 hover:bg-gray-100 rounded-full text-[#00A6FF] transition cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    
                    {/* Floating Tooltip design */}
                    {(activeTooltip === 'email') && (
                      <div className="absolute right-0 bottom-6 z-20 w-64 bg-[#0E1338] text-white text-[11px] p-3 rounded-xl shadow-xl border border-white/10 animate-fadeIn">
                        <p className="font-bold mb-1 text-[#00A6FF]">Why email credentials?</p>
                        <p className="text-gray-300 leading-normal">
                          We route low-stock notifications directly to your email. This ensures you never run out of trade supplies.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. emeka@yeedembooks.com"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 bg-gray-50/50 text-[#0E1338] transition font-semibold"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#0E1338] hover:bg-opacity-95 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-md mt-2 cursor-pointer uppercase tracking-wider text-[11px]"
            >
              <span>Setup Store Details</span>
              <ArrowRight className="w-4 h-4 text-[#00A6FF]" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleNext} className="space-y-5">
            <div className="space-y-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
              <h2 className="text-sm font-extrabold text-[#0E1338] flex items-center gap-1.5 leading-none">
                <Sparkles className="w-4 h-4 text-[#00A6FF]" />
                Establish Business Store Settings
              </h2>
              <p className="text-gray-500 text-[11px] leading-relaxed pt-0.5">
                Select your brand visual identity preference and business trading name.
              </p>
            </div>

            <div className="space-y-4">
              
              {/* Input 0: Business Type */}
              <div className="relative">
                <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px] mb-1.5">
                    Business Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBusinessType('buy_and_sell')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      businessType === 'buy_and_sell'
                        ? 'border-[#00A6FF] bg-blue-50 text-[#00A6FF] font-bold'
                        : 'border-gray-200 hover:border-gray-300 text-[#4A5568] bg-white'
                    }`}
                  >
                    Buy & Sell
                  </button>
                  <button
                    type="button"
                    onClick={() => setBusinessType('service')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      businessType === 'service'
                        ? 'border-[#00A6FF] bg-blue-50 text-[#00A6FF] font-bold'
                        : 'border-gray-200 hover:border-gray-300 text-[#4A5568] bg-white'
                    }`}
                  >
                    Service
                  </button>
                </div>
              </div>
              
              {/* Input 3: Business Phone */}
              <div className="relative">
                <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px] mb-1.5">Store Telephone</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. +234 812-345-6789"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 bg-gray-50/50 text-[#0E1338] transition font-semibold"
                  required
                />
              </div>

               {/* Input 4: Business Address */}
               <div className="relative">
                <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px] mb-1.5">Trading Address</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. Shop 24B, Alaba Int. Market"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 bg-gray-50/50 text-[#0E1338] transition font-semibold"
                  required
                />
              </div>

              {/* Input 5: Business Store name */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px]">
                    Business Store Name
                  </label>
                  
                  {/* Tooltip trigger */}
                  <div className="relative">
                    <button 
                      type="button"
                      onMouseEnter={() => setActiveTooltip('store_name')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => toggleTooltip('store_name')}
                      className="p-1 hover:bg-gray-100 rounded-full text-[#00A6FF] transition cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    
                    {/* Floating Tooltip design */}
                    {(activeTooltip === 'store_name') && (
                      <div className="absolute right-0 bottom-6 z-20 w-64 bg-[#0E1338] text-white text-[11px] p-3 rounded-xl shadow-xl border border-white/10 animate-fadeIn">
                        <p className="font-bold mb-1 text-[#00A6FF]">Store Brand Name</p>
                        <p className="text-gray-300 leading-normal">
                          The absolute corporate name listed on PDF bills, invoices, receipts, and headers of your ledger profiles.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Yeedem Garri & Wholesale Books"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 bg-gray-50/50 text-[#0E1338] transition font-semibold"
                  required
                />
              </div>

              {/* Input 4: Receipts theme switcher */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block font-extrabold text-[#4A5568] uppercase tracking-wider text-[10px]">
                    Default Receipts Theme Layout
                  </label>
                  
                  {/* Tooltip trigger */}
                  <div className="relative">
                    <button 
                      type="button"
                      onMouseEnter={() => setActiveTooltip('theme')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => toggleTooltip('theme')}
                      className="p-1 hover:bg-gray-100 rounded-full text-[#00A6FF] transition cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    
                    {/* Floating Tooltip design */}
                    {(activeTooltip === 'theme') && (
                      <div className="absolute right-0 bottom-6 z-20 w-64 bg-[#0E1338] text-white text-[11px] p-3 rounded-xl shadow-xl border border-white/10 animate-fadeIn">
                        <p className="font-bold mb-1 text-[#00A6FF]">Visual PDF Layout Themes</p>
                        <p className="text-gray-300 leading-normal">
                          <strong className="text-white">Classic:</strong> Clean black & white design. <br />
                          <strong className="text-white">Modern Blue:</strong> Ocean visual accents with sleek status blocks. <br />
                          <strong className="text-white">Kiosk Compact:</strong> Formatted for neat 58mm roll-paper thermal printers.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('classic')}
                    className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                      selectedTemplate === 'classic'
                        ? 'border-[#00A6FF] bg-blue-50/30 text-[#00A6FF] ring-1 ring-[#00A6FF]'
                        : 'border-gray-200 hover:border-gray-300 text-[#4A5568] bg-white'
                    }`}
                  >
                    <span className="font-bold">Classic</span>
                    <span className="text-[9px] text-gray-400 mt-1">Monochrome</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('modern_blue')}
                    className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                      selectedTemplate === 'modern_blue'
                        ? 'border-[#00A6FF] bg-blue-50/30 text-[#00A6FF] ring-1 ring-[#00A6FF]'
                        : 'border-gray-200 hover:border-gray-300 text-[#4A5568] bg-white'
                    }`}
                  >
                    <span className="font-bold">Modern</span>
                    <span className="text-[9px] text-gray-400 mt-1">Sea Blue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('kiosk_compact')}
                    className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                      selectedTemplate === 'kiosk_compact'
                        ? 'border-[#00A6FF] bg-blue-50/30 text-[#00A6FF] ring-1 ring-[#00A6FF]'
                        : 'border-gray-200 hover:border-gray-300 text-[#4A5568] bg-white'
                    }`}
                  >
                    <span className="font-bold">Kiosk</span>
                    <span className="text-[9px] text-gray-400 mt-1">Terminal</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Complete workflow info note */}
            <div className="flex gap-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-[#4A5568]">
              <Info className="w-4 h-4 text-[#00A6FF] shrink-0 mt-0.5" />
              <span>You can modify theme layouts and trading assets inside your profile configurations once registered.</span>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-[#0E1338] to-[#1a2363] hover:opacity-95 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-md mt-3 cursor-pointer uppercase tracking-wider text-[11px]"
            >
              <UserCheck className="w-4 h-4 text-[#00A6FF]" />
              <span>Complete Setup & Open Ledgers</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
