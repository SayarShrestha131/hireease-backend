import jwt from 'jsonwebtoken';

/**
 * Generates a JWT token for a user
 * @param userId - The user's ID to include in the token payload
 * @returns Signed JWT token string
 */
export const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  // @ts-ignore - expiresIn type issue with jsonwebtoken
  const token = jwt.sign(
    { userId },
    secret,
    { expiresIn }
  );

  return token;
};
