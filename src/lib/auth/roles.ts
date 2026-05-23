import { UserRole } from "@/types";

// Role hierarchy - higher index = more permissions
export const ROLE_HIERARCHY: UserRole[] = [
  "PATIENT",
  "FRONT_DESK",
  "MEDICAL_ASSISTANT",
  "NURSE",
  "PHYSICIAN",
  "ADMIN",
];

// Permission definitions
export type Permission =
  // Patient permissions
  | "patients:read"
  | "patients:create"
  | "patients:update"
  | "patients:delete"
  | "patients:search"
  | "patients:export"
  // Encounter permissions
  | "encounters:read"
  | "encounters:create"
  | "encounters:update"
  | "encounters:delete"
  // Clinical permissions
  | "observations:read"
  | "observations:create"
  | "observations:update"
  | "conditions:read"
  | "conditions:create"
  | "conditions:update"
  | "medications:read"
  | "medications:create"
  | "medications:update"
  | "allergies:read"
  | "allergies:create"
  | "allergies:update"
  // Document permissions
  | "documents:read"
  | "documents:create"
  | "documents:update"
  | "documents:delete"
  // Admin permissions
  | "users:read"
  | "users:create"
  | "users:update"
  | "users:delete"
  | "practitioners:read"
  | "practitioners:create"
  | "practitioners:update"
  | "organizations:read"
  | "organizations:create"
  | "organizations:update"
  | "settings:read"
  | "settings:update"
  | "reports:read"
  | "reports:export"
  | "audit:read";

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  PATIENT: [
    "patients:read", // Can only read own record (enforced in code)
    "encounters:read",
    "observations:read",
    "conditions:read",
    "medications:read",
    "allergies:read",
    "documents:read",
  ],
  FRONT_DESK: [
    "patients:read",
    "patients:create",
    "patients:update",
    "patients:search",
    "encounters:read",
    "encounters:create",
    "encounters:update",
  ],
  MEDICAL_ASSISTANT: [
    "patients:read",
    "patients:update",
    "patients:search",
    "encounters:read",
    "encounters:create",
    "encounters:update",
    "observations:read",
    "observations:create",
    "observations:update",
    "allergies:read",
    "documents:read",
    "documents:create",
  ],
  NURSE: [
    "patients:read",
    "patients:update",
    "patients:search",
    "encounters:read",
    "encounters:create",
    "encounters:update",
    "observations:read",
    "observations:create",
    "observations:update",
    "conditions:read",
    "conditions:create",
    "medications:read",
    "medications:create",
    "medications:update",
    "allergies:read",
    "allergies:create",
    "allergies:update",
    "documents:read",
    "documents:create",
  ],
  PHYSICIAN: [
    "patients:read",
    "patients:create",
    "patients:update",
    "patients:search",
    "patients:export",
    "encounters:read",
    "encounters:create",
    "encounters:update",
    "encounters:delete",
    "observations:read",
    "observations:create",
    "observations:update",
    "conditions:read",
    "conditions:create",
    "conditions:update",
    "medications:read",
    "medications:create",
    "medications:update",
    "allergies:read",
    "allergies:create",
    "allergies:update",
    "documents:read",
    "documents:create",
    "documents:update",
    "documents:delete",
    "reports:read",
    "reports:export",
  ],
  ADMIN: [
    // All permissions
    "patients:read",
    "patients:create",
    "patients:update",
    "patients:delete",
    "patients:search",
    "patients:export",
    "encounters:read",
    "encounters:create",
    "encounters:update",
    "encounters:delete",
    "observations:read",
    "observations:create",
    "observations:update",
    "conditions:read",
    "conditions:create",
    "conditions:update",
    "medications:read",
    "medications:create",
    "medications:update",
    "allergies:read",
    "allergies:create",
    "allergies:update",
    "documents:read",
    "documents:create",
    "documents:update",
    "documents:delete",
    "users:read",
    "users:create",
    "users:update",
    "users:delete",
    "practitioners:read",
    "practitioners:create",
    "practitioners:update",
    "organizations:read",
    "organizations:create",
    "organizations:update",
    "settings:read",
    "settings:update",
    "reports:read",
    "reports:export",
    "audit:read",
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// Check if a role has any of the specified permissions
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

// Check if a role has all of the specified permissions
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

// Get all permissions for a role
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

// Check if a role is higher than another in hierarchy
export function isRoleHigherOrEqual(role: UserRole, compareTo: UserRole): boolean {
  const roleIndex = ROLE_HIERARCHY.indexOf(role);
  const compareIndex = ROLE_HIERARCHY.indexOf(compareTo);
  return roleIndex >= compareIndex;
}

// Get role display name
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    ADMIN: "Administrator",
    PHYSICIAN: "Physician",
    NURSE: "Nurse",
    MEDICAL_ASSISTANT: "Medical Assistant",
    FRONT_DESK: "Front Desk",
    PATIENT: "Patient",
  };
  return displayNames[role];
}

