import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import connectDB from './config/DB.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import pharmacyRoutes from './routes/pharmacyRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSMongoose from '@adminjs/mongoose';
import session from 'express-session';
import adminOptions from './config/admin.js';
import bcrypt from 'bcrypt';
import User from './models/UserModel.js';
import path from 'path';
import MongoStore from 'connect-mongo';
import uploadRoutes from './routes/uploadRoutes.js';
import './scheduler/reminderScheduler.js';
dotenv.config();

// Connect to MongoDB
connectDB();

// Register AdminJS adapter
AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});

// Create AdminJS instance
const admin = new AdminJS(adminOptions);

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(compression());
app.use(morgan('dev'));

// Session middleware (MUST be before AdminJS)
app.use(session({
  secret: process.env.ADMIN_SESSION_SECRET || 'some-secret-password-used-to-secure-session',
  resave: true,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
  }),
  cookie: {
    httpOnly: false,
    secure: false,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'lax'
  },
  name: 'adminjs',
}));

// Debug middleware
app.use((req, res, next) => {
  console.log('\n=== Request Debug ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Session:', req.session);
  console.log('Session ID:', req.sessionID);
  console.log('===================\n');
  next();
});


// Create uploads directory if it doesn't exist
import fs from 'fs';
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/pharmacies', pharmacyRoutes);
app.use('/api/prescriptions',prescriptionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reminders',reminderRoutes);
app.use('/api/cart',cartRoutes);
app.use('/api/wishlist',wishlistRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/payment',paymentRoutes);
app.use('/api/addresses',addressRoutes);
app.use('/api/upload', uploadRoutes);

// AdminJS routes
const adminRouter = AdminJSExpress.buildRouter(admin);

// Mount admin routes
app.use('/admin', adminRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message,
    error: process.env.NODE_ENV === 'development' ? err : undefined
  });
});

const PORT = process.env.PORT || 5050;

app.listen(PORT,"0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`AdminJS started on http://0.0.0.0:${PORT}/admin`);
});
