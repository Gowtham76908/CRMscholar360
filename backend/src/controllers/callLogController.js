const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");
const normalizePhone = require("../utils/normalizePhone");
const FormData = require("form-data");
const axios = require("axios");
const { updateLeadScoreFromCall } = require("../services/leadScoringService");
const { runRulesForLead } = require("../services/automationEngine");

// Initiate Click2Call via Greeter
const initiateCall = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadId, customerNumber } = req.body;

        if (!leadId || !customerNumber) {
            return res.status(400).json({ message: "leadId and customerNumber are required" });
        }

        // Get the agent's phone number
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user?.phone) {
            return res.status(400).json({ message: "Your phone number is not set. Please update your profile with your phone number." });
        }

        // Normalize before storing so webhook lookups can use exact match
        const normalizedAgentNumber = normalizePhone(user.phone);
        if (!normalizedAgentNumber) {
            return res.status(400).json({ message: "Your phone number is invalid. Please update your profile with a valid phone number." });
        }

        // Create a call log entry first (status: INITIATED)
        const callLog = await prisma.callLog.create({
            data: {
                leadId,
                userId,
                callType: "OUTBOUND",
                callStatus: "INITIATED",
                agentNumber: normalizedAgentNumber,
                duration: 0
            }
        });

        // Call Greeter Click2Call API
        const formData = new FormData();
        formData.append("user_id", process.env.GREETER_USER_ID);
        formData.append("customer_number", customerNumber);
        formData.append("agen_number", user.phone);
        formData.append("number", process.env.GREETER_NUMBER);
        formData.append("Customer_CRM_ID", leadId);

        const greeterResponse = await axios.post(
            process.env.GREETER_API_URL,
            formData,
            { headers: formData.getHeaders() }
        );

        // Update call log with greeter response if available
        if (greeterResponse.data) {
            await prisma.callLog.update({
                where: { id: callLog.id },
                data: {
                    greeterCallId: greeterResponse.data?.call_id?.toString() || null,
                    callStatus: "RINGING"
                }
            });
        }

        // Log Activity
        await logActivity({
            leadId,
            userId,
            action: "CALL_INITIATED",
            metadata: { callType: "OUTBOUND", customerNumber, callLogId: callLog.id }
        });

        res.status(200).json({
            message: "Call initiated successfully",
            callLog,
            greeterResponse: greeterResponse.data
        });
    } catch (error) {
        console.error("Click2Call error:", error.message);
        res.status(500).json({ message: "Failed to initiate call", error: error.message });
    }
};

// Greeter Webhook - receives call data after call ends
// This endpoint is called by Greeter (no auth required)
const greeterWebhook = async (req, res) => {
    try {
        console.log("Greeter webhook received:", req.body);

        const {
            "call-duration": callDuration,
            "agent-number": agentNumber,
            "call-date": callDate,
            "call-recording": callRecording,
            "call-type": callType,
            "call-status": callStatus,
            "Customer_CRM_ID": customerCrmId,
            "customer_number": customerNumber
        } = req.body;

        // Try to find the matching call log
        let callLog = null;

        // First try by Customer_CRM_ID (leadId)
        if (customerCrmId) {
            callLog = await prisma.callLog.findFirst({
                where: {
                    leadId: customerCrmId,
                    callStatus: { in: ["INITIATED", "RINGING", "CONNECTED"] }
                },
                orderBy: { createdAt: "desc" }
            });
        }

        // Fallback: exact match on normalized agent number (stored normalized at call creation)
        if (!callLog && agentNumber) {
            const normalizedAgent = normalizePhone(agentNumber);
            if (normalizedAgent) {
                callLog = await prisma.callLog.findFirst({
                    where: {
                        agentNumber: normalizedAgent,
                        callStatus: { in: ["INITIATED", "RINGING", "CONNECTED"] }
                    },
                    orderBy: { createdAt: "desc" }
                });
            }
        }

        if (callLog) {
            // Update existing call log
            await prisma.callLog.update({
                where: { id: callLog.id },
                data: {
                    duration: parseInt(callDuration) || 0,
                    callStatus: callStatus || "COMPLETED",
                    recordingUrl: callRecording || null,
                    callDate: callDate ? new Date(callDate) : new Date(),
                    agentNumber: agentNumber || callLog.agentNumber
                }
            });

            // Log activity
            await logActivity({
                leadId: callLog.leadId,
                userId: callLog.userId,
                action: "CALL_COMPLETED",
                metadata: {
                    duration: parseInt(callDuration) || 0,
                    callStatus,
                    hasRecording: !!callRecording
                }
            });

            // Fire MISSED_CALL automation rules if the call was not answered
            const missedStatuses = ["MISSED", "NO_ANSWER", "BUSY", "UNANSWERED"];
            if (missedStatuses.includes((callStatus || "").toUpperCase())) {
                const lead = await prisma.lead.findUnique({ where: { id: callLog.leadId } });
                if (lead) runRulesForLead("MISSED_CALL", lead).catch(console.error);
            }
        } else {
            // Create a new call log if no matching one found
            // Try to find lead by customer number
            let leadId = customerCrmId;
            if (!leadId && customerNumber) {
                const normalizedCustomer = normalizePhone(customerNumber);
                if (normalizedCustomer) {
                    const lead = await prisma.lead.findFirst({
                        where: { phoneNormalized: normalizedCustomer }
                    });
                    leadId = lead?.id;
                }
            }

            if (leadId) {
                let userId = null;
                if (agentNumber) {
                    const normalizedAgent = normalizePhone(agentNumber);
                    if (normalizedAgent) {
                        const user = await prisma.user.findFirst({
                            where: { phoneNormalized: normalizedAgent }
                        });
                        userId = user?.id;
                    }
                }

                await prisma.callLog.create({
                    data: {
                        leadId,
                        userId,
                        duration: parseInt(callDuration) || 0,
                        callType: callType || "OUTBOUND",
                        callStatus: callStatus || "COMPLETED",
                        recordingUrl: callRecording || null,
                        agentNumber: agentNumber || null,
                        callDate: callDate ? new Date(callDate) : new Date()
                    }
                });
            }
        }

        res.status(200).json({ message: "Webhook received successfully" });
    } catch (error) {
        console.error("Greeter webhook error:", error.message);
        res.status(500).json({ message: "Webhook processing error", error: error.message });
    }
};

