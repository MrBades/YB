import React, { useState, useEffect } from 'react';
import { Lock, Smartphone, ShieldCheck, ArrowRightLeft, Sparkles, AlertTriangle, Key, Loader2 } from 'lucide-react';
import LogoImg from '../assets/images/yeedem_books_logo_1779553023368.png';
import { nodeFetch } from '../lib/api';

export function normalizeContact(phoneOrEmailStr: string): string {
  let input = phoneOrEmailStr.trim();
  if (!input) return '';

  const cleanPhoneCheck = input.replace(/[\s\-\(\)]/g, '');
  const isEmail = input.includes('@') && input.includes('.');
  const isPhone = /^\+?[0-9]{8,15}$/.test(cleanPhoneCheck);

  if (isPhone && !isEmail) {
    if (cleanPhoneCheck.startsWith('0') && cleanPhoneCheck.length === 11) {
      return '+234' + cleanPhoneCheck.slice(1);
    } else if (!cleanPhoneCheck.startsWith('+') && !cleanPhoneCheck.startsWith('0') && cleanPhoneCheck.length === 10) {
      return '+234' + cleanPhoneCheck;
    } else {
      return (cleanPhoneCheck.startsWith('+') ? '+' : '') + cleanPhoneCheck.replace(/\D/g, '');
    }
  }
  return input;
}

interface LoginScreenProps {
  onLogin: (session_id: string, phone_or_email: string, user?: any) => void;
  deviceFingerprint: string;
  approxRegion: string;
  onNavigate?: (screen: 'landing' | 'login' | 'about' | 'terms' | 'guest_invoice' | 'dashboard' | 'debtors' | 'profile' | 'invoice_preview' | 'products' | 'invoices' | 'customers' | 'terminal') => void;
}

