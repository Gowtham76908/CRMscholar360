import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { LeadDetailSkeleton } from "../components/ui/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import Avatar from "../components/Avatar";
import {
    ArrowLeft, Phone, Mail, MessageSquare, Plus, CheckCircle, Circle,
    Calendar, User, Loader2, PhoneCall, FileText, Activity,
    ChevronDown, ChevronRight, Play, Clock, AlertCircle, ChevronLeft,
    Zap, Users, Save, SlidersHorizontal, Eye, MousePointerClick, GitBranch,
    TrendingUp, IndianRupee, Pencil, Paperclip, ArrowRight,
    PanelRightOpen, PanelRightClose, Archive, MoreVertical, RefreshCw, RotateCcw, Copy, Trash2,
    Globe, Download, CheckCheck, Check,
} from "lucide-react";
import { Modal } from "../components/Modal";
import SlidePanel from "../components/SlidePanel";
import { getScoreLabel } from "../utils/leadScore";
import { fileUrl } from "../utils/fileUrl";
import AddTaskForm from "../components/AddTaskForm";
import AddLeadForm from "../components/AddLeadForm";
import LeadSidebar from "../components/lead/LeadSidebar";
import LeadDepartmentsPanel from "../components/lead/LeadDepartmentsPanel";
import StudentJourneyPanel from "../components/lead/StudentJourneyPanel";
import LeadUniversitiesPanel from "../components/lead/LeadUniversitiesPanel";
import LeadDepositPanel from "../components/lead/LeadDepositPanel";
import LeadVisaPanel from "../components/lead/LeadVisaPanel";
import SmartSuggestions from "../components/lead/SmartSuggestions";
import WhatsAppModal from "../components/lead/WhatsAppModal";
import PostCallPanel from "../components/lead/PostCallPanel";
import ComposeEmailModal from "../components/ComposeEmailModal";
import { useLeadPresence } from "../hooks/useLeadPresence";
import { useLeadDepartments, useWorkflows } from "../hooks/useDepartments";
import { ACTION_CONFIG, relTime } from "../lib/activity";

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_LABEL = {
    FACEBOOK: "Facebook", INSTAGRAM: "Instagram", GMAIL: "Gmail",
    WEBSITE: "Website", PHONE_CALL: "Phone Call", LINKEDIN: "LinkedIn",
};

