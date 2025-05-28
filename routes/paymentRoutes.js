import express from 'express';
import {
 
  handlePaymobCallback
} from '../controllers/PaymentController.js';

const router = express.Router();

router.post('/paymob/callback', handlePaymobCallback);

export default router; 