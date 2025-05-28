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
    }
    
    res.status(200).send("Callback processed");
  } catch (error) {
    console.error("Callback processing failed:", error);
    res.status(400).send("Error processing callback");
  }
};