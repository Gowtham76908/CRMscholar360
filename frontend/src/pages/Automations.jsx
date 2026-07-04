import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import api from "../api/axios";
import { roleLabel } from "../lib/roles";
import { useWorkflows } from "../hooks/useDepartments";

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
    { value: "LEAD_CREATED",   label: "Lead is created" },
    { value: "STAGE_CHANGED",  label: "Lead stage changes to…" },
    { value: "ASSIGNED",       label: "Consultant is assigned" },
    { value: "NO_ACTIVITY",    label: "No activity for N days" },
    { value: "MISSED_CALL",    label: "Missed / unanswered call" },
];

const SOURCE_OPTIONS       = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL", "LINKEDIN"];
const ENQUIRY_TYPE_OPTIONS = ["PRODUCT", "WHITE_LABEL", "LMS", "SERVICES"];

const CONDITION_FIELDS = [
    { value: "source",      label: "Lead Source" },
    { value: "stage",       label: "Lead Stage" },
    { value: "assignedTo",  label: "Assigned To" },
    { value: "enquiryType", label: "Enquiry Type" },
];

const OPERATORS = [
    { value: "equals",       label: "equals" },
    { value: "not_equals",   label: "does not equal" },
    { value: "is_empty",     label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
];

const ACTION_TYPES = [
    { value: "CHANGE_STAGE",       label: "Change lead stage" },
    { value: "ASSIGN_CONSULTANT",  label: "Assign consultant to lead" },
    { value: "CREATE_TASK",        label: "Create a task" },
    { value: "CREATE_REMINDER",    label: "Create a reminder" },
    { value: "SEND_NOTIFICATION",  label: "Send in-app notification" },
    { value: "SEND_WHATSAPP",      label: "Send WhatsApp template" },
    { value: "SEND_EMAIL",         label: "Send email" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerLabel(rule, stageLabel) {
    const base = TRIGGER_TYPES.find(t => t.value === rule.triggerType)?.label ?? rule.triggerType;
    if (rule.triggerType === "STAGE_CHANGED" && rule.triggerConfig?.stage) {
        const dept = rule.triggerConfig.department || "SALES";
        const label = stageLabel ? stageLabel(dept, rule.triggerConfig.stage) : rule.triggerConfig.stage;
        return `Lead stage changes to ${dept} · ${label}`;
    }
    if (rule.triggerType === "NO_ACTIVITY" && rule.triggerConfig?.days)
        return `No activity for ${rule.triggerConfig.days} day(s)`;
    return base;
}

const emptyRule = () => ({
    name: "",
    description: "",
    triggerType: "LEAD_CREATED",
    triggerConfig: {},
    conditions: [],
    actions: [],
});

const CONSTRAINT_TYPES = [
    { value: "COOLDOWN",               label: "Cooldown (hours between runs)" },
    { value: "MAX_EXECUTIONS_PER_DAY", label: "Max runs per day" },
    { value: "BUSINESS_HOURS_ONLY",    label: "Business hours only" },
    { value: "SKIP_WEEKENDS",          label: "Skip weekends" },
    { value: "PREVENT_DUPLICATES",          label: "Run only once per lead" },
    { value: "PREVENT_RECURSIVE_TRIGGERS",  label: "Block if already in trigger chain" },
];

const emptyConstraint = () => ({ type: "COOLDOWN", hours: 24 });
const emptyCondition = () => ({ field: "source", operator: "equals", value: "" });
const emptyAction    = () => ({ type: "CHANGE_STAGE", config: {} });

// ─── Rule Builder Modal ───────────────────────────────────────────────────────

function RuleModal({ initial, users, onSave, onClose }) {
    const [form, setForm] = useState(initial ?? emptyRule());

    const set = (patch) => setForm(f => ({ ...f, ...patch }));
    const setCondition = (i, patch) =>
        setForm(f => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
    const setAction = (i, patch) =>
        setForm(f => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, ...patch } : a) }));
    const setActionConfig = (i, patch) =>
        setForm(f => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, config: { ...a.config, ...patch } } : a) }));

    const addCondition = () => setForm(f => ({ ...f, conditions: [...f.conditions, emptyCondition()] }));
    const removeCondition = (i) => setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
    const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, emptyAction()] }));
    const removeAction = (i) => setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));

    const getConstraints = () => form.triggerConfig?.constraints ?? [];
    const setConstraints = (constraints) => set({ triggerConfig: { ...form.triggerConfig, constraints } });
    const addConstraint = () => setConstraints([...getConstraints(), emptyConstraint()]);
    const removeConstraint = (i) => setConstraints(getConstraints().filter((_, idx) => idx !== i));
    const setConstraint = (i, patch) => setConstraints(getConstraints().map((c, idx) => idx === i ? { ...c, ...patch } : c));

    const { byDepartment, getStages } = useWorkflows();
    const departments = Object.keys(byDepartment);

    const hasWA = form.actions.some(a => a.type === "SEND_WHATSAPP");
    const { data: waTemplates = [], error: waError, isLoading: waLoading } = useQuery({
        queryKey: ["wa-templates"],
        queryFn: () => api.get("/whatsapp/templates").then(r => r.data),
        enabled: hasWA,
        retry: false,
        staleTime: 120_000,
    });
    const waNotConnected = !!waError;

    const needsValue = (op) => op === "equals" || op === "not_equals";
    const fieldValues = (field) => {
        if (field === "source")      return SOURCE_OPTIONS.map(v => ({ value: v, label: v.replace("_", " ") }));
        if (field === "stage")       return getStages(form.triggerConfig?.department || "SALES").map(s => ({ value: s.code, label: s.label }));
        if (field === "enquiryType") return ENQUIRY_TYPE_OPTIONS.map(v => ({ value: v, label: v.replace("_", " ") }));
        return [];
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-900">{initial ? "Edit Rule" : "New Automation Rule"}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                </div>

                <div className="px-6 py-5 space-y-6">
                    {/* Basic info */}
                    <div className="space-y-3">
                        <input
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="Rule name *"
                            value={form.name}
                            onChange={e => set({ name: e.target.value })}
                        />
                        <input
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="Description (optional)"
                            value={form.description}
                            onChange={e => set({ description: e.target.value })}
                        />
                    </div>

                    {/* Trigger */}
                    <div className="space-y-2">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">When (Trigger)</p>
                        <select
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.triggerType}
                            onChange={e => set({ triggerType: e.target.value, triggerConfig: {} })}
                        >
                            {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        {form.triggerType === "STAGE_CHANGED" && (
                            <div className="grid grid-cols-2 gap-3">
                                <select
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    value={form.triggerConfig?.department ?? ""}
                                    onChange={e => set({ triggerConfig: { ...form.triggerConfig, department: e.target.value, stage: "" } })}
                                >
                                    <option value="">— select department —</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    value={form.triggerConfig?.stage ?? ""}
                                    onChange={e => set({ triggerConfig: { ...form.triggerConfig, stage: e.target.value } })}
                                    disabled={!form.triggerConfig?.department}
                                >
                                    <option value="">— select stage —</option>
                                    {getStages(form.triggerConfig?.department).map(s => (
                                        <option key={s.code} value={s.code}>{s.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {form.triggerType === "NO_ACTIVITY" && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number" min="1"
                                    className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    value={form.triggerConfig?.days ?? 1}
                                    onChange={e => set({ triggerConfig: { ...form.triggerConfig, days: parseInt(e.target.value) || 1 } })}
                                />
                                <span className="text-sm text-gray-500">days without activity</span>
                            </div>
                        )}
                    </div>

                    {/* Constraints */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Constraints</p>
                            <button onClick={addConstraint} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                <Plus className="h-3 w-3" /> Add
                            </button>
                        </div>
                        {getConstraints().length === 0 && (
                            <p className="text-xs text-gray-400">No constraints — rule can fire on every trigger event.</p>
                        )}
                        {getConstraints().map((c, i) => (
                            <div key={i} className="flex items-center gap-2 flex-wrap">
                                <select
                                    className="flex-1 min-w-[180px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                    value={c.type}
                                    onChange={e => setConstraint(i, { type: e.target.value, hours: 24, max: 1 })}
                                >
                                    {CONSTRAINT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                                </select>
                                {c.type === "COOLDOWN" && (
                                    <>
                                        <input
                                            type="number" min="1"
                                            className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                            value={c.hours ?? 24}
                                            onChange={e => setConstraint(i, { hours: parseInt(e.target.value) || 24 })}
                                        />
                                        <span className="text-xs text-gray-500">hours</span>
                                    </>
                                )}
                                {c.type === "MAX_EXECUTIONS_PER_DAY" && (
                                    <>
                                        <input
                                            type="number" min="1"
                                            className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                            value={c.max ?? 1}
                                            onChange={e => setConstraint(i, { max: parseInt(e.target.value) || 1 })}
                                        />
                                        <span className="text-xs text-gray-500">per day</span>
                                    </>
                                )}
                                {c.type === "BUSINESS_HOURS_ONLY" && (
                                    <>
                                        <input
                                            type="number" min="0" max="23"
                                            className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                            placeholder="9"
                                            value={c.startHour ?? 9}
                                            onChange={e => setConstraint(i, { startHour: parseInt(e.target.value) })}
                                        />
                                        <span className="text-xs text-gray-500">–</span>
                                        <input
                                            type="number" min="0" max="23"
                                            className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                            placeholder="18"
                                            value={c.endHour ?? 18}
                                            onChange={e => setConstraint(i, { endHour: parseInt(e.target.value) })}
                                        />
                                        <span className="text-xs text-gray-500">hr</span>
                                    </>
                                )}
                                <button onClick={() => removeConstraint(i)} className="text-red-400 hover:text-red-600">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Conditions */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">If (Conditions)</p>
                            <button onClick={addCondition} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                <Plus className="h-3 w-3" /> Add
                            </button>
                        </div>
                        {form.conditions.length === 0 && (
                            <p className="text-xs text-gray-400">No conditions — rule runs for every matching trigger.</p>
                        )}
                        {form.conditions.map((cond, i) => (
                            <div key={i} className="flex items-center gap-2 flex-wrap">
                                <select
                                    className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                    value={cond.field}
                                    onChange={e => setCondition(i, { field: e.target.value, value: "" })}
                                >
                                    {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                                <select
                                    className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                    value={cond.operator}
                                    onChange={e => setCondition(i, { operator: e.target.value })}
                                >
                                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                {needsValue(cond.operator) && (
                                    cond.field === "assignedTo" ? (
                                        <select
                                            className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                            value={cond.value}
                                            onChange={e => setCondition(i, { value: e.target.value })}
                                        >
                                            <option value="">— select user —</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    ) : fieldValues(cond.field).length > 0 ? (
                                        <select
                                            className="flex-1 min-w-[100px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                            value={cond.value}
                                            onChange={e => setCondition(i, { value: e.target.value })}
                                        >
                                            <option value="">— select —</option>
                                            {fieldValues(cond.field).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            className="flex-1 min-w-[100px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                            placeholder="value"
                                            value={cond.value}
                                            onChange={e => setCondition(i, { value: e.target.value })}
                                        />
                                    )
                                )}
                                <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Then (Actions)</p>
                            <button onClick={addAction} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                <Plus className="h-3 w-3" /> Add
                            </button>
                        </div>
                        {form.actions.length === 0 && (
                            <p className="text-xs text-gray-400">No actions added yet.</p>
                        )}
                        {form.actions.map((action, i) => (
                            <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <select
                                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                        value={action.type}
                                        onChange={e => setAction(i, { type: e.target.value, config: {} })}
                                    >
                                        {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                    </select>
                                    <button onClick={() => removeAction(i)} className="text-red-400 hover:text-red-600">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                {/* Action config fields */}
                                {action.type === "CHANGE_STAGE" && (
                                    <select
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                        value={action.config.stage ?? ""}
                                        onChange={e => setActionConfig(i, { stage: e.target.value })}
                                    >
                                        <option value="">— select stage —</option>
                                        {getStages(form.triggerConfig?.department || "SALES").map(s => (
                                            <option key={s.code} value={s.code}>{s.label}</option>
                                        ))}
                                    </select>
                                )}
                                {action.type === "ASSIGN_CONSULTANT" && (
                                    <select
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                        value={action.config.userId ?? ""}
                                        onChange={e => setActionConfig(i, { userId: e.target.value })}
                                    >
                                        <option value="">— select user —</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({roleLabel(u.role)})</option>)}
                                    </select>
                                )}
                                {action.type === "CREATE_TASK" && (
                                    <div className="space-y-1.5">
                                        <input
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                            placeholder="Task title *"
                                            value={action.config.title ?? ""}
                                            onChange={e => setActionConfig(i, { title: e.target.value })}
                                        />
                                        <textarea
                                            rows={2}
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none resize-none"
                                            placeholder="Description * — what should the employee do?"
                                            value={action.config.description ?? ""}
                                            onChange={e => setActionConfig(i, { description: e.target.value })}
                                        />
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number" min="1"
                                                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                                value={action.config.dueDaysFromNow ?? 1}
                                                onChange={e => setActionConfig(i, { dueDaysFromNow: parseInt(e.target.value) || 1 })}
                                            />
                                            <span className="text-xs text-gray-500">days from now</span>
                                        </div>
                                    </div>
                                )}
                                {action.type === "CREATE_REMINDER" && (
                                    <div className="space-y-1.5">
                                        <input
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                            placeholder="Reminder message *"
                                            value={action.config.message ?? ""}
                                            onChange={e => setActionConfig(i, { message: e.target.value })}
                                        />
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number" min="1"
                                                className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                                placeholder="Hours"
                                                value={action.config.dueHoursFromNow ?? 24}
                                                onChange={e => setActionConfig(i, { dueHoursFromNow: parseInt(e.target.value) || 24 })}
                                            />
                                            <span className="text-xs text-gray-500">hours from now</span>
                                        </div>
                                    </div>
                                )}
                                {action.type === "SEND_NOTIFICATION" && (
                                    <div className="space-y-1.5">
                                        <input
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                            placeholder="Notification title"
                                            value={action.config.title ?? ""}
                                            onChange={e => setActionConfig(i, { title: e.target.value })}
                                        />
                                        <input
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                            placeholder="Notification message"
                                            value={action.config.message ?? ""}
                                            onChange={e => setActionConfig(i, { message: e.target.value })}
                                        />
                                    </div>
                                )}
                                {action.type === "SEND_WHATSAPP" && (
                                    <div className="space-y-1.5">
                                        {waNotConnected ? (
                                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 leading-snug">
                                                WhatsApp is not connected.{" "}
                                                <a href="/settings" className="underline font-medium">Settings → Integrations</a>
                                                {" "}to connect your WhatsApp Business account first.
                                            </div>
                                        ) : waLoading ? (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                <Loader2 className="h-3 w-3 animate-spin" /> Loading templates…
                                            </div>
                                        ) : waTemplates.length > 0 ? (
                                            <select
                                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                                value={action.config.templateName ?? ""}
                                                onChange={e => setActionConfig(i, { templateName: e.target.value, parameters: [] })}
                                            >
                                                <option value="">— select a template —</option>
                                                {waTemplates.map(t => (
                                                    <option key={t.name} value={t.name}>{t.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                                placeholder="Template name (e.g. welcome_lead)"
                                                value={action.config.templateName ?? ""}
                                                onChange={e => setActionConfig(i, { templateName: e.target.value })}
                                            />
                                        )}
                                        {/* Preview body + per-param inputs when a template is selected */}
                                        {action.config.templateName && (() => {
                                            const tpl = waTemplates.find(t => t.name === action.config.templateName);
                                            const bodyText = tpl?.components?.find(c => c.type === "BODY")?.text;
                                            const paramCount = bodyText ? (bodyText.match(/\{\{\d+\}\}/g) || []).length : 0;
                                            return (
                                                <div className="space-y-1.5">
                                                    {bodyText && (
                                                        <p className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2 py-1.5 leading-snug">
                                                            <span className="font-semibold">Template: </span>{bodyText}
                                                        </p>
                                                    )}
                                                    {paramCount > 0 && (
                                                        <>
                                                            <p className="text-[10px] font-medium text-gray-500">Fill in parameters:</p>
                                                            {Array.from({ length: paramCount }, (_, idx) => (
                                                                <div key={idx} className="flex items-center gap-2">
                                                                    <span className="text-[10px] text-gray-400 w-8 shrink-0 font-mono">{`{{${idx + 1}}}`}</span>
                                                                    <input
                                                                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none"
                                                                        placeholder={idx === 0 ? "e.g. {{lead.name}}" : "e.g. {{lead.phone}}"}
                                                                        value={(action.config.parameters ?? [])[idx] ?? ""}
                                                                        onChange={e => {
                                                                            const params = [...(action.config.parameters ?? [])];
                                                                            params[idx] = e.target.value;
                                                                            setActionConfig(i, { parameters: params });
                                                                        }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </>
                                                    )}
                                                    {!bodyText && (
                                                        <input
                                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                                            placeholder="Parameters, comma-separated"
                                                            value={(action.config.parameters ?? []).join(", ")}
                                                            onChange={e => setActionConfig(i, {
                                                                parameters: e.target.value.split(",").map(p => p.trim()).filter(Boolean)
                                                            })}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        <p className="text-[10px] text-gray-400">{"{{lead.name}}"} and {"{{lead.phone}}"} are replaced with the lead's real values.</p>
                                    </div>
                                )}
                                {action.type === "SEND_EMAIL" && (
                                    <div className="space-y-1.5">
                                        <input
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                                            placeholder="Email subject"
                                            value={action.config.subject ?? ""}
                                            onChange={e => setActionConfig(i, { subject: e.target.value })}
                                        />
                                        <textarea
                                            rows={3}
                                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none resize-none"
                                            placeholder={"Email body. Use {{lead.name}} for the lead's name."}
                                            value={action.config.body ?? ""}
                                            onChange={e => setActionConfig(i, { body: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(form)}
                        disabled={!form.name.trim() || form.actions.length === 0}
                        className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Save Rule
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({ rule, users, onEdit, onDelete, onToggle }) {
    const [logsOpen, setLogsOpen] = useState(false);
    const { data: logs = [], isLoading: logsLoading } = useQuery({
        queryKey: ["automation-logs", rule.id],
        queryFn: () => api.get(`/automations/${rule.id}/logs`).then(r => r.data),
        enabled: logsOpen,
    });

    const { stageLabel } = useWorkflows();
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

    return (
        <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${rule.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
            <div className="flex items-start justify-between px-5 py-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">{rule.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {rule.isActive ? "Active" : "Paused"}
                        </span>
                    </div>
                    {rule.description && <p className="text-xs text-gray-500 mb-2">{rule.description}</p>}
                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full font-medium">
                            ⚡ {triggerLabel(rule, stageLabel)}
                        </span>
                        {rule.conditions.length > 0 && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
                                {rule.conditions.length} condition{rule.conditions.length > 1 ? "s" : ""}
                            </span>
                        )}
                        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                            {rule.actions.length} action{rule.actions.length > 1 ? "s" : ""}
                        </span>
                        <span className="text-gray-400">{rule._count?.logs ?? 0} runs</span>
                        {(rule.triggerConfig?.constraints ?? []).map((c, i) => {
                            const label =
                                c.type === "COOLDOWN"               ? `⏱ ${c.hours ?? 24}h cooldown`
                              : c.type === "MAX_EXECUTIONS_PER_DAY" ? `⛔ max ${c.max ?? 1}/day`
                              : c.type === "BUSINESS_HOURS_ONLY"    ? `🕘 biz hours`
                              : c.type === "SKIP_WEEKENDS"          ? `📅 no weekends`
                              : c.type === "PREVENT_DUPLICATES"         ? `1× only`
                              : c.type === "PREVENT_RECURSIVE_TRIGGERS" ? `no recursion`
                              : c.type;
                            return (
                                <span key={i} className="bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-full font-medium text-[10px]">
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <button onClick={() => onToggle(rule)} title={rule.isActive ? "Pause" : "Resume"} className="text-gray-400 hover:text-indigo-600">
                        {rule.isActive
                            ? <ToggleRight className="h-5 w-5 text-indigo-500" />
                            : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button onClick={() => onEdit(rule)} className="text-xs font-semibold text-gray-500 hover:text-indigo-600 px-2 py-1 border border-gray-200 rounded-lg">
                        Edit
                    </button>
                    <button onClick={() => onDelete(rule.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Actions summary */}
            <div className="border-t border-gray-50 px-5 py-3 bg-gray-50 space-y-1">
                {rule.actions.map((a, i) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="font-bold text-gray-400">→</span>
                        {a.type === "CHANGE_STAGE"     && `Change stage to ${stageLabel(rule.triggerConfig?.department || "SALES", a.config.stage)}`}
                        {a.type === "ASSIGN_CONSULTANT" && `Assign to ${userMap[a.config.userId] ?? a.config.userId}`}
                        {a.type === "CREATE_TASK"       && `Create task "${a.config.title}" in ${a.config.dueDaysFromNow ?? 1}d`}
                        {a.type === "CREATE_REMINDER"   && `Set reminder: "${a.config.message}" in ${a.config.dueHoursFromNow ?? 24}h`}
                        {a.type === "SEND_NOTIFICATION" && `Notify: "${a.config.title ?? "Alert"}"`}
                        {a.type === "SEND_WHATSAPP"     && `Send WhatsApp template "${a.config.templateName}"`}
                        {a.type === "SEND_EMAIL"        && `Send email "${a.config.subject ?? "(no subject)"}"`}
                    </div>
                ))}
            </div>

            {/* Logs toggle */}
            <button
                onClick={() => setLogsOpen(v => !v)}
                className="w-full flex items-center gap-1.5 px-5 py-2.5 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-100 bg-white"
            >
                {logsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Execution history
            </button>
            {logsOpen && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 space-y-2 max-h-48 overflow-y-auto">
                    {logsLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                    {!logsLoading && logs.length === 0 && <p className="text-xs text-gray-400">No executions yet.</p>}
                    {logs.map(log => (
                        <div key={log.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                    log.status === "SUCCESS" ? "bg-green-100 text-green-700"
                                    : log.status === "SKIPPED" ? "bg-gray-100 text-gray-500"
                                    : "bg-red-100 text-red-600"
                                }`}>{log.status}</span>
                                <span className="text-gray-600">{log.lead?.name ?? log.leadId}</span>
                            </div>
                            <span className="text-gray-400">{new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Automations() {
    const qc = useQueryClient();
    const [modal, setModal] = useState(null); // null | { mode: "create" | "edit", rule?: object }

    const { data: rules = [], isLoading } = useQuery({
        queryKey: ["automations"],
        queryFn: () => api.get("/automations").then(r => r.data),
    });

    const { data: users = [] } = useQuery({
        queryKey: ["team-users"],
        queryFn: () => api.get("/users").then(r => r.data),
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["automations"] });

    const create = useMutation({
        mutationFn: (data) => api.post("/automations", data),
        onSuccess: () => { invalidate(); setModal(null); },
    });

    const update = useMutation({
        mutationFn: ({ id, ...data }) => api.patch(`/automations/${id}`, data),
        onSuccess: () => { invalidate(); setModal(null); },
    });

    const remove = useMutation({
        mutationFn: (id) => api.delete(`/automations/${id}`),
        onSuccess: invalidate,
    });

    const toggle = useMutation({
        mutationFn: (id) => api.patch(`/automations/${id}/toggle`),
        onSuccess: invalidate,
    });

    const seed = useMutation({
        mutationFn: () => api.post("/automations/seed"),
        onSuccess: invalidate,
    });

    const handleSave = (form) => {
        if (modal?.mode === "edit") {
            update.mutate({ id: modal.rule.id, ...form });
        } else {
            create.mutate(form);
        }
    };

    const activeCount  = rules.filter(r => r.isActive).length;
    const pausedCount  = rules.length - activeCount;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-5 w-5 text-indigo-600" />
                        <h1 className="text-xl font-bold text-gray-900">Automation Rules</h1>
                    </div>
                    <p className="text-sm text-gray-500">
                        {rules.length === 0
                            ? "No rules yet — create your first automation."
                            : `${activeCount} active · ${pausedCount} paused`}
                    </p>
                </div>
                <div className="flex gap-2">
                    {rules.length === 0 && (
                        <button
                            onClick={() => seed.mutate()}
                            disabled={seed.isPending}
                            className="flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-600 text-sm font-semibold rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-50"
                        >
                            {seed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            Load Defaults
                        </button>
                    )}
                    <button
                        onClick={() => setModal({ mode: "create" })}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        New Rule
                    </button>
                </div>
            </div>

            {/* Rules list */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                </div>
            ) : rules.length === 0 ? (
                <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
                    <Zap className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">No automation rules yet</p>
                    <p className="text-xs text-gray-400 mt-1 mb-4">Rules run automatically when leads match your conditions.</p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={() => seed.mutate()}
                            disabled={seed.isPending}
                            className="flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-600 text-sm font-semibold rounded-xl hover:bg-indigo-50 disabled:opacity-50"
                        >
                            {seed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            Load 3 Default Rules
                        </button>
                        <button
                            onClick={() => setModal({ mode: "create" })}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700"
                        >
                            Build custom rule
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {rules.map(rule => (
                        <RuleCard
                            key={rule.id}
                            rule={rule}
                            users={users}
                            onEdit={(r) => setModal({ mode: "edit", rule: r })}
                            onDelete={(id) => { if (confirm("Delete this rule?")) remove.mutate(id); }}
                            onToggle={(r) => toggle.mutate(r.id)}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            {modal && (
                <RuleModal
                    initial={modal.mode === "edit" ? modal.rule : null}
                    users={users}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                />
            )}
        </div>
    );
}
