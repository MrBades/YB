import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import Paystack from 'paystack';
import { anomalyDetectionMiddleware, requireSession, getApproxRegion } from "./server/middleware";
import { readDB, writeDB } from "./server/db";

dotenv.config();

const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY || '');
const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy check of Gemini AI client
let ai: GoogleGenAI | null = null;
if (process.env.AI_API_KEY_OVERRIDE || process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.AI_API_KEY_OVERRIDE || process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// All API routes
app.use("/api/admin/*", anomalyDetectionMiddleware);

app.post("/api/guest/invoice-generate", (req, res) => {
    const body_hash = req.body.device_fingerprint_hash;
    const header_hash = req.headers['x-device-fingerprint'];
    
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
    const user_agent = req.headers['user-agent'] || 'unknown';
    
    const isInvalidHash = (h: any) => !h || h === 'unknown' || h === 'unknown_fp';
    
    const device_fingerprint_hash = (!isInvalidHash(body_hash) ? body_hash : 
                                     (!isInvalidHash(header_hash) ? header_hash : 
                                        Buffer.from(`${client_ip}:${user_agent}`).toString('base64')));
    
    const db = readDB();

    let tracker = db.anonymousTrialTrackers.find((t: any) => t.device_fingerprint_hash === device_fingerprint_hash);
    
    if (!tracker) {
        tracker = { device_fingerprint_hash, ip_address: client_ip, invoice_count: 0, last_request_timestamp: Date.now() };
        db.anonymousTrialTrackers.push(tracker);
    }

    if (tracker.invoice_count >= 2) {
        return res.status(400).json({ error: "Trial limit reached. Please sign up." });
    }

    tracker.invoice_count++;
    tracker.last_request_timestamp = Date.now();
    
    writeDB(db);
    res.json({ status: "success", count: tracker.invoice_count });
});

function normalizeContact(phone_or_email: any): string {
    if (typeof phone_or_email !== "string") return "";
    let input = phone_or_email.trim();
    const cleanPhoneCheck = input.replace(/[\s\-\(\)]/g, "");
    const isEmail = input.includes("@") && input.includes(".");
    const isPhone = /^\+?[0-9]{8,15}$/.test(cleanPhoneCheck);

    if (isPhone && !isEmail) {
        if (cleanPhoneCheck.startsWith("0") && cleanPhoneCheck.length === 11) {
            return "+234" + cleanPhoneCheck.slice(1);
        } else if (!cleanPhoneCheck.startsWith("+") && !cleanPhoneCheck.startsWith("0") && cleanPhoneCheck.length === 10) {
            return "+234" + cleanPhoneCheck;
        } else {
            return (cleanPhoneCheck.startsWith("+") ? "+" : "") + cleanPhoneCheck.replace(/\D/g, "");
        }
    }
    return input;
}

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


app.post("/api/auth/probe", (req, res) => {
    const raw_phone_or_email = req.body.phone_or_email;
    const phone_or_email = normalizeContact(raw_phone_or_email);
    const db = readDB();
    let user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone_or_email);
    
    if (!user) {
        user = { id: Date.now().toString(), phone_or_email, otp_secret: "1234" }; // Simulated OTP in demo
        db.users.push(user);
    }
    
    // WhatsApp Authentication flow
    if (!db.whatsappVerifications) db.whatsappVerifications = [];
    const verificationCode = generateOTP();
    const expiresAt = Date.now() + 180000; // 3 minutes
    
    db.whatsappVerifications = db.whatsappVerifications.filter((v: any) => v.phone !== phone_or_email);
    db.whatsappVerifications.push({ phone: phone_or_email, code: verificationCode, status: 'pending', expiresAt });
    
    writeDB(db);

    const isNewUser = !user.full_name;
    const hasPin = !!user.owner_pin;
    
    res.json({ 
        newUser: isNewUser,
        hasPin: hasPin,
        verificationCode: verificationCode // Frontend uses this to construct the link
    });
});

app.post("/api/auth/whatsapp-webhook", (req, res) => {
    const { from_number, message } = req.body;
    
    if (!message) return res.status(200).json({ status: "ignored", message: "No message" });
    
    // Strict parsing
    const regex = /^Verify my Yeedem account code:\s*(\d{6})/i;
    const match = message.match(regex);
    if (!match) return res.status(200).json({ status: "ignored", message: "Not an auth message" });
    
    const token = match[1];
    
    const db = readDB();
    
    // Find matching pending verification
    const verification = (db.whatsappVerifications || []).find(
        (v: any) => normalizeContact(v.phone) === normalizeContact(from_number) && v.code === token && v.status === 'pending' && v.expiresAt > Date.now()
    );

    if (verification) {
        verification.status = 'verified';
        
        // Also update user verification state
        const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === normalizeContact(verification.phone));
        if (user) {
            user.isVerified = true;
            // Automatically clear suspicious locks for this user's active sessions too
            if (db.merchantSessions) {
                db.merchantSessions.forEach((s: any) => {
                    if (s.user_id === user.id) {
                        s.is_suspicious_locked = false;
                    }
                });
            }
        }

        writeDB(db);
        return res.json({ status: "success" });
    }
    
    res.status(400).json({ error: "Invalid verification code or phone number." });
});

app.post("/api/auth/check-verification-status", (req, res) => {
    const { phone_or_email } = req.body;
    const db = readDB();
    const verification = (db.whatsappVerifications || []).find(
        (v: any) => normalizeContact(v.phone) === normalizeContact(phone_or_email)
    );
    
    if (verification && verification.status === 'verified') {
        // Now proceed to log the user in
        const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === normalizeContact(phone_or_email));
        // ... (login logic as in verify-otp)
        // For simplicity, just return verified status and let frontend initiate login
        return res.json({ status: "verified", user });
    }
    
    res.json({ status: verification ? verification.status : 'not_found' });
});


app.post("/api/auth/verify-otp", (req, res) => {
    const { phone_or_email: raw_phone_or_email, otp } = req.body;
    const phone_or_email = normalizeContact(raw_phone_or_email);
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';

    const db = readDB();
    const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone_or_email);
    
    if (user && otp === '1234') {
        const session_id = Date.now().toString();
        
        // Remove old sessions for this user to avoid conflicts (except staff sessions)
        db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
        
        const session = { 
            session_id, 
            user_id: user.id, 
            device_fingerprint: deviceFingerprint, 
            last_active_ip: client_ip, 
            last_active_region: approxRegion, 
            is_suspicious_locked: false 
        };
        db.merchantSessions.push(session);
        writeDB(db);
        
        res.json({ 
            status: "success", 
            session_id, 
            is_new_user: !user.full_name,
            needs_pin: !user.owner_pin, 
            user: { id: user.id, phone_or_email: user.phone_or_email, full_name: user.full_name, business_name: user.business_name, business_type: user.business_type || 'buy_and_sell' }
        });
    } else {
        res.status(401).json({ error: "Invalid 4-digit OTP" });
    }
});

app.post("/api/auth/register-onboarding", requireSession, (req, res) => {
    const { pin, full_name, business_name, business_type, phone, address, template } = req.body;
    const user_id = (req as any).user_id;

    const db = readDB();
    const user = db.users.find((u: any) => u.id === user_id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.owner_pin = pin || user.owner_pin;
    user.full_name = full_name || user.full_name || "Merchant";
    user.business_name = business_name || user.business_name || "My Business";
    user.business_type = business_type || user.business_type || 'buy_and_sell';
    user.phone = phone || user.phone;
    user.address = address || user.address;
    user.shop_slug = (business_name || user.business_name || "My Business").toString().toLowerCase().replace(/\s+/g, '-');
    
    // Explicitly initialize the user's business config object matching setting profiles
    user.business = {
        businessName: user.business_name,
        businessType: user.business_type,
        phone: user.phone || '',
        address: user.address || '',
        invoiceTemplatePreference: template || 'classic',
        customAccentColor: '#00A6FF',
        customFontSize: 'md',
        customFontFamily: 'sans',
        customShowLogo: true,
        customHeaderTitle: 'TAX INVOICE',
        customFooterNotes: 'This document acts as an official trade journal entry. Please verify balances online.',
        customShadowStyle: 'md'
    };

    writeDB(db);
    res.json({ 
        status: "success", 
        user: { 
            id: user.id,
            phone_or_email: user.phone_or_email,
            full_name: user.full_name, 
            business_name: user.business_name, 
            business_type: user.business_type,
            owner_pin: user.owner_pin,
            phone: user.phone || '',
            address: user.address || '',
            shop_slug: user.shop_slug,
            business: user.business
        } 
    });
});

app.post("/api/auth/set-pin", (req, res) => {
    const { phone_or_email: raw_phone_or_email, pin } = req.body;
    const phone_or_email = normalizeContact(raw_phone_or_email);
    const db = readDB();
    const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone_or_email);
    if (!user) {
        return res.status(404).json({ error: "User profile not found." });
    }
    user.owner_pin = pin;
    writeDB(db);
    res.json({ status: "success", message: "PIN set successfully" });
});

