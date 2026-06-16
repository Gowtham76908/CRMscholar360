// Static metadata for the multi-department lead model. The authoritative stage
// lists come from the backend (`GET /api/lead-departments/workflows`, see
// useWorkflows); this file only holds presentation concerns (labels, colors,
// ordering) so every department-aware screen renders consistently.

// Canonical display order (matches the backend DepartmentType enum intent).
export const DEPARTMENT_ORDER = [
    "SALES",
    "APPLICATION_VISA",
    "LOAN",
    "ACCOMMODATION_TICKETS",
    "FOREX",
    "MISCELLANEOUS",
];

export const DEPARTMENT_LABELS = {
    SALES: "Sales",
    APPLICATION_VISA: "Application & Visa",
    LOAN: "Loan",
    ACCOMMODATION_TICKETS: "Accommodation & Tickets",
    FOREX: "Forex",
    MISCELLANEOUS: "Miscellaneous",
};

// Per-department accent classes (Tailwind) for chips / headers.
export const DEPARTMENT_STYLE = {
    SALES:                 "bg-indigo-100 text-indigo-800 border-indigo-200",
    APPLICATION_VISA:      "bg-sky-100 text-sky-800 border-sky-200",
    LOAN:                  "bg-emerald-100 text-emerald-800 border-emerald-200",
    ACCOMMODATION_TICKETS: "bg-amber-100 text-amber-800 border-amber-200",
    FOREX:                 "bg-violet-100 text-violet-800 border-violet-200",
    MISCELLANEOUS:         "bg-gray-100 text-gray-700 border-gray-200",
};

export const departmentLabel = (code) => DEPARTMENT_LABELS[code] || code;
export const departmentStyle = (code) => DEPARTMENT_STYLE[code] || DEPARTMENT_STYLE.MISCELLANEOUS;

// Sort a list of department codes into canonical order.
export const sortDepartments = (codes = []) =>
    [...codes].sort((a, b) => DEPARTMENT_ORDER.indexOf(a) - DEPARTMENT_ORDER.indexOf(b));

// Fallback label for a stage code when the workflow map hasn't loaded yet.
export const humanizeStage = (code) =>
    code
        ? String(code).toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "—";
