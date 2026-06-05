import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';

interface JwtPayload {
  sub?: string;
  id?: string;
  email?: string;
  role?: 'creator' | 'admin';
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization');

  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Bearer token required'));
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const id = decoded.sub ?? decoded.id;

    if (!id) {
      return next(new AppError(401, 'Token is missing subject'));
    }

    req.user = {
      id,
      email: decoded.email,
      role: decoded.role ?? 'creator',
    };

    return next();
  } catch {
    return next(new AppError(401, 'Invalid bearer token'));
  }
}
