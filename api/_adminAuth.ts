// Shared server-side Admin Authentication & Firestore helper for Vercel functions

export const AUTHORIZED_ADMIN_EMAILS = ['madhurzamutsha@gmail.com'];

export interface AdminCaller {
  uid: string;
  email: string;
  idToken: string;
  projectId: string;
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

export async function verifyAdminRequest(req: any, res: any): Promise<AdminCaller | null> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  if (!idToken) {
    res.status(401).json({ error: 'Empty token.' });
    return null;
  }

  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'classmate-6f10c';
  const apiKey =
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    '';

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!verifyRes.ok) {
      res.status(401).json({ error: 'Invalid or expired Firebase Auth token.' });
      return null;
    }

    const userData = await verifyRes.json();
    const callerUser = userData.users?.[0];
    const callerUid = callerUser?.localId;
    const callerEmail = (callerUser?.email || '').toLowerCase().trim();

    const isAuthorizedEmail = AUTHORIZED_ADMIN_EMAILS.includes(callerEmail);
    let hasAdminClaim = false;
    if (callerUser?.customAttributes) {
      try {
        const claims = JSON.parse(callerUser.customAttributes);
        hasAdminClaim = Boolean(claims.admin);
      } catch {}
    }

    if (!callerUid || (!isAuthorizedEmail && !hasAdminClaim)) {
      res.status(403).json({
        error: 'Access Denied: You do not have administrator permissions for ClassMate.',
      });
      return null;
    }

    return {
      uid: callerUid,
      email: callerEmail,
      idToken,
      projectId,
    };
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Authentication check failed.' });
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
