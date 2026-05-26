const { z } = require("zod");

// ── Auth ──────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(1, "Password is required"),
});

// ── User ──────────────────────────────────────────────────────────────────────
const registerUserSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    phone: z.string().optional(),
    role: z.enum(["SUPER_ADMIN", "MANAGER", "EMPLOYEE"]).optional(),
    department: z.string().optional(),
});

const updateProfileSchema = z.object({
    name: z.string().min(1, "Name is required"),
    phone: z.string().optional(),
    department: z.string().optional(),
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

const updatePreferencesSchema = z.object({
    preferences: z.record(z.unknown()),
});

// ── Lead ──────────────────────────────────────────────────────────────────────
const leadSources = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL", "LINKEDIN"];
const enquiryTypes = ["PRODUCT", "WHITE_LABEL", "LMS", "SERVICES"];
const leadStatuses = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "LOST"];

const createLeadSchema = z.object({
    name: z.string().min(1, "Name is required"),
    phone: z.string().min(1, "Phone is required"),
    source: z.enum(leadSources, { errorMap: () => ({ message: "Invalid source" }) }),
    enquiryType: z.enum(enquiryTypes, { errorMap: () => ({ message: "Invalid enquiry type" }) }),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
});

const updateLeadSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    source: z.enum(leadSources).optional(),
    status: z.enum(leadStatuses).optional(),
    enquiryType: z.enum(enquiryTypes).optional(),
}).refine(data => Object.keys(data).length > 0, { message: "At least one field is required" });

const assignLeadSchema = z.object({
    assignedToId: z.string().uuid("Invalid user ID"),
});

const mergeLeadsSchema = z.object({
    primaryLeadId: z.string().uuid("Invalid primary lead ID"),
    secondaryLeadId: z.string().uuid("Invalid secondary lead ID"),
});

const checkDuplicateSchema = z.object({
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
});

const bulkUpdateSchema = z.object({
    leadIds: z.array(z.string().uuid()).min(1, "At least one lead ID required"),
    status: z.enum(leadStatuses),
});

const bulkAssignSchema = z.object({
    leadIds: z.array(z.string().uuid()).min(1, "At least one lead ID required"),
    assignedToId: z.string().uuid("Invalid user ID"),
});

// ── Task ──────────────────────────────────────────────────────────────────────
const priorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const taskTypes = ["EPIC", "STORY", "TASK", "BUG", "SUBTASK"];
const kanbanStatuses = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];

const createTaskSchema = z.object({
    title: z.string().min(1, "Title is required"),
    dueDate: z.string().refine(d => !isNaN(new Date(d).getTime()), "Invalid due date"),
    description: z.string().optional(),
    leadId: z.string().uuid().optional().or(z.literal("")).or(z.null()),
    assignedTo: z.string().uuid().optional().or(z.null()),
    priority: z.enum(priorities).optional(),
    type: z.enum(taskTypes).optional(),
    storyPoints: z.number().int().positive().optional().or(z.null()),
    estimatedHours: z.number().positive().optional().or(z.null()),
    labels: z.array(z.string()).optional(),
    sprintId: z.string().uuid().optional().or(z.literal("")).or(z.null()),
    kanbanStatus: z.enum(kanbanStatuses).optional(),
    files: z.array(z.object({
        fileName: z.string(),
        fileUrl: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
    })).optional(),
});

const updateTaskSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional().or(z.null()),
    assignedTo: z.string().uuid().optional().or(z.null()),
    dueDate: z.string().refine(d => !isNaN(new Date(d).getTime()), "Invalid due date").optional(),
    priority: z.enum(priorities).optional(),
    type: z.enum(taskTypes).optional(),
    storyPoints: z.number().int().positive().optional().or(z.null()),
    estimatedHours: z.number().positive().optional().or(z.null()),
    actualHours: z.number().positive().optional().or(z.null()),
    labels: z.array(z.string()).optional(),
    sprintId: z.string().uuid().optional().or(z.null()),
    leadId: z.string().uuid().optional().or(z.null()),
});

