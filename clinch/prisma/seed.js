const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Internal Users
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('Password123!', saltRounds);

  const internalUsers = [
    {
      name: 'Alice Sales',
      email: 'rep@dealflow360.com',
      passwordHash,
      role: 'REP',
    },
    {
      name: 'Bob Manager',
      email: 'manager@dealflow360.com',
      passwordHash,
      role: 'MANAGER',
    },
    {
      name: 'Carol Finance',
      email: 'finance@dealflow360.com',
      passwordHash,
      role: 'FINANCE',
    },
    {
      name: 'Dave Admin',
      email: 'admin@dealflow360.com',
      passwordHash,
      role: 'ADMIN',
    },
  ];

  for (const user of internalUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash: user.passwordHash },
      create: user,
    });
    console.log(`  👤 User ready: ${user.name} (${user.email}) [${user.role}]`);
  }

  // 2. Seed B2B Customers
  const customers = [
    {
      name: 'John Acme',
      email: 'customer@acmecorp.com',
      companyName: 'Acme Corp',
      tier: 'GOLD',
    },
    {
      name: 'Sarah Beta',
      email: 'procurement@betaindustries.com',
      companyName: 'Beta Industries',
      tier: 'SILVER',
    },
    {
      name: 'David Delta',
      email: 'contact@deltatech.io',
      companyName: 'Delta Tech',
      tier: 'BRONZE',
    },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { email: customer.email },
      update: { name: customer.name, companyName: customer.companyName, tier: customer.tier },
      create: customer,
    });
    console.log(`  🏢 Customer ready: ${customer.name} - ${customer.companyName} (${customer.tier})`);
  }

  // 3. Seed IT & Networking Products with Variants and Tier Pricing
  console.log('\n📦 Seeding Products, Variants, and Tier Price Lists...');

  const productsData = [
    {
      name: 'Enterprise Edge Router X200',
      category: 'Hardware',
      basePrice: 1200.00,
      unit: 'piece',
      taxPercent: 18.0,
      description: 'High-performance multi-WAN branch gateway router with IPsec hardware acceleration and zero-touch provisioning.',
      variants: [
        { attributeName: 'Port Configuration', attributeValue: '24-Port Gigabit', extraPrice: 150.00 },
        { attributeName: 'Port Configuration', attributeValue: '48-Port Gigabit', extraPrice: 320.00 },
      ],
      tierPricing: {
        BRONZE: 1200.00,
        SILVER: 1080.00,
        GOLD: 960.00,
      },
    },
    {
      name: 'Core Layer-3 Switch Catalyst S500',
      category: 'Hardware',
      basePrice: 2500.00,
      unit: 'piece',
      taxPercent: 18.0,
      description: 'Enterprise 10G uplink stackable layer-3 switch with redundant modular power supply and dynamic QoS.',
      variants: [
        { attributeName: 'Power Delivery', attributeValue: 'PoE+ 370W Budget', extraPrice: 400.00 },
        { attributeName: 'Power Delivery', attributeValue: 'Full PoE+ 740W Budget', extraPrice: 750.00 },
      ],
      tierPricing: {
        BRONZE: 2500.00,
        SILVER: 2250.00,
        GOLD: 2000.00,
      },
    },
    {
      name: 'High-Density Wi-Fi 6 Access Point',
      category: 'Hardware',
      basePrice: 450.00,
      unit: 'piece',
      taxPercent: 18.0,
      description: 'Tri-band 4x4 MU-MIMO indoor wireless access point with integrated Bluetooth Low Energy (BLE) beaconing.',
      variants: [
        { attributeName: 'Mounting Kit', attributeValue: 'Ceiling Rail Mount', extraPrice: 25.00 },
        { attributeName: 'Mounting Kit', attributeValue: 'Wall Junction Mount', extraPrice: 35.00 },
      ],
      tierPricing: {
        BRONZE: 450.00,
        SILVER: 410.00,
        GOLD: 360.00,
      },
    },
    {
      name: 'Server Rack & Enclosure 42U',
      category: 'Hardware',
      basePrice: 850.00,
      unit: 'piece',
      taxPercent: 18.0,
      description: 'Heavy-duty 42U data center equipment rack with perforated mesh doors and smart cable management conduits.',
      variants: [
        { attributeName: 'Depth', attributeValue: '1000mm Standard', extraPrice: 0.00 },
        { attributeName: 'Depth', attributeValue: '1200mm Extended Depth', extraPrice: 120.00 },
      ],
      tierPricing: {
        BRONZE: 850.00,
        SILVER: 780.00,
        GOLD: 700.00,
      },
    },
    {
      name: 'On-Site Network Deployment & Config',
      category: 'Services',
      basePrice: 150.00,
      unit: 'hour',
      taxPercent: 18.0,
      description: 'Certified CCIE engineering deployment for on-site physical racking, patch cabling, VLAN trunking, and OSPF/BGP routing.',
      variants: [
        { attributeName: 'Schedule', attributeValue: 'Standard Business Hours', extraPrice: 0.00 },
        { attributeName: 'Schedule', attributeValue: 'Weekend / After-Hours SLA', extraPrice: 50.00 },
      ],
      tierPricing: {
        BRONZE: 150.00,
        SILVER: 135.00,
        GOLD: 120.00,
      },
    },
    {
      name: 'Infrastructure Security & Vulnerability Audit',
      category: 'Services',
      basePrice: 3500.00,
      unit: 'audit',
      taxPercent: 18.0,
      description: 'Comprehensive external penetration test, firewall rulebase audit, network posture review, and executive compliance report.',
      variants: [],
      tierPricing: {
        BRONZE: 3500.00,
        SILVER: 3150.00,
        GOLD: 2800.00,
      },
    },
    {
      name: 'Emergency On-Call Remediation SLA',
      category: 'Services',
      basePrice: 250.00,
      unit: 'hour',
      taxPercent: 18.0,
      description: 'Priority 1 production outage incident response with guaranteed 1-hour remote engineer dispatch and root-cause postmortem.',
      variants: [],
      tierPricing: {
        BRONZE: 250.00,
        SILVER: 225.00,
        GOLD: 195.00,
      },
    },
    {
      name: 'Managed SD-WAN Cloud Core',
      category: 'Subscriptions',
      basePrice: 600.00,
      unit: 'month',
      taxPercent: 18.0,
      description: 'Cloud controller SaaS orchestration, sub-second application traffic steering, jitter correction, and bandwidth aggregation.',
      variants: [
        { attributeName: 'Redundancy', attributeValue: 'Single Uplink Failover', extraPrice: 0.00 },
        { attributeName: 'Redundancy', attributeValue: 'Active-Active Dual Uplink', extraPrice: 120.00 },
      ],
      tierPricing: {
        BRONZE: 600.00,
        SILVER: 540.00,
        GOLD: 480.00,
      },
    },
    {
      name: '24/7 Threat Monitoring Pro',
      category: 'Subscriptions',
      basePrice: 400.00,
      unit: 'month',
      taxPercent: 18.0,
      description: 'Continuous managed SOC telemetry monitoring, SIEM log correlation, automated endpoint threat isolation, and threat hunting.',
      variants: [],
      tierPricing: {
        BRONZE: 400.00,
        SILVER: 360.00,
        GOLD: 310.00,
      },
    },
    {
      name: 'Next-Gen Cloud Firewall Virtual Appliance',
      category: 'Subscriptions',
      basePrice: 250.00,
      unit: 'month',
      taxPercent: 18.0,
      description: 'Virtual firewall VM subscription license with Deep Packet Inspection, TLS/SSL decryption, and automated signature feeds.',
      variants: [
        { attributeName: 'Throughput', attributeValue: '1 Gbps Standard', extraPrice: 0.00 },
        { attributeName: 'Throughput', attributeValue: '5 Gbps Enterprise', extraPrice: 180.00 },
      ],
      tierPricing: {
        BRONZE: 250.00,
        SILVER: 220.00,
        GOLD: 190.00,
      },
    },
  ];

  for (const item of productsData) {
    // Find or create product
    let product = await prisma.product.findFirst({
      where: { name: item.name },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: item.name,
          category: item.category,
          basePrice: item.basePrice,
          unit: item.unit,
          taxPercent: item.taxPercent,
          description: item.description,
        },
      });
    } else {
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          category: item.category,
          basePrice: item.basePrice,
          unit: item.unit,
          taxPercent: item.taxPercent,
          description: item.description,
        },
      });
    }

    // Seed Variants
    for (const v of item.variants) {
      const existingVariant = await prisma.productVariant.findFirst({
        where: {
          productId: product.id,
          attributeName: v.attributeName,
          attributeValue: v.attributeValue,
        },
      });

      if (!existingVariant) {
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            attributeName: v.attributeName,
            attributeValue: v.attributeValue,
            extraPrice: v.extraPrice,
          },
        });
      }
    }

    // Seed Tier Pricing (BRONZE, SILVER, GOLD)
    for (const [tier, price] of Object.entries(item.tierPricing)) {
      await prisma.priceList.upsert({
        where: {
          productId_tier: {
            productId: product.id,
            tier,
          },
        },
        update: {
          price,
          currency: 'USD',
        },
        create: {
          productId: product.id,
          tier,
          price,
          currency: 'USD',
        },
      });
    }

    console.log(`  🛒 Product ready: [${item.category}] ${item.name} (Base: $${item.basePrice}) with Bronze/Silver/Gold pricing`);
  }

  console.log('\n✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
