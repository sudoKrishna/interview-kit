import type { Request, Response, NextFunction } from "express";
import "express-session";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; email: string };
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userEmail?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } });
  }
  req.user = { id: req.session.userId, email: req.session.userEmail ?? "" };
  next();
}