app.post("/api/auth/pin-login", (req, res) => {
    const { phone_or_email: raw_phone_or_email, pin } = req.body;
    const phone_or_email = normalizeContact(raw_phone_or_email);
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';

    const db = readDB();
    const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone_or_email);
    
    console.log(`[DEBUG] PIN Login attempt for phone: ${phone_or_email}, User found: ${!!user}`);

    if (!user) {
        return res.status(404).json({ error: "Merchant profile not found on this device." });
    }
    
    if (user.owner_pin !== pin) {
        return res.status(401).json({ error: "Incorrect 4-digit security PIN." });
    }
    
    const session_id = Date.now().toString();
    let is_suspicious_locked = false;
    
    // Anomaly checks
    const prevSessions = db.merchantSessions.filter((s: any) => s.user_id === user.id);
    if (prevSessions.length > 0) {
        const usualDevice = prevSessions[0].device_fingerprint;
        const usualRegion = prevSessions[0].last_active_region;
        
        if (usualDevice && usualDevice !== deviceFingerprint) {
            is_suspicious_locked = true;
            console.log(`[ANOMALY TRIGGER] Unrecognized hardware footprint: cur=${deviceFingerprint}, expected=${usualDevice}`);
        } else if (usualRegion && usualRegion !== 'Unknown' && approxRegion !== 'Unknown' && usualRegion !== approxRegion) {
            is_suspicious_locked = true;
            console.log(`[ANOMALY TRIGGER] Geographic shift detected: cur=${approxRegion}, expected=${usualRegion}`);
        }
    }
    
    db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
    const session = {
        session_id,
        user_id: user.id,
        device_fingerprint: deviceFingerprint,
        last_active_ip: client_ip,
        last_active_region: approxRegion,
        is_suspicious_locked
    };
    db.merchantSessions.push(session);
    writeDB(db);
    
    res.json({
        status: is_suspicious_locked ? "locked" : "success",
        session_id,
        is_suspicious_locked,
        user: { 
            id: user.id, 
            phone_or_email: user.phone_or_email, 
            full_name: user.full_name, 
            business_name: user.business_name, 
            business_type: user.business_type || 'buy_and_sell',
            owner_pin: user.owner_pin,
            phone: user.phone || user.phone_or_email,
            address: user.address || '',
            shop_slug: user.shop_slug || '',
            business: user.business || null
        }
    });
});

app.post("/api/auth/reset-forgotten-pin", (req, res) => {
    const { phone_or_email: raw_phone_or_email, otp, pin } = req.body;
    const phone_or_email = normalizeContact(raw_phone_or_email);
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';

    if (!phone_or_email || !pin) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    if (otp !== '1234') {
        return res.status(401).json({ error: "Invalid 4-digit OTP" });
    }

    const db = readDB();
    const user = db.users.find((u: any) => normalizeContact(u.phone_or_email) === phone_or_email);
    if (!user) {
        return res.status(404).json({ error: "Merchant profile not found on this device." });
    }

    // Set new PIN
    user.owner_pin = pin;

    const session_id = Date.now().toString();

    // Clear old session (except staff sessions)
    db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user.id || s.is_staff);
    
    // Create new active session, bypassing suspicious locks as they just verified via OTP reset
    const session = {
        session_id,
        user_id: user.id,
        device_fingerprint: deviceFingerprint,
        last_active_ip: client_ip,
        last_active_region: approxRegion,
        is_suspicious_locked: false
    };
    db.merchantSessions.push(session);
    writeDB(db);

    res.json({
        status: "success",
        session_id,
        user: { 
            id: user.id, 
            phone_or_email: user.phone_or_email, 
            full_name: user.full_name, 
            business_name: user.business_name, 
            business_type: user.business_type || 'buy_and_sell',
            owner_pin: user.owner_pin,
            phone: user.phone || user.phone_or_email,
            address: user.address || '',
            shop_slug: user.shop_slug || '',
            business: user.business || null
        }
    });
});

app.post("/api/auth/validate-session", requireSession, (req, res) => {
    const session_id = req.headers['x-session-id'] as string;
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
    const db = readDB();
    const session = db.merchantSessions.find((s: any) => s.session_id === session_id);
    
    if (!session) {
        return res.status(401).json({ error: "Invalid or expired session" });
    }
    
    const user = db.users.find((u: any) => u.id === session.user_id);
    const is_staff = !!session.is_staff;
    const staffObj = is_staff ? (db.staff || []).find((s: any) => s.id === session.staff_id) : null;

    res.json({
        status: "success",
        is_suspicious_locked: session.is_suspicious_locked,
        is_staff,
        staff: staffObj,
        user: user ? { 
            id: user.id, 
            phone_or_email: user.phone_or_email, 
            full_name: user.full_name, 
            business_name: user.business_name, 
            business_type: user.business_type || 'buy_and_sell',
            owner_pin: user.owner_pin,
            phone: user.phone || user.phone_or_email,
            address: user.address || '',
            shop_slug: user.shop_slug || '',
            business: user.business || null,
            subscriptionPlan: user.subscriptionPlan || 'starter',
            subscriptionStatus: user.subscriptionStatus || 'active'
        } : null
    });
});

app.post("/api/auth/verify-suspicious-otp", (req, res) => {
    const { session_id, otp } = req.body;
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
    const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';

    const db = readDB();
    const session = db.merchantSessions.find((s: any) => s.session_id === session_id);
    
    if (!session) {
        return res.status(401).json({ error: "Invalid security session context." });
    }
    
    const user = db.users.find((u: any) => u.id === session.user_id);
    const userPhone = user ? user.phone_or_email : '';

    let isOtpValid = false;
    if (otp === '1234') {
        isOtpValid = true;
    } else if (otp && userPhone) {
        const verification = (db.whatsappVerifications || []).find(
            (v: any) => normalizeContact(v.phone) === normalizeContact(userPhone) && 
                       v.code === otp && 
                       v.expiresAt > Date.now()
        );
        if (verification) {
            verification.status = 'verified';
            isOtpValid = true;
        }
    }
    
    if (isOtpValid) {
        session.is_suspicious_locked = false;
        session.device_fingerprint = deviceFingerprint;
        session.last_active_region = approxRegion;
        session.last_active_ip = client_ip;
        writeDB(db);
        res.json({ status: "success", message: "OTP Verification complete. Suspicious block cleared." });
    } else {
        res.status(401).json({ error: "Invalid verification code. Use 1234 or dynamic WhatsApp code." });
    }
});

app.post("/api/auth/logout", (req, res) => {
    res.json({ status: "success" });
});

app.post("/api/payment/initialize", requireSession, async (req, res) => {
    try {
        const { plan, amount, email } = req.body;
        
        const hasKey = process.env.PAYSTACK_SECRET_KEY && 
                        process.env.PAYSTACK_SECRET_KEY !== 'MY_PAYSTACK_SECRET_KEY' &&
                        process.env.PAYSTACK_SECRET_KEY.trim() !== '' &&
                        !process.env.PAYSTACK_SECRET_KEY.includes('PLACEholder');
                        
        if (!hasKey) {
            // Simulator mode when Paystack key is not available
            const simRef = `sim_ref_${Math.random().toString(36).substring(2, 10)}`;
            return res.json({
                status: true,
                message: "Simulator Auth URL Created",
                data: {
                    authorization_url: "SIMULATOR",
                    reference: simRef,
                    access_code: `sim_code_${Math.random().toString(36).substring(2, 10)}`
                }
            });
        }

        const reqOrigin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
        const callbackRaw = process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL" ? process.env.APP_URL : reqOrigin;
        const callbackUrl = `${callbackRaw.replace(/\/$/, '')}/dashboard`;

        const response = await paystack.transaction.initialize({
            amount: Math.round(amount * 100), // Paystack uses kobo
            email,
            callback_url: callbackUrl
        });
        res.json(response);
    } catch (err: any) {
        console.error("Paystack initialization error:", err);
        res.status(500).json({ error: "Failed to initialize payment" });
    }
});

