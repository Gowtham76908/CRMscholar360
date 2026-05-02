import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { Loader2, Facebook, Instagram, Mail, Globe, Phone, CheckCircle, XCircle, RefreshCw } from "lucide-react";

const Integrations = () => {
    const queryClient = useQueryClient();

    const { data: integrations, isLoading } = useQuery({
        queryKey: ["integrations"],
        queryFn: async () => {
            const res = await api.get("/integrations");
            return res.data;
        },
    });

    const toggleMutation = useMutation({
        mutationFn: async (id) => {
            return await api.patch(`/integrations/${id}/toggle`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["integrations"]);
        },
    });

    const getIcon = (platform) => {
        switch (platform) {
            case "Facebook Leads": return <Facebook className="h-8 w-8 text-blue-600" />;
            case "Instagram Leads": return <Instagram className="h-8 w-8 text-pink-600" />;
            case "Gmail": return <Mail className="h-8 w-8 text-red-500" />;
            case "Website Contact Form": return <Globe className="h-8 w-8 text-indigo-500" />;
            case "Phone Call Logs": return <Phone className="h-8 w-8 text-green-500" />;
            default: return <Globe className="h-8 w-8 text-gray-500" />;
        }
    };

    const getDescription = (platform) => {
        switch (platform) {
            case "Facebook Leads": return "Import leads from Facebook Lead Ads automatically.";
            case "Instagram Leads": return "Capture leads from Instagram contact forms and DMs.";
            case "Gmail": return "Track email enquiries and convert them to leads.";
            case "Website Contact Form": return "Connect your website contact form for instant lead capture.";
            case "Phone Call Logs": return "Log phone call leads with automatic caller ID lookup.";
            default: return "Connect this service to your CRM.";
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const connectedCount = integrations?.filter(i => i.isConnected).length || 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Integrations</h1>
                <p className="text-sm text-gray-500">Connect your lead sources to automatically import leads.</p>
                <div className="mt-2 text-sm text-gray-400">
                    {connectedCount} of {integrations?.length} integrations connected
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations?.map((integration) => (
                    <div key={integration.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between h-full">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    {getIcon(integration.platform)}
                                </div>
                                {integration.isConnected ? (
                                    <div className="flex items-center text-green-600 text-xs font-medium">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Connected
                                    </div>
                                ) : (
                                    <div className="flex items-center text-gray-400 text-xs font-medium">
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Not Connected
                                    </div>
                                )}
                            </div>

                            <h3 className="text-lg font-semibold text-gray-900">{integration.platform}</h3>
                            <p className="text-sm text-gray-500 mt-2 mb-4">
                                {getDescription(integration.platform)}
                            </p>
                        </div>

                        <div className="mt-auto">
                            {integration.isConnected && (
                                <div className="mb-3 space-y-2">
                                    <div className="text-xs text-gray-400">
                                        Last synced: {integration.lastSynced ? new Date(integration.lastSynced).toLocaleString() : 'Never'}
                                    </div>
                                    {integration.platform === "Website Contact Form" && (
                                        <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                            <p className="text-xs font-semibold text-gray-500 mb-1">Webhook URL:</p>
                                            <code className="text-xs text-gray-700 bg-white p-1 rounded border border-gray-200 block break-all">
                                                {window.location.protocol}//{window.location.hostname}:5001/api/webhooks/leads
                                            </code>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3">
                                {integration.isConnected ? (
                                    <>
                                        <button className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Sync
                                        </button>
                                        <button
                                            onClick={() => toggleMutation.mutate(integration.id)}
                                            className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none"
                                        >
                                            Disconnect
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => toggleMutation.mutate(integration.id)}
                                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        Connect
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Integrations;