const updateTaskStatusSchema = z.object({
    status: z.enum(["PENDING", "COMPLETED"]),
});

const updateKanbanStatusSchema = z.object({
    kanbanStatus: z.enum(kanbanStatuses),
    orderIndex: z.number().int().optional(),
});

const addCommentSchema = z.object({
    content: z.string().min(1, "Comment cannot be empty"),
});

// ── Leave ─────────────────────────────────────────────────────────────────────
const applyLeaveSchema = z.object({
    fromDate: z.string().refine(d => !isNaN(new Date(d).getTime()), "Invalid from date"),
    toDate: z.string().refine(d => !isNaN(new Date(d).getTime()), "Invalid to date"),
    reason: z.string().min(1, "Reason is required"),
    approverIds: z.array(z.string().uuid()).min(1, "At least one approver required"),
    leaveType: z.enum(["LEAVE", "WFH", "COMP_OFF"]).optional(),
});

const approveRejectLeaveSchema = z.object({
    comments: z.string().optional(),
});

// ── Sprint ────────────────────────────────────────────────────────────────────
const createSprintSchema = z.object({
    name: z.string().min(1, "Sprint name is required"),
    goal: z.string().optional(),
    startDate: z.string().refine(d => !isNaN(new Date(d).getTime()), "Invalid start date"),
    endDate: z.string().refine(d => !isNaN(new Date(d).getTime()), "Invalid end date"),
});

const updateSprintSchema = z.object({
    name: z.string().min(1).optional(),
    goal: z.string().optional(),
    startDate: z.string().refine(d => !isNaN(new Date(d).getTime()), "Invalid start date").optional(),
    endDate: z.string().refine(d => !isNaN(new Date(d).getTime()), "Invalid end date").optional(),
});

const addTasksToSprintSchema = z.object({
    taskIds: z.array(z.string().uuid()).min(1, "At least one task ID required"),
});

// ── Invoice ───────────────────────────────────────────────────────────────────
const invoiceItemSchema = z.object({
    description: z.string().min(1, "Item description is required"),
    price: z.number().positive("Price must be positive"),
    quantity: z.number().positive().optional(),
    taxRate: z.number().min(0).max(100).optional(),
    taxableValue: z.number().min(0),
    amount: z.number().min(0),
});

const createInvoiceSchema = z.object({
    clientName: z.string().min(1, "Client name is required"),
    clientEmail: z.string().email().optional().or(z.literal("")),
    clientPhone: z.string().optional(),
    clientAddress: z.string().optional(),
    clientGstin: z.string().optional(),
    invoiceType: z.enum(["PROFORMA", "TAX_INVOICE"]).optional(),
    subtotal: z.number().min(0),
    cgst: z.number().min(0).optional(),
    sgst: z.number().min(0).optional(),
    igst: z.number().min(0).optional(),
    total: z.number().min(0),
    dueDate: z.string().optional().or(z.null()),
    notes: z.string().optional(),
    items: z.array(invoiceItemSchema).min(1, "At least one item required"),
});

const addPaymentSchema = z.object({
    amount: z.number().positive("Amount must be positive"),
    type: z.enum(["CREDIT", "DEBIT"]).optional(),
    description: z.string().optional(),
    paymentDate: z.string().optional(),
});

module.exports = {
    loginSchema,
    registerUserSchema,
    updateProfileSchema,
    changePasswordSchema,
    updatePreferencesSchema,
    createLeadSchema,
    updateLeadSchema,
    assignLeadSchema,
    mergeLeadsSchema,
    checkDuplicateSchema,
    bulkUpdateSchema,
    bulkAssignSchema,
    createTaskSchema,
    updateTaskSchema,
    updateTaskStatusSchema,
    updateKanbanStatusSchema,
    addCommentSchema,
    applyLeaveSchema,
    approveRejectLeaveSchema,
    createSprintSchema,
    updateSprintSchema,
    addTasksToSprintSchema,
    createInvoiceSchema,
    addPaymentSchema,
};
