/**
 * Department workflows — the SINGLE SOURCE OF TRUTH for per-department stages.
 *
 * Stages are stored on LeadDepartment.stage as the UPPERCASE codes below.
 * No DB table, no admin workflow builder, no dynamic stages — change here = change everywhere.
 *
 * Keys must match the Prisma `DepartmentType` enum exactly.
 */

const DEPARTMENT_WORKFLOWS = {
    SALES: [
        "ENQUIRY",
        "FOLLOW_UP",
        "PROSPECT",
        "UNIVERSITY_SHORTLISTING",
        "APPLICATION",
        "AWAITING_STATUS",
        "VISA_DOCUMENTATION",
        "VISA_STATUS",
        "VISA_APPROVAL",
        "COMMISSION_INVOICING",
        "ARCHIVE",
        "FUTURE_PROSPECT",
    ],

    // Application & Visa has no workflow defined yet (the visa stages currently
    // live inside SALES). Left intentionally empty — a lead cannot be allocated
    // here until stages are added. Fill this array when the workflow is decided.
    APPLICATION_VISA: [],

    LOAN: [
        "ENQUIRY",
        "LOAN_DOCUMENTATION",
        "AWAITING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "COMMISSION_INVOICING",
    ],

    ACCOMMODATION_TICKETS: [
        "ENQUIRY",
        "ON_PROGRESS",
        "BOOKING_CONFIRMED",
        "COMMISSION_INVOICING",
    ],

    FOREX: [
        "ENQUIRY",
        "ON_PROGRESS",
        "PROCESS_COMPLETED",
        "COMMISSION_INVOICING",
    ],

    MISCELLANEOUS: [
        "ENQUIRY",
        "ON_PROGRESS",
        "PROCESS_COMPLETED",
        "COMMISSION_INVOICING",
    ],
};

/**
 * Outcome classification per department — which stages count as a "won"
 * (successful conversion) or "lost" outcome. Used by analytics for conversion
 * rates and by aging reports to decide which services are still "active".
 * A stage absent from both lists is an in-progress stage.
 */
const WON_STAGES = {
    SALES: ["COMMISSION_INVOICING"],
    APPLICATION_VISA: [],
    LOAN: ["APPROVED", "COMMISSION_INVOICING"],
    ACCOMMODATION_TICKETS: ["BOOKING_CONFIRMED", "COMMISSION_INVOICING"],
    FOREX: ["PROCESS_COMPLETED", "COMMISSION_INVOICING"],
    MISCELLANEOUS: ["PROCESS_COMPLETED", "COMMISSION_INVOICING"],
};

const LOST_STAGES = {
    SALES: ["ARCHIVE"],
    APPLICATION_VISA: [],
    LOAN: ["REJECTED"],
    ACCOMMODATION_TICKETS: [],
    FOREX: [],
    MISCELLANEOUS: [],
};

/**
 * The stage at which a department's service becomes commission-eligible. Reaching
 * it awards a commission to that service's consultant (see commissionService).
 * APPLICATION_VISA has no workflow yet, so no commission stage.
 */
const COMMISSION_STAGES = {
    SALES: "COMMISSION_INVOICING",
    APPLICATION_VISA: null,
    LOAN: "COMMISSION_INVOICING",
    ACCOMMODATION_TICKETS: "COMMISSION_INVOICING",
    FOREX: "COMMISSION_INVOICING",
    MISCELLANEOUS: "COMMISSION_INVOICING",
};

/** True if reaching `stage` makes `department`'s service commission-eligible. */
function isCommissionStage(department, stage) {
    const s = COMMISSION_STAGES[department];
    return s != null && s === stage;
}

/** True if `stage` is a successful terminal stage for `department`. */
function isWonStage(department, stage) {
    return (WON_STAGES[department] || []).includes(stage);
}

/** True if `stage` is an unsuccessful terminal stage for `department`. */
function isLostStage(department, stage) {
    return (LOST_STAGES[department] || []).includes(stage);
}

