import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface CloseAccountCardProps {
  userEmail: string;
  onAccountDeleted: () => void;
}

export default function CloseAccountCard({ userEmail, onAccountDeleted }: CloseAccountCardProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmInput.trim() !== userEmail.trim()) {
      setError(`Verification contact does not match. Please type: ${userEmail}`);
      return;
    }

    const doubleConfirmed = window.confirm(
      "⚠ FINAL DANGER WARNING: This will permanently delete your merchant record, cancel your owner authentication PIN, and completely wipe all of your secure cloud backups from Yeedem servers.\n\nAre you absolutely sure you want to delete your account forever?"
    );

    if (!doubleConfirmed) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('session_id') || '';
      const response = await apiFetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-session-id': token
        }
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to complete cloud account deletion.');
      }

      // Success - Trigger complete frontend reset and redirect
      onAccountDeleted();
    } catch (err: any) {
      setError(err.message || 'Verification or purge process failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="account-closure-zone-card" className="bg-white rounded-[24px] shadow-sm border border-red-100 overflow-hidden text-xs transition-all duration-300">
      
      {/* Red Alert Banner */}
      <div className="p-5 md:p-6 bg-[#C62828] text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} className="text-red-100 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-sm tracking-tight flex items-center gap-1.5">
              Danger Zone: Master Account Deletion
            </h3>
            <p className="text-[10px] text-red-100">Permanently close and wipe all cloud data, backups, and user credentials.</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 text-gray-700">
        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
          <AlertTriangle className="w-5 h-5 text-[#C62828] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold text-[#C62828] text-[11px] uppercase tracking-wider">Irreversible Action Warning</p>
            <p className="text-gray-600 leading-relaxed font-medium">
              Closing this merchant profile destroys your database reference in our system. Any and all daily automated backups linked to your phone or email will be permanently destroyed. 
              <strong> You will not be able to recover this history.</strong>
            </p>
          </div>
        </div>

        <form onSubmit={handleDeleteAccount} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Verify Account Identity
            </label>
            <p className="text-gray-500 mb-2 font-medium">
              To verify deletion authorization, type your exact registered login contact: 
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800 font-bold ml-1">{userEmail}</span>
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => {
                setConfirmInput(e.target.value);
                setError('');
              }}
              placeholder={userEmail}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] h-11 px-4 rounded-xl text-sm font-semibold transition outline-none"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-[#C62828] font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C62828]" />
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || confirmInput.trim() !== userEmail.trim()}
              className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-white font-bold tracking-tight text-xs transition duration-200 ${
                confirmInput.trim() === userEmail.trim()
                  ? 'bg-[#C62828] hover:bg-[#B71C1C] hover:shadow-lg hover:shadow-red-500/10 active:scale-[0.98]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Server Purge...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Permanently Purge Account & Ledger Clouds
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
