import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "../api/axios";
import { Loader2, User, Bell, Lock, Download, Trash2, Save, Shield, Smartphone, Eye, EyeOff, Camera, X } from "lucide-react";
import AuditLogs from "../components/AuditLogs";
import SessionManager from "../components/SessionManager";
import Avatar from "../components/Avatar";

// Schemas
const profileSchema = z.object({
    name: z.string().min(2, "Name required"),
    phone: z.string().optional(),
    department: z.string().optional(),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

const Settings = () => {
    const { user, refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState("profile");
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);

    // Profile photo upload states
    const [photoPreview, setPhotoPreview] = useState(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
    const fileInputRef = useRef(null);

    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);

    // Profile Form
    const { register: registerProfile, handleSubmit: handleProfileSubmit } = useForm({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: user?.name,
            phone: user?.phone,
            department: user?.department,
        }
    });

    // Password Form
    const { register: registerPass, handleSubmit: handlePassSubmit, reset: resetPass, formState: { errors: passErrors } } = useForm({
        resolver: zodResolver(passwordSchema)
    });

    const onProfileSubmit = async (data) => {
        setIsSaving(true);
        setMessage({ type: "", text: "" });
        try {
            let photoUploadResponse = null;

            // Step 1: Upload photo first if a new one is selected
            if (selectedPhotoFile) {
                console.log("Uploading photo:", selectedPhotoFile.name);
                const formData = new FormData();
                formData.append("photo", selectedPhotoFile);

                photoUploadResponse = await api.post("/upload/profile-photo", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
                console.log("Photo upload response:", photoUploadResponse.data);
            }

            // Step 2: Update profile information
            const res = await api.patch("/users/profile", data);
            console.log("Profile update response:", res.data);

            // Use the photo upload response if available (it has the updated profilePhoto)
            // Otherwise use the profile update response
            const finalUserData = photoUploadResponse?.data?.user || res.data;
            refreshUser(finalUserData);
            setMessage({ type: "success", text: "Profile updated successfully!" });

            // Reset edit mode and photo states
            setIsEditMode(false);
            setPhotoPreview(null);
            setSelectedPhotoFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (error) {
            console.error("Profile submit error:", error);
            setMessage({ type: "error", text: error.response?.data?.message || "Failed to update profile." });
        } finally {
            setIsSaving(false);
        }
    };

    const onPasswordSubmit = async (data) => {
        setIsSaving(true);
        setMessage({ type: "", text: "" });
        try {
            await api.patch("/users/password", {
                currentPassword: data.currentPassword,
                newPassword: data.newPassword
            });
            setMessage({ type: "success", text: "Password changed successfully." });
            resetPass();
        } catch (error) {
            setMessage({ type: "error", text: error.response?.data?.message || "Failed to change password." });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setMessage({ type: "error", text: "Image size must be less than 5MB" });
                return;
            }
            // Store the file for later upload
            setSelectedPhotoFile(file);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePhotoDelete = async () => {
        if (!confirm("Are you sure you want to remove your profile photo?")) return;

        setIsUploadingPhoto(true);
        try {
            await api.delete("/upload/profile-photo");
            refreshUser({ profilePhoto: null });
            setMessage({ type: "success", text: "Profile photo removed" });
        } catch (error) {
            setMessage({ type: "error", text: "Failed to remove photo" });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        setPhotoPreview(null);
        setSelectedPhotoFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMessage({ type: "", text: "" });
    };

    const handleExport = async () => {
        try {
            const response = await api.get("/leads/export", { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "leads.csv");
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Export failed", error);
            alert("Failed to export data.");
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="md:col-span-1 space-y-1">
                <button
                    onClick={() => setActiveTab("profile")}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'profile' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900 hover:bg-gray-50'}`}
                >
                    <User className="flex-shrink-0 -ml-1 mr-3 h-5 w-5 text-gray-400" />
                    Profile Settings
                </button>
                <button
                    onClick={() => setActiveTab("notifications")}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'notifications' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900 hover:bg-gray-50'}`}
                >
                    <Bell className="flex-shrink-0 -ml-1 mr-3 h-5 w-5 text-gray-400" />
                    Notifications
                </button>
                <button
                    onClick={() => setActiveTab("security")}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'security' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900 hover:bg-gray-50'}`}
                >
                    <Lock className="flex-shrink-0 -ml-1 mr-3 h-5 w-5 text-gray-400" />
                    Security
                </button>
                <button
                    onClick={() => setActiveTab("data")}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'data' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900 hover:bg-gray-50'}`}
                >
                    <Download className="flex-shrink-0 -ml-1 mr-3 h-5 w-5 text-gray-400" />
                    Data Export
                </button>

                {/* Admin Only Tabs */}
                {["ADMIN", "SUPER_ADMIN"].includes(user?.role) && (
                    <>
                        <div className="pt-4 pb-2">
                            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin Area</p>
                        </div>
                        <button
                            onClick={() => setActiveTab("audit")}
                            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'audit' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900 hover:bg-gray-50'}`}
                        >
                            <Shield className="flex-shrink-0 -ml-1 mr-3 h-5 w-5 text-gray-400" />
                            Audit Logs
                        </button>
                        <button
                            onClick={() => setActiveTab("sessions")}
                            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'sessions' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900 hover:bg-gray-50'}`}
                        >
                            <Smartphone className="flex-shrink-0 -ml-1 mr-3 h-5 w-5 text-gray-400" />
                            Active Sessions
                        </button>
                    </>
                )}
                <button
                    onClick={() => setActiveTab("danger")}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'danger' ? 'bg-red-50 text-red-700' : 'text-gray-900 hover:bg-gray-50'}`}
                >
                    <Trash2 className="flex-shrink-0 -ml-1 mr-3 h-5 w-5 text-gray-400" />
                    Danger Zone
                </button>
            </div>

            {/* Content */}
            <div className="md:col-span-3">
                {message.text && (
                    <div className={`mb-4 p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                {activeTab === "profile" && (
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Profile Information</h3>
                            {!isEditMode && (
                                <button
                                    onClick={() => setIsEditMode(true)}
                                    className="inline-flex items-center px-4 py-2 border border-indigo-600 shadow-sm text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    <User className="h-4 w-4 mr-2" />
                                    Edit Profile
                                </button>
                            )}
                        </div>

                        {/* Profile Photo Section */}
                        <div className="mb-8 pb-6 border-b border-gray-200">
                            <h4 className="text-sm font-medium text-gray-700 mb-4">Profile Photo</h4>
                            <div className="flex items-center gap-6">
                                <Avatar user={user} size="xl" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoSelect}
                                            disabled={!isEditMode}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={!isEditMode || isUploadingPhoto}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Camera className="h-4 w-4 mr-2" />
                                            Change Photo
                                        </button>
                                        {user?.profilePhoto && isEditMode && (
                                            <button
                                                onClick={handlePhotoDelete}
                                                disabled={isUploadingPhoto}
                                                className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none disabled:opacity-50"
                                            >
                                                <X className="h-4 w-4 mr-2" />
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500">JPG, PNG or GIF. Max size 5MB.</p>

                                    {photoPreview && isEditMode && (
                                        <div className="mt-4">
                                            <p className="text-sm font-medium text-gray-700 mb-2">New Photo Preview:</p>
                                            <div className="flex items-center gap-4">
                                                <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover ring-2 ring-indigo-200" />
                                                <p className="text-xs text-gray-500 italic">This photo will be saved when you click "Save Changes"</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Profile Form */}
                        <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Display Name</label>
                                <input
                                    {...registerProfile("name")}
                                    disabled={!isEditMode}
                                    className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${!isEditMode ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                <input value={user?.email} disabled className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                                    <input
                                        {...registerProfile("phone")}
                                        disabled={!isEditMode}
                                        className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${!isEditMode ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Department</label>
                                    <input
                                        {...registerProfile("department")}
                                        disabled={!isEditMode}
                                        className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${!isEditMode ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                            </div>
                            {isEditMode && (
                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        disabled={isSaving}
                                        className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Changes
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                )}

                {activeTab === "notifications" && (
                    <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Notification Preferences</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">New Lead Alerts</h4>
                                    <p className="text-sm text-gray-500">Get notified when a new lead arrives.</p>
                                </div>
                                <div className="flex items-center">
                                    <input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" defaultChecked />
                                </div>
                            </div>
                            <hr />
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Task Reminders</h4>
                                    <p className="text-sm text-gray-500">Receive reminders for upcoming tasks.</p>
                                </div>
                                <div className="flex items-center">
                                    <input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" defaultChecked />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "security" && (
                    <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Change Password</h3>
                        <form onSubmit={handlePassSubmit(onPasswordSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Current Password</label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPass ? "text" : "password"}
                                        {...registerPass("currentPassword")}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                                        className="absolute inset-y-0 right-0 top-1 pr-3 flex items-center"
                                    >
                                        {showCurrentPass ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                                    </button>
                                </div>
                                {passErrors.currentPassword && <p className="text-red-500 text-xs mt-1">{passErrors.currentPassword.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNewPass ? "text" : "password"}
                                        {...registerPass("newPassword")}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPass(!showNewPass)}
                                        className="absolute inset-y-0 right-0 top-1 pr-3 flex items-center"
                                    >
                                        {showNewPass ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                                    </button>
                                </div>
                                {passErrors.newPassword && <p className="text-red-500 text-xs mt-1">{passErrors.newPassword.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPass ? "text" : "password"}
                                        {...registerPass("confirmPassword")}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                                        className="absolute inset-y-0 right-0 top-1 pr-3 flex items-center"
                                    >
                                        {showConfirmPass ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                                    </button>
                                </div>
                                {passErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passErrors.confirmPassword.message}</p>}
                            </div>
                            <div className="flex justify-end">
                                <button type="submit" disabled={isSaving} className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                    {isSaving ? "Updating..." : "Update Password"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === "data" && (
                    <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Data Export</h3>
                        <p className="text-sm text-gray-500 mb-4">Export your CRM data to CSV format.</p>
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Export Leads (CSV)
                        </button>
                    </div>
                )}

                {activeTab === "audit" && ["ADMIN", "SUPER_ADMIN"].includes(user?.role) && <AuditLogs />}
                {activeTab === "sessions" && ["ADMIN", "SUPER_ADMIN"].includes(user?.role) && <SessionManager />}
                {activeTab === "danger" && (
                    <div className="bg-red-50 border border-red-200 shadow rounded-lg p-6">
                        <h3 className="text-lg leading-6 font-medium text-red-900 mb-2">Danger Zone</h3>
                        <p className="text-sm text-red-600 mb-4">Irreversible actions. Be careful.</p>
                        <div className="flex items-center justify-between bg-white p-4 border border-red-100 rounded-md">
                            <div>
                                <h4 className="text-sm font-medium text-gray-900">Delete Account</h4>
                                <p className="text-xs text-gray-500">Permanently delete your account and all data.</p>
                            </div>
                            <button className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none">
                                Delete Account
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
