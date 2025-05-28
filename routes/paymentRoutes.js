import express from 'express';
import {
 
  registerPaymobWebhook,
  handlePaymobCallback
} from '../controllers/PaymentController.js';

const router = express.Router();

router.post('/paymob/webhook/register', registerPaymobWebhook);
router.post('/paymob/callback', handlePaymobCallback);

export default router; 