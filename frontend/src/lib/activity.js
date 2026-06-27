// Shared presentation helpers for lead activity / history items. Used by the
// lead detail timeline and the My Day action queue history preview so action
// labels and relative times render consistently everywhere.

export const ACTION_CONFIG = {
    LEAD_CREATED:   { icon: "✦", color: "text-blue-500",   bg: "bg-blue-50 border-blue-100",   label: "Lead created" },
    LEAD_UPDATED:   { icon: "✎", color: "text-gray-500",   bg: "bg-gray-50 border-gray-100",   label: "Lead updated" },
    STATUS_CHANGED: { icon: "⇄", color: "text-indigo-500", bg: "bg-indigo-50 border-indigo-100",label: "Status changed" },
    CALL_MADE:      { icon: "📞", color: "text-green-500",  bg: "bg-green-50 border-green-100", label: "Call made" },
    NOTE_ADDED:     { icon: "📝", color: "text-amber-500",  bg: "bg-amber-50 border-amber-100", label: "Note added" },
    TASK_CREATED:   { icon: "☑", color: "text-teal-500",   bg: "bg-teal-50 border-teal-100",   label: "Task created" },
    TASK_UPDATED:   { icon: "✎", color: "text-teal-600",   bg: "bg-teal-50 border-teal-100",   label: "Task updated" },
    TASK_DELETED:   { icon: "✕", color: "text-red-500",    bg: "bg-red-50 border-red-100",     label: "Task deleted" },
    TASK_COMPLETED: { icon: "✓", color: "text-green-600",  bg: "bg-green-50 border-green-100", label: "Task completed" },
    REMINDER_SET:   { icon: "⏰", color: "text-orange-500", bg: "bg-orange-50 border-orange-100",label: "Reminder set" },
    ASSIGNED:            { icon: "→", color: "text-violet-500",  bg: "bg-violet-50 border-violet-100",  label: "Assigned" },
    LEAD_ASSIGNED:       { icon: "→", color: "text-violet-500",  bg: "bg-violet-50 border-violet-100",  label: "Lead assigned" },
    LEAD_REASSIGNED:     { icon: "⇄", color: "text-violet-600",  bg: "bg-violet-50 border-violet-100",  label: "Lead reassigned" },
    LEAD_MERGED:         { icon: "⊕", color: "text-gray-600",    bg: "bg-gray-50 border-gray-100",      label: "Lead merged" },
    LEAD_BULK_UPDATE:    { icon: "✎", color: "text-gray-500",    bg: "bg-gray-50 border-gray-100",      label: "Bulk update" },
    LEAD_BULK_ASSIGN:    { icon: "→", color: "text-indigo-500",  bg: "bg-indigo-50 border-indigo-100",  label: "Bulk assigned" },
    LEAD_CREATED_VIA_WEBHOOK: { icon: "⚡", color: "text-blue-500", bg: "bg-blue-50 border-blue-100",  label: "Lead via webhook" },
    WEBHOOK_DUPLICATE_HIT:    { icon: "!", color: "text-amber-600", bg: "bg-amber-50 border-amber-100", label: "Duplicate detected" },
    WHATSAPP_SENT:  { icon: "→", color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-100", label: "WhatsApp sent" },
    WHATSAPP_REPLY: { icon: "←", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", label: "WhatsApp reply" },
    EMAIL_SENT:     { icon: "✉", color: "text-blue-500",    bg: "bg-blue-50 border-blue-100",       label: "Email sent" },
    CALL_INITIATED: { icon: "📞", color: "text-green-500",  bg: "bg-green-50 border-green-100",  label: "Call initiated" },
    CALL_COMPLETED: { icon: "📞", color: "text-green-600",  bg: "bg-green-50 border-green-100",  label: "Call completed" },
    DEPARTMENTS_ALLOCATED: { icon: "⊞", color: "text-indigo-500", bg: "bg-indigo-50 border-indigo-100", label: "Departments allocated" },
    CONSULTANT_ASSIGNED:   { icon: "👤", color: "text-violet-500", bg: "bg-violet-50 border-violet-100", label: "Consultant assigned" },
    REASSIGNMENT_REQUESTED:{ icon: "⇄", color: "text-violet-400", bg: "bg-violet-50 border-violet-100", label: "Reassignment requested" },
    REASSIGNMENT_REJECTED: { icon: "✕", color: "text-red-500",    bg: "bg-red-50 border-red-100",      label: "Reassignment rejected" },
    STAGE_UPDATED:         { icon: "⇄", color: "text-indigo-500", bg: "bg-indigo-50 border-indigo-100", label: "Stage updated" },
    DEPARTMENT_REMOVED:    { icon: "⊟", color: "text-red-400",    bg: "bg-red-50 border-red-100",      label: "Department removed" },
    DEAL_CREATED:          { icon: "💵", color: "text-green-500",  bg: "bg-green-50 border-green-100",   label: "Deal created" },
    DEAL_STAGE_CHANGED:    { icon: "⇄", color: "text-green-600",  bg: "bg-green-50 border-green-100",   label: "Deal stage updated" },
    DEAL_UPDATED:          { icon: "✎", color: "text-green-500",  bg: "bg-green-50 border-green-100",   label: "Deal updated" },
    INVOICE_CREATED:       { icon: "🧾", color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-100", label: "Invoice created" },
    INVOICE_UPDATED:       { icon: "✎", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", label: "Invoice updated" },
    PAYMENT_RECEIVED:      { icon: "💰", color: "text-emerald-700", bg: "bg-emerald-100 border-emerald-200", label: "Payment received" },
    RESUME_UPLOADED:       { icon: "📎", color: "text-indigo-500", bg: "bg-indigo-50 border-indigo-100", label: "Resume uploaded" },
    DEFAULT:        { icon: "·", color: "text-gray-400",   bg: "bg-gray-50 border-gray-100",   label: "Activity" },
};

export const actionConfig = (action) => ACTION_CONFIG[action] ?? ACTION_CONFIG.DEFAULT;
export const actionLabel = (action) => actionConfig(action).label;

// Compact relative-time label ("just now", "5m ago", "3d ago", or a date).
export const relTime = (date) => {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
