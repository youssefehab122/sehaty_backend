import express from 'express';
import {
 
  handlePaymobCallback
} from '../controllers/PaymentController.js';

const router = express.Router();

router.get('/paymob/callback', handlePaymobCallback);
router.post('/paymob/callback', handlePaymobCallback);

export default router; 