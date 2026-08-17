import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/security';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SARI 2 database...');

  // 1. Create Users
  const users = [
    { name: 'Store Owner', email: 'owner@sari2.local', password: 'password123', role: 'ADMIN' },
    { name: 'Store Staff', email: 'staff@sari2.local', password: 'password123', role: 'STAFF' },
  ];

  const seededUsers = [];
  for (const user of users) {
    let existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (!existing) {
      existing = await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: hashPassword(user.password),
          role: user.role,
        }
      });
      console.log(`Created user: ${user.email} (${user.role})`);
    }
    seededUsers.push(existing);
  }

  const owner = seededUsers[0];

  // 2. Create Suppliers
  const suppliersData = [
    { name: 'San Miguel Distributing', contactInfo: '0917-888-9999', address: 'Manila' },
    { name: 'Puregold Wholesale', contactInfo: '0918-111-2222', address: 'Quezon City' },
    { name: 'Super8 Warehouse', contactInfo: '0922-333-4444', address: 'Pasig City' },
    { name: 'Unilever Distributor', contactInfo: '0999-555-6666', address: 'Makati City' },
  ];

  const suppliers: Record<string, any> = {};
  for (const sup of suppliersData) {
    let existing = await prisma.supplier.findUnique({ where: { name: sup.name } });
    if (!existing) {
      existing = await prisma.supplier.create({ data: sup });
      console.log(`Created supplier: ${sup.name}`);
    }
    suppliers[sup.name] = existing;
  }

  // 3. Create Categories
  const categoriesList = [
    'Beverages',
    'Canned Goods',
    'Snacks',
    'Grains & Rice',
    'Toiletries',
    'Condiments',
    'Instant Noodles'
  ];

  const categories: Record<string, any> = {};
  for (const catName of categoriesList) {
    let existing = await prisma.category.findUnique({ where: { name: catName } });
    if (!existing) {
      existing = await prisma.category.create({ data: { name: catName } });
      console.log(`Created category: ${catName}`);
    }
    categories[catName] = existing;
  }

  // 4. Create Products
  const productsData = [
    {
      name: 'Coke 1.5L',
      categoryName: 'Beverages',
      stockQty: 15,
      price: 65,
      unit: 'bottle',
      supplierName: 'San Miguel Distributing',
      lowStockThreshold: 5,
      expirationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300'
    },
    {
      name: 'Lucky Me Instant Pancit Canton Extra Hot',
      categoryName: 'Instant Noodles',
      stockQty: 45,
      price: 15,
      unit: 'pack',
      supplierName: 'Puregold Wholesale',
      lowStockThreshold: 15,
      expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days
      imageUrl: 'https://images.unsplash.com/photo-1612966608967-3e2b747c7c46?w=300'
    },
    {
      name: 'Century Tuna Flakes in Oil 180g',
      categoryName: 'Canned Goods',
      stockQty: 2, // Low stock!
      price: 38,
      unit: 'can',
      supplierName: 'Super8 Warehouse',
      lowStockThreshold: 8,
      expirationDate: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
      imageUrl: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=300'
    },
    {
      name: 'Nestle Chuckie Chocolate Milk 250ml',
      categoryName: 'Beverages',
      stockQty: 10,
      price: 28,
      unit: 'pack',
      supplierName: 'Puregold Wholesale',
      lowStockThreshold: 5,
      expirationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Expired 2 days ago!
      imageUrl: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=300'
    },
    {
      name: 'Sunsilk Shampoo Smooth & Manageable',
      categoryName: 'Toiletries',
      stockQty: 120,
      price: 7,
      unit: 'sachet',
      supplierName: 'Unilever Distributor',
      lowStockThreshold: 20,
      imageUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300'
    },
    {
      name: 'Datu Puti Vinegar 200ml',
      categoryName: 'Condiments',
      stockQty: 8,
      price: 12,
      unit: 'bottle',
      supplierName: 'Puregold Wholesale',
      lowStockThreshold: 4,
      expirationDate: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000),
      imageUrl: 'https://images.unsplash.com/photo-1598971861713-54ad16a7e72e?w=300'
    }
  ];

  const products: Record<string, any> = {};
  for (const prod of productsData) {
    let existing = await prisma.product.findFirst({ where: { name: prod.name } });
    if (!existing) {
      existing = await prisma.product.create({
        data: {
          name: prod.name,
          categoryId: categories[prod.categoryName].id,
          stockQty: prod.stockQty,
          price: prod.price,
          unit: prod.unit,
          supplierId: suppliers[prod.supplierName]?.id || null,
          lowStockThreshold: prod.lowStockThreshold,
          expirationDate: prod.expirationDate,
          imageUrl: prod.imageUrl,
        }
      });
      console.log(`Created product: ${prod.name}`);
    }
    products[prod.name] = existing;
  }

  // 5. Create Customers (for Utang)
  const customersData = [
    { name: 'Mang Jose', phone: '09171234567', balance: 150 },
    { name: 'Aling Nena', phone: '09187654321', balance: 45 },
    { name: 'Kulas', phone: '09228889999', balance: 0 },
  ];

  const customers: Record<string, any> = {};
  for (const cust of customersData) {
    let existing = await prisma.customer.findUnique({ where: { name: cust.name } });
    if (!existing) {
      existing = await prisma.customer.create({
        data: {
          name: cust.name,
          phone: cust.phone,
          balance: cust.balance,
        }
      });
      console.log(`Created customer: ${cust.name}`);
    }
    customers[cust.name] = existing;
  }

  // Create Utang Records for balance tracking
  const nena = customers['Aling Nena'];
  const jose = customers['Mang Jose'];

  const existingUtang = await prisma.utangRecord.findFirst();
  if (!existingUtang) {
    await prisma.utangRecord.create({
      data: {
        customerId: jose.id,
        type: 'CREDIT',
        amount: 150,
        description: 'Purchased 2 cans of Century Tuna and Coke 1.5L',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      }
    });

    await prisma.utangRecord.create({
      data: {
        customerId: nena.id,
        type: 'CREDIT',
        amount: 100,
        description: 'Assorted grocery items',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    });

    await prisma.utangRecord.create({
      data: {
        customerId: nena.id,
        type: 'PAYMENT',
        amount: 55,
        description: 'Partial payment',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    });
    console.log('Seeded Utang Records');
  }

  // 6. Seed Sales History for Predictive Analytics (Generate sales over past 30 days)
  const existingSales = await prisma.sale.findFirst();
  if (!existingSales) {
    console.log('Generating 30 days of sales history for predictive analytics...');
    const now = new Date();
    
    // Let's create sales records
    for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
      const saleDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      
      // Determine number of sales on this day (between 1 and 4 sales)
      const numSales = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < numSales; i++) {
        // Build items list
        const items = [];
        let totalAmount = 0;
        
        // Randomly pick products to buy
        // Pancit Canton and Sunsilk are fast-moving (higher probability and quantity)
        if (Math.random() < 0.8) {
          const qty = Math.floor(Math.random() * 6) + 2; // 2-7 packs
          const prod = products['Lucky Me Instant Pancit Canton Extra Hot'];
          items.push({
            productId: prod.id,
            quantity: qty,
            priceAtSale: prod.price
          });
          totalAmount += qty * prod.price;
        }

        if (Math.random() < 0.75) {
          const qty = Math.floor(Math.random() * 12) + 4; // 4-15 sachets
          const prod = products['Sunsilk Shampoo Smooth & Manageable'];
          items.push({
            productId: prod.id,
            quantity: qty,
            priceAtSale: prod.price
          });
          totalAmount += qty * prod.price;
        }

        if (Math.random() < 0.5) {
          const qty = Math.floor(Math.random() * 2) + 1; // 1-2 bottles
          const prod = products['Coke 1.5L'];
          items.push({
            productId: prod.id,
            quantity: qty,
            priceAtSale: prod.price
          });
          totalAmount += qty * prod.price;
        }

        if (Math.random() < 0.2) {
          const qty = 1;
          const prod = products['Datu Puti Vinegar 200ml'];
          items.push({
            productId: prod.id,
            quantity: qty,
            priceAtSale: prod.price
          });
          totalAmount += qty * prod.price;
        }

        if (items.length > 0) {
          await prisma.sale.create({
            data: {
              saleDate,
              totalAmount,
              paymentMethod: 'CASH',
              receivedAmount: totalAmount + 20,
              changeAmount: 20,
              userId: owner.id,
              Items: {
                create: items
              }
            }
          });
        }
      }
    }
    console.log('Seeded historical sales data.');
  }

  // 7. Seed Initial Notifications
  const existingNotifications = await prisma.notification.findFirst();
  if (!existingNotifications) {
    await prisma.notification.create({
      data: {
        type: 'LOW_STOCK',
        title: 'Century Tuna Low Stock',
        message: 'Century Tuna Flakes in Oil 180g is down to 2 cans (threshold: 8). Consider restocking soon!',
      }
    });

    await prisma.notification.create({
      data: {
        type: 'EXPIRATION',
        title: 'Expired Product Alert',
        message: 'Nestle Chuckie Chocolate Milk 250ml has expired on ' + new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString() + '.',
      }
    });
    console.log('Seeded Notifications');
  }

  console.log('SARI 2 Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
