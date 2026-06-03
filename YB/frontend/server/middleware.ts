
import { Request, Response, NextFunction } from 'express';
import { readDB, writeDB } from './db';

export const getApproxRegion = (req: Request): string => {
    const headerRegion = req.headers['x-approx-region'] as string;
    if (headerRegion) return headerRegion;
    
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress || '';
        
    if (client_ip.includes('127.0.0.1') || client_ip.includes('localhost') || client_ip.startsWith('::')) {
        return 'NG-Lagos';
    }
    if (client_ip.startsWith('10.0.') || client_ip.startsWith('172.')) {
        return 'NG-Abuja';
    }
    if (client_ip.startsWith('8.8.8.')) {
        return 'US-California';
    }
    return 'NG-Lagos';
};

export const anomalyDetectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const session_id = req.headers['x-session-id'] as string;
    const client_ip = (Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']) || req.socket.remoteAddress;
    const device_fingerprint = req.headers['x-device-fingerprint'] as string;
    const approxRegion = getApproxRegion(req);

    if (session_id) {
        const db = readDB();
        const session = db.merchantSessions.find((s: any) => s.session_id === session_id);
      
        if (session) {
            let isMismatched = false;
            if (device_fingerprint && device_fingerprint !== 'unknown_fp' && device_fingerprint !== 'unknown') {
                if (session.device_fingerprint === 'fp_default_owner' || !session.device_fingerprint) {
                    session.device_fingerprint = device_fingerprint;
                    writeDB(db);
                } else if (device_fingerprint !== 'fp_default_owner' && session.device_fingerprint !== device_fingerprint) {
                    isMismatched = true;
                }
            }

            const isGeographicMismatched = session.last_active_region !== 'Unknown' && 
                                           approxRegion !== 'Unknown' && 
                                           session.last_active_region !== approxRegion;

            // Only lock if device fingerprint actually mismatches
            if (isMismatched && device_fingerprint && device_fingerprint !== 'unknown' && device_fingerprint !== 'unknown_fp') {
                session.is_suspicious_locked = true;
                writeDB(db);
                return res.status(401).json({ error: "Suspicious activity detected. Session locked. Re-authenticate via OTP.", is_suspicious_locked: true });
            }
        }
    }
    next();
};

export const requireSession = (req: Request, res: Response, next: NextFunction) => {
    try {
        const session_id = req.headers['x-session-id'] as string;
        if (!session_id) return res.status(401).json({ error: "Session required" });
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
            if (session.device_fingerprint === 'fp_default_owner' || !session.device_fingerprint) {
                session.device_fingerprint = device_fingerprint;
                writeDB(db);
            } else if (device_fingerprint !== 'fp_default_owner' && session.device_fingerprint !== device_fingerprint) {
                isMismatched = true;
            }
        }

        const isGeographicMismatched = session.last_active_region !== 'Unknown' && 
                                       approxRegion !== 'Unknown' && 
                                       session.last_active_region !== approxRegion;
        
        // Only lock if device fingerprint actually mismatches
        if (isMismatched && device_fingerprint && device_fingerprint !== 'unknown' && device_fingerprint !== 'unknown_fp') {
            session.is_suspicious_locked = true;
            writeDB(db);
            return res.status(401).json({ error: "Suspicious activity detected. Session locked. Re-authenticate via OTP.", is_suspicious_locked: true });
        }
        
        (req as any).user_id = session.user_id;
        next();
    } catch (err: any) {
        console.error("Authentication middleware error:", err);
        return res.status(555).json({ error: "Authentication system error: " + (err.message || err) });
    }
};

export const checkSubscription = (req: Request, res: Response, next: NextFunction) => {
    const user_id = (req as any).user_id;
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });

    const db = readDB();
    const user = db.users.find((u: any) => u.id === user_id);
    if (!user || user.subscriptionStatus !== 'active') {
        return res.status(403).json({ error: "Subscription required for this feature" });
    }

    next();
};

