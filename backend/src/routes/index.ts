import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, authorize } from '../middleware/auth';

// Controllers
import * as authCtrl from '../controllers/auth.controller';
import * as userCtrl from '../controllers/user.controller';
import * as customerCtrl from '../controllers/customer.controller';
import * as productCtrl from '../controllers/product.controller';
import * as orderCtrl from '../controllers/order.controller';
import * as invoiceCtrl from '../controllers/invoice.controller';
import * as collectionCtrl from '../controllers/collection.controller';
import * as gpsCtrl from '../controllers/gps.controller';
import * as reportCtrl from '../controllers/report.controller';
import * as settingsCtrl from '../controllers/settings.controller';
import * as routeCtrl from '../controllers/route.controller';

const router = Router();

// Multer setup
const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Auth
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticate, authCtrl.getMe);
router.post('/auth/change-password', authenticate, authCtrl.changePassword);

// Users (admin+)
const adminRoles = ['SUPER_ADMIN', 'ADMIN'];
router.get('/users', authenticate, authorize(...adminRoles, 'MANAGER'), userCtrl.getUsers);
router.get('/users/:id', authenticate, authorize(...adminRoles, 'MANAGER'), userCtrl.getUser);
router.post('/users', authenticate, authorize(...adminRoles), userCtrl.createUser);
router.put('/users/:id', authenticate, authorize(...adminRoles), userCtrl.updateUser);
router.delete('/users/:id', authenticate, authorize('SUPER_ADMIN'), userCtrl.deleteUser);
router.post('/users/:id/reset-password', authenticate, authorize(...adminRoles), userCtrl.resetPassword);
router.get('/users/:id/stats', authenticate, userCtrl.getSalesmanStats);

// Customers
router.get('/customers', authenticate, customerCtrl.getCustomers);
router.get('/customers/:id', authenticate, customerCtrl.getCustomer);
router.post('/customers', authenticate, customerCtrl.createCustomer);
router.put('/customers/:id', authenticate, customerCtrl.updateCustomer);
router.post('/customers/:id/photos', authenticate, upload.single('photo'), customerCtrl.uploadPhoto);
router.get('/customers/:id/balance', authenticate, customerCtrl.getCustomerBalance);

// Products & Categories
router.get('/products', authenticate, productCtrl.getProducts);
router.get('/products/low-stock', authenticate, productCtrl.getLowStockProducts);
router.get('/products/:id', authenticate, productCtrl.getProduct);
router.post('/products', authenticate, authorize(...adminRoles, 'MANAGER'), productCtrl.createProduct);
router.put('/products/:id', authenticate, authorize(...adminRoles, 'MANAGER'), productCtrl.updateProduct);
router.post('/products/:id/adjust-stock', authenticate, authorize(...adminRoles, 'MANAGER'), productCtrl.adjustStock);
router.get('/categories', authenticate, productCtrl.getCategories);
router.post('/categories', authenticate, authorize(...adminRoles, 'MANAGER'), productCtrl.createCategory);
router.delete('/categories/:id', authenticate, authorize(...adminRoles, 'MANAGER'), productCtrl.deleteCategory);

// Orders
router.get('/orders', authenticate, orderCtrl.getOrders);
router.get('/orders/:id', authenticate, orderCtrl.getOrder);
router.post('/orders', authenticate, orderCtrl.createOrder);
router.patch('/orders/:id/status', authenticate, authorize(...adminRoles, 'MANAGER'), orderCtrl.updateOrderStatus);
router.patch('/orders/:id/cancel', authenticate, orderCtrl.cancelOrder);

// Invoices
router.get('/invoices', authenticate, invoiceCtrl.getInvoices);
router.get('/invoices/:id', authenticate, invoiceCtrl.getInvoice);
router.post('/invoices/generate', authenticate, invoiceCtrl.generateInvoice);
router.get('/invoices/:id/pdf', authenticate, invoiceCtrl.generatePDF);
router.get('/orders/:orderId/preview', authenticate, invoiceCtrl.previewInvoice);
router.post('/invoices/:id/payment', authenticate, invoiceCtrl.recordPayment);

// Collections
router.get('/collections', authenticate, collectionCtrl.getCollections);
router.get('/collections/pending', authenticate, collectionCtrl.getPendingCollections);
router.get('/collections/today', authenticate, collectionCtrl.getTodayCollections);

// GPS Tracking
router.post('/gps/log', authenticate, gpsCtrl.logLocation);
router.get('/gps/locations', authenticate, authorize(...adminRoles, 'MANAGER'), gpsCtrl.getLatestLocations);
router.get('/gps/route/:userId', authenticate, authorize(...adminRoles, 'MANAGER'), gpsCtrl.getSalesmanRoute);
router.get('/gps/my-route', authenticate, gpsCtrl.getMyRoute);

// Reports
router.get('/reports/dashboard', authenticate, reportCtrl.getDashboardStats);
router.get('/reports/sales', authenticate, authorize(...adminRoles, 'MANAGER'), reportCtrl.getSalesReport);
router.get('/reports/top-products', authenticate, authorize(...adminRoles, 'MANAGER'), reportCtrl.getTopProducts);
router.get('/reports/salesman-performance', authenticate, authorize(...adminRoles, 'MANAGER'), reportCtrl.getSalesmanPerformance);
router.get('/reports/collections', authenticate, authorize(...adminRoles, 'MANAGER'), reportCtrl.getCollectionReport);
router.get('/reports/stock', authenticate, authorize(...adminRoles, 'MANAGER'), reportCtrl.getStockReport);
router.get('/reports/product-wise', authenticate, authorize(...adminRoles, 'MANAGER'), reportCtrl.getProductWiseReport);
router.get('/reports/balance', authenticate, authorize(...adminRoles, 'MANAGER'), reportCtrl.getBalanceReport);
router.get('/reports/aging', authenticate, authorize(...adminRoles, 'MANAGER'), reportCtrl.getAgingReport);

// Routes & Check-ins
router.get('/routes', authenticate, routeCtrl.getRoutes);
router.get('/routes/:id', authenticate, routeCtrl.getRoute);
router.post('/routes', authenticate, authorize(...adminRoles, 'MANAGER'), routeCtrl.createRoute);
router.put('/routes/:id', authenticate, authorize(...adminRoles, 'MANAGER'), routeCtrl.updateRoute);
router.delete('/routes/:id', authenticate, authorize(...adminRoles, 'MANAGER'), routeCtrl.deleteRoute);
router.post('/checkins', authenticate, routeCtrl.uploadSelfie.single('selfie'), routeCtrl.checkIn);
router.get('/checkins', authenticate, authorize(...adminRoles, 'MANAGER'), routeCtrl.getCheckIns);

// Settings
router.get('/settings', authenticate, settingsCtrl.getSettings);
router.put('/settings/:key', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), settingsCtrl.updateSetting);
router.put('/settings', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), settingsCtrl.updateSettings);

export default router;
