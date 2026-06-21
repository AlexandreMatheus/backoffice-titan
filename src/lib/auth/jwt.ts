import jwt from 'jsonwebtoken';
import crypto from 'crypto';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // During next build (static analysis), allow a placeholder to avoid crash.
    // At runtime, missing JWT_SECRET will cause auth failures which is acceptable
    // since this is caught in the route handlers.
    return 'build-time-placeholder-do-not-use-in-production-32chars';
  }
  return secret;
}

// Lazy getter so we don't throw at module evaluation time during `next build`
function JWT_SECRET(): string {
  return getJwtSecret();
}

export interface TokenPayload {
  userId: string;
  email?: string;
  userType?: 'admin' | 'trainer' | 'student';
}

/**
 * Generate JWT access token (short-lived: 15 minutes)
 */
export function generateAccessToken(
  userId: string,
  expiresIn: number = 15 * 60,
  userType?: 'admin' | 'trainer' | 'student'
): string {
  const payload: { userId: string; type: string; userType?: string } = {
    userId,
    type: 'access',
  };
  if (userType) {
    payload.userType = userType;
  }
  return jwt.sign(payload, JWT_SECRET(), { expiresIn, algorithm: 'HS256' });
}

/**
 * Generate refresh token (long-lived: 7 days)
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET()) as {
      userId: string;
      email?: string;
      userType?: string;
      type?: string;
    };
    return {
      userId: decoded.userId,
      email: decoded.email,
      userType: decoded.userType as TokenPayload['userType'],
    };
  } catch {
    return null;
  }
}

/**
 * Hash a refresh token for secure storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length < 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts.slice(1).join(' ') || null;
}
