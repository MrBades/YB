import React from 'react';
import { CreditCard, Users, DollarSign, ArrowRightLeft } from 'lucide-react';
import { formatNaira } from '../utils/currency';

interface QuickActionsProps {
  metrics: {
    salesTotal: number;
    paidTotal: number;
    netProfit: number;
    outstandingTotal: number;
  };
}

export function DashboardQuickActions({ metrics }: QuickActionsProps) {
  const cards = [
    { title: 'Total Collected', value: metrics.paidTotal, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Pending Debt', value: metrics.outstandingTotal, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'Real Net Profit', value: metrics.netProfit, icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className={`${card.bg} p-4 rounded-2xl`}>
            <card.icon className={`w-6 h-6 ${card.color}`} />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{card.title}</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1">{formatNaira(card.value)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
