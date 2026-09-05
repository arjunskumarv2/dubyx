import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Dubyx database...');

  // Super Admin
  const hashedPassword = await bcrypt.hash('DubYx@2024!', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@dubyx.sa' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@dubyx.sa',
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      phone: '+966501234567',
      isActive: true,
    },
  });
  console.log('✅ Super Admin created:', superAdmin.email);

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dubyx.sa' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@dubyx.sa',
      password: hashedPassword,
      role: Role.ADMIN,
      phone: '+966501234568',
      isActive: true,
    },
  });
  console.log('✅ Admin created:', admin.email);

  // Sample Salesman
  const salesman = await prisma.user.upsert({
    where: { email: 'sales1@dubyx.sa' },
    update: {},
    create: {
      name: 'Ahmed Al-Rashid',
      email: 'sales1@dubyx.sa',
      password: hashedPassword,
      role: Role.SALESMAN,
      phone: '+966555123456',
      area: 'Riyadh',
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
      taxRate: 15,
      vatCategory: 'STANDARD' as const,
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
      taxRate: 15,
      vatCategory: 'STANDARD' as const,
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
      taxRate: 15,
      vatCategory: 'STANDARD' as const,
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
      taxRate: 15,
      vatCategory: 'STANDARD' as const,
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
      taxRate: 15,
      vatCategory: 'STANDARD' as const,
      unit: 'PCS',
      currentStock: 800,
      minStock: 100,
    },
    {
      // Qualifying medicines are zero-rated under the KSA VAT regulations
      id: 'prod-006',
      name: 'Paracetamol 500mg (20 tablets)',
      sku: 'PHR-001',
      categoryId: 'cat-grocery',
      sellingPrice: 8.0,
      costPrice: 5.0,
      taxRate: 0,
      vatCategory: 'ZERO_RATED' as const,
      unit: 'BOX',
      currentStock: 120,
      minStock: 20,
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

  // Sample Customers — Saudi National Address format + VAT registration
  const customers = [
    {
      id: 'cust-001',
      shopName: 'Al Othaim Mini Market',
      arabicShopName: 'أسواق العثيم الصغيرة',
      ownerName: 'Mohammed Al-Harbi',
      phone: '+966551234567',
      address: 'King Fahd Road, Al Olaya, Riyadh',
      area: 'Riyadh',
      route: 'Riyadh North',
      creditLimit: 20000,
      // VAT-registered buyer -> receives a standard tax invoice
      vatNumber: '310175397500003',
      crNumber: '1010123456',
      buildingNumber: '7231',
      street: 'King Fahd Road',
      district: 'Al Olaya',
      city: 'Riyadh',
      postalCode: '12212',
      additionalNumber: '2345',
    },
    {
      id: 'cust-002',
      shopName: 'Jeddah Corner Store',
      arabicShopName: 'بقالة ركن جدة',
      ownerName: 'Khalid Al-Zahrani',
      phone: '+966552345678',
      address: 'Prince Sultan Street, Al Rawdah, Jeddah',
      area: 'Jeddah',
      route: 'Jeddah West',
      creditLimit: 15000,
      // Not VAT-registered -> receives a simplified tax invoice
      buildingNumber: '3412',
      street: 'Prince Sultan Street',
      district: 'Al Rawdah',
      city: 'Jeddah',
      postalCode: '23435',
      additionalNumber: '6721',
    },
    {
      id: 'cust-003',
      shopName: 'Dammam Fresh Supermarket',
      arabicShopName: 'سوبرماركت الدمام الطازج',
      ownerName: 'Ahmed Al-Qahtani',
      phone: '+966553456789',
      address: 'King Saud Street, Al Faisaliyah, Dammam',
      area: 'Dammam',
      route: 'Eastern Province',
      creditLimit: 25000,
      vatNumber: '311234567800003',
      crNumber: '2050123456',
      buildingNumber: '5188',
      street: 'King Saud Street',
      district: 'Al Faisaliyah',
      city: 'Dammam',
      postalCode: '32271',
      additionalNumber: '4410',
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
    { key: 'company_name', value: 'Dubyx Trading Est.' },
    { key: 'company_name_ar', value: 'مؤسسة دوبيكس التجارية' },
    { key: 'company_address', value: 'King Fahd Road, Al Olaya, Riyadh 12212, Saudi Arabia' },
    { key: 'company_phone', value: '+966 11 456 7890' },
    { key: 'company_email', value: 'info@dubyx.sa' },

    // ZATCA-mandated seller identifiers
    { key: 'company_vat_number', value: '310175397500003' },
    { key: 'company_cr_number', value: '1010987654' },

    // Saudi National Address (required on tax invoices)
    { key: 'company_building_number', value: '8452' },
    { key: 'company_street', value: 'King Fahd Road' },
    { key: 'company_district', value: 'Al Olaya' },
    { key: 'company_city', value: 'Riyadh' },
    { key: 'company_postal_code', value: '12212' },
    { key: 'company_additional_number', value: '3167' },

    { key: 'currency', value: 'SAR' },
    { key: 'currency_symbol', value: 'ر.س' },
    { key: 'default_tax_rate', value: '15' },
    { key: 'invoice_prefix', value: 'INV' },
    { key: 'credit_note_prefix', value: 'CN' },
    { key: 'debit_note_prefix', value: 'DN' },
    { key: 'order_prefix', value: 'ORD' },
    { key: 'country', value: 'SA' },
    { key: 'timezone', value: 'Asia/Riyadh' },
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
  console.log('   Email:    superadmin@dubyx.sa');
  console.log('   Password: DubYx@2024!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
