const express = require('express');
const cors = require('cors');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const path = require('path');
const { NotFoundError } = require('./utils/errors');

// Import module routes
const authRoutes = require('./modules/auth/routes');
const productRoutes = require('./modules/products/routes');
const priceListRoutes = require('./modules/pricelists/routes');
const discountTierRoutes = require('./modules/discount-tiers/routes');
const approvalChainRoutes = require('./modules/approval-chains/routes');
const approvalRoutes = require('./modules/approvals/routes');

const app = express();

// Security & Parsing Middlewares
app.use(cors({
  origin: '*', // Allow requests from any frontend dev server port
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use(requestLogger);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve test client at root / and /test-client
app.use(express.static(path.join(__dirname, '../test-client')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../test-client/index.html'));
});
app.use('/test-client', express.static(path.join(__dirname, '../test-client')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/pricelists', priceListRoutes);
app.use('/api/v1/discount-tiers', discountTierRoutes);
app.use('/api/v1/approval-chains', approvalChainRoutes);
app.use('/api/v1/approvals', approvalRoutes);

// Catch-all 404 Handler
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