app.post("/api/payment/verify", requireSession, async (req, res) => {
    try {
        const { reference, plan } = req.body;
        
        if (reference && reference.startsWith('sim_ref_')) {
            // Verify simulator payment immediately
            const user_id = (req as any).user_id;
            const db = readDB();
            const user = db.users.find((u: any) => u.id === user_id);
            if (user) {
                user.subscriptionPlan = plan;
                user.subscriptionStatus = 'active';
                writeDB(db);
            }
            return res.json({ status: "success", plan, is_simulated: true });
        }

        const hasKey = process.env.PAYSTACK_SECRET_KEY && 
                        process.env.PAYSTACK_SECRET_KEY !== 'MY_PAYSTACK_SECRET_KEY' &&
                        process.env.PAYSTACK_SECRET_KEY.trim() !== '' &&
                        !process.env.PAYSTACK_SECRET_KEY.includes('PLACEholder');

        if (!hasKey) {
            return res.status(400).json({ error: "No Paystack key set, and reference is not simulated." });
        }

        const response = await paystack.transaction.verify(reference);
        if (response.status === 'success' || (response.data && response.data.status === 'success') || response.message === 'Verification successful') {
            // Update user subscription
            const user_id = (req as any).user_id;
            const db = readDB();
            const user = db.users.find((u: any) => u.id === user_id);
            if (user) {
                user.subscriptionPlan = plan;
                user.subscriptionStatus = 'active';
                writeDB(db);
            }
            res.json({ status: "success", plan });
        } else {
            res.status(400).json({ error: "Payment verification failed" });
        }
    } catch (err: any) {
        console.error("Paystack verification error:", err);
        res.status(500).json({ error: "Failed to verify payment" });
    }
});

app.delete("/api/auth/delete-account", requireSession, (req, res) => {
    try {
        const user_id = (req as any).user_id;
        const db = readDB();
        const user = db.users.find((u: any) => u.id === user_id);
        
        if (!user) {
            return res.status(404).json({ error: "User profile not found." });
        }

        const email = user.phone_or_email;
        
        // Remove user
        console.log(`[DEBUG] Deleting account for user_id: ${user_id}`);
        db.users = db.users.filter((u: any) => u.id !== user_id);
        console.log(`[DEBUG] Remaining users: ${db.users.length}`);
        
        // Remove merchant sessions
        db.merchantSessions = db.merchantSessions.filter((s: any) => s.user_id !== user_id);
        
        // Remove staff associated with user
        db.staff = (db.staff || []).filter((s: any) => s.user_id !== user_id);
        
        // Remove staff activity logs associated with user
        db.staffActivityLogs = (db.staffActivityLogs || []).filter((l: any) => l.user_id !== user_id);
        
        writeDB(db);
        
        // Purge automated backups for this user
        if (email) {
            const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
            const backupsDir = path.join(process.cwd(), 'data', 'backups');
            if (fs.existsSync(backupsDir)) {
                const files = fs.readdirSync(backupsDir);
                let deletedCount = 0;
                files.forEach(f => {
                    if (f.startsWith(`backup_${safeEmail}_`) && f.endsWith('.json')) {
                        const filePath = path.join(backupsDir, f);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            deletedCount++;
                        }
                    }
                });
                console.log(`[PURGE SUCCESS] Purged ${deletedCount} cloud user backup files for ${email}`);
            }
        }
        
        res.json({ status: "success", message: "Account and associated data deleted successfully." });
    } catch (err: any) {
        console.error("Account deletion error:", err);
        res.status(500).json({ error: err.message || "Failed to delete account" });
    }
});

