import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid, differenceInYears } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date utilities
export function formatDate(date: Date | string | null | undefined, formatStr = "MMM dd, yyyy"): string {
  if (!date) return "N/A";
  const parsedDate = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(parsedDate)) return "Invalid date";
  return format(parsedDate, formatStr);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, "MMM dd, yyyy h:mm a");
}

export function formatTime(date: Date | string | null | undefined): string {
  return formatDate(date, "h:mm a");
}

export function calculateAge(dateOfBirth: Date | string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = typeof dateOfBirth === "string" ? parseISO(dateOfBirth) : dateOfBirth;
  if (!isValid(dob)) return null;
  return differenceInYears(new Date(), dob);
}

export function formatAge(dateOfBirth: Date | string | null | undefined): string {
  const age = calculateAge(dateOfBirth);
  if (age === null) return "N/A";
  return `${age} y`;
}

// String utilities
export function formatName(firstName: string, lastName: string, middleName?: string): string {
  if (middleName) {
    return `${lastName}, ${firstName} ${middleName.charAt(0)}.`;
  }
  return `${lastName}, ${firstName}`;
}

export function formatFullName(firstName: string, lastName: string, middleName?: string): string {
  if (middleName) {
    return `${firstName} ${middleName} ${lastName}`;
  }
  return `${firstName} ${lastName}`;
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

// Phone number formatting
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "N/A";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

// MRN (Medical Record Number) generation
export function generateMRN(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MRN${timestamp}${random}`;
}

// Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10;
}

export function isValidSSN(ssn: string): boolean {
  const cleaned = ssn.replace(/\D/g, "");
  return cleaned.length === 9;
}

// Array utilities
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    result[groupKey] = result[groupKey] || [];
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

// Debounce utility
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Local storage utilities
export function setLocalStorage(key: string, value: unknown): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
  }
}

export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window !== "undefined") {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error("Error reading from localStorage:", e);
      return defaultValue;
    }
  }
  return defaultValue;
}

export function removeLocalStorage(key: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }
}

// Color utilities for avatar backgrounds
export function getAvatarColor(name: string): string {
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
    "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// File utilities
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

// URL utilities
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `?${query}` : "";
}

// FHIR utilities
export function toFHIRDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM-dd");
}

export function toFHIRDateTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return d.toISOString();
}
