import axios from 'axios';
import crypto from 'crypto'; // You forgot to import this
import Order from '../models/OrderModel.js';
import { config } from '../config/config.js';

class PaymobService {
  constructor() {
    this.apiKey = config.paymob.apiKey;
    this.iframeId = config.paymob.iframeId;
    this.integrationId = config.paymob.integrationId;
    this.hmacSecret = config.paymob.hmacSecret;
    this.baseUrl = "https://accept.paymobsolutions.com/api";
  }
 async registerWebhook() {
    try {
      const token = await this.authenticate();
      const response = await axios.post(`${this.baseUrl}/acceptance/webhooks`, {
        auth_token: token,
        url: `${config.server.baseUrl}/api/orders/paymob/callback`,
      });
      return response.data;
    } catch (error) {
      console.error("Webhook registration error:", error.response?.data || error.message);
      throw error;
    }
  }

  async processCallback(payload) {
    try {
      const { obj } = payload;
      
      // Validate HMAC first
      if (!this.validateHMAC(obj.hmac, obj)) {
        throw new Error("Invalid HMAC signature");
      }

      const order = await Order.findById(obj.merchant_order_id);
      if (!order) {
        throw new Error("Order not found");
      }

      return {
        success: obj.success === "true",
        orderId: obj.merchant_order_id,
        transactionId: obj.id,
        amount: obj.amount_cents / 100,
        payload: obj
      };
    } catch (error) {
      console.error("Callback processing error:", error);
      throw error;
    }
  }
  async getPaymentUrl(orderId, amountCents, billingData, returnUrl) {
    try {
      const { paymentKey, paymobOrderId } = await this.getPaymentKey(
        orderId,
        amountCents,
        billingData,
        returnUrl
      );

      return {
        paymentUrl: `https://accept.paymobsolutions.com/api/acceptance/iframes/${this.iframeId}?payment_token=${paymentKey}`,
        paymobOrderId,
        paymentKey,
      };
    } catch (error) {
      console.error("Payment URL generation error:", error);
      throw error;
    }
  }

  async authenticate() {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/tokens`, {
        api_key: this.apiKey,
      });
      return response.data.token;
    } catch (error) {
      console.error("Paymob authentication error:", error.response?.data || error.message);
      throw error;
    }
  }

  async createOrder(orderId, amountCents) {
    try {
      const token = await this.authenticate();
      const response = await axios.post(`${this.baseUrl}/ecommerce/orders`, {
        auth_token: token,
        delivery_needed: "false",
        amount_cents: amountCents.toString(),
        currency: "EGP",
        merchant_order_id: orderId.toString(),
        items: [],
      });
      return response.data;
    } catch (error) {
      console.error("Paymob order creation error:", error.response?.data || error.message);
      throw error;
    }
  }

  async getPaymentKey(orderId, amountCents, billingData, returnUrl) {
    try {
      const token = await this.authenticate();
      const { id: paymobOrderId } = await this.createOrder(orderId, amountCents);

      const response = await axios.post(`${this.baseUrl}/acceptance/payment_keys`, {
        auth_token: token,
        amount_cents: amountCents.toString(),
        expiration: 3600,
        order_id: paymobOrderId.toString(),
        billing_data: billingData,
        currency: "EGP",
        integration_id: this.integrationId,
        return_url: returnUrl
      });

      return {
        paymentKey: response.data.token,
        paymobOrderId,
      };
    } catch (error) {
      console.error("Paymob payment key error:", error.response?.data || error.message);
      throw error;
    }
  }

  async verifyPayment(transactionId) {
    try {
      const token = await this.authenticate();
      const response = await axios.get(
        `${this.baseUrl}/acceptance/transactions/${transactionId}/verify`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Paymob payment verification error:", error.response?.data || error.message);
      throw error;
    }
  }

  validateHMAC(hmac, obj) {
    const entries = Object.entries(obj)
      .filter(([k]) => !["hmac", "created_at", "is_3d_secure"].includes(k))
      .sort(([a], [b]) => a.localeCompare(b));

    const concatenated = entries.map(([k, v]) => `${k}=${v}`).join("");
    const calculatedHmac = crypto
      .createHmac("sha512", this.hmacSecret)
      .update(concatenated)
      .digest("hex");

    return hmac === calculatedHmac;
  }
}

const paymobService = new PaymobService();
export default paymobService;
