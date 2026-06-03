import React, { useState, useEffect } from 'react';
import { Lock, Smartphone, ShieldCheck, ArrowRightLeft, Sparkles, AlertTriangle, Key, Loader2 } from 'lucide-react';
import LogoImg from '../assets/images/yeedem_books_logo_1779553023368.png';
import { apiFetch } from '../lib/api';

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
  const [step, setStep] = useState<'pin_lock' | 'phone' | 'otp' | 'set_pin' | 'confirm_pin' | 'enter_name' | 'enter_business' | 'forgot_phone' | 'forgot_otp' | 'forgot_new_pin' | 'forgot_confirm_pin'>('phone');
  
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
  
  // Check on load if this device already has an authorized profile
  const storedPhone = localStorage.getItem('authorized_phone_or_email') || '';

  useEffect(() => {
    if (storedPhone) {
      const normalized = normalizeContact(storedPhone);
      setPhoneOrEmail(normalized);
      setStep('pin_lock');
    }
  }, [storedPhone]);

  const headers = {
    'Content-Type': 'application/json',
    'x-device-fingerprint': deviceFingerprint || 'unknown_fp',
    'x-approx-region': approxRegion || 'NG-Lagos'
  };

  // Automated transitions for 4-digit steps
  useEffect(() => {
    if (step === 'otp' && otp.length === 4) {
      verifyOtp();
    } else if (step === 'set_pin' && newPin.length === 4) {
      handleSavePin();
    } else if (step === 'confirm_pin' && confirmPin.length === 4) {
      handleConfirmPin();
    } else if (step === 'forgot_otp' && otp.length === 4) {
      verifyForgotOtp();
    } else if (step === 'forgot_new_pin' && newPin.length === 4) {
      handleForgotSavePin();
    } else if (step === 'forgot_confirm_pin' && confirmPin.length === 4) {
      handleForgotConfirmPin();
    }
  }, [otp, newPin, confirmPin, step]);

  const sendForgotOtp = async () => {
    const input = normalizeContact(phoneOrEmail);
    if (!input) {
      setError('Please enter your registered phone number or email first.');
      return;
    }
    setLoading(true);
    setLoadingText('Requesting recovery code...');
    setError('');
    setSimulatedOtpNotice('');
    try {
      const res = await apiFetch('/api/auth/probe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: input })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Authentication gateway unreachable (${res.status}). ${errText.substring(0, 50)}`);
      }
      const data = await res.json();

      if (data.newUser) {
        setError('No active merchant profile is registered with this phone/email.');
      } else {
        setStep('forgot_otp');
        setSimulatedOtpNotice(`WhatsApp: Standard verification OTP dispatched securely to ${input}. Default code is [1234].`);
      }
    } catch (e: any) {
      setError(e.message || 'Verification gateway unreachable. Try again.');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const verifyForgotOtp = async () => {
    if (otp.trim() !== '1234') {
      setError('Invalid 4-digit OTP. Enter 1234 for simulation.');
      setOtp('');
      return;
    }
    setStep('forgot_new_pin');
    setError('');
  };

  const handleForgotSavePin = async () => {
    if (newPin.length !== 4) {
      setError('Please choose a 4-digit numeric PIN.');
      return;
    }
    setError('');
    setStep('forgot_confirm_pin');
  };

  const handleForgotConfirmPin = async () => {
    if (confirmPin !== newPin) {
      setError('PIN entries do not match. Start over.');
      setNewPin('');
      setConfirmPin('');
      setStep('forgot_new_pin');
      return;
    }

    const cleanContact = normalizeContact(phoneOrEmail);
    setLoading(true);
    setLoadingText('Resetting vault access...');
    setError('');
    try {
      const res = await apiFetch('/api/auth/reset-forgotten-pin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: cleanContact, otp: otp.trim(), pin: confirmPin })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.detail || 'PIN reset flow failed.');
      }
      const data = await res.json();
      if (data.session_id) {
        localStorage.setItem('authorized_phone_or_email', cleanContact);
        localStorage.setItem('session_id', data.session_id);
        onLogin(data.session_id, cleanContact, data.user);
      } else {
        throw new Error('Pin reset succeeded but could not establish active user terminal.');
      }
    } catch (e: any) {
      setError(e.message || 'Forgot PIN reset process encountered an error.');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const probeUser = async () => {
    const input = normalizeContact(phoneOrEmail);
    if (!input) {
      setError('Please enter your phone number or email first.');
      return;
    }

    const cleanPhoneCheck = input.replace(/[\s\-\(\)]/g, '');
    const isEmail = input.includes('@') && input.includes('.');
    const isPhone = /^\+?[0-9]{8,15}$/.test(cleanPhoneCheck);

    if (!isEmail && !isPhone) {
      setError('Invalid contact format! Please enter a valid business email address or phone number (e.g., 07066144913 or +2348123456789).');
      return;
    }

    if (!navigator.onLine) {
      setError('⚠️ Network Offline: An active internet connection is required to verify account profiles or connect to Yeedem servers.');
      return;
    }

    setPhoneOrEmail(input);

    setLoading(true);
    setLoadingText('Locating ledger profile...');
    setError('');
    setSimulatedOtpNotice('');
    try {
      const res = await apiFetch('/api/auth/probe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: input })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Authentication gateway unreachable (${res.status}). ${errText.substring(0, 50)}`);
      }
      const data = await res.json();
      
      localStorage.setItem('hasPin', String(data.hasPin));
      
      if (!data.newUser && data.hasPin) {
        setStep('pin_lock');
      } else {
        setStep('otp');
        setSimulatedOtpNotice(`WhatsApp: Standard OTP dispatched securely to ${input}. Default code is [1234].`);
      }
    } catch (e: any) {
      setError(e.message || 'Verification gateway unreachable. Try again.');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const verifyOtp = async () => {
    if (!navigator.onLine) {
      setError('⚠️ Network Offline: OTP verification requires an internet connection to sync with Yeedem servers.');
      return;
    }
    if (otp.trim() !== '1234') {
      setError('Invalid 4-digit OTP. Enter 1234 for simulation.');
      setOtp('');
      return;
    }
    const cleanContact = normalizeContact(phoneOrEmail);
    setLoading(true);
    setLoadingText('Verifying identity...');
    setError('');
    try {
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: cleanContact, otp: otp.trim() })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.detail || 'Invalid OTP code entered.');
      }
      const data = await res.json();
      
      if (data.session_id) {
          localStorage.setItem('session_id', data.session_id);
      }

      if (data.is_new_user) {
        setIsNewUser(true);
        setStep('set_pin');
      } else if (!data.needs_pin) {
        setIsNewUser(false);
        localStorage.setItem('authorized_phone_or_email', cleanContact);
        setStep('pin_lock');
      } else {
        setIsNewUser(false);
        setStep('set_pin');
      }
    } catch (e: any) {
      setError(e.message || 'OTP check failed.');
      setOtp('');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };
<<<<<<< HEAD
=======
    
  const handlePinInput = (value: string) => {
      setError('');
      if (/^\d{0,4}$/.test(value)) {
          setPinAttempt(value);
          if (value.length === 4) {
              triggerPinLogin(value);
          }
      }
  };
>>>>>>> main

  const handleSavePin = async () => {
    if (newPin.length !== 4) {
      setError('Please choose a 4-digit numeric PIN.');
      return;
    }
    setError('');
    setStep('confirm_pin');
  };

  const handleConfirmPin = async () => {
    if (!navigator.onLine) {
      setError('⚠️ Network Offline: Configuring PIN credentials requires an internet connection to sync with Yeedem servers.');
      return;
    }
    if (confirmPin !== newPin) {
      setError('PIN entries do not match. Start over.');
      setNewPin('');
      setConfirmPin('');
      setStep('set_pin');
      return;
    }
    
    if (isNewUser) {
        setStep('enter_name');
        return;
    }

    const cleanContact = normalizeContact(phoneOrEmail);
    setLoading(true);
    setLoadingText('Securing your vault...');
    setError('');
    try {
      const res = await apiFetch('/api/auth/set-pin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: cleanContact, pin: confirmPin })
      });
      if (!res.ok) throw new Error('Failed to configure PIN.');

      const authRes = await apiFetch('/api/auth/pin-login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_or_email: cleanContact, pin: confirmPin })
      });
      const authData = await authRes.json();

      if (authData.session_id) {
        localStorage.setItem('authorized_phone_or_email', cleanContact);
        onLogin(authData.session_id, cleanContact, authData.user);
      } else {
        throw new Error('Could not establish secure session after PIN configuration.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to authorize secret PIN.');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const handlePinLogin = async (digit: string) => {
    setError('');
    if (pinAttempt.length < 4) {
      const nextAttempt = pinAttempt + digit;
      setPinAttempt(nextAttempt);

      if (nextAttempt.length === 4) {
        const cleanContact = normalizeContact(phoneOrEmail);
        setLoading(true);
        setLoadingText('Unlocking Storefront...');
        try {
          const res = await apiFetch('/api/auth/pin-login', {
            method: 'POST',
            headers,
            body: JSON.stringify({ phone_or_email: cleanContact, pin: nextAttempt })
          });
          const data = await res.json();

          if (res.status === 403 || data.is_suspicious_locked) {
            onLogin(data.session_id || 'suspended_session', cleanContact, data.user);
          } else if (res.ok && data.session_id) {
            onLogin(data.session_id, cleanContact, data.user);
          } else {
            setPinAttempt('');
            setError(data.error || data.detail || 'Incorrect 4-digit Master PIN code.');
          }
        } catch (err) {
          setError('Hardware connection error. Please try again.');
          setPinAttempt('');
        } finally {
          setLoading(false);
          setLoadingText('');
        }
      }
    }
  };

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

  // Keyboard support for 4-digit entries
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['pin_lock', 'otp', 'set_pin', 'confirm_pin', 'forgot_otp', 'forgot_new_pin', 'forgot_confirm_pin'].includes(step)) {
        if (e.key >= '0' && e.key <= '9') {
          handleKeypadPress(e.key);
        } else if (e.key === 'Backspace') {
          handleBackspace();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, loading, otp, newPin, confirmPin, pinAttempt]);

  const renderKeypad = () => (
    <div className="space-y-6">
      <div className="flex justify-center gap-4 py-2">
        {[1, 2, 3, 4].map(idx => {
          let isFilled = false;
          if (step === 'pin_lock') isFilled = pinAttempt.length >= idx;
          else if (step === 'otp' || step === 'forgot_otp') isFilled = otp.length >= idx;
          else if (step === 'set_pin' || step === 'forgot_new_pin') isFilled = newPin.length >= idx;
          else if (step === 'confirm_pin' || step === 'forgot_confirm_pin') isFilled = confirmPin.length >= idx;

          return (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border border-blue-400/30 transition-all ${
                isFilled ? 'bg-[#00A6FF] scale-110 shadow-md shadow-[#00A6FF]/50' : 'bg-white/5'
              }`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto pb-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button
            key={num}
            type="button"
            onClick={() => handleKeypadPress(num)}
            disabled={loading}
            className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-lg font-bold flex items-center justify-center transition text-white outline-none cursor-pointer"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (step === 'pin_lock') setPinAttempt('');
            else if (step === 'otp' || step === 'forgot_otp') setOtp('');
            else if (step === 'set_pin' || step === 'forgot_new_pin') setNewPin('');
            else if (step === 'confirm_pin' || step === 'forgot_confirm_pin') setConfirmPin('');
          }}
          className="text-[10px] text-slate-400 font-bold hover:text-white uppercase tracking-tighter"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => handleKeypadPress('0')}
          disabled={loading}
          className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-lg font-bold flex items-center justify-center transition text-white cursor-pointer"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="text-[10px] text-slate-400 font-bold hover:text-white uppercase tracking-tighter"
        >
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-[#161C48] rounded-[32px] p-8 border border-white/10 shadow-2xl text-center space-y-6 max-w-md mx-auto relative overflow-hidden">

      {loading && (
        <div className="absolute inset-0 bg-[#161C48]/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-3 animate-fadeIn">
          <Loader2 className="w-10 h-10 text-[#00A6FF] animate-spin" />
          <p className="text-[#00A6FF] font-bold text-sm tracking-wide">{loadingText || 'Please wait...'}</p>
        </div>
      )}

      {/* Decorative Branding header token */}
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-white border border-white/20 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden p-1.5 hover:scale-105 transition duration-300">
          <img src={LogoImg} alt="Yeedem Books" className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
        </div>
      </div>

<<<<<<< HEAD
      <div className="space-y-2">
        <h1 className="text-2xl font-black font-serif text-white tracking-tight">
          {step === 'pin_lock' ? 'Storefront Vault Locked' : step.startsWith('forgot_') ? 'Reset Master PIN' : 'Yeedem Merchant Hub'}
        </h1>
        <p className="text-xs text-slate-300 px-2 leading-relaxed">
          {step === 'pin_lock'
            ? `Enter the 4-digit Master PIN configured for ${phoneOrEmail} to resume books.`
            : step === 'otp'
            ? 'Enter the 4-digit verification code sent to your credentials.'
            : step === 'set_pin'
            ? 'Configure a unique 4-digit storefront master lock PIN.'
            : step === 'confirm_pin'
            ? 'Please re-enter your 4-digit Master PIN to confirm lock security.'
            : step === 'forgot_phone'
            ? 'Enter your registered phone number or email to receive a recovery code.'
            : step === 'forgot_otp'
            ? 'Input the 4-digit security code sent to your credentials.'
            : step === 'forgot_new_pin'
            ? 'Configure your new 4-digit security master PIN.'
            : step === 'forgot_confirm_pin'
            ? 'Re-enter your new 4-digit Master PIN to confirm and log in.'
            : 'Access your secure bookkeeping ledger files safely across multiple operational environments.'}
=======
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
                        <button key={num} onClick={() => handlePinInput(pinAttempt + num.toString())} className="bg-white/10 text-white p-4 rounded-xl text-xl font-bold">
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
>>>>>>> main
        </p>
      </div>

      {error && (
        <div className="bg-red-500/15 border border-red-500/25 p-3 rounded-xl flex items-center gap-2 text-red-300 text-[11px] font-bold text-left animate-shake">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Keypad-based steps */}
      {['pin_lock', 'otp', 'set_pin', 'confirm_pin', 'forgot_otp', 'forgot_new_pin', 'forgot_confirm_pin'].includes(step) && (
        <div className="space-y-6">
          {simulatedOtpNotice && (step === 'otp' || step === 'forgot_otp') && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-left text-[11px] text-emerald-300 space-y-1 max-w-sm mx-auto">
              <span className="font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Token Transmitted:
              </span>
              <p className="font-mono text-[10px] leading-tight text-emerald-400">{simulatedOtpNotice}</p>
            </div>
          )}

          {step === 'set_pin' && (
             <div className="bg-blue-500/15 border border-blue-500/25 p-3 rounded-xl text-left text-[11px] text-blue-300 leading-relaxed font-mono max-w-sm mx-auto">
                * Setup PIN Loop: Use this 4-digit code on this device for all future entries bypassing the OTP.
             </div>
          )}

          {renderKeypad()}

          <div className="flex items-center justify-between px-6 max-w-[245px] mx-auto text-xs font-semibold pt-2">
            {step === 'pin_lock' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep('forgot_phone');
                  }}
                  className="text-[10px] text-blue-400 font-semibold hover:underline cursor-pointer"
                >
                  Forgot master PIN?
                </button>
                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                <button
                  type="button"
                  onClick={clearAuthProfile}
                  className="text-[10px] text-red-400 font-semibold hover:underline cursor-pointer"
                  title="De-authorize profiling to log in as another merchant."
                >
                  Switch User
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  if (step === 'otp') setStep('phone');
                  else if (step === 'set_pin') setStep('otp');
                  else if (step === 'confirm_pin') setStep('set_pin');
                  else if (step === 'forgot_otp') setStep('forgot_phone');
                  else if (step === 'forgot_new_pin') setStep('forgot_otp');
                  else if (step === 'forgot_confirm_pin') setStep('forgot_new_pin');
                }}
                className="text-[10px] text-slate-400 font-semibold hover:underline mx-auto cursor-pointer"
              >
                Go Back
              </button>
            )}
          </div>
          {step === 'set_pin' && renderTermsDisclaimer()}
        </div>
      )}

      {/* 2. Phone / Email Entry Screen */}
      {step === 'phone' && (
        <div className="space-y-4 max-w-sm mx-auto">
          <input
            className="p-3.5 rounded-xl w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-[#00A6FF] transition outline-none font-medium text-center text-sm"
            placeholder="E.g. +234 812 345 6789 or shop@depot.com"
            value={phoneOrEmail}
            onChange={e => setPhoneOrEmail(e.target.value)}
            disabled={loading}
          />
          <button
            onClick={probeUser}
            disabled={loading}
            className={`bg-[#00A6FF] hover:bg-opacity-95 active:scale-95 text-white p-3.5 rounded-xl w-full font-bold text-xs transition-all shadow-lg shadow-blue-500/20 ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            Verify Account Profile
          </button>
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep('forgot_phone');
              }}
              className="text-[11px] text-[#00A6FF]/90 font-bold hover:underline cursor-pointer"
            >
              Forgot master PIN? Recover Account
            </button>
          </div>
        </div>
      )}

      {/* 6. Enter Name */}
      {step === 'enter_name' && (
        <div className="space-y-4 max-w-sm mx-auto">
          <input
            className="p-3.5 rounded-xl w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-[#00A6FF] transition outline-none font-medium text-center text-sm"
            placeholder="Your Full Name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setStep('enter_business')}
            className="bg-[#00A6FF] hover:bg-opacity-95 active:scale-95 text-white p-3.5 rounded-xl w-full font-bold text-xs transition"
          >
            Next: Business Info
          </button>
          {renderTermsDisclaimer()}
        </div>
      )}

      {/* 7. Enter Business */}
      {step === 'enter_business' && (
        <div className="space-y-4 max-w-sm mx-auto text-left">
          <input
            className="p-3.5 rounded-xl w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-[#00A6FF] transition outline-none font-medium text-center text-sm"
            placeholder="Business Name"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
          />

          <div className="space-y-2">
            <label className="text-xs text-slate-300 font-bold tracking-wider uppercase block">Select Business Type</label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition duration-200 flex flex-col cursor-pointer ${
                  businessType === 'buy_and_sell'
                    ? 'bg-[#00A6FF]/25 border-[#00A6FF] text-white shadow-[#00A6FF]/20 shadow-sm'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                }`}
                onClick={() => setBusinessType('buy_and_sell')}
              >
                <span className="font-extrabold text-sm">Buy & Sell (Retail/Wholesale Products)</span>
                <span className="text-[10px] text-slate-300 mt-1 font-normal leading-normal">Track physical item stock counts, product quantities, wholesale cost prices, and suppliers.</span>
              </button>

              <button
                type="button"
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition duration-200 flex flex-col cursor-pointer ${
                  businessType === 'service'
                    ? 'bg-[#00A6FF]/25 border-[#00A6FF] text-white shadow-[#00A6FF]/20 shadow-sm'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                }`}
                onClick={() => setBusinessType('service')}
              >
                <span className="font-extrabold text-sm">Service Rendering (Consulting, Repair, etc.)</span>
                <span className="text-[10px] text-slate-300 mt-1 font-normal leading-normal">Record services, hours, sessions, custom rate card durations, and calculate profit without item stock constraints.</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
                if (!navigator.onLine) {
                  setError('⚠️ Network Offline: An active internet connection is strictly required to complete account registration on our servers.');
                  return;
                }
                const cleanContact = normalizeContact(phoneOrEmail);
                if (!fullName.trim()) {
                  setError('Please fill in your full name.');
                  return;
                }
                if (!businessName.trim()) {
                  setError('Please fill in your business name.');
                  return;
                }
                setLoading(true);
                setLoadingText('Finalizing registration...');
                setError('');
                try {
                  const res = await apiFetch('/api/auth/register-onboarding', {
                    method: 'POST',
                    headers: { ...headers, 'x-session-id': localStorage.getItem('session_id') || '' },
                    body: JSON.stringify({
                      phone_or_email: cleanContact,
                      pin: confirmPin,
                      full_name: fullName.trim(),
                      business_name: businessName.trim(),
                      business_type: businessType
                    })
                  });
                  if (!res.ok) {
                    const errInfo = await res.json().catch(() => ({}));
                    throw new Error(errInfo.error || errInfo.detail || 'Server rejected onboarding. Please try again.');
                  }

                  localStorage.setItem('authorized_phone_or_email', cleanContact);

                  // Fetch auth session after registration
                  const authRes = await apiFetch('/api/auth/pin-login', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ phone_or_email: cleanContact, pin: confirmPin })
                  });

                  if (!authRes.ok) {
                    const errInfo = await authRes.json().catch(() => ({}));
                    throw new Error(errInfo.error || errInfo.detail || 'Failed to authenticate secure session after registration.');
                  }

                  const authData = await authRes.json();
                  if (!authData || !authData.session_id) {
                    throw new Error('Onboarding session token was missing from connection response.');
                  }
                  onLogin(authData.session_id, cleanContact, authData.user);
                } catch(e: any) {
                  setError(e.message || 'Onboarding gateway error. Please try again.');
                } finally {
                  setLoading(false);
                  setLoadingText('');
                }
            }}
            className="bg-[#00A6FF] hover:bg-opacity-95 active:scale-95 text-white p-3.5 rounded-xl w-full font-bold text-xs transition cursor-pointer"
          >
            Complete Registration
          </button>
          {renderTermsDisclaimer()}
        </div>
      )}
      
      {/* Recovery Step: Forgot Phone */}
      {step === 'forgot_phone' && (
        <div className="space-y-4 max-w-sm mx-auto">
          <input
            className="p-3.5 rounded-xl w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-[#00A6FF] transition outline-none font-medium text-center text-sm"
            placeholder="Registered Phone or Email"
            value={phoneOrEmail}
            onChange={e => setPhoneOrEmail(e.target.value)}
            disabled={loading}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setError(''); setStep('phone'); }}
              className="bg-white/5 hover:bg-white/10 text-slate-300 p-3.5 rounded-xl flex-1 font-bold text-xs transition cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={sendForgotOtp}
              disabled={loading}
              className="bg-[#00A6FF] hover:bg-opacity-95 active:scale-95 text-white p-3.5 rounded-xl flex-[2] font-bold text-xs transition shadow-lg tracking-wide animate-pulse-subtle cursor-pointer"
            >
              Send Recovery OTP
            </button>
          </div>
          <div className="pt-2 text-center text-xs text-slate-300">
            <span>New merchant? </span>
            <button
              type="button"
              onClick={() => {
                setError('');
                setPhoneOrEmail('');
                setStep('phone');
              }}
              className="text-[#00A6FF] font-extrabold hover:underline ml-1 cursor-pointer"
            >
              Sign Up / Register Here
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 font-mono tracking-tight select-none">
        Simulated Client Environment: Geo={approxRegion} | IP={deviceFingerprint ? deviceFingerprint.substring(0,8) : 'Detecting...'}
      </p>
    </div>
  );
}