// Log a manual call (existing functionality)
const logCall = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadId, duration, callType, notes } = req.body;

        const callLog = await prisma.callLog.create({
            data: {
                userId,
                leadId,
                duration: parseInt(duration) || 0,
                callType: callType || "OUTBOUND",
                callStatus: "COMPLETED"
            }
        });

        if (notes) {
            await prisma.note.create({
                data: {
                    leadId,
                    content: `[Call Log - ${callType} - ${duration}s]: ${notes}`
                }
            });
        }

        await logActivity({
            leadId,
            userId,
            action: "CALL_LOGGED",
            metadata: { duration, callType }
        });

        res.status(201).json(callLog);
    } catch (error) {
        res.status(500).json({ message: "Error logging call", error: error.message });
    }
};

// Get call logs for a lead
const getCallLogs = async (req, res) => {
    try {
        const { leadId } = req.params;
        const logs = await prisma.callLog.findMany({
            where: { leadId },
            orderBy: { createdAt: "desc" }
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching call logs", error: error.message });
    }
};

// Transcribe a call recording
const transcribeCall = async (req, res) => {
    try {
        const { callLogId } = req.params;

        const callLog = await prisma.callLog.findUnique({ where: { id: callLogId } });
        if (!callLog) {
            return res.status(404).json({ message: "Call log not found" });
        }

        if (!callLog.recordingUrl) {
            return res.status(400).json({ message: "No recording available for this call" });
        }

        if (callLog.isTranscribed) {
            return res.status(200).json({
                message: "Already transcribed",
                callLog
            });
        }

        const { transcribeFromUrl, transcribeFromFile } = require("../services/transcriptionService");
        const path = require("path");

        console.log(`Starting transcription for call ${callLogId}...`);
        console.log(`Recording URL: ${callLog.recordingUrl}`);

        let result;

        // Check if it's a local file path (uploaded recording)
        if (callLog.recordingUrl.startsWith("/uploads/")) {
            const localPath = path.join(__dirname, "../../", callLog.recordingUrl);
            console.log(`Transcribing local file: ${localPath}`);
            result = await transcribeFromFile(localPath);
        } else {
            // Remote URL (from Greeter webhook)
            result = await transcribeFromUrl(callLog.recordingUrl);
        }

        const updated = await prisma.callLog.update({
            where: { id: callLogId },
            data: {
                transcription: result.transcription,
                plainText: result.plainText,
                summary: result.summary,
                tone: result.tone,
                urgency: result.urgency,
                emotion: result.emotion,
                callCategory: result.category,
                sentiment: result.sentiment,
                feedback: result.feedback,
                conclusion: result.conclusion,
                isTranscribed: true,
                transcribedAt: new Date(),
                duration: result.duration || callLog.duration
            }
        });

        // Update lead cold score based on AI analysis
        const newScore = await updateLeadScoreFromCall(callLog.leadId, result);

        // Log activity
        await logActivity({
            leadId: callLog.leadId,
            userId: req.user.userId,
            action: "CALL_TRANSCRIBED",
            metadata: {
                callLogId,
                tone: result.tone,
                sentiment: result.sentiment,
                category: result.category,
                newScore,
            }
        });

        res.status(200).json({
            message: "Transcription complete",
            callLog: updated
        });
    } catch (error) {
        console.error("Transcription error:", error.message);
        res.status(500).json({ message: "Transcription failed", error: error.message });
    }
};

// Get all call logs for a lead (with full details)
const getCallLogDetails = async (req, res) => {
    try {
        const { callLogId } = req.params;
        const callLog = await prisma.callLog.findUnique({
            where: { id: callLogId },
            include: { lead: { select: { name: true, phone: true } } }
        });
        if (!callLog) {
            return res.status(404).json({ message: "Call log not found" });
        }
        res.json(callLog);
    } catch (error) {
        res.status(500).json({ message: "Error fetching call log", error: error.message });
    }
};

// Upload a recording file manually for a lead
const uploadRecording = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadId } = req.body;

        if (!leadId) {
            return res.status(400).json({ message: "leadId is required" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No recording file uploaded" });
        }

        // Verify lead exists
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        // Build the recording URL
        const recordingUrl = `/uploads/recordings/${req.file.filename}`;

        // Create a completed call log with the recording
        const callLog = await prisma.callLog.create({
            data: {
                leadId,
                userId,
                callType: "OUTBOUND",
                callStatus: "COMPLETED",
                agentNumber: "Manual Upload",
                duration: 0,
                recordingUrl,
                callDate: new Date()
            }
        });

        // Log activity
        await logActivity({
            leadId,
            userId,
            action: "RECORDING_UPLOADED",
            metadata: { callLogId: callLog.id, fileName: req.file.originalname }
        });

        res.status(201).json({
            message: "Recording uploaded successfully",
            callLog
        });
    } catch (error) {
        console.error("Upload recording error:", error.message);
        res.status(500).json({ message: "Failed to upload recording", error: error.message });
    }
};

// Upload an audio file and immediately transcribe it (combined workflow)
const uploadAndTranscribe = async (req, res) => {
    try {
        const { userId } = req.user;
        const { leadId } = req.body;

        if (!leadId) {
            return res.status(400).json({ message: "leadId is required" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No audio file uploaded" });
        }

        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        const recordingUrl = `/uploads/recordings/${req.file.filename}`;
        const filePath = req.file.path;

        // Create call log immediately so we have an ID
        const callLog = await prisma.callLog.create({
            data: {
                leadId,
                userId,
                callType: "OUTBOUND",
                callStatus: "COMPLETED",
                recordingUrl,
                callDate: new Date(),
                duration: 0,
            }
        });

        console.log(`Starting transcription for uploaded file: ${req.file.originalname}`);

        const { transcribeFromFile } = require("../services/transcriptionService");
        const result = await transcribeFromFile(filePath);

        const updated = await prisma.callLog.update({
            where: { id: callLog.id },
            data: {
                transcription: result.transcription,
                plainText: result.plainText,
                summary: result.summary,
                tone: result.tone,
                urgency: result.urgency,
                emotion: result.emotion,
                callCategory: result.category,
                sentiment: result.sentiment,
                feedback: result.feedback,
                conclusion: result.conclusion,
                isTranscribed: true,
                transcribedAt: new Date(),
                duration: result.duration || 0,
            }
        });

        // Update lead cold score based on AI analysis
        const newScore = await updateLeadScoreFromCall(leadId, result);

        await logActivity({
            leadId,
            userId,
            action: "CALL_TRANSCRIBED",
            metadata: {
                callLogId: callLog.id,
                fileName: req.file.originalname,
                tone: result.tone,
                sentiment: result.sentiment,
                category: result.category,
                newScore,
            }
        });

        res.status(201).json({
            message: "Upload and transcription complete",
            callLog: updated,
        });
    } catch (error) {
        console.error("Upload-and-transcribe error:", error.message);
        res.status(500).json({ message: "Upload and transcription failed", error: error.message });
    }
};

module.exports = { initiateCall, greeterWebhook, logCall, getCallLogs, transcribeCall, getCallLogDetails, uploadRecording, uploadAndTranscribe };