const FILTER_PILLS = [
    { id: "all",         label: "All", icon: SlidersHorizontal },
    { id: "note",        label: "Notes", icon: Pencil },
    { id: "call",        label: "Calls", icon: PhoneCall },
    { id: "whatsapp",    label: "WhatsApp", icon: MessageSquare },
    { id: "email",       label: "Email", icon: Mail },
    { id: "activity",    label: "Activity", icon: Activity },
    { id: "task",        label: "Tasks", icon: CheckCircle },
    { id: "attachment",  label: "Attachments", icon: Paperclip },
    { id: "document",    label: "Documents", icon: FileText },
    { id: "visa",        label: "Visa Details", icon: Globe },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dayLabel = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const fmtDuration = (secs) => {
    if (!secs) return "—";
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
};

const initials = (name = "") =>
    name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

// ─── Sub-components ───────────────────────────────────────────────────────────

// Legacy audit-log status pills (historical STATUS_CHANGED entries only — the live
// workflow stage now lives per-department in LeadDepartmentsPanel).
const STATUS_PILL = {
    NEW:       "bg-blue-100 text-blue-700",
    CONTACTED: "bg-indigo-100 text-indigo-700",
    FOLLOW_UP: "bg-amber-100 text-amber-700",
    CONVERTED: "bg-green-100 text-green-700",
    LOST:      "bg-red-100 text-red-700",
};

function TimelineItem({ item }) {
    const cfg = ACTION_CONFIG[item.action] ?? ACTION_CONFIG.DEFAULT;
    const meta = item.metadata ?? {};

    const renderDetail = () => {
        if (item.action === "RESUME_UPLOADED" && meta.resumeUrl) {
            const ext = meta.resumeName ? meta.resumeName.split('.').pop().toUpperCase() : 'PDF';
            const isPdf = ext === 'PDF';
            const isDoc = ['DOC', 'DOCX'].includes(ext);
            const badgeBg = isPdf ? 'bg-red-50 border border-red-100 text-red-600' : isDoc ? 'bg-blue-50 border border-blue-100 text-blue-600' : 'bg-indigo-50 border border-indigo-100 text-indigo-600';
            const iconColor = isPdf ? 'text-red-500' : isDoc ? 'text-blue-500' : 'text-indigo-500';

            return (
                <div className="mt-2 bg-gradient-to-br from-indigo-50/40 to-white hover:to-indigo-50/10 border border-indigo-100/80 hover:border-indigo-300 rounded-2xl p-4 flex items-center justify-between gap-4 max-w-lg shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`h-11 w-11 rounded-xl bg-white border flex items-center justify-center shadow-inner flex-shrink-0 relative group-hover:scale-105 transition-transform duration-200 ${badgeBg}`}>
                            <FileText className={`h-5 w-5 ${iconColor}`} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate" title={meta.resumeName || "Attachment"}>
                                {meta.resumeName || "Attachment"}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider ${badgeBg}`}>
                                    {ext}
                                </span>
                                <span className="text-[10px] font-medium text-gray-400">
                                    by {meta.uploadedBy || "User"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <a
                        href={fileUrl(meta.resumeUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md hover:shadow-indigo-100/50 transition-all flex-shrink-0 cursor-pointer"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Download
                    </a>
                </div>
            );
        }
        if (item.action === "LEAD_CREATED") {
            const isImport = meta.source === "FILE_IMPORT";
            const isFb = meta.source === "FACEBOOK_REALTIME";
            return (
                <p className="mt-1 text-xs text-gray-500">
                    {isImport ? "Created via file import" : isFb ? "Created via Facebook Realtime Webhook" : meta.source ? `Created via ${meta.source.toLowerCase()}` : "Created"}
                    {meta.category && ` · Category: ${meta.category}`}
                    {meta.score && ` · Score: ${meta.score}`}
                </p>
            );
        }
        if (item.action === "LEAD_UPDATED" && (meta.message || meta.changes)) {
            return (
                <div className="mt-1.5 bg-slate-50 border border-slate-100 rounded-xl p-3 max-w-md shadow-3xs space-y-1.5">
                    {meta.message && <p className="text-xs font-bold text-slate-800">{meta.message}</p>}
                    {meta.changes && (
                        <div className="text-[10px] text-slate-550 space-y-1 font-semibold">
                            {meta.changes.financial_proof_docs !== undefined && (
                                <div><span className="text-slate-400">Financial Proof:</span> <span className="text-slate-700">{meta.changes.financial_proof_docs || "None"}</span></div>
                            )}
                            {meta.changes.cas_form_number !== undefined && (
                                <div><span className="text-slate-400">CAS/I-20 Form Number:</span> <span className="text-slate-700">{meta.changes.cas_form_number || "None"}</span></div>
                            )}
                            {meta.changes.visa_appointment_date !== undefined && (
                                <div><span className="text-slate-400">Visa Appointment Date:</span> <span className="text-slate-700">{meta.changes.visa_appointment_date ? new Date(meta.changes.visa_appointment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "None"}</span></div>
                            )}
                            {meta.changes.visa_manager_approved !== undefined && (
                                <div><span className="text-slate-400">Manager Approved:</span> <span className="text-slate-700">{meta.changes.visa_manager_approved ? "Yes" : "No"}</span></div>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        if (item.action === "DEPARTMENTS_ALLOCATED" && meta.departments) {
            return (
                <p className="mt-1 text-xs text-gray-600">
                    Allocated departments: <span className="font-semibold">{meta.departments.join(", ")}</span>
                </p>
            );
        }
        if (item.action === "CONSULTANT_ASSIGNED" && meta.department) {
            const name = meta.consultantName || "Consultant";
            return (
                <p className="mt-1 text-xs text-gray-600">
                    {meta.selfClaim ? "Self-claimed" : "Assigned"} <span className="font-semibold">{name}</span> to department <span className="font-semibold">{meta.department}</span>
                    {meta.viaRequest && <span className="text-gray-400"> (via request approval)</span>}
                </p>
            );
        }
        if (item.action === "REASSIGNMENT_REQUESTED" && meta.department) {
            const from = meta.fromUserName || "Unassigned";
            const to = meta.toUserName || "Consultant";
            return (
                <p className="mt-1 text-xs text-gray-600">
                    Requested reassignment in <span className="font-semibold">{meta.department}</span> from <span className="font-semibold">{from}</span> to <span className="font-semibold">{to}</span>
                </p>
            );
        }
        if (item.action === "REASSIGNMENT_REJECTED" && meta.department) {
            const to = meta.toUserName || "Consultant";
            return (
                <p className="mt-1 text-xs text-gray-600">
                    Reassignment request to <span className="font-semibold">{to}</span> in <span className="font-semibold">{meta.department}</span> was rejected
                </p>
            );
        }
        if (item.action === "STAGE_UPDATED" && meta.to) {
            return (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {meta.department}
                    </span>
                    {meta.from && (
                        <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            {meta.from.replace("_", " ")}
                        </span>
                    )}
                    {meta.from && <span className="text-xs text-gray-400">→</span>}
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {meta.to.replace("_", " ")}
                    </span>
                </div>
            );
        }
        if (item.action === "DEPARTMENT_REMOVED" && meta.department) {
            return (
                <p className="mt-1 text-xs text-gray-600">
                    Removed department: <span className="font-semibold">{meta.department}</span>
                </p>
            );
        }
        if (item.action === "DEAL_CREATED" && meta.title) {
            return (
                <div className="mt-1.5 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5 space-y-0.5">
                    <p className="text-xs font-semibold text-green-800">Deal: "{meta.title}"</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white border border-green-200 text-green-700">
                            {meta.currency || "INR"} {meta.amount ?? 0}
                        </span>
                        {meta.stage && (
                            <span className="text-[10px] font-semibold text-green-600">
                                Stage: {meta.stage}
                            </span>
                        )}
                    </div>
                </div>
            );
        }
        if (item.action === "DEAL_STAGE_CHANGED" && meta.title) {
            return (
                <div className="mt-1.5 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5 space-y-0.5">
                    <p className="text-xs font-semibold text-green-800">Deal: "{meta.title}"</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {meta.from && (
                            <span className="text-[10px] font-semibold text-gray-500 bg-white border px-1.5 py-0.5 rounded">
                                {meta.from}
                            </span>
                        )}
                        {meta.from && <span className="text-xs text-gray-400">→</span>}
                        <span className="text-[10px] font-bold text-green-700 bg-white border border-green-200 px-1.5 py-0.5 rounded">
                            {meta.to}
                        </span>
                    </div>
                </div>
            );
        }
        if (item.action === "DEAL_UPDATED" && meta.title) {
            const keys = Object.keys(meta.changes ?? {}).filter(k => k !== "updatedAt");
            return (
                <div className="mt-1.5 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-xs font-semibold text-green-800">Deal updated: "{meta.title}"</p>
                    {keys.length > 0 && (
                        <p className="text-[10px] text-green-600">Changed: {keys.join(", ")}</p>
                    )}
                </div>
            );
        }
        if (item.action === "INVOICE_CREATED" && meta.invoiceNumber) {
            return (
                <div className="mt-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 space-y-0.5">
                    <p className="text-xs font-semibold text-emerald-800">Invoice: {meta.invoiceNumber}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700">
                            INR {meta.amount ?? 0}
                        </span>
                        {meta.dealTitle && (
                            <span className="text-[10px] text-emerald-600">
                                Deal: {meta.dealTitle}
                            </span>
                        )}
                    </div>
                </div>
            );
        }
        if (item.action === "INVOICE_UPDATED" && meta.invoiceNumber) {
            const keys = Object.keys(meta.changes ?? {}).filter(k => k !== "updatedAt");
            return (
                <div className="mt-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-xs font-semibold text-emerald-800">Invoice updated: {meta.invoiceNumber}</p>
                    {keys.length > 0 && (
                        <p className="text-[10px] text-emerald-600">Changed: {keys.join(", ")}</p>
                    )}
                </div>
            );
        }
        if (item.action === "PAYMENT_RECEIVED" && meta.invoiceNumber) {
            return (
                <div className="mt-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 space-y-0.5">
                    <p className="text-xs font-semibold text-emerald-800">Payment received for invoice {meta.invoiceNumber}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
                            Received: INR {meta.amount ?? 0}
                        </span>
                        <span className="text-[10px] font-medium text-emerald-700 bg-white border border-emerald-200 px-1.5 py-0.5 rounded-full">
                            Status: {meta.status} (Paid: INR {meta.totalPaid ?? 0})
                        </span>
                    </div>
                </div>
            );
        }
        if (item.action === "TASK_COMPLETED" && meta.title) {
            return (
                <div className="mt-1.5 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-xs font-semibold text-green-700">"{meta.title}" was completed</p>
                </div>
            );
        }
        if (item.action === "STATUS_CHANGED" && meta.newStatus) {
            return (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {meta.prevStatus && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_PILL[meta.prevStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {meta.prevStatus?.replace("_", " ")}
                        </span>
                    )}
                    <span className="text-[10px] text-gray-400">→</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_PILL[meta.newStatus] ?? "bg-gray-100 text-gray-600"}`}>
                        {meta.newStatus?.replace("_", " ")}
                    </span>
                </div>
            );
        }
        if (["CALL_MADE", "CALL_INITIATED", "CALL_COMPLETED"].includes(item.action)) {
            const outcomeColor = {
                CONNECTED: "bg-green-100 text-green-700",
                NO_ANSWER: "bg-amber-100 text-amber-700",
                VOICEMAIL: "bg-blue-100 text-blue-700",
                WRONG_NUM: "bg-red-100 text-red-700",
            }[meta.outcome] ?? "bg-gray-100 text-gray-600";
            return (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {meta.duration && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />{fmtDuration(meta.duration)}
                        </span>
                    )}
                    {meta.outcome && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${outcomeColor}`}>
                            {meta.outcome?.replace("_", " ")}
                        </span>
                    )}
                </div>
            );
        }
        if (["WHATSAPP_SENT", "WHATSAPP_REPLY"].includes(item.action) && meta.message) {
            return (
                <p className="mt-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 line-clamp-2">
                    {meta.message}
                </p>
            );
        }
        if (item._type === "email") {
            return (
                <div className="mt-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 space-y-1.5">
                    <p className="text-xs font-semibold text-blue-800">To: {item.toEmail}</p>
                    <p className="text-xs font-medium text-gray-700">{item.subject}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{item.body}</p>
                    <div className="flex items-center gap-3 pt-0.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            item.openedAt ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}>
                            <Eye className="h-2.5 w-2.5" />
                            {item.openedAt
                                ? `Opened ${relTime(item.openedAt)}`
                                : "Not opened"}
                        </span>
                        {item.clickCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                <MousePointerClick className="h-2.5 w-2.5" />
                                {item.clickCount} click{item.clickCount !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                </div>
            );
        }
        if (item.action === "NOTE_ADDED" && meta.content) {
            return (
                <p className="mt-1.5 text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 line-clamp-2">
                    {meta.content}
                </p>
            );
        }
        if (item.action === "REMINDER_SET" && meta.remindAt) {
            return (
                <div className="mt-1.5 flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                    <div className="h-6 w-6 rounded-md bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                        {meta.message && <p className="text-xs font-semibold text-amber-900">{meta.message}</p>}
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">
                            Due {new Date(meta.remindAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                    </div>
                </div>
            );
        }
        if (["LEAD_ASSIGNED", "ASSIGNED"].includes(item.action) && meta.assignedTo) {
            return (
                <p className="mt-1 text-xs text-gray-600">
                    Assigned to <span className="font-semibold">{meta.assignedToName || meta.assignedTo}</span>
                </p>
            );
        }
        if (item.action === "LEAD_REASSIGNED" && meta.newEmployeeName) {
            return (
                <p className="mt-1 text-xs text-gray-600">
                    {meta.previousEmployeeId ? "Reassigned" : "Assigned"} to <span className="font-semibold">{meta.newEmployeeName}</span>
                    {meta.reason && <span className="text-gray-400"> · {meta.reason}</span>}
                </p>
            );
        }
        if (item.action === "LEAD_UPDATED") {
            return (
                <p className="mt-1 text-xs text-gray-500">Updated the contact information</p>
            );
        }
        if (item.action === "TASK_CREATED" && meta.title) {
            return (
                <div className="mt-1.5 bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1.5 space-y-0.5">
                    <p className="text-xs font-semibold text-teal-800">"{meta.title}"</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        {meta.priority && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white border border-teal-200 text-teal-700">{meta.priority}</span>}
                        {meta.dueDate && <span className="text-[10px] text-teal-600">Due {new Date(meta.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                        {meta.assignedToName && <span className="text-[10px] text-teal-600">Assigned to: {meta.assignedToName}</span>}
                    </div>
                </div>
            );
        }
        if (item.action === "TASK_UPDATED" && meta.taskTitle) {
            const changes = meta.changes ?? {};
            const changeKeys = Object.keys(changes).filter(k => k !== "assignedTo");
            return (
                <div className="mt-1.5 bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1.5 space-y-0.5">
                    <p className="text-xs font-semibold text-teal-800">"{meta.taskTitle}"</p>
                    {changeKeys.length > 0 && (
                        <p className="text-[10px] text-teal-600">Changed: {changeKeys.join(", ")}</p>
                    )}
                    {changes.assignedTo && meta.assignedToName && (
                        <p className="text-[10px] text-teal-600">Assigned to: {meta.assignedToName}</p>
                    )}
                </div>
            );
        }
        if (item.action === "TASK_DELETED" && meta.title) {
            return (
                <div className="mt-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-xs font-semibold text-red-700">"{meta.title}" was deleted</p>
                    {meta.deletedBy && <p className="text-[10px] text-red-500">by {meta.deletedBy.toLowerCase()}</p>}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0 mt-0.5">
                {!item.user ? (
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs ${cfg.bg} ${cfg.color}`}>
                        {cfg.icon}
                    </div>
                ) : (
                    <>
                        <Avatar user={item.user} size="sm" />
                        <span className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border border-white flex items-center justify-center text-[9px] shadow-sm ${cfg.bg} ${cfg.color}`}>
                            {cfg.icon}
                        </span>
                    </>
                )}
            </div>
            <div className="flex-1 min-w-0 pb-4 border-b border-gray-100 last:border-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{cfg.label}</p>
                        {item.user?.name && (
                            <p className="text-xs text-gray-500">by {item.user.name}</p>
                        )}
                        {renderDetail()}
                    </div>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{relTime(item.createdAt)}</span>
                </div>
            </div>
        </div>
    );
}

function CallItem({ call, leadId }) {
    const [expanded, setExpanded] = useState(false);
    const queryClient = useQueryClient();
    const statusColor = {
        COMPLETED: "bg-green-100 text-green-700",
        MISSED: "bg-red-100 text-red-700",
        INITIATED: "bg-blue-100 text-blue-700",
    }[call.callStatus] ?? "bg-gray-100 text-gray-600";

    const transcribe = useMutation({
        mutationFn: () => api.post(`/calls/transcribe/${call.id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead-calls", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
        },
    });

    return (
        <div className="border border-gray-200/70 rounded-2xl overflow-hidden">
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                        <PhoneCall className="h-3.5 w-3.5 text-green-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{call.callType ?? "Outbound"}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusColor}`}>
                                {call.callStatus ?? "—"}
                            </span>
                            {call.isTranscribed && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">AI Analysed</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {fmtDuration(call.duration)}
                            </span>
                            <span>{relTime(call.createdAt)}</span>
                        </div>
                    </div>
                </div>
                <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>

            {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50 space-y-3">
                    {call.recordingUrl && (
                        <div className="flex items-center gap-3 flex-wrap">
                            <a href={fileUrl(call.recordingUrl)} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                                <Play className="h-3 w-3" /> Play Recording
                            </a>
                            {!call.isTranscribed && (
                                <button
                                    onClick={() => transcribe.mutate()}
                                    disabled={transcribe.isPending}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-50"
                                >
                                    {transcribe.isPending
                                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Analysing…</>
                                        : <><FileText className="h-3 w-3" /> Transcribe & Analyse</>}
                                </button>
                            )}
                        </div>
                    )}
                    {transcribe.isError && (
                        <p className="text-xs text-red-500">{transcribe.error?.response?.data?.error?.message || transcribe.error?.response?.data?.message || "Transcription failed"}</p>
                    )}
                    {call.summary && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">AI Summary</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{call.summary}</p>
                        </div>
                    )}
                    {call.feedback && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Feedback</p>
                            <p className="text-xs text-gray-600 leading-relaxed">{call.feedback}</p>
                        </div>
                    )}
                    {call.conclusion && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Conclusion</p>
                            <p className="text-xs text-gray-600 leading-relaxed">{call.conclusion}</p>
                        </div>
                    )}
                    {call.plainText && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Transcript</p>
                            <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{call.plainText}</p>
                        </div>
                    )}
                    {call.sentiment && (
                        <div className="flex flex-wrap gap-3 text-xs">
                            <span className="text-gray-500">Sentiment: <strong className="text-gray-800">{call.sentiment}</strong></span>
                            {call.tone && <span className="text-gray-500">Tone: <strong className="text-gray-800">{call.tone}</strong></span>}
                            {call.urgency && <span className="text-gray-500">Urgency: <strong className="text-gray-800">{call.urgency}</strong></span>}
                            {call.emotion && <span className="text-gray-500">Emotion: <strong className="text-gray-800">{call.emotion}</strong></span>}
                            {call.callCategory && <span className="text-gray-500">Category: <strong className="text-gray-800">{call.callCategory}</strong></span>}
                        </div>
                    )}
                    {!call.recordingUrl && !call.summary && !call.plainText && (
                        <p className="text-xs text-gray-400">No additional details available.</p>
                    )}
                </div>
            )}
        </div>
    );
}

