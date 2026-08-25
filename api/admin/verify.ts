import { handleCors, verifyAdminRequest } from '../_adminAuth';

export const config = {
  maxDuration: 15,
};

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  const admin = await verifyAdminRequest(req, res);
  if (!admin) return;

  return res.status(200).json({
    success: true,
    authorized: true,
    email: admin.email,
    uid: admin.uid,
    timestamp: new Date().toISOString(),
  });
}
