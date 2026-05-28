import { useState, useMemo } from 'react';
import { Invoice, BusinessProfile } from '../types';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { 
  Search, 
  Filter, 
  Eye, 
  Trash2, 
  FileText, 
  TrendingUp, 
  ArrowLeftRight, 
  ChevronRight,
  Database,
  ArrowBigUp,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Edit2,
  Check,
  X
} from 'lucide-react';

interface InvoicesListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  onEditInvoice?: (invoiceId: string, updated: Partial<Invoice>) => void;
  business?: BusinessProfile;
}

export default function InvoicesList({ invoices, onSelectInvoice, onDeleteInvoice, onEditInvoice, business }: InvoicesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'expense' | 'payment_on_account'>('all');
  const [debtFilter, setDebtFilter] = useState<'all' | 'unpaid' | 'settled'>('all');

  // Edit invoice local states
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editProdName, setEditProdName] = useState('');
  const [editTotalAmount, setEditTotalAmount] = useState('0');
  const [editAmountPaid, setEditAmountPaid] = useState('0');

  const startEditInvoice = (inv: Invoice) => {
    setEditingInvoiceId(inv.id);
    setEditCustName(inv.customerName);
    setEditProdName(inv.productName);
    setEditTotalAmount(inv.totalAmount.toString());
    setEditAmountPaid(inv.amountPaid.toString());
  };

  const handleSaveInvoiceEditLocal = (id: string) => {
    if (!editCustName.trim()) {
      alert("Please specify a client name!");
      return;
    }
    if (onEditInvoice) {
      onEditInvoice(id, {
        customerName: editCustName.trim(),
        productName: editProdName.trim() || 'General Cargo',
        totalAmount: parseFloat(editTotalAmount) || 0,
        amountPaid: parseFloat(editAmountPaid) || 0
      });
    }
    setEditingInvoiceId(null);
  };


  // Computed summary variables
  const invoiceSummaries = useMemo(() => {
    let salesTotal = 0;
    let expenseTotal = 0;
    let outstandingDebt = 0;
    let settlementTotal = 0;

    invoices.forEach((inv) => {
      if (inv.transactionType === 'sale') {
        salesTotal += inv.totalAmount;
        outstandingDebt += inv.debtBalance;
      } else if (inv.transactionType === 'expense') {
        expenseTotal += inv.totalAmount;
      } else if (inv.transactionType === 'payment_on_account') {
        settlementTotal += inv.totalAmount;
      }
    });

    return {
      salesTotal,
      expenseTotal,
      outstandingDebt,
      settlementTotal,
      count: invoices.length
    };
  }, [invoices]);

  // Combined Search and Filter algorithms
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch = 
        (inv.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.id || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === 'all' || inv.transactionType === typeFilter;

      const matchesDebt = 
        debtFilter === 'all' ||
        (debtFilter === 'unpaid' && inv.debtBalance > 0) ||
        (debtFilter === 'settled' && inv.debtBalance === 0);

      return matchesSearch && matchesType && matchesDebt;
    });
  }, [invoices, searchTerm, typeFilter, debtFilter]);

  const getStatusBadge = (inv: Invoice) => {
    if (inv.transactionType === 'payment_on_account') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-150">
          <ArrowLeftRight className="w-3 h-3 text-blue-500" /> Payment Recv
        </span>
      );
    }
    if (inv.transactionType === 'expense') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-50 text-slate-700 border border-gray-200">
          <CreditCard className="w-3 h-3 text-slate-500" /> Outflow Exp
        </span>
      );
    }
    if (inv.debtBalance > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-50 text-[#D32F2F] border border-red-150">
          <AlertTriangle className="w-3 h-3 text-[#D32F2F]" /> Credit: ₦{inv.debtBalance.toLocaleString(undefined, { minimumFractionDigits: 1 })}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-150">
        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Fully Paid
      </span>
    );
  };

  return (
    <div className="space-y-6" id="invoices-list-workspace">
      
      {/* 1. Interactive Search, Query & Filter Row */}
      <div className="bg-white rounded-[24px] p-5 shadow-sm space-y-4" id="invoices-filter-controls">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ledger entries by customer name, catalog items or SKU codes..."
              className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] pl-10 pr-4 py-3 bg-gray-50/50 placeholder:text-gray-400 text-gray-800 transition"
              id="invoice-search-input"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-xl border border-gray-150 text-xs">
              <span className="text-gray-400 font-semibold px-2 text-[10px] uppercase">Trade Type</span>
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${typeFilter === 'all' ? 'bg-[#0E1338] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                All
              </button>
              <button
                onClick={() => setTypeFilter('sale')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${typeFilter === 'sale' ? 'bg-[#0E1338] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Sales
              </button>
              <button
                onClick={() => setTypeFilter('payment_on_account')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${typeFilter === 'payment_on_account' ? 'bg-[#0E1338] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Settlements
              </button>
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-xl border border-gray-150 text-xs">
              <span className="text-gray-400 font-semibold px-2 text-[10px] uppercase">Payment status</span>
              <button
                onClick={() => setDebtFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${debtFilter === 'all' ? 'bg-[#0E1338] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                All
              </button>
              <button
                onClick={() => setDebtFilter('unpaid')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${debtFilter === 'unpaid' ? 'bg-[#D32F2F] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Unpaid
              </button>
              <button
                onClick={() => setDebtFilter('settled')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${debtFilter === 'settled' ? 'bg-emerald-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Settled
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Table Catalog List Layout */}
      <div className="bg-white rounded-[24px] overflow-hidden shadow-sm" id="invoices-ledger-table-boundary">
        <div className="px-6 py-4.5 bg-[#0E1338] text-white flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#00A6FF]" />
            <h3 className="font-serif font-extrabold text-xs uppercase tracking-wider">Historical General Invoice Registry</h3>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 bg-white/10 rounded-full border border-white/5 text-[#00A6FF]">
            Verified: {filteredInvoices.length} entries of {invoices.length}
          </span>
        </div>

        <div className="overflow-x-auto text-xs text-gray-750">
          <table className="w-full text-left font-sans">
            <thead>
              <tr className="border-b font-semibold text-gray-400 uppercase tracking-wide text-[10px] bg-gray-50/70 p-4">
                <th className="py-3 px-6">Timestamp Info</th>
                <th className="py-3 px-4">Invoice Reference</th>
                <th className="py-3 px-4">Debted Client</th>
                <th className="py-3 px-4">Acquired Goods</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Invoice Sum</th>
                <th className="py-3 px-4 text-right">Cleared Cash</th>
                <th className="py-3 px-6 text-center">Receipt Workspace</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400 italic">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="font-bold text-gray-700 font-sans text-sm">No ledger queries resolved</p>
                      <p className="text-[11px] leading-relaxed">Adjust search criteria or navigate back to the smart workspace to dispatch a new bookkeeping event!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isEditing = editingInvoiceId === inv.id;
                  return (
                    <tr key={inv.id} className={`border-b border-gray-105 transition duration-150 ${isEditing ? 'bg-blue-50/20' : 'hover:bg-gray-50/40'}`}>
                      <td className="py-3 px-6 text-gray-400 font-mono">
                        {new Date(inv.createdAt).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <button
                          type="button"
                          onClick={() => onSelectInvoice(inv)}
                          className="font-mono font-bold text-left text-[#00A6FF] hover:text-[#0E1338] hover:underline focus:outline-none transition-colors uppercase tracking-wider text-[10px] cursor-pointer"
                          title="Click to preview this invoice"
                        >
                          {inv.id.substring(0, 10)}...
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={editCustName}
                            onChange={(e) => setEditCustName(e.target.value)}
                            className="w-full text-xs font-bold font-sans p-1.5 border border-gray-200 focus:ring-1 focus:ring-[#00A6FF] rounded bg-white text-gray-800"
                          />
                        ) : (
                          <p className="font-extrabold text-gray-900">{inv.customerName}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 font-normal text-gray-600 truncate max-w-[150px]" title={inv.productName}>
                        {isEditing ? (
                          <input 
                            type="text"
                            value={editProdName}
                            onChange={(e) => setEditProdName(e.target.value)}
                            className="w-full text-xs p-1.5 border border-gray-200 focus:ring-1 focus:ring-[#00A6FF] rounded bg-white text-gray-800"
                          />
                        ) : (
                          inv.productName
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isEditing ? (
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded">Editing</span>
                        ) : (
                          getStatusBadge(inv)
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold font-mono text-gray-800 text-[11px]">
                        {isEditing ? (
                          <input 
                            type="number"
                            value={editTotalAmount}
                            onChange={(e) => setEditTotalAmount(e.target.value)}
                            className="w-24 text-xs font-bold font-mono text-right p-1.5 border border-gray-200 focus:ring-1 focus:ring-[#00A6FF] rounded bg-white text-gray-800"
                          />
                        ) : (
                          <>₦{(inv.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-emerald-700 text-[11px]">
                        {isEditing ? (
                          <input 
                            type="number"
                            value={editAmountPaid}
                            onChange={(e) => setEditAmountPaid(e.target.value)}
                            className="w-24 text-xs font-bold font-mono text-right p-1.5 border border-gray-200 focus:ring-1 focus:ring-[#00A6FF] rounded bg-white text-gray-800"
                          />
                        ) : (
                          <>₦{(inv.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
                        )}
                      </td>
                      <td className="py-3 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveInvoiceEditLocal(inv.id)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition"
                                title="Save changes"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingInvoiceId(null)}
                                className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg transition"
                                title="Abort changes"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onSelectInvoice(inv)}
                                className="px-2.5 py-1 bg-gray-50 hover:bg-[#00A6FF]/10 text-gray-750 hover:text-[#0E1338] hover:border-[#00A6FF]/20 border border-gray-200 font-bold rounded-lg text-[10px] uppercase tracking-wide transition flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                              {business && (
                                <button
                                  type="button"
                                  onClick={() => generateInvoicePDF(inv, business)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-150/15 text-indigo-700 hover:text-indigo-950 font-extrabold rounded-lg text-[10px] uppercase tracking-wide transition flex items-center gap-1 border border-indigo-100 cursor-pointer"
                                  title="Download custom-designed PDF receipt directly"
                                >
                                  <FileText className="w-3.5 h-3.5 text-indigo-500" /> Export PDF
                                </button>
                              )}
                              {onEditInvoice && (
                                <button
                                  type="button"
                                  onClick={() => startEditInvoice(inv)}
                                  className="p-1.5 text-gray-400 hover:text-[#00A6FF] hover:bg-blue-50 rounded-lg transition"
                                  title="Edit entry details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteInvoice && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Are you sure you wish to void transaction ledger reference "${inv.id}"?`)) {
                                      onDeleteInvoice(inv.id);
                                    }
                                  }}
                                  className="p-1.5 text-gray-300 hover:text-[#D32F2F] hover:bg-red-50 rounded-lg transition"
                                  title="Void registry command"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Footer/Base Analytics KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
        <div className="bg-white rounded-2xl p-5 shadow-sm transition hover:shadow-md" id="kpi-invoice-total">
          <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">Accumulated Trade Logs</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-extrabold text-[#0E1338] font-sans">{invoiceSummaries.count}</span>
            <span className="text-gray-400 text-[10px] font-semibold">Ledger Entries</span>
          </div>
          <p className="text-[10px] text-gray-400 font-mono mt-1">Unified general record tracking</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm transition hover:shadow-md" id="kpi-invoice-sales">
          <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">Gross Sales Invoiced</span>
          <div className="flex items-baseline gap-1 mt-1.5 text-emerald-700">
            <span className="text-xl font-extrabold font-sans">₦{invoiceSummaries.salesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="text-[10px] text-gray-400 font-mono mt-1">Receivables cleared + credits</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm transition hover:shadow-md" id="kpi-invoice-debt">
          <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">Active Outstanding Debts</span>
          <div className="flex items-baseline gap-1 mt-1.5 text-[#D32F2F]">
            <span className="text-xl font-extrabold font-sans">₦{invoiceSummaries.outstandingDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="text-[10px] text-[#D32F2F] font-semibold flex items-center gap-1 mt-1">Pending client adjustments</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm transition hover:shadow-md" id="kpi-invoice-settlements">
          <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block font-sans">Account Clearances Recv</span>
          <div className="flex items-baseline gap-1 mt-1.5 text-blue-700">
            <span className="text-xl font-extrabold font-sans">₦{invoiceSummaries.settlementTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="text-[10px] text-gray-400 font-mono mt-1">Direct debtor settlements</p>
        </div>
      </div>

    </div>
  );
}
