import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Import enums from Prisma client
const { Gender, MaritalStatus, Race, Ethnicity, PatientStatus } = require('@prisma/client');

async function main() {
  console.log("Seeding database...");

  // Create organization
  const organization = await prisma.organization.upsert({
    where: { identifier: "METAPHARSIC-001" },
    update: {},
    create: {
      identifier: "METAPHARSIC-001",
      name: "Metapharsic Lifesciences Medical Center",
      type: "PROVIDER",
      active: true,
      phone: "(555) 123-4567",
      email: "admin@metapharsic.com",
      addressLine1: "123 Healthcare Blvd",
      city: "Medical City",
      state: "CA",
      postalCode: "90210",
      country: "US",
    },
  });

  console.log("Created organization:", organization.name);

  // Create practitioners
  const practitioners = await Promise.all([
    prisma.practitioner.upsert({
      where: { identifier: "DR001" },
      update: {},
      create: {
        identifier: "DR001",
        firstName: "Sarah",
        lastName: "Johnson",
        specialty: "Internal Medicine",
        credentials: "MD",
        email: "sarah.johnson@metapharsic.com",
        phone: "(555) 100-1001",
        active: true,
        organizationId: organization.id,
      },
    }),
    prisma.practitioner.upsert({
      where: { identifier: "DR002" },
      update: {},
      create: {
        identifier: "DR002",
        firstName: "Michael",
        lastName: "Chen",
        specialty: "Family Medicine",
        credentials: "MD",
        email: "michael.chen@metapharsic.com",
        phone: "(555) 100-1002",
        active: true,
        organizationId: organization.id,
      },
    }),
    prisma.practitioner.upsert({
      where: { identifier: "NURSE001" },
      update: {},
      create: {
        identifier: "NURSE001",
        firstName: "Emily",
        lastName: "Rodriguez",
        specialty: "Registered Nurse",
        credentials: "RN",
        email: "emily.rodriguez@metapharsic.com",
        phone: "(555) 100-1003",
        active: true,
        organizationId: organization.id,
      },
    }),
  ]);

  console.log(`Created ${practitioners.length} practitioners`);

  // Create users with passwords
  const hashedPassword = await bcrypt.hash("admin123", 12);
  const physicianPassword = await bcrypt.hash("physician123", 12);
  const nursePassword = await bcrypt.hash("nurse123", 12);

  const users = await Promise.all([
    // Admin user
    prisma.user.upsert({
      where: { email: "admin@metapharsic.com" },
      update: {},
      create: {
        email: "admin@metapharsic.com",
        password: hashedPassword,
        name: "System Administrator",
        role: "ADMIN",
        isActive: true,
        organizationId: organization.id,
      },
    }),
    // Physician user
    prisma.user.upsert({
      where: { email: "physician@metapharsic.com" },
      update: {},
      create: {
        email: "physician@metapharsic.com",
        password: physicianPassword,
        name: "Dr. Sarah Johnson",
        role: "PHYSICIAN",
        isActive: true,
        practitionerId: practitioners[0].id,
        organizationId: organization.id,
      },
    }),
    // Nurse user
    prisma.user.upsert({
      where: { email: "nurse@metapharsic.com" },
      update: {},
      create: {
        email: "nurse@metapharsic.com",
        password: nursePassword,
        name: "Emily Rodriguez",
        role: "NURSE",
        isActive: true,
        practitionerId: practitioners[2].id,
        organizationId: organization.id,
      },
    }),
    // Front desk user
    prisma.user.upsert({
      where: { email: "frontdesk@metapharsic.com" },
      update: {},
      create: {
        email: "frontdesk@metapharsic.com",
        password: await bcrypt.hash("frontdesk123", 12),
        name: "Front Desk Staff",
        role: "FRONT_DESK",
        isActive: true,
        organizationId: organization.id,
      },
    }),
  ]);

  console.log(`Created ${users.length} users`);

  // Create sample patients
  const samplePatients = [
    {
      mrn: "MRN2024001",
      firstName: "John",
      lastName: "Smith",
      middleName: "A",
      gender: "MALE",
      dateOfBirth: new Date("1985-03-15"),
      ssn: "123-45-6789",
      maritalStatus: "MARRIED",
      race: "WHITE",
      ethnicity: "NOT_HISPANIC_OR_LATINO",
      status: "ACTIVE",
    },
    {
      mrn: "MRN2024002",
      firstName: "Maria",
      lastName: "Garcia",
      middleName: "L",
      gender: "FEMALE",
      dateOfBirth: new Date("1990-07-22"),
      ssn: "234-56-7890",
      maritalStatus: "SINGLE",
      race: "WHITE",
      ethnicity: "HISPANIC_OR_LATINO",
      status: "ACTIVE",
    },
    {
      mrn: "MRN2024003",
      firstName: "Robert",
      lastName: "Johnson",
      middleName: "K",
      gender: "MALE",
      dateOfBirth: new Date("1975-11-08"),
      ssn: "345-67-8901",
      maritalStatus: "DIVORCED",
      race: "BLACK_OR_AFRICAN_AMERICAN",
      ethnicity: "NOT_HISPANIC_OR_LATINO",
      status: "ACTIVE",
    },
    {
      mrn: "MRN2024004",
      firstName: "Jennifer",
      lastName: "Williams",
      middleName: "M",
      gender: "FEMALE",
      dateOfBirth: new Date("1988-01-30"),
      ssn: "456-78-9012",
      maritalStatus: "MARRIED",
      race: "ASIAN",
      ethnicity: "NOT_HISPANIC_OR_LATINO",
      status: "ACTIVE",
    },
    {
      mrn: "MRN2024005",
      firstName: "David",
      lastName: "Brown",
      middleName: "T",
      gender: "MALE",
      dateOfBirth: new Date("1960-05-12"),
      ssn: "567-89-0123",
      maritalStatus: "WIDOWED",
      race: "WHITE",
      ethnicity: "NOT_HISPANIC_OR_LATINO",
      status: "ACTIVE",
    },
  ];

  for (const patientData of samplePatients) {
    const patient = await prisma.patient.create({
      data: {
        ...(patientData as any),
        organizationId: organization.id,
        primaryPhysicianId: practitioners[0].id,
        addresses: {
          create: {
            use: "HOME",
            type: "BOTH",
            line1: `${Math.floor(Math.random() * 9000) + 1000} Main St`,
            city: "Medical City",
            state: "CA",
            postalCode: "90210",
            country: "US",
            isPrimary: true,
          },
        },
        telecoms: {
          create: [
            {
              system: "PHONE",
              value: `(555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
              use: "HOME",
              isPrimary: true,
            },
          ],
        },
      },
    });
    console.log(`Created patient: ${patient.firstName} ${patient.lastName}`);
  }

  console.log("\n✅ Database seeded successfully!");
  console.log("\nDemo credentials:");
  console.log("  Admin: admin@metapharsic.com / admin123");
  console.log("  Physician: physician@metapharsic.com / physician123");
  console.log("  Nurse: nurse@metapharsic.com / nurse123");
  console.log("  Front Desk: frontdesk@metapharsic.com / frontdesk123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
