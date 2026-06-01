import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  buttonText: string;
  featured?: boolean;
}

const plans: PricingPlan[] = [
  {
    id: 'sme_basic',
    name: 'SME Basic',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Perfect for micro-entrepreneurs.',
    features: ['5 manual invoices monthly', 'Manual invoice entry', 'Fuse Search Mode'],
    buttonText: 'Get Started Free',
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 4500,
    annualPrice: 45000,
    featured: true,
    description: 'Perfect for growing shops needing AI powers.',
    features: ['200 invoices monthly', 'AI invoice parsing', 'Advanced analytics', 'WhatsApp debt alerts'],
    buttonText: 'Select Growth',
  },
  {
    id: 'starter_pro',
    name: 'Starter Pro',
    monthlyPrice: 7500,
    annualPrice: 75000,
    description: 'Ideal for businesses needing automated tracking.',
    features: ['Unlimited ledger logs', 'Up to 3 operator staff clerks', 'Automated Daily Cloud Backups'],
    buttonText: 'Start 14-Day Free Trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 20000,
    annualPrice: 200000,
    description: 'For massive warehouses needing unified tracking.',
    features: ['Multi-shop synchronization', 'Unlimited clerk/operator accounts', '24/7 Dedicated Support Managers'],
    buttonText: 'Contact Enterprise',
  },
];

export default function PricingGrid({ onNavigate }: { onNavigate: (screen: 'login' | 'about' | 'terms' | 'guest_invoice') => void; }) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');

  return (
    <div className="py-12 space-y-8">
      {/* Toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-full flex items-center gap-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${billingCycle === 'monthly' ? 'bg-white shadow-sm text-[#00A6FF]' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annually')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${billingCycle === 'annually' ? 'bg-white shadow-sm text-[#00A6FF]' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Annually
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between ${
              plan.featured 
                ? 'border-2 border-[#00A6FF] shadow-lg relative' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {plan.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00A6FF] text-white text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-wider">
                💥 MOST POPULAR
              </span>
            )}
            
            <div className="space-y-4">
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${plan.featured ? 'bg-blue-50 text-[#00A6FF]' : 'bg-gray-100 text-gray-650'}`}>
                  {plan.name}
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-[#0E1338]">
                    ₦{billingCycle === 'monthly' ? plan.monthlyPrice.toLocaleString() : (plan.annualPrice / 12).toLocaleString()}
                  </span>
                  <span className="text-gray-400 text-[10px] font-bold">/mo</span>
                </div>
                {billingCycle === 'annually' && plan.annualPrice > 0 && (
                  <p className="text-green-600 text-[9px] font-bold mt-1">Save 16% (₦{plan.annualPrice.toLocaleString()} billed yearly)</p>
                )}
              </div>
              
              <p className="text-gray-450 text-[11px] leading-relaxed">
                {plan.description}
              </p>
              
              <div className="border-t border-gray-100 pt-4 space-y-3 text-[11px] text-gray-600">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={14} className={plan.featured ? 'text-[#00A6FF]' : 'text-gray-400'} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => onNavigate('login')}
              className={`mt-6 w-full h-10 rounded-xl text-xs font-bold transition shadow-sm ${
                plan.featured 
                  ? 'bg-[#00A6FF] text-white hover:bg-[#0095E6]' 
                  : 'border border-gray-200 hover:bg-slate-50 text-[#0E1338]'
              }`}
            >
              {plan.buttonText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
