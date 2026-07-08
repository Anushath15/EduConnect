export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  PRINCIPAL: [
    "timetable:view:all","timetable:edit","timetable:generate","timetable:lock",
    "substitution:assign","substitution:accept","swap:request","swap:respond",
    "student:view","student:create","student:edit","staff:create","staff:edit","permission:manage:roles",
    "permission:manage:individual","resource:book","school:config",
    "school:reports","announcement:create","audit:view",
  ],
  VICE_PRINCIPAL: [
    "timetable:view:all","timetable:edit","timetable:generate","timetable:lock",
    "substitution:assign","substitution:accept","swap:request","swap:respond",
    "student:view","student:create","student:edit","staff:create","staff:edit","resource:book",
    "school:reports","announcement:create","audit:view",
  ],
  COORDINATOR: [
    "substitution:assign","substitution:accept","timetable:view:all",
    "student:view","swap:request","swap:respond","announcement:create",
    "school:reports","audit:view",
  ],
  ADMINISTRATOR: [
    "school:config","timetable:generate","timetable:edit","timetable:view:all",
    "staff:create","staff:edit","student:view","student:create","student:edit","resource:book","school:reports",
  ],
  CLASS_TEACHER: [
    "timetable:view:all","substitution:accept","swap:request","swap:respond",
    "student:view","resource:book","announcement:create",
  ],
  SUBJECT_TEACHER: [
    "timetable:view:all","substitution:accept","swap:request","swap:respond","resource:book",
  ],
  TEMP_TEACHER: ["timetable:view:all","substitution:accept","resource:book"],
  INTERN: [],
  OFFICE_STAFF: ["resource:book","announcement:create","student:create","student:edit"],
}

export function hasPermission(role: string, permission: string): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

// Roles permitted to edit staff records (staff:edit).
export const STAFF_EDIT_ROLES = ["PRINCIPAL", "VICE_PRINCIPAL", "ADMINISTRATOR"] as const

// Matches school:config — Principal + Administrator only.
// Vice Principal deliberately excluded (matches defaults.ts).
export const SCHOOL_CONFIG_ROLES = ["PRINCIPAL", "ADMINISTRATOR"] as const

// Matches student:create / student:edit.
export const STUDENT_EDIT_ROLES = ["PRINCIPAL", "VICE_PRINCIPAL", "ADMINISTRATOR", "OFFICE_STAFF"] as const

// Matches substitution:assign.
export const SUBSTITUTION_ASSIGN_ROLES = ["PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"] as const

// Matches swap:request.
export const SWAP_REQUEST_ROLES = ["PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "CLASS_TEACHER", "SUBJECT_TEACHER"] as const

// Matches announcement:create.
export const ANNOUNCEMENT_CREATE_ROLES = ["PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "CLASS_TEACHER", "OFFICE_STAFF"] as const

// Matches audit:view — only senior leadership and coordinators can see the audit trail.
export const AUDIT_VIEW_ROLES = ["PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"] as const

// Matches resource:book — everyone except INTERN.
export const RESOURCE_BOOK_ROLES = [
  "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "ADMINISTRATOR",
  "CLASS_TEACHER", "SUBJECT_TEACHER", "TEMP_TEACHER", "OFFICE_STAFF",
] as const

export const ROLE_LABELS: Record<string, string> = {
  PRINCIPAL: "Principal",
  VICE_PRINCIPAL: "Vice Principal",
  COORDINATOR: "Coordinator",
  ADMINISTRATOR: "Administrator",
  CLASS_TEACHER: "Class Teacher",
  SUBJECT_TEACHER: "Subject Teacher",
  TEMP_TEACHER: "Temp Teacher",
  INTERN: "Intern",
  OFFICE_STAFF: "Office Staff",
}

export const ROLE_COLORS: Record<string, string> = {
  PRINCIPAL: "#7C3AED",
  VICE_PRINCIPAL: "#6366F1",
  COORDINATOR: "#0EA5E9",
  ADMINISTRATOR: "#0EA5E9",
  CLASS_TEACHER: "#10B981",
  SUBJECT_TEACHER: "#F59E0B",
  TEMP_TEACHER: "#EF4444",
  INTERN: "#8B5CF6",
  OFFICE_STAFF: "#64748B",
}

export const WORKING_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const

export const DAY_LABELS: Record<string, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat",
}

export const API_PREFIX = "/v1"

export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100