function TaskRow({ task, leadId, compact = false }) {
    const queryClient = useQueryClient();
    const toggle = useMutation({
        mutationFn: ({ id, status }) => api.patch(`/tasks/${id}/status`, { status }),
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ["lead-tasks", leadId] });
            const prev = queryClient.getQueryData(["lead-tasks", leadId]);
            queryClient.setQueryData(["lead-tasks", leadId], (old) => {
                if (!old?.data) return old;
                return { ...old, data: old.data.map(t => t.id === id ? { ...t, status } : t) };
            });
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(["lead-tasks", leadId], ctx.prev);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
        },
    });

    const overdue = task.status !== "COMPLETED" && new Date(task.dueDate) < new Date();

    if (compact) {
        return (
            <div className="flex items-center gap-2 py-1">
                <button
                    onClick={() => toggle.mutate({ id: task.id, status: task.status === "PENDING" ? "COMPLETED" : "PENDING" })}
                    disabled={toggle.isPending}
                    className={`flex-shrink-0 transition-transform hover:scale-110 disabled:opacity-50
                        ${task.status === "COMPLETED" ? "text-green-500" : "text-gray-300 hover:text-indigo-400"}`}
                >
                    {toggle.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                        : task.status === "COMPLETED"
                            ? <CheckCircle className="h-4 w-4" />
                            : <Circle className="h-4 w-4" />}
                </button>
                <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${task.status === "COMPLETED" ? "line-through text-gray-400" : overdue ? "text-red-600" : "text-gray-800"}`}>
                        {task.title}
                    </p>
                    <p className={`text-[10px] ${overdue ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                        {overdue ? "Overdue · " : ""}
                        {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 p-3 bg-white border border-gray-200/70 rounded-2xl hover:shadow-sm transition-all group">
            <button
                onClick={() => toggle.mutate({ id: task.id, status: task.status === "PENDING" ? "COMPLETED" : "PENDING" })}
                disabled={toggle.isPending}
                className={`flex-shrink-0 transition-transform hover:scale-110 active:scale-95 disabled:opacity-50
                    ${task.status === "COMPLETED" ? "text-green-500" : "text-gray-300 group-hover:text-indigo-400"}`}
            >
                {toggle.isPending
                    ? <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                    : task.status === "COMPLETED"
                        ? <CheckCircle className="h-5 w-5" />
                        : <Circle className="h-5 w-5" />}
            </button>
            <div className="flex-1 min-w-0">
                <Link to={`/tasks/${task.id}`}
                    className={`text-sm font-semibold truncate block hover:text-indigo-600 transition-colors
                        ${task.status === "COMPLETED" ? "line-through text-gray-400" : "text-gray-900"}`}>
                    {task.title}
                </Link>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500">
                    <span className={`flex items-center gap-1 ${overdue ? "text-red-500 font-semibold" : ""}`}>
                        <Calendar className="h-3 w-3" />
                        {overdue ? "Overdue · " : ""}
                        {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    {task.assignedTo && (
                        <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.assignedTo.name}
                        </span>
                    )}
                </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0
                ${task.status === "COMPLETED" ? "bg-green-50 text-green-700" : overdue ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                {task.status === "COMPLETED" ? "Done" : overdue ? "Overdue" : "Pending"}
            </span>
        </div>
    );
}

// ─── All Fields Panel (system + custom) ──────────────────────────────────────

const SYSTEM_KEYS = new Set([
    "name", "phone", "email", "company", "source",
    "enquiryType", "biodata", "jobTitle", "linkedinUrl", "category",
]);

const ENUM_LABELS = {
    FACEBOOK: "Facebook", INSTAGRAM: "Instagram", GMAIL: "Gmail",
    WEBSITE: "Website", PHONE_CALL: "Phone Call", LINKEDIN: "LinkedIn",
    PRODUCT: "Product", WHITE_LABEL: "White Label", LMS: "LMS", SERVICES: "Services",
};

function CustomFieldsPanel({ leadId, lead }) {
    const qc = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [values, setValues] = useState({});
    const [isOpen, setIsOpen] = useState(false); // Closed by default

    const { data: allDefs = [] } = useQuery({
        queryKey: ["lead-fields"],
        queryFn: () => api.get("/custom-fields").then(r => r.data),
        staleTime: 5 * 60_000,
    });

    // Only show visible fields; skip the ones already prominently shown in the header (name, status, source)
    const HEADER_KEYS = new Set(["name", "source", "status"]);
    const visibleFields = allDefs.filter(d => d.visible && !HEADER_KEYS.has(d.fieldKey));

    const getLeadValue = (def) => {
        if (SYSTEM_KEYS.has(def.fieldKey)) return lead[def.fieldKey] ?? "";
        return lead.customFields?.[def.fieldKey] ?? "";
    };

    const handleEdit = () => {
        const init = {};
        visibleFields.forEach(def => { init[def.fieldKey] = getLeadValue(def); });
        setValues(init);
        setEditing(true);
    };

    const save = useMutation({
        mutationFn: async () => {
            const systemPatch = {};
            const customPatch = {};
            visibleFields.forEach(def => {
                const v = values[def.fieldKey];
                if (SYSTEM_KEYS.has(def.fieldKey)) systemPatch[def.fieldKey] = v ?? null;
                else customPatch[def.fieldKey] = v ?? null;
            });
            const ops = [];
            if (Object.keys(systemPatch).length) ops.push(api.patch(`/leads/${leadId}`, systemPatch));
            if (Object.keys(customPatch).length) ops.push(api.patch(`/leads/${leadId}/custom-fields`, { fields: customPatch }));
            await Promise.all(ops);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["lead", leadId] });
            qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
            setEditing(false);
        },
        onError: (err) => toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to save fields"),
    });

    if (visibleFields.length === 0) return null;

    return (
        <div className="bg-white border border-gray-200/70 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-0 cursor-pointer select-none" onClick={() => !editing && setIsOpen(!isOpen)}>
                <div className="flex items-center gap-1.5 py-1">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400" />
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Lead Fields</h3>
                </div>
                {!editing ? (
                    isOpen && <button onClick={(e) => { e.stopPropagation(); handleEdit(); }} className="text-xs text-indigo-500 hover:underline font-semibold">Edit</button>
                ) : (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        <button
                            onClick={() => save.mutate()}
                            disabled={save.isPending}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded-lg disabled:opacity-50"
                        >
                            {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Save
                        </button>
                    </div>
                )}
            </div>
            {isOpen && (
                <div className="space-y-2.5 mt-3 pt-3 border-t border-gray-100">
                    {visibleFields.map(def => {
                        const displayVal = editing ? (values[def.fieldKey] ?? "") : getLeadValue(def);
                        return (
                            <div key={def.id}>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{def.name}</p>
                                {!editing ? (
                                    <p className="text-sm text-gray-800 break-words">
                                        {displayVal !== "" && displayVal !== null && displayVal !== undefined
                                            ? (ENUM_LABELS[displayVal] ?? String(displayVal))
                                            : <span className="text-gray-300">—</span>}
                                    </p>
                                ) : def.type === "SELECT" ? (
                                    <select
                                        className="w-full h-8 px-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        value={values[def.fieldKey] ?? ""}
                                        onChange={e => setValues(v => ({ ...v, [def.fieldKey]: e.target.value }))}
                                    >
                                        <option value="">— Select —</option>
                                        {(def.options || []).map(o => <option key={o} value={o}>{ENUM_LABELS[o] ?? o}</option>)}
                                    </select>
                                ) : def.type === "TEXTAREA" ? (
                                    <textarea
                                        rows={3}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
                                        value={values[def.fieldKey] ?? ""}
                                        onChange={e => setValues(v => ({ ...v, [def.fieldKey]: e.target.value }))}
                                    />
                                ) : def.type === "CHECKBOX" ? (
                                    <input
                                        type="checkbox"
                                        checked={!!values[def.fieldKey]}
                                        onChange={e => setValues(v => ({ ...v, [def.fieldKey]: e.target.checked }))}
                                        className="accent-indigo-600 h-4 w-4"
                                    />
                                ) : (
                                    <input
                                        type={def.type === "NUMBER" ? "number" : def.type === "DATE" ? "date" : "text"}
                                        className="w-full h-8 px-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        value={values[def.fieldKey] ?? ""}
                                        onChange={e => setValues(v => ({ ...v, [def.fieldKey]: e.target.value }))}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}


// ─── Deal Stage helpers ───────────────────────────────────────────────────────

const DEAL_STAGE_STYLE = {
    NEW:         "bg-blue-100 text-blue-800",
    NEGOTIATION: "bg-orange-100 text-orange-800",
    WON:         "bg-green-100 text-green-800",
    LOST:        "bg-red-100 text-red-800",
};

const CURRENCY_SYMBOL = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
function fmtAmt(amount, currency = "INR") {
    return `${CURRENCY_SYMBOL[currency] ?? currency}${Number(amount).toLocaleString("en-IN")}`;
}

// ─── ConvertToDealModal ───────────────────────────────────────────────────────

function ConvertToDealModal({ leadId, leadName, onClose, onSuccess }) {
    const [form, setForm] = useState({ title: "", amount: "", stage: "NEW", currency: "INR", notes: "", assignedEmployeeId: "" });
    const [error, setError] = useState("");

    const { data: teamMembers = [] } = useQuery({
        queryKey: ["team-members-light"],
        queryFn: () => api.get("/team").then(r => r.data?.users ?? r.data ?? []),
        staleTime: 300_000,
    });

    const mutation = useMutation({
        mutationFn: (data) => api.post("/deals", data),
        onSuccess,
        onError: (err) => setError(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to create deal"),
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const cls = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none";

    const submit = (e) => {
        e.preventDefault();
        if (!form.title.trim()) { setError("Deal title is required"); return; }
        setError("");
        mutation.mutate({
            leadId,
            title: form.title.trim(),
            amount: parseFloat(form.amount) || 0,
            stage: form.stage,
            currency: form.currency,
            notes: form.notes.trim() || undefined,
            assignedEmployeeId: form.assignedEmployeeId || undefined,
        });
    };

    return (
        <Modal isOpen onClose={onClose} title="Convert To Deal">
            <p className="text-sm text-gray-500 mb-4">
                Creating a deal for <span className="font-semibold text-gray-800">{leadName}</span>
            </p>
            <form onSubmit={submit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deal Title <span className="text-red-500">*</span></label>
                    <input className={cls} placeholder="e.g. Website Development" value={form.title} onChange={e => set("title", e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                        <input type="number" min="0" step="0.01" className={cls} placeholder="0" value={form.amount} onChange={e => set("amount", e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                        <select className={cls} value={form.currency} onChange={e => set("currency", e.target.value)}>
                            <option value="INR">INR ₹</option>
                            <option value="USD">USD $</option>
                            <option value="EUR">EUR €</option>
                            <option value="GBP">GBP £</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                    <select className={cls} value={form.assignedEmployeeId} onChange={e => set("assignedEmployeeId", e.target.value)}>
                        <option value="">Unassigned (me)</option>
                        {teamMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                    <select className={cls} value={form.stage} onChange={e => set("stage", e.target.value)}>
                        <option value="NEW">New</option>
                        <option value="NEGOTIATION">Negotiation</option>
                        <option value="WON">Won</option>
                        <option value="LOST">Lost</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea className={`${cls} resize-none`} rows={3} placeholder="Optional notes…" value={form.notes} onChange={e => set("notes", e.target.value)} />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-3 pt-1">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={mutation.isPending} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-violet-600 border border-transparent rounded-lg hover:bg-violet-700 disabled:opacity-60">
                        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                        Create Deal
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ─── DealsPanel ───────────────────────────────────────────────────────────────

function DealsPanel({ deals, loading, onAdd }) {
    const [isOpen, setIsOpen] = useState(false);
    const totalValue = deals.reduce((s, d) => s + d.amount, 0);
    const wonDeals = deals.filter(d => d.stage === "WON");

    return (
        <div className="bg-white border border-gray-200/70 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-0 cursor-pointer select-none" onClick={() => setIsOpen(!isOpen)}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 py-1">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
                    Deals {deals.length > 0 && <span className="text-violet-600">({deals.length})</span>}
                </h3>
                {isOpen && (
                    <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="text-violet-600 hover:text-violet-800 transition-colors" title="New deal">
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    {loading ? (
                        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
                    ) : deals.length === 0 ? (
                        <div className="text-center py-3">
                            <p className="text-xs text-gray-400 mb-2">No deals yet</p>
                            <button onClick={onAdd} className="text-xs text-violet-600 hover:underline font-medium">
                                + Convert to deal
                            </button>
                        </div>
                    ) : (
                        <>
                            {deals.length > 0 && (
                                <div className="flex gap-3 mb-3 p-2 bg-violet-50 rounded-lg">
                                    <div className="flex-1">
                                        <p className="text-[10px] text-gray-500">Pipeline</p>
                                        <p className="text-sm font-black text-violet-700">{fmtAmt(totalValue)}</p>
                                    </div>
                                    {wonDeals.length > 0 && (
                                        <div className="flex-1">
                                            <p className="text-[10px] text-gray-500">Won</p>
                                            <p className="text-sm font-black text-green-700">{fmtAmt(wonDeals.reduce((s, d) => s + d.amount, 0))}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="space-y-2">
                                {deals.map(deal => (
                                    <div key={deal.id} className="flex items-start justify-between gap-2 py-1 border-b border-gray-100 last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{deal.title}</p>
                                            <p className="text-[11px] text-gray-500">{fmtAmt(deal.amount, deal.currency)}</p>
                                        </div>
                                        <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${DEAL_STAGE_STYLE[deal.stage] ?? "bg-gray-100 text-gray-600"}`}>
                                            {deal.stage}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <Link to="/deals" className="block text-center text-[11px] text-violet-600 hover:underline mt-2">
                                View all deals →
                            </Link>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

    const lastPath = localStorage.getItem("last-leads-path");
    const validPaths = ["/leads", "/department-board", "/my-day", "/dashboard", "/tasks", "/inbox", "/deals"];
    const isValid = lastPath && validPaths.some(p => lastPath.startsWith(p));
    const backUrl = isValid ? lastPath : "/leads?view=kanban";

    const getBackLabel = (path) => {
        if (!path) return "Leads";
        if (path.startsWith("/my-day")) return "My Day";
        if (path.startsWith("/dashboard")) return "Dashboard";
        if (path.startsWith("/department-board")) return "Department Board";
        if (path.startsWith("/tasks")) return "Tasks";
        if (path.startsWith("/inbox")) return "Inbox";
        if (path.startsWith("/deals")) return "Deals";
        return "Leads";
    };
    const backLabel = getBackLabel(backUrl);

    const [noteText, setNoteText] = useState("");
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showEditLead, setShowEditLead] = useState(false);
    const [showWaModal, setShowWaModal] = useState(false);
    const [showPostCall, setShowPostCall] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showDealModal, setShowDealModal] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [departmentsOpen, setDepartmentsOpen] = useState(false);
    const [teamActivityOpen, setTeamActivityOpen] = useState(false);
    const [tasksOpen, setTasksOpen] = useState(false);
    const [automationsOpen, setAutomationsOpen] = useState(false);
    const [timelineFilter, setTimelineFilter] = useState("all");
    const [activityTab, setActivityTab] = useState("timeline");
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const noteRef = useRef(null);
    const fileInputRef = useRef(null);
    const dropdownButtonRef = useRef(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

    const [showReminder, setShowReminder] = useState(false);
    const [reminderAt, setReminderAt] = useState("");
    const [addToGcal, setAddToGcal] = useState(false);
    const [showStageDropdown, setShowStageDropdown] = useState(false);

    // ─── Queries (all parallel) ───────────────────────────────────────────────
    const { data: lead, isLoading: leadLoading, error: leadError } = useQuery({
        queryKey: ["lead", id],
        queryFn: () => api.get(`/leads/${id}`).then(r => r.data),
    });

    const { data: activities = [] } = useQuery({
        queryKey: ["lead-activities", id],
        queryFn: () => api.get(`/leads/${id}/activities`).then(r => r.data?.data ?? r.data),
        enabled: !!lead,
    });

    const { data: notes = [] } = useQuery({
        queryKey: ["lead-notes", id],
        queryFn: () => api.get(`/leads/${id}/notes`).then(r => r.data),
        enabled: !!lead,
    });

    const { data: callsData } = useQuery({
        queryKey: ["lead-calls", id],
        queryFn: () => api.get(`/calls/${id}`).then(r => r.data),
        enabled: !!lead,
    });

    const { data: tasksData, isLoading: tasksLoading } = useQuery({
        queryKey: ["lead-tasks", id],
        queryFn: () => api.get("/tasks", { params: { leadId: id, limit: 100 } }).then(r => r.data),
        enabled: !!lead,
    });

    const { data: gcalStatus } = useQuery({
        queryKey: ["gcal-status"],
        queryFn: () => api.get("/google/calendar/status").then(r => r.data),
        staleTime: 60_000,
    });
    const gcalConnected = gcalStatus?.connected;

    const { data: leadNav } = useQuery({
        queryKey: ["leads-nav"],
        queryFn: () => api.get("/leads", { params: { limit: 500, fields: "id" } }).then(r => {
            const list = r.data.data || r.data;
            return Array.isArray(list) ? list.map(l => l.id) : [];
        }),
        staleTime: 60_000,
    });

    const { data: waMessages = [] } = useQuery({
        queryKey: ["lead-whatsapp", id],
        queryFn: () => api.get(`/whatsapp/${id}/messages`).then(r => r.data),
        enabled: !!lead,
    });

    const { data: emailLogs = [] } = useQuery({
        queryKey: ["lead-emails", id],
        queryFn: () => api.get(`/leads/${id}/emails`).then(r => r.data),
        enabled: !!lead,
    });

    const { data: leadDeals = [], isLoading: dealsLoading } = useQuery({
        queryKey: ["lead-deals", id],
        queryFn: () => api.get("/deals", { params: { leadId: id, limit: 50 } }).then(r => r.data.data ?? []),
        enabled: !!lead,
    });

    const { data: automationsRaw = [] } = useQuery({
        queryKey: ["automations-active"],
        queryFn: () => api.get("/automations").then(r => r.data.data || r.data || []),
        staleTime: 60_000,
        retry: false,
        throwOnError: false,
        enabled: !!lead,
    });

    const coViewers = useLeadPresence(id);

    // Department hooks for stage progression
    const { data: assignments = [] } = useLeadDepartments(id);
    const { stageLabel, getStages, hasWorkflow } = useWorkflows();

    // Get primary (first) department for stage actions
    const primaryDept = assignments.length > 0 ? assignments[0] : null;
    const canUpdateStage = primaryDept && hasWorkflow(primaryDept.department);
    
    // Calculate next and previous stages
    const stages = primaryDept ? getStages(primaryDept.department) : [];
    const currentIndex = stages.findIndex((s) => s.code === primaryDept?.stage);
    const nextStage = currentIndex !== -1 && currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
    const prevStage = currentIndex > 0 ? stages[currentIndex - 1] : null;
    
    // Check if user can move to previous (Manager or Director only)
    const canMoveToPrevious = (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && prevStage;
    
    // Check current stage for special actions
    const isArchived = primaryDept?.stage === "ARCHIVE";
    const isFutureProspect = primaryDept?.stage === "FUTURE_PROSPECT";

    const stageMut = useMutation({
        mutationFn: ({ leadDepartmentId, newStage }) => 
            api.patch(`/lead-departments/${leadDepartmentId}/stage`, { stage: newStage }).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead-departments", id] });
            queryClient.invalidateQueries({ queryKey: ["lead", id] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
        }
    });

    const handleMoveToNextStage = () => {
        if (!primaryDept || !nextStage) return;
        setShowStageDropdown(false);
        stageMut.mutate(
            { leadDepartmentId: primaryDept.id, newStage: nextStage.code },
            {
                onSuccess: () => {
                    toast.success(`Moved to ${nextStage.label}`);
                },
                onError: (err) => {
                    toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to update stage");
                }
            }
        );
    };

    const handleMoveToPreviousStage = () => {
        if (!primaryDept || !prevStage) return;
        setShowStageDropdown(false);
        stageMut.mutate(
            { leadDepartmentId: primaryDept.id, newStage: prevStage.code },
            {
                onSuccess: () => {
                    toast.success(`Moved back to ${prevStage.label}`);
                },
                onError: (err) => {
                    toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to update stage");
                }
            }
        );
    };

    const handleArchive = () => {
        if (!primaryDept) return;
        setShowStageDropdown(false);
        stageMut.mutate(
            { leadDepartmentId: primaryDept.id, newStage: "ARCHIVE" },
            {
                onSuccess: () => {
                    toast.success("Lead archived");
                },
                onError: (err) => {
                    toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to archive lead");
                }
            }
        );
    };

    const handleFutureProspect = () => {
        if (!primaryDept) return;
        setShowStageDropdown(false);
        stageMut.mutate(
            { leadDepartmentId: primaryDept.id, newStage: "FUTURE_PROSPECT" },
            {
                onSuccess: () => {
                    toast.success("Moved to Future Prospect");
                },
                onError: (err) => {
                    toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to move to future prospect");
                }
            }
        );
    };

    const handleUnarchive = () => {
        if (!primaryDept) return;
        setShowStageDropdown(false);
        stageMut.mutate(
            { leadDepartmentId: primaryDept.id, newStage: "ENQUIRY" },
            {
                onSuccess: () => {
                    toast.success("Lead unarchived and moved to Enquiry");
                },
                onError: (err) => {
                    toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to unarchive lead");
                }
            }
        );
    };

    const handleMoveToEnquiry = () => {
        if (!primaryDept) return;
        setShowStageDropdown(false);
        stageMut.mutate(
            { leadDepartmentId: primaryDept.id, newStage: "ENQUIRY" },
            {
                onSuccess: () => {
                    toast.success("Moved to Enquiry");
                },
                onError: (err) => {
                    toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to move to enquiry");
                }
            }
        );
    };

    // Calculate dropdown position when it opens
    useEffect(() => {
        if (showStageDropdown && dropdownButtonRef.current) {
            const rect = dropdownButtonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
            });

            // Close dropdown on scroll so it doesn't float detached
            const handleScroll = () => setShowStageDropdown(false);
            window.addEventListener("scroll", handleScroll, true);
            return () => window.removeEventListener("scroll", handleScroll, true);
        }
    }, [showStageDropdown]);

    const calls = Array.isArray(callsData) ? callsData : (callsData?.data ?? []);
    const tasks = tasksData?.data ?? [];
    const activeAutomations = Array.isArray(automationsRaw) ? automationsRaw.filter(a => a.active) : [];
    const navIdx    = leadNav ? leadNav.indexOf(id) : -1;
    const prevLeadId = navIdx > 0 ? leadNav[navIdx - 1] : null;
    const nextLeadId = navIdx >= 0 && navIdx < (leadNav?.length ?? 0) - 1 ? leadNav[navIdx + 1] : null;

    // Team activity = activities done by someone other than the current user
    const teamActivity = useMemo(() =>
        activities.filter(a => a.user?.id && a.user.id !== user?.id).slice(0, 6),
        [activities, user]
    );

    // ─── Mutations ────────────────────────────────────────────────────────────
    const addNote = useMutation({
        mutationFn: (content) => api.post(`/leads/${id}/notes`, { content }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead-notes", id] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
            setNoteText("");
        },
    });

    const handleNoteSubmit = (e) => {
        e.preventDefault();
        if (showReminder && reminderAt) {
            addReminder.mutate({ leadId: id, message: noteText.trim() || "Reminder", remindAt: reminderAt });
            return;
        }
        if (!noteText.trim()) return;
        addNote.mutate(noteText.trim());
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";

        if (file.size > 10 * 1024 * 1024) {
            toast.error("File size exceeds 10MB limit");
            return;
        }

        const formData = new FormData();
        formData.append("resume", file);

        setUploadingFile(true);
        try {
            await api.post(`/upload/resume/${id}`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            toast.success("Resume uploaded successfully!");
            queryClient.invalidateQueries({ queryKey: ["lead", id] });
            queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
        } catch (error) {
            console.error("Failed to upload resume:", error);
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || "Failed to upload resume";
            toast.error(errMsg);
        } finally {
            setUploadingFile(false);
        }
    };

    const addReminder = useMutation({
        mutationFn: (data) => api.post("/reminders", data),
        onSuccess: async (res) => {
            queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
            if (addToGcal && gcalConnected) {
                try {
                    const reminderId = res.data?.id;
                    await api.post("/google/calendar/events", {
                        summary: noteText.trim() || "CRM Reminder",
                        description: `Lead: ${lead?.name || id}`,
                        startTime: reminderAt,
                        reminderId,
                        leadId: id,
                    });
                    toast.success("Reminder set & added to Google Calendar");
                } catch {
                    toast.success("Reminder set (Google Calendar sync failed)");
                }
            } else {
                toast.success("Reminder set");
            }
            setNoteText("");
            setReminderAt("");
            setShowReminder(false);
            setAddToGcal(false);
        },
        onError: () => {
            toast.error("Failed to set reminder");
        }
    });

    // ─── Timeline: merge + filter ─────────────────────────────────────────────
    const timelineGroups = useMemo(() => {
        const allItems = [
            ...activities.map(a => ({ ...a, _type: "activity", _date: new Date(a.createdAt) })),
            ...notes.map(n => ({ ...n, _type: "note", action: "NOTE_ADDED", _date: new Date(n.createdAt) })),
            ...calls.map(c => ({ ...c, _type: "call", action: "CALL_MADE", _date: new Date(c.createdAt) })),
            ...waMessages.map(w => ({ ...w, _type: "whatsapp", action: w.direction === "INBOUND" ? "WHATSAPP_REPLY" : "WHATSAPP_SENT", _date: new Date(w.createdAt) })),
            ...emailLogs.map(e => ({ ...e, _type: "email", action: "EMAIL_SENT", _date: new Date(e.createdAt) })),
        ].sort((a, b) => b._date - a._date);

        const isTaskAction = (i) => i._type === "activity" && i.action?.startsWith("TASK_");
        const isAttachment = (i) => i.action === "RESUME_UPLOADED" && i.metadata?.resumeUrl;
        const filtered = timelineFilter === "all"        ? allItems
            : timelineFilter === "task"       ? allItems.filter(i => isTaskAction(i))
            : timelineFilter === "attachment" ? allItems.filter(i => isAttachment(i))
            : timelineFilter === "activity"   ? allItems.filter(i => i._type === "activity" && !isTaskAction(i))
            : allItems.filter(i => i._type === timelineFilter);

        const now = Date.now();
        const MS_7D = 7 * 86_400_000;
        const MS_30D = 30 * 86_400_000;

        const groupKey = (item) => {
            const age = now - item._date.getTime();
            if (age < MS_7D) return { key: dayLabel(item._date), recent: true };
            if (age < MS_30D) return { key: "Earlier this month", recent: false };
            return {
                key: item._date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
                recent: false,
            };
        };

        const groups = new Map();
        filtered.forEach(item => {
            const { key, recent } = groupKey(item);
            if (!groups.has(key)) groups.set(key, { items: [], recent });
            groups.get(key).items.push(item);
        });
        return [...groups.entries()].map(([key, { items, recent }]) => ({ key, items, recent }));
    }, [activities, notes, calls, waMessages, emailLogs, timelineFilter]);

    // Seed expanded state when groups change: auto-expand recent groups
    const prevGroupKeysRef = useRef(null);
    useMemo(() => {
        const keys = timelineGroups.map(g => g.key).join("|");
        if (keys === prevGroupKeysRef.current) return;
        prevGroupKeysRef.current = keys;
        setExpandedGroups(new Set(timelineGroups.filter(g => g.recent).map(g => g.key)));
    }, [timelineGroups]);

    // ─── Detail sections shown as tabs inside the Activity card ───────────────
    // Always expose the detail tabs so they're discoverable and can be filled in,
    // even before any data exists for this lead.
    const activityTabs = [
        { id: "timeline", label: "Timeline" },
        { id: "universities", label: "Universities" },
        { id: "deposit", label: "Deposit" },
        { id: "visa", label: "Visa" },
    ];
    const effectiveTab = activityTabs.some(t => t.id === activityTab) ? activityTab : "timeline";

    // ─── Initiating call via click2call ──────────────────────────────────────
    const initiateCall = useMutation({
        mutationFn: () => api.post("/calls/click2call", {
            leadId: id,
            customerNumber: lead?.phone,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead-calls", id] });
            setTimeout(() => setShowPostCall(true), 3000);
        },
        onError: (err) => {
            const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err.message || "Failed to initiate call";
            toast.error(`Call failed: ${msg}`);
        },
    });

    // ─── Suggestion CTA handler ───────────────────────────────────────────────
    const handleSuggestionAction = (ctaAction, currentLead) => {
        switch (ctaAction) {
            case "call":
                initiateCall.mutate();
                break;
            case "whatsapp":
                if (currentLead?.phone) setShowWaModal(true);
                break;
            case "email":
                if (currentLead?.email) window.open(`mailto:${currentLead.email}`, "_blank");
                break;
            case "note":
                setTimeout(() => noteRef.current?.focus(), 100);
                break;
            case "tasks":
                setShowTaskModal(true);
                break;
            default:
                break;
        }
    };

    // ─── Loading / error states ───────────────────────────────────────────────
    if (leadLoading) return <LeadDetailSkeleton />;

    if (leadError || !lead) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <p className="text-gray-600 font-medium">Lead not found</p>
                <Link to={backUrl} className="text-sm text-indigo-600 hover:underline">← Back to {backLabel}</Link>
            </div>
        );
    }

    const openTasks = tasks.filter(t => t.status !== "COMPLETED");

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            {/* Back nav + prev/next */}
            <div className="flex items-center justify-between">
                <Link to={backUrl} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium">
                    <ArrowLeft className="h-4 w-4" /> {backLabel}
                </Link>
                <div className="flex items-center gap-3">
                    {leadNav && leadNav.length > 0 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => prevLeadId && navigate(`/leads/${prevLeadId}`)}
                                disabled={!prevLeadId}
                                title="Previous lead"
                                className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-xs text-gray-400 font-medium px-1">
                                {navIdx + 1} / {leadNav.length}
                            </span>
                            <button
                                onClick={() => nextLeadId && navigate(`/leads/${nextLeadId}`)}
                                disabled={!nextLeadId}
                                title="Next lead"
                                className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setShowDetails(v => !v)}
                        title={showDetails ? "Hide lead details" : "Show lead details"}
                        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                            showDetails
                                ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                                : "border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
                        }`}
                    >
                        {showDetails ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                        Details
                    </button>
                </div>
            </div>

            {/* ── Lead Hero Header ──────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden">
                {coViewers.length > 0 && (
                    <div className="flex items-center gap-2 px-5 py-2 bg-indigo-50/50 border-b border-indigo-100">
                        <div className="flex -space-x-1.5">
                            {coViewers.slice(0, 4).map((v) => (
                                <div
                                    key={v.userId}
                                    title={`${v.userName} is also viewing`}
                                    style={{ backgroundColor: v.avatarColor }}
                                    className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ring-2 ring-white flex-shrink-0"
                                >
                                    {v.userName?.slice(0, 1).toUpperCase() ?? "?"}
                                </div>
                            ))}
                        </div>
                        <span className="text-xs text-indigo-700 font-medium">
                            {coViewers.length === 1
                                ? `${coViewers[0].userName} is also viewing`
                                : `${coViewers.length} teammates viewing`}
                        </span>
                    </div>
                )}

                {/* Compact identity + contact — condensed to two lines */}
                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-indigo-50">
                            <span className="text-base font-black text-white">{initials(lead.name)}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                            {/* Line 1 — name, id, stage, category */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl font-black text-gray-900 truncate leading-tight">{lead.name}</h1>
                                {lead.leadId && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 select-all">
                                        <span>{lead.leadId}</span>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(lead.leadId);
                                                toast.success("Lead ID copied!");
                                            }}
                                            title="Copy Lead ID"
                                            className="hover:text-indigo-900 transition-colors cursor-pointer"
                                        >
                                            <Copy className="h-3 w-3" />
                                        </button>
                                    </span>
                                )}
                                {primaryDept?.stage && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                                        primaryDept.stage === "ARCHIVE"
                                            ? "bg-gray-100 text-gray-700 border border-gray-200"
                                            : primaryDept.stage === "FUTURE_PROSPECT"
                                            ? "bg-blue-100 text-blue-700 border border-blue-200"
                                            : primaryDept.stage === "COMMISSION_INVOICING"
                                            ? "bg-green-100 text-green-700 border border-green-200"
                                            : primaryDept.stage === "ENQUIRY"
                                            ? "bg-amber-100 text-amber-700 border border-amber-200"
                                            : "bg-indigo-100 text-indigo-700 border border-indigo-200"
                                    }`}>
                                        {stageLabel(primaryDept.department, primaryDept.stage)}
                                    </span>
                                )}
                                {lead.category && (
                                    <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 uppercase tracking-wide">
                                        {lead.category}
                                    </span>
                                )}
                                {lead.score != null && (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-br from-purple-50 to-indigo-50 text-purple-700 border border-purple-100">
                                        <span className="font-black">{lead.score}</span>
                                        <span className="text-purple-400">·</span>
                                        {getScoreLabel(lead.score)}
                                    </span>
                                )}
                            </div>

                            {/* Line 2 — phone · email · company · services · source · enquiry */}
                            <div className="flex items-center gap-y-1.5 flex-wrap mt-2 text-xs text-gray-500 min-w-0
                                            [&>*]:inline-flex [&>*]:items-center
                                            [&>*:not(:last-child)]:after:content-[''] [&>*:not(:last-child)]:after:mx-4 [&>*:not(:last-child)]:after:h-3.5 [&>*:not(:last-child)]:after:w-px [&>*:not(:last-child)]:after:bg-gray-200">
                                {lead.phone && (
                                    <a href={`tel:${lead.phone}`} className="gap-1.5 font-semibold text-gray-700 hover:text-green-700 transition-colors">
                                        <Phone className="h-3.5 w-3.5 text-green-500" /> {lead.phone}
                                    </a>
                                )}
                                {lead.email && (
                                    <a href={`mailto:${lead.email}`} className="gap-1.5 font-medium hover:text-blue-700 transition-colors max-w-[22rem]">
                                        <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" /> <span className="truncate">{lead.email}</span>
                                    </a>
                                )}
                                {(lead.company || lead.jobTitle) && (
                                    <span className="gap-1.5 min-w-0">
                                        {lead.company && <span className="font-semibold text-gray-700 truncate">{lead.company}</span>}
                                        {lead.company && lead.jobTitle && <span className="text-gray-300">·</span>}
                                        {lead.jobTitle && <span className="truncate">{lead.jobTitle}</span>}
                                    </span>
                                )}
                                {lead.leadDepartments?.length > 0 && (
                                    <span className="gap-1.5">
                                        <Users className="h-3.5 w-3.5 text-indigo-500" /> {lead.leadDepartments.length} dept{lead.leadDepartments.length === 1 ? "" : "s"}
                                    </span>
                                )}
                                <span className="gap-1.5">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source</span>
                                    <span className="font-semibold text-gray-700">{SOURCE_LABEL[lead.source] ?? lead.source}</span>
                                </span>
                                {lead.enquiryType && (
                                    <span className="gap-1.5">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</span>
                                        <span className="font-semibold text-gray-700">{lead.enquiryType}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action bar — primary on left, secondary on right */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => initiateCall.mutate()}
                                disabled={initiateCall.isPending || !lead.phone}
                                title={!lead.phone ? "No phone number on record" : "Initiate call"}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-bold rounded-lg shadow-sm transition-all disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
                            >
                                {initiateCall.isPending
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Phone className="h-4 w-4" />}
                                Call
                            </button>

                            <button
                                onClick={() => lead.phone ? setShowWaModal(true) : toast.warning("No phone number on record")}
                                title={!lead.whatsappOptIn ? "Lead has not opted in to WhatsApp" : "Send WhatsApp message"}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all relative cursor-pointer"
                            >
                                <MessageSquare className="h-4 w-4" />
                                WhatsApp
                                {!lead.whatsappOptIn && (
                                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 border border-white" title="Not opted in" />
                                )}
                            </button>

                            <button
                                onClick={() => setShowEmailModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                                <Mail className="h-4 w-4" /> Email
                            </button>

                            <button
                                onClick={() => setTimeout(() => noteRef.current?.focus(), 100)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                                <FileText className="h-4 w-4" /> Note
                            </button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {isAdmin && (
                                <button
                                    onClick={() => setShowEditLead(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 text-gray-700 text-sm font-semibold rounded-lg transition-all cursor-pointer"
                                >
                                    <Pencil className="h-3.5 w-3.5" /> Edit Lead
                                </button>
                            )}
                            {isAdmin && (
                                <button
                                    onClick={() => setShowTaskModal(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 text-gray-700 text-sm font-semibold rounded-lg transition-all cursor-pointer"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Task
                                </button>
                            )}
                            <button
                                onClick={() => navigate(`/invoices?leadId=${id}&invoiceForLead=1`)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-all cursor-pointer shadow-sm"
                            >
                                <IndianRupee className="h-3.5 w-3.5" /> Invoice
                            </button>
                            <Link
                                to={`/leads/${id}/journey`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 text-gray-700 text-sm font-semibold rounded-lg transition-all"
                            >
                                <GitBranch className="h-3.5 w-3.5" /> Journey
                            </Link>
                            {canUpdateStage && (
                                <div className="relative">
                                    <button
                                        ref={dropdownButtonRef}
                                        onClick={() => setShowStageDropdown(!showStageDropdown)}
                                        disabled={stageMut.isPending}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
                                    >
                                        {stageMut.isPending ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        )}
                                        Stage Actions
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                    {showStageDropdown && createPortal(
                                        <>
                                            <div 
                                                className="fixed inset-0 z-40" 
                                                onClick={() => setShowStageDropdown(false)}
                                            />
                                            <div 
                                                className="fixed w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-50"
                                                style={{
                                                    top: `${dropdownPosition.top}px`,
                                                    right: `${dropdownPosition.right}px`,
                                                }}
                                            >
                                                {/* Show Unarchive if currently archived */}
                                                {isArchived ? (
                                                    <button
                                                        onClick={handleUnarchive}
                                                        disabled={stageMut.isPending}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                                                    >
                                                        <RotateCcw className="h-4 w-4 text-green-600" />
                                                        <span className="font-semibold text-green-700">Unarchive (Move to Enquiry)</span>
                                                    </button>
                                                ) : isFutureProspect ? (
                                                    /* Show Move to Enquiry if in future prospect */
                                                    <button
                                                        onClick={handleMoveToEnquiry}
                                                        disabled={stageMut.isPending}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                                                    >
                                                        <ArrowRight className="h-4 w-4 text-indigo-600" />
                                                        <span>Move to <span className="font-semibold text-indigo-700">Enquiry</span></span>
                                                    </button>
                                                ) : (
                                                    /* Normal workflow options */
                                                    <>
                                                        {nextStage && (
                                                            <button
                                                                onClick={handleMoveToNextStage}
                                                                disabled={stageMut.isPending}
                                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-100 rounded-t-lg"
                                                            >
                                                                <ArrowRight className="h-4 w-4 text-indigo-600" />
                                                                <span>Move to <span className="font-semibold text-indigo-700">{nextStage.label}</span></span>
                                                            </button>
                                                        )}
                                                        {canMoveToPrevious && (
                                                            <button
                                                                onClick={handleMoveToPreviousStage}
                                                                disabled={stageMut.isPending}
                                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-100"
                                                            >
                                                                <ArrowLeft className="h-4 w-4 text-amber-600" />
                                                                <span>Move to <span className="font-semibold text-amber-700">{prevStage.label}</span></span>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={handleArchive}
                                                            disabled={stageMut.isPending}
                                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-100"
                                                        >
                                                            <Archive className="h-4 w-4 text-gray-600" />
                                                            <span>Archive</span>
                                                        </button>
                                                        <button
                                                            onClick={handleFutureProspect}
                                                            disabled={stageMut.isPending}
                                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-b-lg"
                                                        >
                                                            <RefreshCw className="h-4 w-4 text-blue-600" />
                                                            <span>Future Prospect</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>,
                                        document.body
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Main grid — context panel toggles open/closed (default closed) ── */}
            <div className={`grid grid-cols-1 gap-6 items-start ${showDetails ? "lg:grid-cols-3" : ""}`}>

                {/* ── LEFT: suggestions + timeline (full width when details closed) ── */}
                <div className={`min-w-0 space-y-5 ${showDetails ? "lg:col-span-2" : ""}`}>

                    {/* Smart suggestions — surfaced, no longer behind a tab */}
                    <SmartSuggestions leadId={id} lead={lead} onAction={handleSuggestionAction} />

                    {/* Timeline card */}
                    <div className="bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden">
                        {/* Activity header */}
                        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-gray-400" />
                                <h2 className="text-sm font-bold text-gray-800">Activity</h2>
                                {activities.length > 0 && (
                                    <span className="text-xs text-gray-400 font-medium">
                                        · Last update {relTime(activities[0]?.createdAt)}
                                    </span>
                                )}
                            </div>
                            {calls.length > 0 && (
                                <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                                    <Phone className="h-3 w-3" /> Last call {relTime(calls[0]?.createdAt)}
                                </span>
                            )}
                        </div>

                        {/* Section tabs: Timeline + detail sections (only when they have data) */}
                        {activityTabs.length > 1 && (
                            <div className="px-4 pt-3 flex items-center gap-1.5 border-b border-gray-100">
                                {activityTabs.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setActivityTab(t.id)}
                                        className={`text-xs font-bold px-3 py-2 -mb-px border-b-2 transition-colors ${
                                            effectiveTab === t.id
                                                ? "border-indigo-600 text-indigo-700"
                                                : "border-transparent text-gray-400 hover:text-gray-700"
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {effectiveTab === "universities" ? (
                            <LeadUniversitiesPanel leadId={id} lead={lead} embedded />
                        ) : effectiveTab === "deposit" ? (
                            <LeadDepositPanel leadId={id} lead={lead} embedded />
                        ) : effectiveTab === "visa" ? (
                            <LeadVisaPanel leadId={id} lead={lead} embedded />
                        ) : (
                        <>
                        {/* Inline note/reminder compose (unified) */}
                        <div className="border-b border-gray-100 overflow-hidden">
                            <div className="p-4">
                                <form onSubmit={handleNoteSubmit} className="space-y-3">
                                    <div className="flex gap-2 items-end">
                                        <textarea
                                            ref={noteRef}
                                            value={noteText}
                                            onChange={e => setNoteText(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleNoteSubmit(e);
                                                }
                                            }}
                                            placeholder={showReminder
                                                ? "Reminder message… (optional)"
                                                : "Add a note… (Enter to save, Shift+Enter for new line)"}
                                            rows={2}
                                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400"
                                        />
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept=".pdf,.doc,.docx,.txt"
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingFile}
                                            className="flex-shrink-0 p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-lg transition-all cursor-pointer"
                                            title="Upload Resume"
                                        >
                                            {uploadingFile ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                            ) : (
                                                <Paperclip className="h-4 w-4" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowReminder(v => {
                                                    if (v) setReminderAt("");
                                                    return !v;
                                                });
                                            }}
                                            className={`flex-shrink-0 p-2 border rounded-lg transition-all cursor-pointer ${
                                                showReminder
                                                    ? "text-indigo-600 bg-indigo-50 border-indigo-300"
                                                    : "text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border-gray-200"
                                            }`}
                                            title={showReminder ? "Remove reminder" : "Set a reminder (optional)"}
                                        >
                                            <Calendar className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={
                                                (addNote.isPending || addReminder.isPending) ||
                                                (showReminder ? !reminderAt : !noteText.trim())
                                            }
                                            className="flex-shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-all cursor-pointer"
                                        >
                                            {(addNote.isPending || addReminder.isPending)
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : "Save"}
                                        </button>
                                    </div>

                                    {/* Optional reminder / calendar — toggled by the calendar icon above */}
                                    {showReminder && (
                                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-end">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 whitespace-nowrap">
                                                        <Calendar className="h-3.5 w-3.5 text-indigo-500" /> Remind me at:
                                                    </span>
                                                    <input
                                                        type="datetime-local"
                                                        value={reminderAt}
                                                        onChange={e => setReminderAt(e.target.value)}
                                                        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white cursor-pointer"
                                                    />
                                                </div>
                                                {gcalConnected && (
                                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={addToGcal}
                                                            onChange={e => setAddToGcal(e.target.checked)}
                                                            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                                                        />
                                                        <span className="flex items-center gap-1 text-xs text-gray-600 font-semibold">
                                                            <Calendar className="h-3.5 w-3.5 text-blue-500" /> Add to GCal
                                                        </span>
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>

                        {/* Filter pills */}
                        <div className="px-4 py-3 bg-slate-50/60 border-b border-gray-100/80 overflow-x-auto scrollbar-none flex items-center gap-2 -mx-px">
                            <div className="flex gap-2 px-1">
                                {FILTER_PILLS.map(f => {
                                    const IconComponent = f.icon;
                                    const isActive = timelineFilter === f.id;
                                    return (
                                        <button
                                            key={f.id}
                                            onClick={() => setTimelineFilter(f.id)}
                                            className={`text-xs font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all duration-200 shrink-0 transform active:scale-95 ${
                                                isActive
                                                    ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm shadow-indigo-100 border border-indigo-600"
                                                    : "bg-white border border-gray-200/80 text-gray-500 hover:text-gray-850 hover:bg-gray-50/80 hover:border-gray-300"
                                            }`}
                                        >
                                            {IconComponent && <IconComponent className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-gray-400"}`} />}
                                            {f.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Timeline content */}
                        <div className="p-5 max-h-[550px] overflow-y-auto">
                            {timelineFilter === "visa" ? (
                                <VisaDetailsSection
                                    lead={lead}
                                    onChanged={() => {
                                        queryClient.invalidateQueries({ queryKey: ["lead", id] });
                                        queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
                                    }}
                                />
                            ) : timelineFilter === "document" ? (
                                <DocumentSection 
                                    lead={lead} 
                                    onChanged={() => {
                                        queryClient.invalidateQueries({ queryKey: ["lead", id] });
                                        queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
                                    }} 
                                />
                            ) : timelineGroups.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-8">No activity yet.</p>
                            ) : (
                                <div className="space-y-5">
                                    {timelineGroups.map(({ key: day, items }) => {
                                        const isOpen = true;
                                        return (
                                        <div key={day}>
                                            <div className="w-full text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <span>{day}</span>
                                                <span className="flex-1 h-px bg-gray-100" />
                                            </div>
                                            {isOpen && <div className="space-y-1">
                                                {items.map((item) => (
                                                    item._type === "call" ? (
                                                        <CallItem key={item.id} call={item} leadId={id} />
                                                    ) : item._type === "note" ? (
                                                        <div key={item.id} className="flex items-start gap-3">
                                                            <div className="relative flex-shrink-0 mt-0.5">
                                                                {!item.user ? (
                                                                    <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-xs">
                                                                        📝
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <Avatar user={item.user} size="sm" />
                                                                        <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border border-white flex items-center justify-center text-[9px] shadow-sm bg-amber-50 text-amber-505">
                                                                            📝
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 pb-3 border-b border-gray-100 last:border-0">
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-semibold text-gray-800 mb-0.5">Note</p>
                                                                        {item.user?.name && (
                                                                            <p className="text-xs text-gray-500 mb-1">by {item.user.name}</p>
                                                                        )}
                                                                        <p className="text-sm text-gray-600 line-clamp-3">{item.content}</p>
                                                                    </div>
                                                                    <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">{relTime(item.createdAt)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : item._type === "whatsapp" ? (
                                                        <div key={item.id} className="flex items-start gap-3">
                                                            <div className="relative flex-shrink-0 mt-0.5">
                                                                {item.direction === "INBOUND" ? (
                                                                    <div className="w-8 h-8 rounded-full bg-emerald-500 border border-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                                                        {initials(lead?.name) || "C"}
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <Avatar user={item.user} size="sm" />
                                                                        <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border border-white flex items-center justify-center text-[9px] shadow-sm bg-emerald-500 text-white font-bold">
                                                                            wa
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 pb-4 border-b border-gray-100 last:border-0">
                                                                {/* Header */}
                                                                <div className="flex items-center justify-between mb-1.5 gap-2">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                                                            <MessageSquare className="h-3 w-3 text-emerald-500 shrink-0" />
                                                                            {item.direction === "INBOUND" ? "Inbound WhatsApp" : "WhatsApp Outbound"}
                                                                        </span>
                                                                        {item.direction === "OUTBOUND" && item.user?.name && (
                                                                            <span className="text-xs text-gray-400">by {item.user.name}</span>
                                                                        )}
                                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider border ${
                                                                            item.status === "READ"      ? "bg-blue-50 border-blue-100 text-blue-600" :
                                                                            item.status === "DELIVERED" ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                                                                            item.status === "REPLIED"   ? "bg-violet-50 border-violet-100 text-violet-600" :
                                                                            item.status === "FAILED"    ? "bg-red-50 border-red-100 text-red-600" :
                                                                            "bg-gray-50 border-gray-100 text-gray-500"
                                                                        }`}>
                                                                            {item.status}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[11px] text-gray-400 flex-shrink-0 whitespace-nowrap">{relTime(item.createdAt)}</span>
                                                                </div>

                                                                {/* Message Bubble Card */}
                                                                <div className={`inline-block max-w-[85%] text-sm px-3.5 py-2.5 rounded-2xl border shadow-3xs ${
                                                                    item.direction === "INBOUND"
                                                                        ? "bg-slate-50 border-gray-200 text-slate-800 rounded-tl-none"
                                                                        : "bg-emerald-50/70 border-emerald-150/80 text-emerald-950 rounded-tr-none"
                                                                }`}>
                                                                    {/* Quoted Message (reply to) */}
                                                                    {item.replyText && item.direction === "OUTBOUND" && (
                                                                        <div className="mb-2 bg-emerald-100/40 border-l-4 border-emerald-500 px-2 py-1 rounded text-[11px] text-emerald-800">
                                                                            <p className="font-bold text-[9px] uppercase tracking-wider text-emerald-600 mb-0.5">Inbound message</p>
                                                                            <p className="line-clamp-2 italic">"{item.replyText}"</p>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    <p className="whitespace-pre-wrap leading-relaxed">{item.messageBody}</p>
                                                                    
                                                                    {/* Read receipt / status checkmarks for outbound */}
                                                                    {item.direction === "OUTBOUND" && (
                                                                        <div className="flex justify-end items-center mt-1 -mr-1">
                                                                            {item.status === "READ" ? (
                                                                                <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                                                                            ) : item.status === "DELIVERED" || item.status === "REPLIED" ? (
                                                                                <CheckCheck className="h-3.5 w-3.5 text-gray-400" />
                                                                            ) : item.status === "FAILED" ? (
                                                                                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                                                            ) : (
                                                                                <Check className="h-3.5 w-3.5 text-gray-400" />
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <TimelineItem key={item.id} item={item} />
                                                    )
                                                ))}
                                            </div>}
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        </>
                        )}
                    </div>

                </div>

                {/* ── RIGHT: lead context (collapsible, sticky on desktop) ─────── */}
                {showDetails && (
                <div className="lg:col-span-1 w-full space-y-5 lg:sticky lg:top-6 self-start pb-16">

                    <LeadSidebar
                        lead={lead}
                        leadId={id}
                        hideContact
                        calls={calls}
                        notes={notes}
                        tasks={tasks}
                    />

                    {lead.leadDepartments?.some(ld => ld.department === "SALES") && (
                        <StudentJourneyPanel
                            lead={lead}
                            onChanged={() => {
                                queryClient.invalidateQueries({ queryKey: ["lead", id] });
                                queryClient.invalidateQueries({ queryKey: ["lead-departments", id] });
                                queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
                                queryClient.invalidateQueries({ queryKey: ["lead-notes", id] });
                            }}
                        />
                    )}

                    {/* ── Departments (multi-department services) ──────────────── */}
                    <div className="bg-white border border-gray-200/70 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-0 cursor-pointer select-none" onClick={() => setDepartmentsOpen(!departmentsOpen)}>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 py-1">
                                {departmentsOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                <GitBranch className="h-3.5 w-3.5 text-gray-400" />
                                Departments
                            </h3>
                        </div>
                        {departmentsOpen && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <LeadDepartmentsPanel leadId={id} />
                            </div>
                        )}
                    </div>

                    {/* ── Custom Fields ───────────────────────────────────────── */}
                    <CustomFieldsPanel leadId={id} lead={lead} />

                    {/* ── Deals ───────────────────────────────────────────────── */}
                    <DealsPanel deals={leadDeals} loading={dealsLoading} onAdd={() => setShowDealModal(true)} />

                    {/* ── Related Team Activity ────────────────────────────────── */}
                    {teamActivity.length > 0 && (
                        <div className="bg-white border border-gray-200/70 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-0 cursor-pointer select-none" onClick={() => setTeamActivityOpen(!teamActivityOpen)}>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 py-1">
                                    {teamActivityOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                    <Users className="h-3.5 w-3.5 text-gray-400" />
                                    Team Activity
                                </h3>
                            </div>
                            {teamActivityOpen && (
                                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                                    {teamActivity.map(a => {
                                        const cfg = ACTION_CONFIG[a.action] ?? ACTION_CONFIG.DEFAULT;
                                        return (
                                            <div key={a.id} className="flex items-start gap-2">
                                                <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <span className="text-[9px] font-bold text-indigo-600">
                                                        {a.user?.name?.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-gray-700 leading-snug">
                                                        <span className="font-semibold">{a.user?.name}</span>
                                                        {" "}{cfg.label.toLowerCase()}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400">{relTime(a.createdAt)}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Tasks Section (Collapsible) ──────────────────────────── */}
                    <div className="bg-white border border-gray-200/70 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-0 cursor-pointer select-none" onClick={() => setTasksOpen(!tasksOpen)}>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 py-1">
                                {tasksOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                <CheckCircle className="h-3.5 w-3.5 text-indigo-500" />
                                Tasks {tasks.length > 0 && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full ml-1">{openTasks.length} open</span>}
                            </h3>
                            {tasksOpen && isAdmin && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowTaskModal(true); }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-all shadow-sm shadow-indigo-100 cursor-pointer"
                                >
                                    <Plus className="h-3 w-3" /> New
                                </button>
                            )}
                        </div>
                        {tasksOpen && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                {tasksLoading ? (
                                    <div className="flex justify-center py-4">
                                        <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                                    </div>
                                ) : tasks.length === 0 ? (
                                    <p className="text-xs text-gray-400 py-2">No tasks yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {tasks.map(task => (
                                            <div key={task.id} className="py-1 border-b border-gray-100 last:border-0">
                                                <TaskRow task={task} leadId={id} compact={true} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Active Automations ───────────────────────────────────── */}
                    {activeAutomations.length > 0 && (
                        <div className="bg-white border border-gray-200/70 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-0 cursor-pointer select-none" onClick={() => setAutomationsOpen(!automationsOpen)}>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 py-1">
                                    {automationsOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                    <Zap className="h-3.5 w-3.5 text-violet-500" />
                                    Active Automations
                                </h3>
                            </div>
                            {automationsOpen && (
                                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                    {activeAutomations.slice(0, 4).map(auto => (
                                        <div key={auto.id} className="flex items-center gap-2">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                            <p className="text-xs text-gray-700 truncate flex-1">{auto.name}</p>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 flex-shrink-0">
                                                ON
                                            </span>
                                        </div>
                                    ))}
                                    {activeAutomations.length > 4 && (
                                        <Link to="/automations" className="text-[10px] text-indigo-600 hover:underline mt-2 block">
                                            +{activeAutomations.length - 4} more
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* Edit Lead Dialog */}
            {showEditLead && (
                <AddLeadForm
                    lead={lead}
                    onClose={() => setShowEditLead(false)}
                />
            )}

            {/* Create Task SlidePanel */}
            <SlidePanel isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} title="Create Task">
                <AddTaskForm
                    leadId={id}
                    onClose={() => {
                        setShowTaskModal(false);
                        queryClient.invalidateQueries({ queryKey: ["lead-tasks", id] });
                        queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
                    }}
                />
            </SlidePanel>

            {showWaModal && (
                <WhatsAppModal
                    leadId={id}
                    lead={lead}
                    onClose={() => setShowWaModal(false)}
                />
            )}

            <PostCallPanel
                open={showPostCall}
                leadId={id}
                lead={lead}
                onClose={() => setShowPostCall(false)}
            />

            {showEmailModal && (
                <ComposeEmailModal
                    leadId={id}
                    defaultTo={lead?.email || ""}
                    onClose={() => setShowEmailModal(false)}
                />
            )}

            {showDealModal && (
                <ConvertToDealModal
                    leadId={id}
                    leadName={lead?.name}
                    onClose={() => setShowDealModal(false)}
                    onSuccess={() => {
                        setShowDealModal(false);
                        queryClient.invalidateQueries({ queryKey: ["lead-deals", id] });
                        queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
                    }}
                />
            )}
        </div>
    );
}

function DocumentSection({ lead, onChanged }) {
    const [uploadingName, setUploadingName] = useState(null);
    const [customDocName, setCustomDocName] = useState("");
    const [isUploadingCustom, setIsUploadingCustom] = useState(false);

    const docList = lead.customFields?.documents || [];

    const defaultDocNames = [
        "10th Marksheet",
        "12th Marksheet",
        "Passport Front",
        "Passport Back",
        "CV",
        "UG Marksheet",
        "UG Degree Certificate",
        "SOP (Statement of Purpose)",
        "LOR (Letter of Recommendation)"
    ];

    const renderedDocs = [...defaultDocNames];
    docList.forEach(d => {
        if (!renderedDocs.some(name => name.toLowerCase() === d.name.toLowerCase())) {
            renderedDocs.push(d.name);
        }
    });

    const handleUpload = async (docName, file) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File size exceeds 10MB limit");
            return;
        }

        const formData = new FormData();
        formData.append("document", file);
        formData.append("documentName", docName);

        setUploadingName(docName);
        try {
            await api.post(`/upload/document/${lead.id}`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            toast.success(`${docName} uploaded successfully!`);
            onChanged();
        } catch (error) {
            console.error("Failed to upload document:", error);
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || "Failed to upload document";
            toast.error(errMsg);
        } finally {
            setUploadingName(null);
        }
    };

    const handleDelete = async (docName) => {
        if (!window.confirm(`Are you sure you want to delete ${docName}?`)) return;
        
        try {
            const updatedDocs = docList.filter(d => d.name.toLowerCase() !== docName.toLowerCase());
            await api.patch(`/leads/${lead.id}/custom-fields`, {
                fields: { documents: updatedDocs }
            });
            toast.success(`${docName} deleted successfully`);
            onChanged();
        } catch (error) {
            console.error("Failed to delete document:", error);
            toast.error("Failed to delete document");
        }
    };

    return (
        <div className="space-y-3 p-4 border border-slate-200/70 bg-white rounded-2xl text-left shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-indigo-600" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Documents &amp; Credentials</h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full tabular-nums shrink-0">
                    {docList.filter(d => d.url).length}/{renderedDocs.length} uploaded
                </span>
            </div>

            <div className="space-y-1.5">
                {renderedDocs.map(name => {
                    const docInfo = docList.find(d => d.name.toLowerCase() === name.toLowerCase());
                    const isUploading = uploadingName === name;
                    const uploaded = Boolean(docInfo?.url);
                    const approved = docInfo?.qcStatus === "Approved";

                    return (
                        <div
                            key={name}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                                uploaded
                                    ? "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/20"
                                    : "border-dashed border-slate-200 bg-slate-50/60"
                            }`}
                        >
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                                uploaded ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                            }`}>
                                {uploaded ? <CheckCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-bold text-slate-700 truncate">{name}</p>
                                    {uploaded && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                            approved
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                                : "bg-amber-50 text-amber-700 border border-amber-100"
                                        }`}>
                                            {docInfo.qcStatus || "Under Review"}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    {uploaded
                                        ? `Uploaded ${docInfo.uploadedAt ? new Date(docInfo.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}`
                                        : "Not uploaded yet"}
                                </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {uploaded && (
                                    <a
                                        href={fileUrl(docInfo.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="View document"
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                    >
                                        <Eye className="h-3.5 w-3.5" />
                                    </a>
                                )}
                                <label
                                    title={uploaded ? "Replace document" : "Upload document"}
                                    className={`inline-flex items-center gap-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                                        uploaded
                                            ? "px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                            : "px-2.5 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                                    }`}
                                >
                                    {isUploading ? (
                                        <><Loader2 className="h-3 w-3 animate-spin" /> …</>
                                    ) : uploaded ? (
                                        <><RefreshCw className="h-3 w-3" /> Replace</>
                                    ) : (
                                        <><Download className="h-3 w-3 rotate-180" /> Upload</>
                                    )}
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => handleUpload(name, e.target.files?.[0])}
                                        disabled={isUploading}
                                    />
                                </label>
                                {uploaded && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(name)}
                                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-400 hover:text-rose-700 transition-colors cursor-pointer"
                                        title="Delete document"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="border-t border-slate-200/60 pt-3 mt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Upload Custom Document</p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                        type="text" 
                        placeholder="Enter document name (e.g. Course Completion)"
                        value={customDocName}
                        onChange={(e) => setCustomDocName(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 text-xs font-semibold"
                    />
                    <label className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-3xs text-center cursor-pointer select-none inline-flex items-center justify-center gap-1.5 ${
                        customDocName.trim() 
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-[1.01]" 
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}>
                        {isUploadingCustom ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
                            </>
                        ) : "Select & Upload"}
                        {customDocName.trim() && (
                            <input 
                                type="file" 
                                className="hidden" 
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setIsUploadingCustom(true);
                                        await handleUpload(customDocName.trim(), file);
                                        setCustomDocName("");
                                        setIsUploadingCustom(false);
                                    }
                                }}
                            />
                        )}
                    </label>
                </div>
            </div>
        </div>
    );
}

function VisaDetailsSection({ lead, onChanged }) {
    const [editing, setEditing] = useState(false);
    const [values, setValues] = useState({
        financial_proof_docs: lead.customFields?.financial_proof_docs || "",
        cas_form_number: lead.customFields?.cas_form_number || "",
        visa_appointment_date: lead.customFields?.visa_appointment_date ? new Date(lead.customFields?.visa_appointment_date).toISOString().split("T")[0] : "",
        visa_manager_approved: lead.customFields?.visa_manager_approved === true || lead.customFields?.visa_manager_approved === "true"
    });

    useEffect(() => {
        setValues({
            financial_proof_docs: lead.customFields?.financial_proof_docs || "",
            cas_form_number: lead.customFields?.cas_form_number || "",
            visa_appointment_date: lead.customFields?.visa_appointment_date ? new Date(lead.customFields?.visa_appointment_date).toISOString().split("T")[0] : "",
            visa_manager_approved: lead.customFields?.visa_manager_approved === true || lead.customFields?.visa_manager_approved === "true"
        });
    }, [lead]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            await api.patch(`/leads/${lead.id}/custom-fields`, {
                fields: {
                    financial_proof_docs: values.financial_proof_docs,
                    cas_form_number: values.cas_form_number,
                    visa_appointment_date: values.visa_appointment_date || null,
                    visa_manager_approved: values.visa_manager_approved
                }
            });
        },
        onSuccess: () => {
            toast.success("Visa details updated successfully");
            setEditing(false);
            onChanged();
        },
        onError: (err) => {
            console.error(err);
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || "Failed to update visa details");
        }
    });

    if (!editing) {
        return (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🛡️</span>
                        <h4 className="text-xs font-extrabold text-slate-750 uppercase tracking-wider">Visa File & Appointment Details</h4>
                    </div>
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-all bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-3xs cursor-pointer"
                    >
                        Edit Details
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs font-semibold">
                    <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-0.5">Financial Proof Documents</span>
                        <span className="text-slate-800 font-bold">{values.financial_proof_docs || "N/A"}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-0.5">CAS / I-20 Form Number</span>
                        <span className="text-slate-800 font-bold">{values.cas_form_number || "N/A"}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-0.5">Visa Appointment Date</span>
                        <span className="text-slate-800 font-bold">
                            {values.visa_appointment_date 
                                ? new Date(values.visa_appointment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) 
                                : "N/A"}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-0.5">Visa Manager Approved</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            values.visa_manager_approved 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}>
                            {values.visa_manager_approved ? "Approved" : "Pending"}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🛡️</span>
                    <h4 className="text-xs font-extrabold text-slate-750 uppercase tracking-wider">Edit Visa Details</h4>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="text-[10px] font-bold text-slate-550 hover:text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-3xs cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saveMutation.isPending}
                        style={{ backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: '#ffffff' }}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-3xs disabled:opacity-50 cursor-pointer"
                    >
                        {saveMutation.isPending ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Financial Proof Documents</label>
                    <input
                        type="text"
                        placeholder="e.g. Education loan sanction letter / Bank statement"
                        value={values.financial_proof_docs}
                        onChange={e => setValues({ ...values, financial_proof_docs: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">CAS / I-20 Form Number</label>
                    <input
                        type="text"
                        placeholder="e.g. CAS-9473-GB"
                        value={values.cas_form_number}
                        onChange={e => setValues({ ...values, cas_form_number: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Visa Appointment Date</label>
                    <input
                        type="date"
                        value={values.visa_appointment_date}
                        onChange={e => setValues({ ...values, visa_appointment_date: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white text-left font-semibold"
                    />
                </div>

                <div className="pt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none font-bold">
                        <input
                            type="checkbox"
                            checked={values.visa_manager_approved}
                            onChange={e => setValues({ ...values, visa_manager_approved: e.target.checked })}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                        />
                        Visa Manager Approved File
                    </label>
                </div>
            </div>
        </form>
    );
}
