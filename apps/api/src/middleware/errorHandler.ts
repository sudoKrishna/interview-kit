import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const code = err?.code ?? "INTERNAL";
  const message = err?.message ?? "Unexpected error";
  if (code === "INTERNAL") console.error(err);
  res.status(statusFor(code)).json({ error: { code, message } });
}

function statusFor(code: string): number {
  switch (code) {
    case "VALIDATION_ERROR":
    case "INVALID_URL":
      return 400;
    case "UNAUTHENTICATED":
      return 401;
    case "KIT_NOT_FOUND":
      return 404;
    case "DUPLICATE_KIT":
      return 409;
    case "LLM_RATE_LIMIT":
      return 429;
    default:
      return 500;
  }
}
