import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthenticatedRequest, AuthUserPayload, UserRole } from '../types/index.js';

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required.',
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token.',
    });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required role: ${roles.join(' or ')}.`,
      });
      return;
    }

    next();
  };
}
