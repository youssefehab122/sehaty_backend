import Order from "../models/OrderModel.js";
import Cart from "../models/CartModel.js";
import PharmacyMedicine from "../models/PharmacyMedicineModel.js";
import Stock from "../models/StockModel.js";
import Delivery from "../models/DeliveryModel.js";
import PromoCode from "../models/PromoCodeModel.js";
import PaymobService from "../utils/paymob.service.js";
import {config} from '../config/config.js';

// Enhanced callback handler
export const handlePaymobCallback = async (req, res) => {
  try {
    console.log("Received Paymob callback:", req.body);
    
    const result = await PaymobService.processCallback(req.body);
    
    if (result.success) {
      const order = await Order.findById(result.orderId);
      
      // Update order status
      order.isPaid = true;
      order.paidAt = new Date();
      order.paymob = {
        ...order.paymob,
        transactionId: result.transactionId,
        paymentStatus: "paid"
      };
      order.status = "confirmed";
      
      await order.save();
      
      // Update stock
      for (const item of order.items) {
        await PharmacyMedicine.findOneAndUpdate(
          { medicineId: item.medicine, pharmacyId: item.pharmacyId },
          { $inc: { stock: -item.quantity } }
        );
      }
      
      // Create delivery record
      await Delivery.create({
        orderId: order._id,
        status: "pending"
      });
      
      // Clear cart
      await Cart.findOneAndUpdate(
        { userId: order.userId },
        { $set: { items: [] } }
      );
      
      console.log(`Order ${order._id} payment completed successfully`);

      // Redirect to the app using the stored return URL
      if (order.paymob?.returnUrl) {
        return res.redirect(order.paymob.returnUrl);
      }
    }
    
    // If no return URL or payment failed, redirect to a fallback URL
    res.redirect(`${config.app.deepLinkScheme}://payment-complete/${result.orderId}`);
  } catch (error) {
    console.error("Callback processing failed:", error);
    // Even on error, try to redirect back to app
    if (req.body?.merchant_order_id) {
      res.redirect(`${config.app.deepLinkScheme}://payment-complete/${req.body.merchant_order_id}`);
    } else {
      res.status(400).send("Error processing callback");
    }
  }
};