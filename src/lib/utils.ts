import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxAttempts = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) return false;

  entry.count++;
  return true;
}

export function getRateLimitRemaining(key: string, windowMs = 60_000): number {
  const entry = rateLimitStore.get(key);
  if (!entry || Date.now() > entry.resetAt) return 5;
  return Math.max(0, 5 - entry.count);
}
