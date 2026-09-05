const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');
const config = require('../../config/env');
const {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} = require('../../utils/errors');

class AuthService {
  /**
   * Remove passwordHash and sensitive fields from user object
   */
  sanitizeUser(user) {
    if (!user) return null;
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Generate JWT for internal staff
   */
  generateInternalToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        type: 'internal',
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  /**
   * Generate JWT for customer portal user
   */
  generateCustomerToken(customer) {
    return jwt.sign(
      {
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
        companyName: customer.companyName,
        tier: customer.tier,
        type: 'customer',
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  // ---------------------------------------------------------------------------
  // Internal Staff Auth
  // ---------------------------------------------------------------------------

  /**
   * Register a new internal staff member
   */
  async signupInternal({ name, email, password, role }) {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictError('A user with this email address already exists.', 'USER_ALREADY_EXISTS');
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role,
      },
    });

    const token = this.generateInternalToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Authenticate internal staff member
   */
  async loginInternal({ email, password }) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password credentials.', 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password credentials.', 'INVALID_CREDENTIALS');
    }

    const token = this.generateInternalToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Get current internal user profile
   */
  async getInternalProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('Internal user profile not found.', 'USER_NOT_FOUND');
    }

    return this.sanitizeUser(user);
  }

  // ---------------------------------------------------------------------------
  // Customer Portal Auth (Self-Registration & Magic Link)
  // ---------------------------------------------------------------------------

  /**
   * Self-register a new customer
   */
  async registerCustomer({ name, email, companyName, tier }) {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictError('Customer with this email already exists.', 'CUSTOMER_ALREADY_EXISTS');
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        companyName: companyName.trim(),
        tier,
      },
    });

    return customer;
  }

  /**
   * Request magic link for customer portal login
   */
  async requestMagicLink(email) {
    const normalizedEmail = email.toLowerCase().trim();

    let customer = await prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });

    if (!customer) {
      throw new NotFoundError(
        `Customer with email '${normalizedEmail}' is not registered. Please contact your sales representative.`,
        'CUSTOMER_NOT_FOUND'
      );
    }

    // Invalidate previous unused tokens for this customer
    await prisma.magicLinkToken.updateMany({
      where: { customerId: customer.id, used: false },
      data: { used: true },
    });

    // Generate cryptographically secure random 32-byte hex token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.magicLinkToken.create({
      data: {
        customerId: customer.id,
        token,
        expiresAt,
        used: false,
      },
    });

    const magicLinkUrl = `http://localhost:${config.port}/portal/login?token=${token}`;

    // Simulate sending email via clear console log for demo
    console.log(`\n======================================================================`);
    console.log(`📧 [MAGIC LINK SIMULATION] Email sent to: ${customer.email}`);
    console.log(`🏢 Company : ${customer.companyName} (Tier: ${customer.tier})`);
    console.log(`🔗 Magic Link URL : ${magicLinkUrl}`);
    console.log(`🔑 Verification Token: ${token}`);
    console.log(`⏰ Expiration: 15 minutes (at ${expiresAt.toISOString()})`);
    console.log(`======================================================================\n`);

    return {
      message: 'Magic link generated successfully and sent to customer email.',
      email: customer.email,
      token, // Also returned in response for convenience in automated tests & hackathon demo
      expiresAt,
    };
  }

  /**
   * Verify customer magic link token and issue customer JWT
   */
  async verifyMagicLink(token) {
    const tokenRecord = await prisma.magicLinkToken.findUnique({
      where: { token },
      include: { customer: true },
    });

    if (!tokenRecord) {
      throw new BadRequestError('Invalid or unrecognized magic link token.', 'INVALID_TOKEN');
    }

    if (tokenRecord.used) {
      throw new BadRequestError('This magic link has already been used.', 'TOKEN_ALREADY_USED');
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      throw new BadRequestError('This magic link has expired. Please request a new one.', 'TOKEN_EXPIRED');
    }

    // Mark token as used
    await prisma.magicLinkToken.update({
      where: { id: tokenRecord.id },
      data: { used: true },
    });

    const customer = tokenRecord.customer;
    const jwtToken = this.generateCustomerToken(customer);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        companyName: customer.companyName,
        tier: customer.tier,
      },
      token: jwtToken,
    };
  }

  /**
   * Get current customer profile
   */
  async getCustomerProfile(customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundError('Customer profile not found.', 'CUSTOMER_NOT_FOUND');
    }

    return customer;
  }
}

module.exports = new AuthService();
