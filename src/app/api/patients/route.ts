import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";
import { patientSchema, patientSearchSchema } from "@/lib/validation/patient";
import { hasPermission } from "@/lib/auth/roles";
import { generateMRN } from "@/lib/utils";
import { z } from "zod";

// Mock patients data
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
  },
];

// GET /api/patients - List patients with search and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    if (!hasPermission((session.user as any).role, "patients:read")) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // Parse search parameters
    const params = {
      query: searchParams.get("query") || undefined,
      gender: searchParams.get("gender") || undefined,
      status: searchParams.get("status") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      sortBy: searchParams.get("sortBy") || "lastName",
      sortOrder: (searchParams.get("sortOrder") || "asc") as "asc" | "desc",
    };

    const validated = patientSearchSchema.parse(params);

    // Filter patients
    let filteredPatients = [...MOCK_PATIENTS];

    if (validated.query) {
      const query = validated.query.toLowerCase();
      filteredPatients = filteredPatients.filter(
        (p) =>
          p.firstName.toLowerCase().includes(query) ||
          p.lastName.toLowerCase().includes(query) ||
          p.mrn.toLowerCase().includes(query)
      );
    }

    if (validated.gender) {
      filteredPatients = filteredPatients.filter((p) => p.gender === validated.gender);
    }

    if (validated.status) {
      filteredPatients = filteredPatients.filter((p) => p.status === validated.status);
    }

    // Sort patients
    filteredPatients.sort((a, b) => {
      const aValue = a[validated.sortBy as keyof typeof a] || "";
      const bValue = b[validated.sortBy as keyof typeof b] || "";
      if (validated.sortOrder === "asc") {
        return String(aValue).localeCompare(String(bValue));
      }
      return String(bValue).localeCompare(String(aValue));
    });

    // Paginate
    const total = filteredPatients.length;
    const start = (validated.page - 1) * validated.limit;
    const paginatedPatients = filteredPatients.slice(start, start + validated.limit);

    return NextResponse.json({
      success: true,
      data: paginatedPatients,
      meta: {
        page: validated.page,
        limit: validated.limit,
        total,
        totalPages: Math.ceil(total / validated.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching patients:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch patients",
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/patients - Create new patient
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    if (!hasPermission((session.user as any).role, "patients:create")) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = patientSchema.parse(body);

    // Check for duplicate
    const existingPatient = MOCK_PATIENTS.find(
      (p) =>
        p.firstName.toLowerCase() === validated.firstName.toLowerCase() &&
        p.lastName.toLowerCase() === validated.lastName.toLowerCase()
    );

    if (existingPatient) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_PATIENT",
            message: "A patient with this name already exists",
          },
        },
        { status: 409 }
      );
    }

    // Create new patient (mock)
    const newPatient = {
      id: String(MOCK_PATIENTS.length + 1),
      mrn: generateMRN(),
      firstName: validated.firstName,
      lastName: validated.lastName,
      middleName: validated.middleName || "",
      gender: validated.gender,
      dateOfBirth: validated.dateOfBirth,
      status: validated.status,
      phone: validated.telecoms?.find((t) => t.system === "PHONE")?.value || "",
      email: validated.telecoms?.find((t) => t.system === "EMAIL")?.value || "",
      address: validated.addresses?.[0]
        ? `${validated.addresses[0].line1}, ${validated.addresses[0].city}, ${validated.addresses[0].state} ${validated.addresses[0].postalCode}`
        : "",
      primaryPhysician: "Unassigned",
    };

    MOCK_PATIENTS.push(newPatient);

    return NextResponse.json(
      {
        success: true,
        data: newPatient,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating patient:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid patient data",
            details: error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create patient",
        },
      },
      { status: 500 }
    );
  }
}
