import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  listDrivers,
  listDeliveries,
  getDeliveryById,
  createDelivery,
  getPoDPhoto,
  getPoDSignature,
  listAuditLogs,
  listBlockedIps,
  blockIp,
  unblockIp,
} from '../controllers/adminController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Enforce Admin Authentication on all admin routes
router.use(authenticate, requireRole('ADMIN'));

// User Provisioning
router.get('/users', listUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);
router.get('/drivers', listDrivers);

// Deliveries
router.get('/deliveries', listDeliveries);
router.post('/deliveries', createDelivery);
router.get('/deliveries/:id', getDeliveryById);
router.get('/deliveries/:id/photo', getPoDPhoto);
router.get('/deliveries/:id/signature', getPoDSignature);

// Audit & Security
router.get('/audit-logs', listAuditLogs);
router.get('/blocked-ips', listBlockedIps);
router.post('/blocked-ips', blockIp);
router.delete('/blocked-ips/:id', unblockIp);

export default router;
