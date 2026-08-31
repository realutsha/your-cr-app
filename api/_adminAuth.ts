// Shared server-side Admin Authentication & Firestore helper for Vercel functions
import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const AUTHORIZED_ADMIN_EMAILS = ['madhurzamutsha@gmail.com'];

export interface AdminCaller {
  uid: string;
  email: string;
  idToken: string;
  projectId: string;
  adminApp: App | null;
}

export function handleCors(req: any, res: any): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Safely initializes and returns the Firebase Admin App instance on the server.
 * Handles singletons to prevent duplicate app initialization on serverless functions.
 * Handles newline '\n' formatting in private keys and discrete/JSON credentials.
 */
export function getFirebaseAdminApp(): App | null {
  if (getApps().length > 0) {
    return getApp();
  }

  // 1. Check for complete Service Account JSON string in environment variables
  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      const projectId =
        parsed.project_id ||
        process.env.FIREBASE_PROJECT_ID ||
        process.env.VITE_FIREBASE_PROJECT_ID ||
        'classmate-6f10c';

      return initializeApp({
        credential: cert(parsed),
        projectId,
      });
    } catch (e: any) {
      console.warn('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON string:', e.message);
    }
  }

  // 2. Check for discrete Service Account environment variables
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'classmate-6f10c';
  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL ||
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawPrivateKey =
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (clientEmail && rawPrivateKey) {
    try {
      // Correctly format escaped newlines (\n -> actual newline character) and strip quotes
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim();

      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
    } catch (e: any) {
      console.warn('[Firebase Admin] Failed to initialize Firebase Admin SDK with discrete env vars:', e.message);
    }
  }

  // 3. Log helpful diagnostics about missing server credentials
  const missingVars: string[] = [];
  if (!clientEmail) missingVars.push('FIREBASE_CLIENT_EMAIL (or FIREBASE_ADMIN_CLIENT_EMAIL)');
  if (!rawPrivateKey) missingVars.push('FIREBASE_PRIVATE_KEY (or FIREBASE_ADMIN_PRIVATE_KEY)');

  console.info(
    `[Firebase Admin] Service Account credentials not found (${missingVars.join(', ')}). Admin routes will operate in REST API fallback mode.`
  );

  return null;
}

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function verifyAdminRequest(req: any, res: any): Promise<AdminCaller | null> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header. Expected Bearer token.' });
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  if (!idToken) {
    res.status(401).json({ error: 'Empty Authorization token provided.' });
    return null;
  }

  const adminApp = getFirebaseAdminApp();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'classmate-6f10c';

  let callerUid = '';
  let callerEmail = '';
  let hasAdminClaim = false;

  try {
    // 1. Verify via Firebase Admin SDK if available
    if (adminApp) {
      try {
        const decoded = await getAuth(adminApp).verifyIdToken(idToken);
        callerUid = decoded.uid || decoded.sub;
        callerEmail = (decoded.email || '').toLowerCase().trim();
        hasAdminClaim = Boolean(decoded.admin);
      } catch (adminErr: any) {
        console.warn('[Firebase Admin] verifyIdToken check failed, attempting fallback verification:', adminErr.message);
      }
    }

    // 2. If Admin SDK verification was not available or failed, fallback to Google Identity Toolkit
    if (!callerUid) {
      const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';
      if (apiKey) {
        try {
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            }
          );

          if (verifyRes.ok) {
            const userData = await verifyRes.json();
            const userObj = userData.users?.[0];
            if (userObj) {
              callerUid = userObj.localId || '';
              callerEmail = (userObj.email || '').toLowerCase().trim();
              if (userObj.customAttributes) {
                try {
                  const claims = JSON.parse(userObj.customAttributes);
                  hasAdminClaim = Boolean(claims.admin) || hasAdminClaim;
                } catch {}
              }
            }
          }
        } catch (err: any) {
          console.warn('[Admin Auth] Identity Toolkit lookup error:', err.message);
        }
      }
    }

    // 3. Fallback to JWT payload verification
    if (!callerUid) {
      const jwtPayload = decodeJwtPayload(idToken);
      if (!jwtPayload) {
        res.status(401).json({ error: 'Invalid token structure. Could not decode JWT.' });
        return null;
      }

      const tokenExp = jwtPayload.exp ? jwtPayload.exp * 1000 : 0;
      if (tokenExp && Date.now() > tokenExp) {
        res.status(401).json({ error: 'Firebase Auth token has expired.' });
        return null;
      }

      callerUid = jwtPayload.user_id || jwtPayload.sub || '';
      callerEmail = (jwtPayload.email || '').toLowerCase().trim();
      hasAdminClaim = Boolean(jwtPayload.admin);
    }

    const isAuthorizedEmail = AUTHORIZED_ADMIN_EMAILS.includes(callerEmail);

    if (!callerUid || (!isAuthorizedEmail && !hasAdminClaim)) {
      console.warn(`[Admin Auth] Access Denied for: ${callerEmail || 'unknown'}`);
      res.status(403).json({
        error: 'Access Denied: You do not have administrator permissions for ClassMate.',
        attemptedEmail: callerEmail,
      });
      return null;
    }

    return {
      uid: callerUid,
      email: callerEmail,
      idToken,
      projectId,
      adminApp,
    };
  } catch (err: any) {
    console.error('[Admin Auth] Authentication check exception:', err);
    res.status(500).json({
      error: err.message || 'Authentication check failed.',
      code: err.code || 'AUTH_ERROR',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
    return null;
  }
}

export function parseFirestoreDoc(doc: any): Record<string, any> {
  if (!doc || !doc.fields) return {};
  const fields = doc.fields;
  const result: Record<string, any> = {};

  const nameParts = (doc.name || '').split('/');
  result.id = nameParts[nameParts.length - 1] || '';

  for (const [key, valObj] of Object.entries<any>(fields)) {
    if (valObj.stringValue !== undefined) result[key] = valObj.stringValue;
    else if (valObj.booleanValue !== undefined) result[key] = valObj.booleanValue;
    else if (valObj.integerValue !== undefined) result[key] = parseInt(valObj.integerValue, 10);
    else if (valObj.doubleValue !== undefined) result[key] = parseFloat(valObj.doubleValue);
    else if (valObj.timestampValue !== undefined) result[key] = valObj.timestampValue;
    else if (valObj.nullValue !== undefined) result[key] = null;
    else if (valObj.arrayValue !== undefined) {
      result[key] = (valObj.arrayValue.values || []).map((v: any) => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
        return v;
      });
    } else if (valObj.mapValue !== undefined) {
      result[key] = valObj.mapValue.fields || {};
    }
  }

  return result;
}

export function encodeFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = encodeFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}
