import DepartmentSelector from "../DepartmentSelector";
import DepartmentInsights from "./DepartmentInsights";
import { useDepartmentSelection } from "../../hooks/useDepartments";

/**
 * Drop-in dashboard section: a department selector + that department's analytics.
 * Self-contained (owns its own selection with role-based defaults), so it can be
 * placed in any dashboard view without prop wiring. Renders nothing if the user
 * belongs to no department (e.g. a consultant not yet staffed).
 */
export default function DepartmentSection() {
    const { department, setDepartment, options } = useDepartmentSelection();

    if (!options.length) return null;

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-base font-bold text-gray-900">Department Overview</h2>
                <DepartmentSelector value={department} onChange={setDepartment} options={options} />
            </div>
            {department && <DepartmentInsights department={department} />}
        </section>
    );
}
