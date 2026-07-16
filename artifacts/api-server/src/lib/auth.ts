import jwt from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "yunora-secret-key-change-in-production";

export function signToken(payload: { userId: number; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: number; email: string; role: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: number; email: string; role: string };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    (req as Request & { user: typeof payload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function simpleEncrypt(text: string): string {
  const key = JWT_SECRET.slice(0, 32).padEnd(32, "0");
  const encoded = Buffer.from(text).toString("base64");
  const keyBuf = Buffer.from(key);
  const textBuf = Buffer.from(encoded);
  const out = Buffer.alloc(textBuf.length);
  for (let i = 0; i < textBuf.length; i++) {
    out[i] = textBuf[i] ^ keyBuf[i % keyBuf.length];
  }
  return out.toString("hex");
}

export function simpleDecrypt(hex: string): string {
  const key = JWT_SECRET.slice(0, 32).padEnd(32, "0");
  const keyBuf = Buffer.from(key);
  const encBuf = Buffer.from(hex, "hex");
  const out = Buffer.alloc(encBuf.length);
  for (let i = 0; i < encBuf.length; i++) {
    out[i] = encBuf[i] ^ keyBuf[i % keyBuf.length];
  }
  return Buffer.from(out.toString(), "base64").toString("utf8");
}