// Get role badge color
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
    PHYSICIAN: "bg-blue-100 text-blue-800 border-blue-200",
    NURSE: "bg-green-100 text-green-800 border-green-200",
    MEDICAL_ASSISTANT: "bg-yellow-100 text-yellow-800 border-yellow-200",
    FRONT_DESK: "bg-gray-100 text-gray-800 border-gray-200",
    PATIENT: "bg-pink-100 text-pink-800 border-pink-200",
  };
  return colors[role];
}

// Navigation items by role
export interface NavItem {
  title: string;
  href: string;
  icon: string;
  permissions?: Permission[];
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: "LayoutDashboard",
  },
  {
    title: "Patients",
    href: "/patients",
    icon: "Users",
    permissions: ["patients:read"],
    children: [
      {
        title: "All Patients",
        href: "/patients",
        icon: "List",
        permissions: ["patients:read"],
      },
      {
        title: "New Patient",
        href: "/patients/new",
        icon: "UserPlus",
        permissions: ["patients:create"],
      },
    ],
  },
  {
    title: "Schedule",
    href: "/schedule",
    icon: "Calendar",
    permissions: ["encounters:read"],
  },
  {
    title: "Clinical",
    href: "/clinical",
    icon: "Stethoscope",
    permissions: ["observations:read", "conditions:read"],
    children: [
      {
        title: "Vitals",
        href: "/clinical/vitals",
        icon: "Activity",
        permissions: ["observations:read"],
      },
      {
        title: "Medications",
        href: "/clinical/medications",
        icon: "Pill",
        permissions: ["medications:read"],
      },
      {
        title: "Allergies",
        href: "/clinical/allergies",
        icon: "AlertTriangle",
        permissions: ["allergies:read"],
      },
    ],
  },
  {
    title: "Documents",
    href: "/documents",
    icon: "FileText",
    permissions: ["documents:read"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: "BarChart3",
    permissions: ["reports:read"],
  },
  {
    title: "Administration",
    href: "/admin",
    icon: "Settings",
    permissions: ["users:read", "settings:read"],
    children: [
      {
        title: "Users",
        href: "/admin/users",
        icon: "Users",
        permissions: ["users:read"],
      },
      {
        title: "Practitioners",
        href: "/admin/practitioners",
        icon: "UserCog",
        permissions: ["practitioners:read"],
      },
      {
        title: "Settings",
        href: "/admin/settings",
        icon: "Settings",
        permissions: ["settings:read"],
      },
      {
        title: "Audit Log",
        href: "/admin/audit",
        icon: "ClipboardList",
        permissions: ["audit:read"],
      },
    ],
  },
];

// Filter navigation items by role permissions
export function filterNavItemsByRole(items: NavItem[], role: UserRole): NavItem[] {
  return items
    .filter((item) => {
      if (!item.permissions) return true;
      return hasAnyPermission(role, item.permissions);
    })
    .map((item) => ({
      ...item,
      children: item.children
        ? filterNavItemsByRole(item.children, role)
        : undefined,
    }))
    .filter((item) => !item.children || item.children.length > 0);
}
