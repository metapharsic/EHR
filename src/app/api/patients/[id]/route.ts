import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";
import { hasPermission } from "@/lib/auth/roles";
import { patientUpdateSchema } from "@/lib/validation/patient";
import { z } from "zod";

// Mock patients data (same as in route.ts)
const MOCK_PATIENTS = [
  {
    id: "1",
    mrn: "MRN2024001",
    firstName: "John",
    lastName: "Smith",
    middleName: "A",
    gender: "MALE",
    dateOfBirth: "1985-03-15",
    status: "ACTIVE",
    phone: "(555) 123-4567",
    email: "john.smith@email.com",
    address: "123 Main St, Medical City, CA 90210",
    primaryPhysician: "Johnson, Sarah",
    addresses: [
      {
        id: "1",
        use: "HOME",
        type: "BOTH",
        line1: "123 Main St",
        line2: null,
        city: "Medical City",
        state: "CA",
        postalCode: "90210",
        country: "US",
        isPrimary: true,
      },
    ],
    telecoms: [
      {
        id: "1",
        system: "PHONE",
        value: "(555) 123-4567",
        use: "HOME",
        isPrimary: true,
      },
      {
        id: "2",
        system: "EMAIL",
        value: "john.smith@email.com",
        use: "HOME",
        isPrimary: true,
      },
    ],
    emergencyContacts: [
      {
        id: "1",
        name: "Jane Smith",
        relationship: "Spouse",
        phone: "(555) 987-6543",
        email: null,
        isPrimary: true,
      },
    ],
    insurancePolicies: [
      {
        id: "1",
        payerName: "Blue Cross Blue Shield",
        policyNumber: "BC123456789",
        groupNumber: "GRP001",
        subscriberName: "John Smith",
        subscriberRelationship: "Self",
        isPrimary: true,
        isActive: true,
      },
    ],
  },
  {
    id: "2",
    mrn: "MRN2024002",
    firstName: "Maria",
    lastName: "Garcia",
    middleName: "L",
    gender: "FEMALE",
    dateOfBirth: "1990-07-22",
    status: "ACTIVE",
    phone: "(555) 234-5678",
    email: "maria.garcia@email.com",
    address: "456 Oak Ave, Medical City, CA 90210",
    primaryPhysician: "Chen, Michael",
    addresses: [
      {
        id: "2",
        use: "HOME",
        type: "BOTH",
        line1: "456 Oak Ave",
        line2: "Apt 2B",
        city: "Medical City",
        state: "CA",
        postalCode: "90210",
        country: "US",
        isPrimary: true,
      },
    ],
    telecoms: [
      {
        id: "3",
        system: "PHONE",
        value: "(555) 234-5678",
        use: "HOME",
        isPrimary: true,
      },
    ],
    emergencyContacts: [],
    insurancePolicies: [],
  },
  {
    id: "3",
    mrn: "MRN2024003",
    firstName: "Robert",
    lastName: "Johnson",
    middleName: "K",
    gender: "MALE",
    dateOfBirth: "1975-11-08",
    status: "ACTIVE",
    phone: "(555) 345-6789",
    email: "robert.j@email.com",
    address: "789 Pine Rd, Medical City, CA 90210",
    primaryPhysician: "Johnson, Sarah",
    addresses: [],
    telecoms: [],
    emergencyContacts: [],
    insurancePolicies: [],
  },
  {
    id: "4",
    mrn: "MRN2024004",
    firstName: "Jennifer",
    lastName: "Williams",
    middleName: "M",
    gender: "FEMALE",
    dateOfBirth: "1988-01-30",
    status: "ACTIVE",
    phone: "(555) 456-7890",
    email: "jennifer.w@email.com",
    address: "321 Elm St, Medical City, CA 90210",
    primaryPhysician: "Chen, Michael",
    addresses: [],
    telecoms: [],
    emergencyContacts: [],
    insurancePolicies: [],
  },
  {
    id: "5",
    mrn: "MRN2024005",
    firstName: "David",
    lastName: "Brown",
    middleName: "T",
    gender: "MALE",
    dateOfBirth: "1960-05-12",
    status: "INACTIVE",
    phone: "(555) 567-8901",
    email: "david.brown@email.com",
    address: "654 Maple Dr, Medical City, CA 90210",
    primaryPhysician: "Johnson, Sarah",
    addresses: [],
    telecoms: [],
    emergencyContacts: [],
    insurancePolicies: [],
  },
];

// GET /api/patients/[id] - Get single patient
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    if (!hasPermission(session.user.role as any, "patients:read")) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }

    const patient = MOCK_PATIENTS.find((p) => p.id === params.id);

    if (!patient) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Patient not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    console.error("Error fetching patient:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch patient",
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/patients/[id] - Update patient
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    if (!hasPermission(session.user.role as any, "patients:update")) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const patientIndex = MOCK_PATIENTS.findIndex((p) => p.id === params.id);

    if (patientIndex === -1) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Patient not found" } },
        { status: 404 }
      );
    }

    // Update patient (mock)
    const updatedPatient = {
      ...MOCK_PATIENTS[patientIndex],
      ...body,
      id: params.id,
    };

    MOCK_PATIENTS[patientIndex] = updatedPatient;

    return NextResponse.json({
      success: true,
      data: updatedPatient,
    });
  } catch (error) {
    console.error("Error updating patient:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update patient",
        },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/patients/[id] - Delete patient (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    if (!hasPermission(session.user.role as any, "patients:delete")) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }

    const patientIndex = MOCK_PATIENTS.findIndex((p) => p.id === params.id);

    if (patientIndex === -1) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Patient not found" } },
        { status: 404 }
      );
    }

    // Soft delete by setting status to INACTIVE
    MOCK_PATIENTS[patientIndex].status = "INACTIVE";

    return NextResponse.json({
      success: true,
      data: MOCK_PATIENTS[patientIndex],
    });
  } catch (error) {
    console.error("Error deleting patient:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete patient",
        },
      },
      { status: 500 }
    );
  }
}
