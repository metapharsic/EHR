// Main types export file
export * from "./fhir";

// Application-specific types

export type UserRole =
  | "ADMIN"
  | "PHYSICIAN"
  | "NURSE"
  | "MEDICAL_ASSISTANT"
  | "FRONT_DESK"
  | "PATIENT";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  image?: string;
  practitionerId?: string;
  patientId?: string;
  organizationId?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  image?: string;
}

// Patient-related types
export interface PatientSummary {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: Date;
  gender: "male" | "female" | "other" | "unknown";
  phone?: string;
  email?: string;
  address?: string;
  primaryPhysician?: string;
  lastVisit?: Date;
  status: "active" | "inactive" | "deceased";
  photoUrl?: string;
}

export interface PatientDetail extends PatientSummary {
  ssn?: string;
  maritalStatus?: string;
  race?: string;
  ethnicity?: string;
  preferredLanguage?: string;
  emergencyContact?: EmergencyContact;
  insurance?: InsuranceInfo;
  addresses: Address[];
  contacts: ContactInfo[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface InsuranceInfo {
  primary: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
    subscriberName: string;
    subscriberDOB?: Date;
    relationshipToSubscriber: string;
  };
  secondary?: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
  };
}

export interface Address {
  id: string;
  type: "home" | "work" | "temp" | "billing";
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isPrimary: boolean;
}

export interface ContactInfo {
  id: string;
  type: "phone" | "email" | "fax";
  value: string;
  use: "home" | "work" | "mobile";
  isPrimary: boolean;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

// Search and Filter types
export interface PatientSearchFilters {
  query?: string;
  gender?: string;
  status?: string;
  dateOfBirthFrom?: Date;
  dateOfBirthTo?: Date;
  providerId?: string;
  lastVisitFrom?: Date;
  lastVisitTo?: Date;
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

export interface PaginationConfig {
  page: number;
  limit: number;
}

// UI Component types
export interface NavItem {
  title: string;
  href: string;
  icon: string;
  roles?: UserRole[];
  children?: NavItem[];
}

export interface DashboardWidget {
  id: string;
  type: "stats" | "chart" | "list" | "calendar";
  title: string;
  data?: unknown;
  roles?: UserRole[];
}

// Form types
export interface FormFieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FormFieldError[];
}

// Toast/Notification types
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}
