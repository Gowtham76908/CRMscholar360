import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import api from "../api/axios";
import { humanizeStage, sortDepartments, DEPARTMENT_ORDER } from "../lib/departments";
import { useAuth } from "../context/AuthContext";

/**
 * React Query hooks for the multi-department lead model. Query keys are shared so
 * mutations elsewhere can invalidate precisely:
 *   ["workflows"]                         — department/stage config (static-ish)
 *   ["my-departments"]                    — the caller's department memberships
 *   ["lead-departments", leadId]          — a lead's department services
 *   ["department-members", department]    — active members of a department
 *   ["department-queue", department, ...] — a department's work list
 */

// Stage config rarely changes within a session — cache it hard.
export function useWorkflows() {
    const query = useQuery({
        queryKey: ["workflows"],
        queryFn: () => api.get("/lead-departments/workflows").then((r) => r.data),
        staleTime: 60 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    });

    // Index by department for O(1) stage lookups, with a label resolver.
    const byDepartment = useMemo(() => {
        const map = {};
        for (const d of query.data?.departments || []) map[d.department] = d;
        return map;
    }, [query.data]);

    const getStages = (department) => byDepartment[department]?.stages || [];
    const stageLabel = (department, code) => {
        const found = byDepartment[department]?.stages?.find((s) => s.code === code);
        return found?.label || query.data?.stageLabels?.[code] || humanizeStage(code);
    };
    const hasWorkflow = (department) => Boolean(byDepartment[department]?.hasWorkflow);

    return { ...query, byDepartment, getStages, stageLabel, hasWorkflow };
}

export function useMyDepartments() {
    return useQuery({
        queryKey: ["my-departments"],
        queryFn: () => api.get("/lead-departments/memberships/me").then((r) => r.data.departments),
        staleTime: 10 * 60 * 1000,
    });
}

export function useLeadDepartments(leadId) {
    return useQuery({
        queryKey: ["lead-departments", leadId],
        queryFn: () => api.get(`/leads/${leadId}/departments`).then((r) => r.data),
        enabled: Boolean(leadId),
    });
}

export function useDepartmentMembers(department) {
    return useQuery({
        queryKey: ["department-members", department],
        queryFn: () => api.get("/lead-departments/members", { params: { department } }).then((r) => r.data),
        enabled: Boolean(department),
        staleTime: 5 * 60 * 1000,
    });
}

export function useDepartmentQueue(department, filters = {}) {
    return useQuery({
        queryKey: ["department-queue", department, filters],
        queryFn: () =>
            api
                .get("/lead-departments/queue", { params: { department, ...filters } })
                .then((r) => r.data),
        enabled: Boolean(department),
    });
}

// Per-stage-paginated variant for the Leads Board view — every column gets its
// own `perStage` rows for the current page (not a flat skip/take over the whole
// department, which starves columns whose leads haven't been touched recently).
export function useDepartmentBoard(department, filters = {}, page = 1, perStage = 10) {
    return useQuery({
        queryKey: ["department-board", department, filters, page, perStage],
        queryFn: () =>
            api
                .get("/lead-departments/board", { params: { department, page, perStage, ...filters } })
                .then((r) => r.data),
        enabled: Boolean(department),
        placeholderData: (prev) => prev,
    });
}

export function useDepartmentDashboard(department) {
    return useQuery({
        queryKey: ["department-dashboard", department],
        queryFn: () =>
            api.get("/lead-departments/dashboard", { params: { department } }).then((r) => r.data),
        enabled: Boolean(department),
        staleTime: 60 * 1000,
    });
}

export function useDepartmentWorkload(department) {
    return useQuery({
        queryKey: ["department-workload", department],
        queryFn: () =>
            api.get("/lead-departments/workload", { params: { department } }).then((r) => r.data),
        enabled: Boolean(department),
    });
}

/**
 * Department selection state with role-based defaults:
 *   Director (SUPER_ADMIN) — every department, defaults to SALES.
 *   Manager / Consultant   — only their own departments, defaults to the first.
 * Returns the currently selected department, a setter, and the option list.
 */
export function useDepartmentSelection() {
    const { user } = useAuth();
    const isDirector = user?.role === "SUPER_ADMIN";
    const { data: myDepartments = [], isLoading } = useMyDepartments();

    const options = useMemo(
        () => (isDirector ? sortDepartments(DEPARTMENT_ORDER) : sortDepartments(myDepartments)),
        [isDirector, myDepartments]
    );

    const [department, setDepartment] = useState(null);

    // Apply the default once options resolve; keep selection valid if it leaves scope.
    useEffect(() => {
        if (isDirector) {
            if (!department) setDepartment("SALES");
            return;
        }
        if (options.length && (!department || !options.includes(department))) {
            setDepartment(options[0]);
        }
    }, [isDirector, options, department]);

    return { department, setDepartment, options, isLoading };
}
