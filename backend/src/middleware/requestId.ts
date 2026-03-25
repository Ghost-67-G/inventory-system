import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestId = (req: Request, _res: Response, next: NextFunction): void => {
  req.requestId = uuidv4();
  next();
};
