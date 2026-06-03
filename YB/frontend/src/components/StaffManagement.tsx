import React, { useState, useEffect } from 'react';
import { UserPlus, ToggleLeft, ToggleRight, Copy, Check } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface Staff {
    id: string;
    shop_id: string;
    name_slug: string;
    owner_generated_pin: string;
    is_active: boolean;
    shop_slug?: string;
}

interface StaffManagementProps {
    onUnauthorized: () => void;
    isSuspiciousLocked: boolean;
    deviceFingerprint?: string;
    approxRegion?: string;
    businessName?: string;
}

export default function StaffManagement({ 
    onUnauthorized, 
    isSuspiciousLocked, 
    deviceFingerprint, 
    approxRegion,
    businessName
}: StaffManagementProps) {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [nameSlug, setNameSlug] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [copiedStaffId, setCopiedStaffId] = useState<string | null>(null);

    // If suspicious, show a message instead of the table
    if (isSuspiciousLocked) {
        return (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
                <p className="font-bold text-red-500 mb-2">Suspicious session detected</p>
                <p className="text-xs text-gray-500">Please verify your account to unlock.</p>
            </div>
        );
    }

    useEffect(() => {
        if (isSuspiciousLocked) return;
        let active = true;
        
        const sesId = localStorage.getItem('session_id');
        if (!sesId) return;

        const simFp = deviceFingerprint || localStorage.getItem('simulated_device_fp') || 'unknown';
        const simLoc = approxRegion || localStorage.getItem('simulated_location') || 'NG-Lagos';
        apiFetch('/api/staff', {
            headers: {
                'x-session-id': sesId,
                'x-device-fingerprint': simFp,
                'x-approx-region': simLoc
            }
        })
        .then(res => {
            if (res.status === 401) {
                onUnauthorized();
                throw new Error('Unauthorized');
            }
            if (res.status === 403) {
                // Not throwing, just silent error here, or we could handle it differently
                console.warn('Suspicious activity locked');
                return null;
            }
            if (!res.ok) throw new Error('Network error');
            return res.json();
        })
        .then(data => {
            if (active && data) {
                if (Array.isArray(data)) {
                    setStaff(data);
                } else {
                    setStaff([]);
                }
            }
        })
        .catch(err => {
            if (active) {
                console.error('Error fetching staff list:', err);
                setStaff([]);
            }
        });

        return () => { active = false; };
    }, [onUnauthorized, isSuspiciousLocked, deviceFingerprint, approxRegion]);

    const addStaff = () => {
        if (isSuspiciousLocked) return;
        if (!nameSlug) {
            setError('Please enter a staff name.');
            return;
        }
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            setError('PIN must be exactly 4 digits.');
            return;
        }
        setError('');
        const sesId = localStorage.getItem('session_id') || '';
        const simFp = deviceFingerprint || localStorage.getItem('simulated_device_fp') || 'unknown';
        const simLoc = approxRegion || localStorage.getItem('simulated_location') || 'NG-Lagos';
        
        // Normalize the name slug
        const processedNameSlug = nameSlug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');

        apiFetch('/api/staff', {
            method: 'POST',
            body: JSON.stringify({ 
                shop_id: 'default_shop', 
                name_slug: processedNameSlug || nameSlug, 
                owner_generated_pin: pin 
            }),
            headers: { 
                'Content-Type': 'application/json',
                'x-session-id': sesId,
                'x-device-fingerprint': simFp,
                'x-approx-region': simLoc
            }
        })
        .then(async res => {
            const isJson = res.headers.get('content-type')?.includes('application/json');
            const data = isJson ? await res.json() : null;
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    onUnauthorized();
                    throw new Error(data?.error || 'Unauthorized or suspicious session. Please re-authenticate.');
                }
                throw new Error(data?.error || `Server responded with status code ${res.status}`);
            }
            return data;
        })
        .then(data => {
            if (data && !data.error) {
                setStaff([...staff, data]);
                setNameSlug('');
                setPin('');
            } else {
                setError(data?.error || 'Failed to add staff.');
            }
        })
        .catch(err => {
            console.error('Error adding staff:', err);
            setError(err.message || 'Failed to add staff on network error.');
        });
    };

    const toggleStaffStatus = (id: string, currentStatus: boolean) => {
        const sesId = localStorage.getItem('session_id') || '';
        const simFp = deviceFingerprint || localStorage.getItem('simulated_device_fp') || 'unknown';
        const simLoc = approxRegion || localStorage.getItem('simulated_location') || 'NG-Lagos';
        apiFetch(`/api/staff/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: !currentStatus }),
            headers: { 
                'Content-Type': 'application/json',
                'x-session-id': sesId,
                'x-device-fingerprint': simFp,
                'x-approx-region': simLoc
            }
        })
        .then(async res => {
            const isJson = res.headers.get('content-type')?.includes('application/json');
            const data = isJson ? await res.json() : null;
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    onUnauthorized();
                    throw new Error(data?.error || 'Unauthorized or suspicious session.');
                }
                throw new Error(data?.error || `Server responded with status ${res.status}`);
            }
            return data;
        })
        .then(data => {
            if (data && !data.error) {
                setStaff(staff.map(s => s.id === id ? data : s));
            }
        })
        .catch(err => console.error('Error toggling staff status:', err));
    };

    const handleCopy = (s: Staff) => {
        const ownerShopSlug = s.shop_slug || businessName?.toLowerCase().replace(/\s+/g, '-') || 'default-shop';
        const workerNameSlug = s.name_slug;
        const generatedLink = `${window.location.origin}/terminal/${ownerShopSlug}/${workerNameSlug}`;

        navigator.clipboard.writeText(generatedLink)
            .then(() => {
                setCopiedStaffId(s.id);
                setTimeout(() => setCopiedStaffId(null), 2000);
            })
            .catch(err => {
                console.error('Failed to copy link:', err);
                setError('Failed to copy element automatically.');
            });
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold mb-4">Staff Terminal Management</h2>
            
            <div className="flex gap-2 mb-4">
                <input 
                    type="text" 
                    placeholder="Worker Name (e.g. Chinedu)" 
                    value={nameSlug} 
                    onChange={e => {setNameSlug(e.target.value); setError('')}} 
                    className="p-2 border rounded-xl w-full text-sm focus:outline-none focus:ring-1 focus:ring-[#00A6FF]" 
                />
                <input 
                    type="password" 
                    placeholder="4-Digit PIN" 
                    value={pin} 
                    onChange={e => {setPin(e.target.value); setError('')}} 
                    maxLength={4} 
                    className="p-2 border rounded-xl w-28 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#00A6FF]" 
                />
                <button 
                    onClick={addStaff} 
                    className="bg-[#0E1338] hover:bg-[#1c2656] text-white p-2 w-12 rounded-xl flex items-center justify-center transition"
                >
                    <UserPlus size={20} />
                </button>
            </div>
            
            {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
            
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="border-b uppercase tracking-wider text-[10px] text-gray-400 font-semibold">
                            <th className="py-3 px-2">Staff Member</th>
                            <th className="py-3 px-2">Access PIN</th>
                            <th className="py-3 px-2">Terminal Link</th>
                            <th className="py-3 px-2 text-right">Status & Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staff.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-gray-400 italic font-serif">
                                    No staff terminals configured. Add a worker above to begin.
                                </td>
                            </tr>
                        ) : (
                            staff.map(s => {
                                const ownerShopSlug = s.shop_slug || businessName?.toLowerCase().replace(/\s+/g, '-') || 'default-shop';
                                const workerNameSlug = s.name_slug;
                                const truncatedLink = `/terminal/.../${workerNameSlug}`;
                                const isCopied = copiedStaffId === s.id;

                                return (
                                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                                        <td className="py-3.5 px-2 font-semibold text-gray-800">
                                            {s.name_slug}
                                        </td>
                                        <td className="py-3.5 px-2 font-mono text-gray-500">
                                            •••• <span className="text-[10px] text-gray-300 ml-1">({s.owner_generated_pin})</span>
                                        </td>
                                        <td className="py-3.5 px-2">
                                            {s.is_active ? (
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-gray-100 px-2 py-1 rounded text-[11px] text-gray-600 font-mono">
                                                        {truncatedLink}
                                                    </code>
                                                    <button
                                                        onClick={() => handleCopy(s)}
                                                        className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 text-[10px] font-bold transition-all ${
                                                            isCopied 
                                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                                                                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm'
                                                        }`}
                                                        title="Copy complete terminal link"
                                                    >
                                                        {isCopied ? (
                                                            <>
                                                                <Check size={12} className="text-emerald-600 shrink-0" />
                                                                <span className="animate-fadeIn font-extrabold">Copied to Clipboard! 🟢</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy size={12} className="text-gray-450 shrink-0" />
                                                                <span>Copy Link</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic text-[11px]">Terminal non-active</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-2 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className={`text-[10px] uppercase tracking-wide font-extrabold px-2 py-0.5 rounded-full ${
                                                    s.is_active 
                                                        ? 'text-green-600 bg-green-50' 
                                                        : 'text-red-600 bg-red-50'
                                                }`}>
                                                    {s.is_active ? 'Active' : 'Disabled'}
                                                </span>
                                                <button 
                                                    onClick={() => toggleStaffStatus(s.id, s.is_active)} 
                                                    className="p-1 hover:bg-gray-50 rounded"
                                                    title={s.is_active ? 'Disable Clerk' : 'Enable Clerk'}
                                                >
                                                    {s.is_active ? (
                                                        <ToggleRight className="text-green-500 w-5 h-5" />
                                                    ) : (
                                                        <ToggleLeft className="text-gray-350 w-5 h-5" />
                                                    )}
                                                </button>
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
    );
}
