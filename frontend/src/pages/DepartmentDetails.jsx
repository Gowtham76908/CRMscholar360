import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, User, Mail, Briefcase, Phone, Loader2 } from "lucide-react";
import api from "../api/axios";

const DepartmentDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // Fetch Department Details (Name + Users)
    const { data: department, isLoading, error } = useQuery({
        queryKey: ["department", id],
        queryFn: async () => (await api.get(`/departments/${id}`)).data,
    });

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;

    if (error) return (
        <div className="text-center py-20">
            <h2 className="text-xl font-semibold text-gray-900">Department Not Found</h2>
            <button onClick={() => navigate("/departments")} className="mt-4 text-indigo-600 hover:text-indigo-800">
                &larr; Back to Departments
            </button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/departments" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5 text-gray-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{department.name}</h1>
                    <p className="text-sm text-gray-500">{department.users?.length || 0} Members</p>
                </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Team Members</h3>
                </div>
                {department.users && department.users.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                        {department.users.map((user) => (
                            <li key={user.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                            {user.name[0]}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                                <Briefcase className="h-3 w-3" />
                                                {user.jobTitle || "No Job Title"}
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                    {user.role}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end text-sm text-gray-500 gap-1">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-3 w-3" /> {user.email}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-3 w-3" /> {user.phone || "N/A"}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="p-10 text-center text-gray-500">
                        <User className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        <p>No members in this department yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DepartmentDetails;
