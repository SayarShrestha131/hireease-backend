import { Request } from 'express';
import { IUser } from '../models/User';

/**
 * Extended Express Request with authenticated user
 */
export interface AuthRequest extends Request {
  user?: IUser;
}
