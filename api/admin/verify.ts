import { handleCors, verifyAdminRequest } from '../_adminAuth';

export const config = {
  maxDuration: 15,
};

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;

    return res.status(200).json({
      success: true,
      authorized: true,
      email: admin.email,
      uid: admin.uid,
      hasAdminSdk: Boolean(admin.adminApp),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Admin API: verify] Handler exception:', err);
    return res.status(500).json({
      error: err.message || 'Failed to verify admin credentials.',
      code: err.code || 'VERIFY_ERROR',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}