/** All terminal (won + lost) stage codes for a department. */
function getTerminalStages(department) {
    return [...(WON_STAGES[department] || []), ...(LOST_STAGES[department] || [])];
}

/**
 * Prisma `OR` clause builders for filtering LeadDepartment rows by outcome across
 * all departments — each entry is { department, stage: { in: [...] } }. Use as
 * `where: { OR: wonStageFilter() }`. Departments with no such stages are omitted.
 */
function stageFilterFrom(map) {
    return Object.entries(map)
        .filter(([, stages]) => Array.isArray(stages) && stages.length > 0)
        .map(([department, stages]) => ({ department, stage: { in: stages } }));
}
function wonStageFilter()      { return stageFilterFrom(WON_STAGES); }
function lostStageFilter()     { return stageFilterFrom(LOST_STAGES); }
function terminalStageFilter() { return [...wonStageFilter(), ...lostStageFilter()]; }

/**
 * Human-readable labels for stage codes (for frontend display).
 * Falls back to a Title-Cased version of the code if not listed.
 */
const STAGE_LABELS = {
    ENQUIRY: "Enquiry",
    FOLLOW_UP: "Follow Up",
    PROSPECT: "Prospect",
    UNIVERSITY_SHORTLISTING: "University Shortlisting",
    APPLICATION: "Application",
    AWAITING_STATUS: "Awaiting Status",
    VISA_DOCUMENTATION: "Visa Documentation",
    VISA_STATUS: "Visa Status",
    VISA_APPROVAL: "Visa Approval",
    COMMISSION_INVOICING: "Commission Invoicing",
    ARCHIVE: "Archive",
    FUTURE_PROSPECT: "Future Prospect",
    LOAN_DOCUMENTATION: "Loan Documentation",
    AWAITING_APPROVAL: "Awaiting Approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    ON_PROGRESS: "On Progress",
    BOOKING_CONFIRMED: "Booking Confirmed",
    PROCESS_COMPLETED: "Process Completed",
};

/** Every valid department code (the workflow keys). */
const DEPARTMENTS = Object.keys(DEPARTMENT_WORKFLOWS);

/** True if `department` is a known department. */
function isValidDepartment(department) {
    return Object.prototype.hasOwnProperty.call(DEPARTMENT_WORKFLOWS, department);
}

/** Ordered list of stage codes for a department. Throws on unknown department. */
function getStages(department) {
    const stages = DEPARTMENT_WORKFLOWS[department];
    if (!stages) throw new Error(`Unknown department: ${department}`);
    return stages;
}

/** True if `stage` belongs to `department`'s workflow. */
function isValidStage(department, stage) {
    const stages = DEPARTMENT_WORKFLOWS[department];
    return Array.isArray(stages) && stages.includes(stage);
}

/** True if the department has at least one stage configured. */
function hasWorkflow(department) {
    return getStages(department).length > 0;
}

/**
 * The first stage a new LeadDepartment starts at (ENQUIRY today), or null if the
 * department has no workflow configured yet (e.g. APPLICATION_VISA).
 */
function getInitialStage(department) {
    const stages = getStages(department);
    return stages.length ? stages[0] : null;
}

/** Display label for a stage code. */
function getStageLabel(stage) {
    return STAGE_LABELS[stage]
        || String(stage).toLowerCase().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

module.exports = {
    DEPARTMENT_WORKFLOWS,
    STAGE_LABELS,
    DEPARTMENTS,
    WON_STAGES,
    LOST_STAGES,
    COMMISSION_STAGES,
    isValidDepartment,
    hasWorkflow,
    getStages,
    isValidStage,
    getInitialStage,
    getStageLabel,
    isCommissionStage,
    isWonStage,
    isLostStage,
    getTerminalStages,
    wonStageFilter,
    lostStageFilter,
    terminalStageFilter,
};
