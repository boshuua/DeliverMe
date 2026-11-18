import { Router } from 'express';
import { scanDelivery, completeDelivery } from '../controllers/driverController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { podUpload } from '../middleware/upload.js';

const router = Router();

// Enforce Driver Authentication on all driver routes
router.use(authenticate, requireRole('DRIVER'));

// Step 1: Scan QR code to resolve active delivery
router.get('/deliveries/scan/:code', scanDelivery);

// Steps 2, 3, 4: Complete delivery with photo, signature, and GPS coordinates
router.post(
  '/deliveries/:id/complete',
  podUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
  ]),
  completeDelivery
);

export default router;