export default function LoginScreen({ onLogin, deviceFingerprint, approxRegion, onNavigate }: LoginScreenProps) {
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [step, setStep] = useState<'pin_lock' | 'phone' | 'otp' | 'whatsapp_verify' | 'set_pin' | 'confirm_pin' | 'enter_name' | 'enter_business' | 'forgot_phone' | 'forgot_otp' | 'forgot_new_pin' | 'forgot_confirm_pin'>('phone');
  
  const [pinAttempt, setPinAttempt] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<'buy_and_sell' | 'service'>('buy_and_sell');
  
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');
  const [simulatedOtpNotice, setSimulatedOtpNotice] = useState('');
  
  // WhatsApp State
  const [verificationCode, setVerificationCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(180);
  
  const storedPhone = localStorage.getItem('authorized_phone_or_email') || '';

  useEffect(() => {
    if (storedPhone) {
      const normalized = normalizeContact(storedPhone);
      setPhoneOrEmail(normalized);
      setStep('pin_lock');
    }
  }, [storedPhone]);

  // WhatsApp-specific: Timer & Polling
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'whatsapp_verify' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const headers = {
    'Content-Type': 'application/json',
    'x-device-fingerprint': deviceFingerprint || 'unknown_fp',
    'x-approx-region': approxRegion || 'NG-Lagos'
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'whatsapp_verify') {
      interval = setInterval(async () => {
        const cleanContact = normalizeContact(phoneOrEmail);
        const res = await nodeFetch('/api/auth/check-verification-status', {
            method: 'POST',
            headers,
            body: JSON.stringify({ phone_or_email: cleanContact })
        });
        const data = await res.json();
        
        if (data.status === 'verified') {
           clearInterval(interval);
           if (data.user) {
               if (!data.user.full_name) {
                 setIsNewUser(true);
                 setStep('set_pin');
               } else {
                 setIsNewUser(false);
                 localStorage.setItem('authorized_phone_or_email', cleanContact);
                 setStep('pin_lock');
               }
           }
        }
      }, 3000); // Poll every 3s
    }
    return () => clearInterval(interval);
  }, [step, phoneOrEmail]);

  const probeUser = async () => {
    const input = normalizeContact(phoneOrEmail);
    if (!input) {
      setError('Please enter your phone number or email first.');
      return;
    }
    
    setLoading(true);
    setLoadingText('Locating ledger profile...');
    setError('');
    
    try {
      const res = await nodeFetch('/api/auth/probe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: input })
      });
      if (!res.ok) throw new Error('Could not connect to authentication gateway.');
      const data = await res.json();
      
      localStorage.setItem('hasPin', String(data.hasPin));
      
      if (!data.newUser && data.hasPin) {
        setStep('pin_lock');
      } else {
        setStep('whatsapp_verify');
        setVerificationCode(data.verificationCode);
        setTimeLeft(180);
      }
    } catch (e: any) {
      setError(e.message || 'Verification gateway unreachable. Try again.');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const triggerPinLogin = async (pin: string) => {
    const cleanContact = normalizeContact(phoneOrEmail);
    setLoading(true);
    try {
      const res = await nodeFetch('/api/auth/pin-login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: cleanContact, pin })
      });
      const data = await res.json();
      
      if (res.status === 403 || data.is_suspicious_locked) {
        onLogin(data.session_id || 'suspended_session', cleanContact, data.user);
      } else if (res.ok && data.session_id) {
        onLogin(data.session_id, cleanContact, data.user);
      } else {
        setPinAttempt('');
        setError(data.error || 'Incorrect 4-digit Master PIN code.');
      }
    } catch (err) {
      setError('Hardware connection error. Please try again.');
      setPinAttempt('');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };
    
  const handlePinInput = (value: string) => {
      setError('');
      if (/^\d{0,4}$/.test(value)) {
          setPinAttempt(value);
      }
  };

  useEffect(() => {
    if (step === 'pin_lock' && pinInputRef.current) {
        pinInputRef.current.focus();
    }
  }, [step]);
    
  const pinInputRef = React.useRef<HTMLInputElement>(null);

  const handleKeypadPress = (val: string) => {
    if (loading) return;
    setError('');

    if (step === 'pin_lock') {
      handlePinLogin(val);
    } else if (step === 'otp' || step === 'forgot_otp') {
      if (otp.length < 4) setOtp(prev => prev + val);
    } else if (step === 'set_pin' || step === 'forgot_new_pin') {
      if (newPin.length < 4) setNewPin(prev => prev + val);
    } else if (step === 'confirm_pin' || step === 'forgot_confirm_pin') {
      if (confirmPin.length < 4) setConfirmPin(prev => prev + val);
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    if (step === 'pin_lock') setPinAttempt(prev => prev.slice(0, -1));
    else if (step === 'otp' || step === 'forgot_otp') setOtp(prev => prev.slice(0, -1));
    else if (step === 'set_pin' || step === 'forgot_new_pin') setNewPin(prev => prev.slice(0, -1));
    else if (step === 'confirm_pin' || step === 'forgot_confirm_pin') setConfirmPin(prev => prev.slice(0, -1));
  };

  const clearAuthProfile = () => {
    localStorage.removeItem('authorized_phone_or_email');
    localStorage.removeItem('session_id');
    setPhoneOrEmail('');
    setPinAttempt('');
    setOtp('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setStep('phone');
  };

  const renderTermsDisclaimer = () => {
    if (!onNavigate) return null;
    return (
      <p className="text-[11px] text-slate-400 mt-4 leading-relaxed text-center">
        By creating an account, you agree to the{" "}
        <button
          type="button"
          onClick={() => onNavigate('terms')}
          className="text-[#00A6FF] hover:underline font-bold focus:outline-none cursor-pointer inline-block"
        >
          terms and conditions
        </button>{" "}
        of this platform by signing up.
      </p>
    );
  };

  // Helper for WhatsApp
  const waLink = `https://wa.me/2348028416553?text=Verify%20my%20Yeedem%20account%20code:%20${verificationCode}`;

  return (
    <div className="w-full bg-[#161C48] rounded-[32px] p-8 border border-white/10 shadow-2xl text-center space-y-6 max-w-md mx-auto relative overflow-hidden">
        
        {/* Simplified Header */}
        <div className="flex justify-center">
            <div className="w-16 h-16 bg-white border border-white/20 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden p-1.5 ">
                <img src={LogoImg} alt="Yeedem Books" className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
            </div>
        </div>

        {/* Step: Phone Entry */}
        {step === 'phone' && (
            <div className="space-y-4">
                <h2 className="text-white text-xl font-bold">Welcome Back</h2>
                <input
                    type="text"
                    value={phoneOrEmail}
                    onChange={(e) => setPhoneOrEmail(e.target.value)}
                    placeholder="Enter phone or email"
                    className="w-full p-4 rounded-xl bg-white/10 text-white placeholder:text-white/50"
                />
                <button 
                    onClick={probeUser}
                    disabled={loading}
                    className="w-full bg-[#00A6FF] p-4 rounded-xl text-white font-bold"
                >
                    {loading ? 'Checking...' : 'Continue'}
                </button>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                {renderTermsDisclaimer()}
            </div>
        )}

        {/* Step: PIN Lock */}
        {step === 'pin_lock' && (
            <div className="space-y-4">
                <h2 className="text-white text-xl font-bold">Enter PIN</h2>
                <div className="flex justify-center gap-2 relative">
                    <input 
                        type="number" 
                        ref={pinInputRef} 
                        value={pinAttempt} 
                        onChange={(e) => handlePinInput(e.target.value)} 
                        className="opacity-0 absolute inset-0 w-full h-full cursor-default"
                        onBlur={() => { if(step === 'pin_lock') pinInputRef.current?.focus() }}
                    />
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full ${i < pinAttempt.length ? 'bg-white' : 'bg-white/20'}`}></div>
                    ))}
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                
                {/* Keypad */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                    {[1,2,3,4,5,6,7,8,9,0].map((num) => (
                        <button key={num} onClick={() => handlePinLogin(num.toString())} className="bg-white/10 text-white p-4 rounded-xl text-xl font-bold">
                            {num}
                        </button>
                    ))}
                    <button onClick={() => setPinAttempt(pinAttempt.slice(0, -1))} className="bg-white/5 text-white p-4 rounded-xl text-sm font-bold">Del</button>
                </div>
                
                <button onClick={clearAuthProfile} className="text-white/60 text-xs underline">Switch Account</button>
            </div>
        )}

        {/* Example of WhatsApp Verify View */}
        {step === 'whatsapp_verify' && (
            <div className="space-y-4">
                <h2 className="text-white text-xl font-bold">Verify via WhatsApp</h2>
                <p className="text-white text-sm">Verifying your account via WhatsApp. Tap to verify:</p>
                <a 
                    href={waLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block bg-emerald-600 p-4 rounded-xl text-white font-bold"
                >
                    Verify via WhatsApp
                </a>
                <p className="text-white text-xs">Expires in {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</p>
                 <p className="text-white/60 text-xs text-center">Or manually message: Verify my Yeedem account code: {verificationCode} to +234 802 841 6553</p>
                 <button onClick={clearAuthProfile} className="text-white/60 text-xs underline mt-2 block w-full">Switch Account</button>
            </div>
        )}
      
        <p className="text-[10px] text-slate-400 font-mono tracking-tight select-none pt-4">
            Simulated Client Environment: Geo={approxRegion} | IP={deviceFingerprint ? deviceFingerprint.substring(0,8) : 'Detecting...'}
        </p>
    </div>
  );
}