app.get("/api/public/shared-invoice/:token", (req, res) => {
    try {
        const token = req.params.token;
        if (!token) {
            return res.status(400).json({ error: "Token is required." });
        }

        const db = readDB();
        let foundInvoice: any = null;
        let foundBusiness: any = null;
        let assocUser: any = null;

        const backupsDir = path.join(process.cwd(), 'data', 'backups');
        if (fs.existsSync(backupsDir)) {
            const files = fs.readdirSync(backupsDir)
                .filter(f => f.endsWith('.json'))
                .map(f => {
                    const filePath = path.join(backupsDir, f);
                    const stats = fs.statSync(filePath);
                    return { filename: f, mtime: stats.mtime.getTime() };
                })
                .sort((a, b) => b.mtime - a.mtime); // Newest backups first

            for (const fileObj of files) {
                try {
                    const content = fs.readFileSync(path.join(backupsDir, fileObj.filename), 'utf-8');
                    const backup = JSON.parse(content);
                    let customersList: any[] = [];
                    if (backup) {
                        if (Array.isArray(backup.customers)) {
                            customersList = backup.customers;
                        } else if (backup.data && Array.isArray(backup.data.customers)) {
                            customersList = backup.data.customers;
                        }
                    }

                    if (customersList && customersList.length > 0) {
                        for (const cust of customersList) {
                            if (Array.isArray(cust.invoices)) {
                                for (const inv of cust.invoices) {
                                    const calcToken = "yb_token_" + inv.id.substring(0, 8);
                                    if (calcToken === token) {
                                        foundInvoice = inv;
                                        if (backup.businessProfile) {
                                            foundBusiness = backup.businessProfile;
                                        } else if (backup.business) {
                                            foundBusiness = backup.business;
                                        }
                                        const fileEmail = backup.email || (backup.data && backup.data.email);
                                        let user = null;
                                        if (fileEmail) {
                                            user = db.users.find((u: any) => (u.phone_or_email || "").toLowerCase().trim() === fileEmail.toLowerCase().trim());
                                        }

                                        if (!user) {
                                            let fileEmailToken = "";
                                            const fname = fileObj.filename;
                                            if (fname.startsWith("backup_") && fname.endsWith(".json")) {
                                                const sub = fname.substring("backup_".length, fname.length - ".json".length);
                                                const lastUnderscore = sub.lastIndexOf("_");
                                                if (lastUnderscore !== -1) {
                                                    fileEmailToken = sub.substring(0, lastUnderscore);
                                                }
                                            }

                                            if (fileEmailToken) {
                                                user = db.users.find((u: any) => {
                                                    const cleanUserEmail = (u.phone_or_email || "").replace(/[^a-zA-Z0-9]/g, '_');
                                                    return cleanUserEmail === fileEmailToken;
                                                });
                                            }
                                        }

                                        if (user) {
                                            assocUser = user;
                                            if (!foundBusiness) {
                                                foundBusiness = user.business;
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                            if (foundInvoice) break;
                        }
                    }
                } catch (parseErr) {
                    // skip corrupted files
                }
                if (foundInvoice) break;
            }
        }

        if (!foundInvoice) {
            return res.status(404).json({ 
                error: "Invoice not found on the cloud server. The merchant might not have updated their cloud backup recently." 
            });
        }

        res.json({
            invoice: foundInvoice,
            business: foundBusiness || {
                businessName: assocUser?.business_name || "Merchant Hub",
                invoiceTemplatePreference: "modern_blue",
                customAccentColor: "#00A6FF"
            }
        });
    } catch (err: any) {
        console.error("Shared invoice retrieve error:", err);
        res.status(500).json({ error: err.message || "Failed to load shared invoice data" });
    }
});

app.get("/api/admin/unlock-all", (req, res) => {
    const db = readDB();
    db.merchantSessions.forEach((s: any) => s.is_suspicious_locked = false);
    writeDB(db);
    res.json({ status: "success", message: "All sessions unlocked." });
});

app.post("/api/terminal/:shop_slug/:worker_slug/pin-verify", (req, res) => {
    const { pin } = req.body;
    const { shop_slug, worker_slug } = req.params;
    const db = readDB();
    
    const staff = db.staff.find((s: any) => s.name_slug === worker_slug && s.is_active);
    
    if (staff && staff.owner_generated_pin === pin) {
        // Create an active session tied to the owner's account with is_staff and staff_id flags
        const session_id = "staff_sess_" + Math.random().toString(36).substring(2, 15);
        const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown_fp';
        const approxRegion = req.headers['x-approx-region'] || 'NG-Lagos';
        const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
            ? req.headers['x-forwarded-for'][0] 
            : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';

        const session = {
            session_id,
            user_id: staff.user_id,
            device_fingerprint: deviceFingerprint,
            last_active_ip: client_ip,
            last_active_region: approxRegion,
            is_suspicious_locked: false,
            is_staff: true,
            staff_id: staff.id
        };
        db.merchantSessions.push(session);

        // Log successful access
        db.staffActivityLogs.push({ id: Date.now().toString(), staff_id: staff.id, action_taken: 'PIN_LOGIN', timestamp: Date.now(), is_flagged: false });
        writeDB(db);

        // Find associated merchant user
        const user = db.users.find((u: any) => u.id === staff.user_id);

        res.json({ 
            authenticated: true, 
            session_id, 
            staff,
            user: user ? { 
                id: user.id, 
                phone_or_email: user.phone_or_email, 
                full_name: user.full_name, 
                business_name: user.business_name, 
                business_type: user.business_type || 'buy_and_sell',
                business: user.business || null
            } : null
        });
    } else {
        // Log failed access attempt
        db.staffActivityLogs.push({ id: Date.now().toString(), action_taken: 'FAILED_PIN_LOGIN', timestamp: Date.now(), is_flagged: true });
        writeDB(db);
        res.status(401).json({ error: "Invalid PIN" });
    }
});

app.use("/api/staff", requireSession);
app.use("/api/staff/log", requireSession);

// --- Module 4/5: Staff Terminal Management API ---
app.get("/api/staff", (req, res) => {
    const user_id = (req as any).user_id;
    const session = (req as any).session;
    if (!user_id || (session && session.is_staff)) return res.status(401).json({ error: "Unauthorized" });

    const db = readDB();
    const user = db.users.find((u: any) => u.id === user_id);
    const shop_slug = user?.shop_slug || (user?.business_name ? user.business_name.toLowerCase().replace(/\s+/g, '-') : 'default-shop');
    
    const matchedStaff = (db.staff || [])
        .filter((s:any) => s.user_id === user_id)
        .map((s: any) => ({
            ...s,
            shop_slug: s.shop_slug || shop_slug
        }));
    res.json(matchedStaff);
});

app.post("/api/staff/log", (req, res) => {
    const user_id = (req as any).user_id;
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });

    const db = readDB();
    const log = {
        id: Date.now().toString(),
        user_id: user_id,
        ...req.body,
        timestamp: Date.now(),
        is_flagged: false
    };
    db.staffActivityLogs.push(log);
    writeDB(db);
    res.json({ status: "success" });
});

app.get("/api/staff/log", (req, res) => {
    const user_id = (req as any).user_id;
    const session = (req as any).session;
    if (!user_id || (session && session.is_staff)) return res.status(401).json({ error: "Unauthorized" });

    const db = readDB();
    res.json((db.staffActivityLogs || []).filter((l:any) => l.user_id === user_id));
});

app.post("/api/staff", (req, res) => {
    try {
        const user_id = (req as any).user_id;
        const session = (req as any).session;
        if (!user_id || (session && session.is_staff)) return res.status(401).json({ error: "Unauthorized" });

        const db = readDB();
        const user = db.users.find((u: any) => u.id === user_id);
        const shop_slug = user?.shop_slug || (user?.business_name ? user.business_name.toLowerCase().replace(/\s+/g, '-') : 'default-shop');
        
        const rawName = req.body.name_slug || '';
        const name_slug = rawName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');

        const newStaff = {
            id: Date.now().toString(),
            user_id,
            shop_id: req.body.shop_id || 'default_shop',
            name_slug: name_slug || rawName,
            owner_generated_pin: req.body.owner_generated_pin,
            is_active: true,
            shop_slug: shop_slug,
            // Toggleable staff permissions
            allow_create_invoices: true,
            allow_view_customers: true,
            allow_view_inventory: true,
            allow_view_costs: false,
            allow_delete_invoices: false,
            allow_manage_products: false
        };
        db.staff = [...(db.staff || []), newStaff];
        writeDB(db);
        res.json(newStaff);
    } catch (err: any) {
        console.error("Error adding staff:", err);
        res.status(500).json({ error: err.message || "Internal server error occurred while creating staff member." });
    }
});

app.put("/api/staff/:id", requireSession, (req, res) => {
    const db = readDB();
    const user_id = (req as any).user_id;
    const session = (req as any).session;
    if (!user_id || (session && session.is_staff)) return res.status(401).json({ error: "Unauthorized" });

    const index = db.staff.findIndex((s: any) => s.id === req.params.id && s.user_id === user_id);
    if (index !== -1) {
        db.staff[index] = { ...db.staff[index], ...req.body, user_id };
        writeDB(db);
        res.json(db.staff[index]);
    } else {
        res.status(404).json({ error: "Staff member not found" });
    }
});

function runLocalFallbackProductParser(text: string): any {
  const productData = {
    name: "General Commodity",
    sku: "SKU-" + Math.floor(100 + Math.random() * 900),
    stock: 10,
    price: 0
  };

  try {
    const rawText = text.trim();

    // 1. Price matching
    const priceMatch = rawText.match(/(?:at|for|price|value.*?of|cost.*?of|₦|N)\s*(\d+(?:\.\d+)?)\s*(k|thousand|million)?/i);
    if (priceMatch) {
      let value = parseFloat(priceMatch[1]);
      const multiplier = priceMatch[2];
      if (multiplier && multiplier.toLowerCase() === 'k') {
        value *= 1000;
      }
      productData.price = value;
    }

    // 2. Stock units matching
    const stockMatch = rawText.match(/(\d+)\s*(?:units|pcs|pieces|bags|items|qty|quantity|stock)/i);
    if (stockMatch) {
      productData.stock = parseInt(stockMatch[1], 10);
    }

    // 3. Name matching
    const nameMatch = rawText.match(/(?:add|create|new|item|product)\s+([\w\s&]+?)(?:\s+(?:with|at|for|under|price|sku|\d+))/i);
    if (nameMatch) {
      productData.name = nameMatch[1].trim();
    } else {
      // Clean up fallback matches
      const cleanTokens = rawText.replace(/(?:add|create|new|item|product|with|at|for|under|price|sku|\d+|units|pcs|pieces|bags|items|qty|quantity|stock)/gi, '').trim();
      if (cleanTokens.length > 3) {
        productData.name = cleanTokens;
      }
    }

    // 4. SKU matching
    const skuMatch = rawText.match(/(?:sku|code|ref)\s*([a-zA-Z0-9\-_]+)/i);
    if (skuMatch) {
      productData.sku = skuMatch[1].toUpperCase();
    } else if (productData.name && productData.name !== "General Commodity") {
      const abbr = productData.name.split(' ').map(w => w[0]).join('').substring(0, 4).toUpperCase();
      if (abbr.length >= 2) {
        productData.sku = `${abbr}-${Math.floor(100 + Math.random() * 900)}`;
      }
    }
  } catch (err) {
    console.error("Local fallback product parse error:", err);
  }

  return productData;
}

// Node.js Regex Heuristic Fallback Parser corresponding to python core/utils.py implementation
function parseAmount(valueStr: string, multiplierStr: string | undefined): number {
  if (!valueStr) return 0.0;
  // Strip commas
  const value = parseFloat(valueStr.replace(/,/g, ''));
  if (isNaN(value)) return 0.0;

  if (multiplierStr) {
    const m = multiplierStr.toLowerCase();
    if (['k', 'kilo', 'thousand'].includes(m)) return value * 1000;
    if (['m', 'million'].includes(m)) return value * 1000000;
    if (['b', 'billion'].includes(m)) return value * 1000000000;
  }
  return value;
}

// Node.js Regex Heuristic Fallback Parser corresponding to python core/utils.py implementation
function runLocalFallbackParser(text: string): any {
  const invoiceData = {
    product_name: "General Goods",
    customer_name: "Walk-in Customer",
    items: [] as any[],
    total_amount: 0.0,
    amount_paid: 0.0,
    debt_balance: 0.0,
    transaction_type: "sale"
  };

  try {
    const rawText = text.trim();
    
    // AMOUNT_REGEX for formats like: 100, 100.50, 1,000, 45k, 1.5 million
    const AMOUNT_REGEX = /([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i;

    // 1. Transaction Type
    if (/\b(expense|spent|bought|purchase|cost|paid for|payment for)\b/i.test(rawText)) {
      invoiceData.transaction_type = "expense";
    } else if (/\b(payment on account|deposit on account)\b/i.test(rawText)) {
      invoiceData.transaction_type = "payment_on_account";
    }

    // 2. Extract customer name
    const customerMatch = rawText.match(/(?:to|for|from|buyer|customer|seller)\s+([a-zA-Z\s]+?)(?:\s+(?:for|at|each|deposit|deposited|pay|paid|with|got|received|he|she|on|₦|N|\d+|,|;|\.|\blet\b|$))/i);
    if (customerMatch) {
      const name = customerMatch[1].trim();
      if (name && !/^(bags|units|pieces|kg|items|cash|the)$/i.test(name)) {
        invoiceData.customer_name = name;
      }
    }

    // 3. Extract amount paid / deposit (look for keyword before or after amount)
    const paidMatch = rawText.match(/(?:deposit(?:ed|s|ing)?|paid|pay(?:ing|s)?|got|received?|payment\s*(?:of)?)\s*(?:cash\s+)?(?:of|cash)?\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i) || 
                      rawText.match(/(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\s*(?:cash\s+)?(?:deposit|deposited|paid|payment|received|got)/i);
    if (paidMatch) {
      invoiceData.amount_paid = parseAmount(paidMatch[1], paidMatch[2]);
    }

    // 4. Extract quantity, item name
    let qty = 1;
    let prodName = "";

    // Pattern A: "3 bags of Garri" or "3 bags Garri" or "3 Garri"
    const qtyItemRegex = /\b(\d+)\s*(?:bags|units|pieces|pcs|kg|cartons|items|shirts|pairs|bottles)?\s*(?:of)?\s+([a-zA-Z\s]+?)(?:\s+(?:to|for|at|each|with|and|he|she|deposited|paid|deposit|₦|N|\d+|,|;|\.|$))/i;
    const qtyItemMatch = rawText.match(qtyItemRegex);
    if (qtyItemMatch) {
      qty = parseInt(qtyItemMatch[1], 10);
      prodName = qtyItemMatch[2].trim();
    } else {
      // Pattern B: No starting number, but item is present
      const itemExtract = rawText.match(/(?:sold|bought|sale of|purchase of)\s+([a-zA-Z\s]+?)(?:\s+(?:to|for|at|each|with|and|he|she|deposited|paid|deposit|₦|N|\d+|,|;|\.|$))/i);
      if (itemExtract) {
        prodName = itemExtract[1].trim();
      }
    }

    // Pattern C starting word fallback
    if (!prodName) {
      const startingWordMatch = rawText.match(/^([a-zA-Z]{2,15})(?:\s+(?:₦|N|\d+|for|to|at|each|with|and|he|she|deposited|paid|deposit))/i);
      if (startingWordMatch && !/^(create|record|add|new|sold|bought|sale|expense)$/i.test(startingWordMatch[1])) {
        prodName = startingWordMatch[1].trim();
      }
    }

    if (prodName) {
      prodName = prodName.replace(/\b(bags|units|pieces|cartons|of|kg|items|pcs)\b/gi, '').trim();
      if (prodName.length > 1) {
        invoiceData.product_name = prodName;
      }
    }

    // 5. Extract unit price or total price
    // Search for "each" or "at" pricing
    const eachMatch = rawText.match(/(?:for|at|@)?\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\s*each/i) || 
                      rawText.match(/(?:at|@)\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i);

    let pricePerUnit = 0.0;
    let isUnitPriceFound = false;

    if (eachMatch) {
      pricePerUnit = parseAmount(eachMatch[1], eachMatch[2]);
      isUnitPriceFound = true;
    }

    let totalAmount = 0.0;
    if (isUnitPriceFound) {
      totalAmount = qty * pricePerUnit;
    } else {
      // Look for a lump sum amount like "amounting to 150k", "worth 150k"
      const lumpSumMatch = rawText.match(/(?:for|amounting\s+to|totalling|worth|total\s*(?:of)?)\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i);
      if (lumpSumMatch) {
        totalAmount = parseAmount(lumpSumMatch[1], lumpSumMatch[2]);
        pricePerUnit = totalAmount / qty;
      } else {
        // Fallback: look for other numbers mapping to price (excluding quantity and paid amount)
        const numbersMatch = [...rawText.matchAll(/\b([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\b/gi)];
        const candidatePrices: number[] = [];
        numbersMatch.forEach(m => {
          const val = parseAmount(m[1], m[2]);
          if (val !== qty && val !== invoiceData.amount_paid) {
            candidatePrices.push(val);
          }
        });

        if (candidatePrices.length > 0) {
          const candidate = candidatePrices[0];
          if (qty > 1 && candidate < 50000) {
            pricePerUnit = candidate;
            totalAmount = qty * pricePerUnit;
          } else {
            totalAmount = candidate;
            pricePerUnit = totalAmount / qty;
          }
        }
      }
    }

    if (totalAmount === 0 && pricePerUnit > 0) {
      totalAmount = qty * pricePerUnit;
    }
    if (pricePerUnit === 0 && totalAmount > 0) {
      pricePerUnit = totalAmount / qty;
    }

    invoiceData.total_amount = totalAmount;
    invoiceData.items = [
      {
        name: invoiceData.product_name,
        quantity: qty,
        price: pricePerUnit,
        total: totalAmount
      }
    ];

    invoiceData.debt_balance = Math.max(0.0, totalAmount - invoiceData.amount_paid);

  } catch (err) {
    console.error("Local fallback parse error:", err);
  }

  return invoiceData;
}

// Full-Stack Smart Input Processor in Express API
app.post("/api/smart-input", async (req, res) => {
  const { text, file } = req.body;
  const session_id = req.headers['x-session-id'] as string;

  let user_id = null;
  if (session_id) {
    // Validate session
    const db = readDB();
    const session = (db.merchantSessions || []).find((s: any) => s.session_id === session_id);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    if (session.is_suspicious_locked) {
        return res.status(401).json({ error: "Suspicious activity detected. Session locked. Re-authenticate via OTP.", is_suspicious_locked: true });
    }
    
    // Live validation of ongoing administrative request client characteristics
    const device_fingerprint = req.headers['x-device-fingerprint'] as string;
    const approxRegion = getApproxRegion(req);
    
    let isMismatched = false;
    if (device_fingerprint && device_fingerprint !== 'unknown_fp' && device_fingerprint !== 'unknown') {
        if (session.device_fingerprint === 'fp_default_owner' || !session.device_fingerprint || session.device_fingerprint === 'unknown_fp' || session.device_fingerprint === 'unknown') {
            session.device_fingerprint = device_fingerprint;
            writeDB(db);
        } else if (device_fingerprint !== 'fp_default_owner' && session.device_fingerprint !== device_fingerprint) {
            isMismatched = true;
        }
    }

    if (isMismatched && device_fingerprint && device_fingerprint !== 'unknown' && device_fingerprint !== 'unknown_fp') {
        session.is_suspicious_locked = true;
        writeDB(db);
        return res.status(401).json({ error: "Suspicious activity detected. Session locked. Re-authenticate via OTP.", is_suspicious_locked: true });
    }
    user_id = session.user_id;
  } else {
    // Treat as Guest Trial Mode
    const body_hash = req.body.device_fingerprint_hash;
    const header_hash = req.headers['x-device-fingerprint'];
    
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
    const user_agent = req.headers['user-agent'] || 'unknown';
    
    const isInvalidHash = (h: any) => !h || h === 'unknown' || h === 'unknown_fp';
    
    const device_fingerprint_hash = (!isInvalidHash(body_hash) ? body_hash : 
                                     (!isInvalidHash(header_hash) ? header_hash : 
                                        Buffer.from(`${client_ip}:${user_agent}`).toString('base64')));
    
    const db = readDB();

    let tracker = db.anonymousTrialTrackers.find((t: any) => t.device_fingerprint_hash === device_fingerprint_hash);
    
    if (!tracker) {
        tracker = { device_fingerprint_hash, ip_address: client_ip, invoice_count: 0, last_request_timestamp: Date.now() };
        db.anonymousTrialTrackers.push(tracker);
    }

    if (tracker.invoice_count >= 2) {
        return res.status(403).json({ error: "Trial limit reached. Please sign up." });
    }

    tracker.invoice_count++;
    tracker.last_request_timestamp = Date.now();
    writeDB(db);
  }

  console.log("Received smart-input payload: text=", text, "file.mimeType=", file?.mimeType);
  console.log("AI client instantiated:", !!ai);
  if (!ai) {
    console.log("AI client is missing (check GEMINI_API_KEY environment variable). Falling back to local parser.");
  }

  // Fallback checks
  if (!text && !file) {
    return res.status(400).json({ status: "error", error: "Please enter text descriptions, record voice, or upload file snapshots." });
  }

  // 1. If Gemini AI instantiated, attempt structured output using gemini-1.5-flash model
  if (ai) {
    try {
      const parts: any[] = [];
       const prompt = `You are an expert bookkeeping AI for microlenders and retail SMEs in Nigeria. 
       Analyze the input (it could be handwritten notebook snapshots, voices, or general transaction memos) and return a structured bookkeeping ledger invoice.
       
       You MUST return values mapping to the expected JSON schema.
       
       SUPPORT QUICK-ENTRY STRUCTURES NATIVELY:
       - Single Sale entry layout e.g. "5 bags of rice at 75000" should map to:
         items: [{ name: "rice", quantity: 5, price: 75000, total: 375000 }]
         total_amount: 375000
         amount_paid: 0
         debt_balance: 375000
       - Multiple entries layout e.g.:
         "2 bags of rice at 75000
         3 cartons of spaghetti at 9000
         paid 100000"
         should map to:
         items: [
           { name: "rice", quantity: 2, price: 75000, total: 150000 },
           { name: "spaghetti", quantity: 3, price: 9000, total: 27000 }
         ]
         total_amount: 177000
         amount_paid: 100000
         debt_balance: 77000

       IMPORTANT parameters:
       1. 'product_name' must be a flat single string summing the main items (e.g., 'Garri, Sugar' or just 'Cotton Shirts')
       2. 'customer_name' must be the buyer's name. If not designated, use 'Walk-in Customer'
       3. 'transaction_type' must be either 'sale' or 'expense' or 'payment_on_account'
       4. 'amount_paid' is the deposit or cash handed over immediately. Default is 0.
       5. 'total_amount' is the total item value sum.
       6. 'debt_balance' is the outstanding balance (total_amount - amount_paid).
       `;
      parts.push({ text: prompt });

      if (text) {
        parts.push({ text: `Text Ledger Node: ${text}` });
      }

      if (file && file.data) {
        // file.data is a base64 encoded string
        parts.push({
          inlineData: {
            mimeType: file.mimeType || "image/jpeg",
            data: file.data
          }
        });
      }

      let response;
      let delayMs = 1500;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Attempt ${attempt}: Calling ai.models.generateContent in /api/smart-input...`);
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: { parts },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  product_name: { type: Type.STRING, description: "Main unified product name string" },
                  customer_name: { type: Type.STRING, description: "Customer name or 'Walk-in Customer'" },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        quantity: { type: Type.INTEGER },
                        price: { type: Type.NUMBER },
                        total: { type: Type.NUMBER }
                      },
                      required: ["name", "quantity", "price", "total"]
                    }
                  },
                  total_amount: { type: Type.NUMBER },
                  amount_paid: { type: Type.NUMBER },
                  debt_balance: { type: Type.NUMBER },
                  transaction_type: { type: Type.STRING }
                },
                required: ["product_name", "customer_name", "items", "total_amount", "amount_paid", "debt_balance"]
              },
              temperature: 0.1
            }
          });
          break;
        } catch (err: any) {
          const isCapacityErr = err?.status === "UNAVAILABLE" || err?.status === 503 || err?.status === 429 || err?.message?.includes("503") || err?.message?.includes("429");
          if (attempt === 3 || !isCapacityErr) throw err;
          
          // Try to extract suggested retry delay from error message, default to exponential backoff
          let waitTime = delayMs;
          const match = err?.message?.match(/retry in ([\d\.]+)s/);
          if (match) {
            waitTime = parseFloat(match[1]) * 1000;
          }
          
          console.log(`Gemini API temporarily busy, retrying in ${Math.round(waitTime)}ms...`);
          await new Promise(r => setTimeout(r, waitTime));
          delayMs *= 2;
        }
      }

      if (response && response.text) {
        console.log("Gemini API call successful, response text:", response.text);
        const parsed = JSON.parse(response.text.trim());
        // Normalizes to prevent KeyError crash downstream
        if (!parsed.product_name) {
          parsed.product_name = parsed.items && parsed.items[0] ? parsed.items[0].name : "General Goods";
        }
        return res.json({ status: "success", parsed_data: parsed });
      }
    } catch (apiError: any) {
      console.error("Gemini AI API Call failed, triggering heuristic backup parser. Error:", apiError.message, "Stack:", apiError.stack);
    }
  }

  // 2. Local fallback regex parsing triggers when AI client fails, is missing, or is offline!
  console.log("Triggered local fallback regex parser");
  const extractedFallback = runLocalFallbackParser(text || "");
  console.log("Local fallback parser result:", extractedFallback);
  return res.json({
    status: "fallback_error",
    parsed_data: extractedFallback,
    fallback_message: "Gemini API failed or offline. Utilizing offline heuristic fallback engine."
  });
});

// Full-Stack Smart Product Processor in Express API
app.post("/api/smart-product", async (req, res) => {
  const { text } = req.body;
  const session_id = req.headers['x-session-id'] as string;

  let user_id = null;
  if (session_id) {
    // Validate session
    const db = readDB();
    const session = (db.merchantSessions || []).find((s: any) => s.session_id === session_id);
    if (!session) return res.status(401).json({ error: "Invalid session" });
    if (session.is_suspicious_locked) {
        return res.status(401).json({ error: "Suspicious activity detected. Session locked. Re-authenticate via OTP.", is_suspicious_locked: true });
    }
    
    // Live validation of ongoing administrative request client characteristics
    const device_fingerprint = req.headers['x-device-fingerprint'] as string;
    const approxRegion = getApproxRegion(req);
    
    let isMismatched = false;
    if (device_fingerprint && device_fingerprint !== 'unknown_fp' && device_fingerprint !== 'unknown') {
        if (session.device_fingerprint === 'fp_default_owner' || !session.device_fingerprint || session.device_fingerprint === 'unknown_fp' || session.device_fingerprint === 'unknown') {
            session.device_fingerprint = device_fingerprint;
            writeDB(db);
        } else if (device_fingerprint !== 'fp_default_owner' && session.device_fingerprint !== device_fingerprint) {
            isMismatched = true;
        }
    }

    if (isMismatched && device_fingerprint && device_fingerprint !== 'unknown' && device_fingerprint !== 'unknown_fp') {
        session.is_suspicious_locked = true;
        writeDB(db);
        return res.status(401).json({ error: "Suspicious activity detected. Session locked. Re-authenticate via OTP.", is_suspicious_locked: true });
    }
    user_id = session.user_id;
  } else {
    // Treat as Guest Trial Mode
    const body_hash = req.body.device_fingerprint_hash;
    const header_hash = req.headers['x-device-fingerprint'];
    
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
    const user_agent = req.headers['user-agent'] || 'unknown';
    
    const isInvalidHash = (h: any) => !h || h === 'unknown' || h === 'unknown_fp';
    
    const device_fingerprint_hash = (!isInvalidHash(body_hash) ? body_hash : 
                                     (!isInvalidHash(header_hash) ? header_hash : 
                                        Buffer.from(`${client_ip}:${user_agent}`).toString('base64')));
    
    const db = readDB();

    let tracker = db.anonymousTrialTrackers.find((t: any) => t.device_fingerprint_hash === device_fingerprint_hash);
    
    if (!tracker) {
        tracker = { device_fingerprint_hash, ip_address: client_ip, invoice_count: 0, last_request_timestamp: Date.now() };
        db.anonymousTrialTrackers.push(tracker);
    }

    if (tracker.invoice_count >= 2) {
        return res.status(403).json({ error: "Trial limit reached. Please sign up." });
    }

    tracker.invoice_count++;
    tracker.last_request_timestamp = Date.now();
    writeDB(db);
  }

  console.log("Received smart-product payload: text =", text);

  // Fallback checks
  if (!text) {
    return res.status(400).json({ status: "error", error: "Please enter product descriptions." });
  }

  // 1. If Gemini AI instantiated, attempt structured output using gemini-1.5-flash model
  if (ai) {
    try {
      const parts: any[] = [];
      const prompt = `You are an expert product catalog AI for microlenders and retail SMEs in Nigeria. 
      Analyze the text description of an inventory product and return a structured product Catalog record.
      
      You MUST return values mapping to the expected JSON schema.
      IMPORTANT parameters:
      1. 'name' must be the clean, customer-facing product or item name. (e.g., 'Aso Ebi Teal Fabric' or 'Groundnut Oil 5L')
      2. 'sku' must be an uppercase short alphanumeric SKU code representation (e.g., 'ASE-TL', 'GNO-5L'). If not designated, generate an appropriate abbreviation SKU from the product name.
      3. 'stock' is the initial stock quantity count. Default is 10.
      4. 'price' is the unit cost or price in Nigerian Naira (₦). Default is 0.
      `;
      parts.push({ text: prompt });
      parts.push({ text: `Product Input text: ${text}` });

      let response;
      let delayMs = 1500;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: { parts },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Normalized clean product name" },
                  sku: { type: Type.STRING, description: "Short uppercase SKU code (e.g., OIL-5L)" },
                  stock: { type: Type.INTEGER, description: "Initial quantity in stock" },
                  price: { type: Type.NUMBER, description: "Unit price of the product" }
                },
                required: ["name", "sku", "stock", "price"]
              },
              temperature: 0.1
            }
          });
          break;
        } catch (err: any) {
          const isCapacityErr = err?.status === "UNAVAILABLE" || err?.status === 503 || err?.status === 429 || err?.message?.includes("503") || err?.message?.includes("429");
          if (attempt === 3 || !isCapacityErr) throw err;
          
          // Try to extract suggested retry delay from error message, default to exponential backoff
          let waitTime = delayMs;
          const match = err?.message?.match(/retry in ([\d\.]+)s/);
          if (match) {
            waitTime = parseFloat(match[1]) * 1000;
          }
          
          console.log(`Gemini API temporarily busy, retrying in ${Math.round(waitTime)}ms...`);
          await new Promise(r => setTimeout(r, waitTime));
          delayMs *= 2;
        }
      }

      if (response && response.text) {
        const parsed = JSON.parse(response.text.trim());
        return res.json({ status: "success", parsed_data: parsed });
      }
    } catch (apiError) {
      console.error("Gemini AI Product API Call failed, triggering heuristic backup product parser:", apiError);
    }
  }

  // 2. Local fallback regex parsing triggers when AI client fails, is missing, or is offline!
  console.log("Triggered local fallback regex product parser");
  const extractedFallback = runLocalFallbackProductParser(text || "");
  return res.json({
    status: "fallback_error",
    parsed_data: extractedFallback,
    fallback_message: "Gemini API failed or offline. Utilizing offline heuristic product fallback engine."
  });
});

// --- Module Backup: Local Disk/Storage JSON Backup Automated Exporter ---
const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function mergeLedgers(incoming: any, existing: any) {
    if (!existing || !existing.data) return incoming;
    if (!incoming || !incoming.data) return existing;
    
    const merged = JSON.parse(JSON.stringify(incoming));
    if (!merged.data) merged.data = {};
    const existingData = existing.data;
    
    // 1. Merge Customers & Invoices
    const incomingCustomers = merged.data.customers || [];
    const existingCustomers = existingData.customers || [];
    const customerMap = new Map<string, any>();
    
    const getCustKey = (c: any) => {
        return (c.name || '').trim().toLowerCase();
    };
    
    for (const cust of existingCustomers) {
        const key = getCustKey(cust);
        customerMap.set(key, { ...cust, invoices: [...(cust.invoices || [])] });
    }
    
    for (const cust of incomingCustomers) {
        const key = getCustKey(cust);
        const existingCust = customerMap.get(key);
        if (existingCust) {
            const invoiceMap = new Map<string, any>();
            for (const inv of existingCust.invoices || []) {
                if (inv && inv.id) {
                    invoiceMap.set(inv.id, inv);
                }
            }
            for (const inv of cust.invoices || []) {
                if (inv && inv.id) {
                    const existingInv = invoiceMap.get(inv.id);
                    if (existingInv) {
                        const existingTime = new Date(existingInv.createdAt || 0).getTime();
                        const incomingTime = new Date(inv.createdAt || 0).getTime();
                        if (incomingTime >= existingTime) {
                            invoiceMap.set(inv.id, inv);
                        }
                    } else {
                        invoiceMap.set(inv.id, inv);
                    }
                }
            }
            
            const mergedInvoices = Array.from(invoiceMap.values());
            
            const activeDebtBalance = mergedInvoices.reduce((sum: number, inv: any) => {
                if (inv.transactionType === 'sale') {
                    return sum + (inv.debtBalance || 0);
                }
                return sum;
            }, 0);
            
            customerMap.set(key, {
                ...existingCust,
                id: cust.id || existingCust.id,
                phone: cust.phone || existingCust.phone,
                email: cust.email || existingCust.email,
                activeDebtBalance,
                createdDate: (cust.createdDate && existingCust.createdDate && cust.createdDate < existingCust.createdDate) ? cust.createdDate : (cust.createdDate || existingCust.createdDate),
                invoices: mergedInvoices
            });
        } else {
            customerMap.set(key, { ...cust });
        }
    }
    merged.data.customers = Array.from(customerMap.values());
    
    // 2. Merge Products & Stocks
    const incomingProducts = merged.data.products || [];
    const existingProducts = existingData.products || [];
    const productMap = new Map<string, any>();
    
    const getProdKey = (p: any) => {
        return (p.name || '').trim().toLowerCase();
    };
    
    for (const prod of existingProducts) {
        productMap.set(getProdKey(prod), { ...prod });
    }
    
    for (const prod of incomingProducts) {
        const key = getProdKey(prod);
        const existingProd = productMap.get(key);
        if (existingProd) {
            productMap.set(key, {
                ...existingProd,
                ...prod
            });
        } else {
            productMap.set(key, { ...prod });
        }
    }
    merged.data.products = Array.from(productMap.values());
    
    // 3. Merge Restock logs
    const incomingLogs = merged.data.restockLogs || [];
    const existingLogs = existingData.restockLogs || [];
    const logMap = new Map<string, any>();
    
    for (const log of existingLogs) {
        if (log && log.id) logMap.set(log.id, log);
    }
    for (const log of incomingLogs) {
        if (log && log.id) logMap.set(log.id, log);
    }
    merged.data.restockLogs = Array.from(logMap.values());
    
    // 4. Merge Business Settings
    if (existing.businessProfile && !merged.businessProfile) {
        merged.businessProfile = existing.businessProfile;
    } else if (merged.businessProfile && existing.businessProfile) {
        merged.businessProfile = {
            ...existing.businessProfile,
            ...merged.businessProfile
        };
    }
    
    return merged;
}

app.post("/api/backup/save", (req, res) => {
    try {
        const session_id = req.headers['x-session-id'] as string;
        if (!session_id) return res.status(401).json({ error: "Session required" });
        const db = readDB();
        const session = (db.merchantSessions || []).find((s: any) => s.session_id === session_id);
        if (!session) return res.status(401).json({ error: "Invalid session" });

        const { email, backupData } = req.body;
        const user_id = session.user_id;
        
        if (!email || !backupData) {
            return res.status(400).json({ error: "Missing email or backupData parameters" });
        }
        
        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Fetch existing latest backup file to merge
        let existingBackupData: any = null;
        if (fs.existsSync(BACKUPS_DIR)) {
            const files = fs.readdirSync(BACKUPS_DIR);
            const userBackupFiles = files
                .filter(f => f.startsWith(`backup_${safeEmail}_`) && f.endsWith('.json'))
                .map(f => {
                    const filePath = path.join(BACKUPS_DIR, f);
                    const stats = fs.statSync(filePath);
                    return {
                        filename: f,
                        mtime: stats.mtime.getTime()
                    };
                })
                .sort((a, b) => b.mtime - a.mtime);
            
            if (userBackupFiles.length > 0) {
                const latestFile = userBackupFiles[0].filename;
                const filePath = path.join(BACKUPS_DIR, latestFile);
                try {
                    existingBackupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                } catch (e) {
                    console.error("Failed to parse existing backup for auto-merge:", e);
                }
            }
        }

        // Run Bidirectional auto-merger logic on server
        const mergedBackupData = mergeLedgers(backupData, existingBackupData);
        
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const fileName = `backup_${safeEmail}_${timestamp}.json`;
        const filePath = path.join(BACKUPS_DIR, fileName);
        
        fs.writeFileSync(filePath, JSON.stringify(mergedBackupData, null, 2), 'utf-8');
        console.log(`[BACKUP SUCCESS] Bidirectionally merged automated backup file saved: ${fileName} for ${email}`);
        
        res.json({ 
            status: "success", 
            message: "Ledger backup exported, bidirectionally merged, and written to server disk successfully.",
            filename: fileName,
            timestamp: new Date().toISOString(),
            mergedData: mergedBackupData
        });
    } catch (err: any) {
        console.error("Backup write error:", err);
        res.status(500).json({ error: err.message || "Failed to write backup JSON file" });
    }
});

app.get("/api/backup/list", requireSession, (req, res) => {
    try {
        const db = readDB();
        const user_id = (req as any).user_id;
        const user = db.users.find((u: any) => u.id === user_id);
        if (!user) return res.status(404).json({ error: "Merchant profile not found" });
        
        const email = user.phone_or_email || "anonymous";
        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        
        if (!fs.existsSync(BACKUPS_DIR)) {
            return res.json([]);
        }
        
        const files = fs.readdirSync(BACKUPS_DIR);
        const userBackups = files
            .filter(f => f.startsWith(`backup_${safeEmail}_`) && f.endsWith('.json'))
            .map(f => {
                const filePath = path.join(BACKUPS_DIR, f);
                const stats = fs.statSync(filePath);
                return {
                    filename: f,
                    size: stats.size,
                    createdAt: stats.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
        res.json(userBackups);
    } catch (err: any) {
        console.error("Error listing backups:", err);
        res.status(500).json({ error: err.message || "Failed to catalog backup list" });
    }
});

app.get("/api/backup/download/:filename", requireSession, (req, res) => {
    try {
        const { filename } = req.params;
        const db = readDB();
        const user_id = (req as any).user_id;
        const user = db.users.find((u: any) => u.id === user_id);
        if (!user) return res.status(401).json({ error: "Unauthorized access" });
        
        const email = user.phone_or_email || "anonymous";
        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        
        if (!filename.startsWith(`backup_${safeEmail}_`) || !filename.endsWith('.json')) {
            return res.status(400).json({ error: "Forbidden: Unauthorized backup target access file" });
        }
        
        const filePath = path.join(BACKUPS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Backup file could not be found on server disk" });
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.parse(fileContent));
    } catch (err: any) {
        console.error("Download backup error:", err);
        res.status(500).json({ error: err.message || "Failed to download backup file" });
    }
});

app.delete("/api/backup/:filename", requireSession, (req, res) => {
    try {
        const { filename } = req.params;
        const db = readDB();
        const user_id = (req as any).user_id;
        const user = db.users.find((u: any) => u.id === user_id);
        if (!user) return res.status(401).json({ error: "Unauthorized" });
        
        const email = user.phone_or_email || "anonymous";
        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        
        if (!filename.startsWith(`backup_${safeEmail}_`) || !filename.endsWith('.json')) {
            return res.status(400).json({ error: "Forbidden" });
        }
        
        const filePath = path.join(BACKUPS_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.json({ status: "success", message: "Automated daily backup file pruned successfully." });
    } catch (err: any) {
        console.error("Delete backup error:", err);
        res.status(500).json({ error: err.message || "Failed to delete backup" });
    }
});

app.post("/api/business/settings", requireSession, (req, res) => {
    const db = readDB();
    const user_id = (req as any).user_id;
    const user = db.users.find((u: any) => u.id === user_id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    user.business = req.body.business;
    
    // Align root level configurations of user profile with updated business settings
    if (req.body.business) {
        user.business_name = req.body.business.businessName || user.business_name;
        user.business_type = req.body.business.businessType || user.business_type;
        user.address = req.body.business.address || user.address;
        user.phone = req.body.business.phone || user.phone;
        user.shop_slug = (user.business_name || "My Business").toString().toLowerCase().replace(/\s+/g, '-');
    }
    
    writeDB(db);
    res.json({ status: "success" });
});

app.get("/api/images/:shop_slug/logo.png", (req, res) => {
    const db = readDB();
    const user = db.users.find((u: any) => u.shop_slug === req.params.shop_slug);
    if (!user || !user.business || !user.business.businessLogo) {
        return res.status(404).send("Logo not found");
    }
    
    const base64Data = user.business.businessLogo.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': imgBuffer.length
    });
    res.end(imgBuffer);
});

// Configure Vite or Static Servers
async function start() {
  // Sync the user-provided logo to public assets for browser titles/favicons/link previews
  try {
    const logoSrc = path.join(process.cwd(), 'src', 'assets', 'images', 'yeedem_books_logo_1779553023368.png');
    const publicDir = path.join(process.cwd(), 'public');
    if (fs.existsSync(logoSrc)) {
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.copyFileSync(logoSrc, path.join(publicDir, 'favicon.png'));
      fs.copyFileSync(logoSrc, path.join(publicDir, 'pwa_icon_logo.png'));
      console.log('⚡ Successfully synced public favicons and pwa_icon_logo with user-supplied logo.');
    } else {
      console.warn('⚠️ User og/favicon logo asset not found at:', logoSrc);
    }
  } catch (err) {
    console.error('❌ Failed to copy custom logo assets to public:', err);
  }

  const getInjectedHtml = async (url: string, template: string, db: any, host: string) => {
    let ogTitle = "Yeedem Books - Fast Bookkeeping & Invoicing";
    let ogDesc = "Automated ledger tracking and real-time debt bookkeeping parameters for modern Nigerian merchant enterprises.";
    let ogImage = `https://${host}/pwa_icon_logo.png`;

    const terminalMatch = url.match(/^\/terminal\/([^\/]+)\/([^\/]+)/);
    if (terminalMatch) {
      const shopSlug = terminalMatch[1];
      const user = db.users.find((u: any) => u.shop_slug === shopSlug);
      
      const shopName = user?.business?.businessName || user?.business_name || "Business";
      ogTitle = `${shopName} - Sales Terminal Managed by Yeedem Books`;
      ogDesc = `Official secure cashier access link for ${shopName}. Enter assigned 4-digit PIN to process secure checkout logs.`;
      
      if (user?.business?.businessLogo) {
        ogImage = `https://${host}/api/images/${shopSlug}/logo.png`;
      }
    }

    return template
      .replace(/<meta property="og:title" content="[^"]+" \/>/, `<meta property="og:title" content="${ogTitle}" />`)
      .replace(/<meta property="og:description" content="[^"]+" \/>/, `<meta property="og:description" content="${ogDesc}" />`)
      .replace(/<meta property="og:image" content="[^"]+" \/>/, `<meta property="og:image" content="${ogImage}" />`);
  };

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom"
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        if (url.startsWith('/api') || url.startsWith('/@vite') || url.startsWith('/src')) {
           return next();
        }

        const templatePath = path.resolve('index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        
        const db = readDB();
        const host = req.get('host') || 'localhost:3000';
        template = await getInjectedHtml(url, template, db, host);
        
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });

  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", async (req, res) => {
      if (req.originalUrl.startsWith('/api')) return res.status(404).send('Not found');
      
      let template = fs.readFileSync(path.join(distPath, "index.html"), 'utf-8');
      const db = readDB();
      const host = req.get('host') || 'localhost:3000';
      template = await getInjectedHtml(req.originalUrl, template, db, host);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

start();
