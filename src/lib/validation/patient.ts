import { z } from "zod";
import { Gender, MaritalStatus, Race, Ethnicity, AddressUse, AddressType, TelecomSystem, TelecomUse } from "@prisma/client";

// Address validation schema
export const addressSchema = z.object({
  id: z.string().optional(),
  use: z.nativeEnum(AddressUse).default("HOME"),
  type: z.nativeEnum(AddressType).default("BOTH"),
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  district: z.string().optional(),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(5, "Valid postal code is required"),
  country: z.string().default("US"),
  isPrimary: z.boolean().default(false),
});

// Telecom validation schema
export const telecomSchema = z.object({
  id: z.string().optional(),
  system: z.nativeEnum(TelecomSystem).default("PHONE"),
  value: z.string().min(1, "Contact value is required"),
  use: z.nativeEnum(TelecomUse).default("HOME"),
  rank: z.number().default(1),
  isPrimary: z.boolean().default(false),
});

// Emergency contact validation schema
export const emergencyContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Contact name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email().optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
});

// Insurance policy validation schema
export const insurancePolicySchema = z.object({
  id: z.string().optional(),
  payerName: z.string().min(1, "Insurance provider is required"),
  payerId: z.string().optional(),
  policyNumber: z.string().min(1, "Policy number is required"),
  groupNumber: z.string().optional(),
  planName: z.string().optional(),
  planType: z.string().optional(),
  subscriberName: z.string().min(1, "Subscriber name is required"),
  subscriberRelationship: z.string().default("Self"),
  subscriberDOB: z.string().optional().or(z.literal("")),
  subscriberSSN: z.string().optional(),
  coverageStartDate: z.string().optional().or(z.literal("")),
  coverageEndDate: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  isPrimary: z.boolean().default(false),
  copayAmount: z.number().optional(),
  deductibleAmount: z.number().optional(),
});

// Main patient validation schema
export const patientSchema = z.object({
  // Identifiers
  mrn: z.string().optional(), // Auto-generated if not provided
  ssn: z.string()
    .regex(/^\d{3}-?\d{2}-?\d{4}$/, "Valid SSN format required (XXX-XX-XXXX)")
    .optional()
    .or(z.literal("")),
  
  // Name
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  middleName: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  preferredName: z.string().optional(),
  
  // Demographics
  gender: z.nativeEnum(Gender),
  birthSex: z.enum(["M", "F", "OTH", "UNK"]).optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  
  // Administrative
  maritalStatus: z.nativeEnum(MaritalStatus).optional(),
  race: z.nativeEnum(Race).optional(),
  ethnicity: z.nativeEnum(Ethnicity).optional(),
  preferredLanguage: z.string().default("en"),
  
  // Status
  status: z.enum(["ACTIVE", "INACTIVE", "DECEASED"]).default("ACTIVE"),
  
  // Relationships
  primaryPhysicianId: z.string().optional(),
  organizationId: z.string().optional(),
  
  // Nested data
  addresses: z.array(addressSchema).min(1, "At least one address is required"),
  telecoms: z.array(telecomSchema).min(1, "At least one contact method is required"),
  emergencyContacts: z.array(emergencyContactSchema).optional(),
  insurancePolicies: z.array(insurancePolicySchema).optional(),
});

// Patient update schema (all fields optional)
export const patientUpdateSchema = patientSchema.partial().extend({
  id: z.string(),
});

// Patient search schema
export const patientSearchSchema = z.object({
  query: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DECEASED"]).optional(),
  dateOfBirthFrom: z.string().optional(),
  dateOfBirthTo: z.string().optional(),
  providerId: z.string().optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
  sortBy: z.string().default("lastName"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// Type exports
export type AddressInput = z.infer<typeof addressSchema>;
export type TelecomInput = z.infer<typeof telecomSchema>;
export type EmergencyContactInput = z.infer<typeof emergencyContactSchema>;
export type InsurancePolicyInput = z.infer<typeof insurancePolicySchema>;
export type PatientInput = z.infer<typeof patientSchema>;
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;
export type PatientSearchInput = z.infer<typeof patientSearchSchema>;
