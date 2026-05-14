import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Dubyx database...');

  // Super Admin
  const hashedPassword = await bcrypt.hash('DubYx@2024!', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@dubyx.qa' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@dubyx.qa',
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      phone: '+97412345678',
      isActive: true,
    },
  });
  console.log('✅ Super Admin created:', superAdmin.email);

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dubyx.qa' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@dubyx.qa',
      password: hashedPassword,
      role: Role.ADMIN,
      phone: '+97412345679',
      isActive: true,
    },
  });
  console.log('✅ Admin created:', admin.email);

  // Sample Salesman
  const salesman = await prisma.user.upsert({
    where: { email: 'sales1@dubyx.qa' },
    update: {},
    create: {
      name: 'Ahmed Al-Rashid',
      email: 'sales1@dubyx.qa',
      password: hashedPassword,
      role: Role.SALESMAN,
      phone: '+97450123456',
      area: 'Al Wakra',
      isActive: true,
    },
  });
  console.log('✅ Salesman created:', salesman.email);

  // Categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: 'cat-beverages' },
      update: {},
      create: { id: 'cat-beverages', name: 'Beverages', description: 'Drinks and juices' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-dairy' },
      update: {},
      create: { id: 'cat-dairy', name: 'Dairy Products', description: 'Milk, cheese, yogurt' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-snacks' },
      update: {},
      create: { id: 'cat-snacks', name: 'Snacks', description: 'Chips, biscuits, confectionery' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-grocery' },
      update: {},
      create: { id: 'cat-grocery', name: 'Grocery', description: 'Rice, flour, oils' },
    }),
  ]);
  console.log('✅ Categories created');

  // Sample Products
  const products = [
    {
      id: 'prod-001',
      name: 'Vimto Juice 250ml',
      sku: 'BEV-001',
      categoryId: 'cat-beverages',
      sellingPrice: 2.5,
      costPrice: 1.8,
      taxRate: 5,
      unit: 'PCS',
      currentStock: 500,
      minStock: 50,
    },
    {
      id: 'prod-002',
      name: 'Baladna Fresh Milk 1L',
      sku: 'DAI-001',
      categoryId: 'cat-dairy',
      sellingPrice: 5.0,
      costPrice: 3.5,
      taxRate: 0,
      unit: 'PCS',
      currentStock: 200,
      minStock: 30,
    },
    {
      id: 'prod-003',
      name: 'Lays Classic 40g',
      sku: 'SNK-001',
      categoryId: 'cat-snacks',
      sellingPrice: 1.5,
      costPrice: 0.9,
      taxRate: 5,
      unit: 'PCS',
      currentStock: 1000,
      minStock: 100,
    },
    {
      id: 'prod-004',
      name: 'Basmati Rice 5kg',
      sku: 'GRO-001',
      categoryId: 'cat-grocery',
      sellingPrice: 22.0,
      costPrice: 16.0,
      taxRate: 0,
      unit: 'BAG',
      currentStock: 150,
      minStock: 20,
    },
    {
      id: 'prod-005',
      name: 'Pepsi 330ml Can',
      sku: 'BEV-002',
      categoryId: 'cat-beverages',
      sellingPrice: 2.0,
      costPrice: 1.3,
      taxRate: 5,
      unit: 'PCS',
      currentStock: 800,
      minStock: 100,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: product,
    });
  }
  console.log('✅ Products created');

  // Sample Customers
  const customers = [
    {
      id: 'cust-001',
      shopName: 'Al Meera Mini Mart',
      ownerName: 'Mohammed Hassan',
      phone: '+97430123456',
      address: 'Al Wakra, Street 12',
      area: 'Al Wakra',
      route: 'Route A',
      creditLimit: 5000,
    },
    {
      id: 'cust-002',
      shopName: 'Doha Grocery Store',
      ownerName: 'Khalid Al-Thani',
      phone: '+97440234567',
      address: 'Old Doha, Souq Area',
      area: 'Doha',
      route: 'Route B',
      creditLimit: 10000,
    },
    {
      id: 'cust-003',
      shopName: 'Pearl Supermarket',
      ownerName: 'Ahmed Ibrahim',
      phone: '+97455345678',
      address: 'The Pearl Qatar, Building 5',
      area: 'The Pearl',
      route: 'Route C',
      creditLimit: 15000,
    },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: {},
      create: customer,
    });
  }
  console.log('✅ Customers created');

  // App Settings
  const settings = [
    { key: 'company_name', value: 'Dubyx Trading LLC' },
    { key: 'company_address', value: 'Al Sadd Street, Doha, Qatar' },
    { key: 'company_phone', value: '+974 4412 3456' },
    { key: 'company_email', value: 'info@dubyx.qa' },
    { key: 'company_trn', value: 'QA-12345678' },
    { key: 'currency', value: 'QAR' },
    { key: 'currency_symbol', value: 'ر.ق' },
    { key: 'default_tax_rate', value: '5' },
    { key: 'invoice_prefix', value: 'INV' },
    { key: 'order_prefix', value: 'ORD' },
  ];

  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    });
  }
  console.log('✅ App settings configured');

  console.log('\n🎉 Seeding complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 Super Admin Login:');
  console.log('   Email:    superadmin@dubyx.qa');
  console.log('   Password: DubYx@2024!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
