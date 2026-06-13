const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");
const normalizePhone = require("../utils/normalizePhone");
const FormData = require("form-data");
const axios = require("axios");
const { updateLeadScoreFromCall, recomputeLeadScore } = require("../services/leadScoringService");
const { runRulesForLead } = require("../services/automationEngine");
const { canAccessLead } = require("../services/permissionService");
const { signUploadUrl } = require("../utils/signedUpload");

// Recordings live in a gated upload dir; <audio> loads them cross-origin without
// cookies, so stamp a short-lived signed token onto recordingUrl at read time.
const signRecording = (cl) =>
    cl && cl.recordingUrl ? { ...cl, recordingUrl: signUploadUrl(cl.recordingUrl) } : cl;

// Shared access check for a call log's underlying lead. Call recordings and
// transcripts are sensitive customer data, so reads are scoped the same way
// leads are: EMPLOYEE → own, ADMIN → team (+ unassigned), SUPER_ADMIN → all.
async function canAccessCallLead(reqUser, assignedToId) {
    return canAccessLead(reqUser.userId, reqUser.role, { assignedToId: assignedToId ?? null });
}

// Initiate Click2Call via Greeter
const initiateCall = async (req, res, next) => {
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

        // Scope to the requester's leads — an agent shouldn't be able to dial out on,
        // or attach call logs to, another team's lead by passing its id.
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedToId: true } });
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }
        if (!(await canAccessCallLead(req.user, lead.assignedToId))) {
            return res.status(403).json({ message: "Access denied" });
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

        return next(error);
    }
};

// Greeter Webhook - receives call data after call ends
// This endpoint is called by Greeter (no auth required)
const greeterWebhook = async (req, res, next) => {
    try {
        // Optional shared-secret gate. If GREETER_WEBHOOK_SECRET is configured,
        // every call must present it (header or query) — otherwise anyone could
        // inject fake call logs and trigger automations. Lenient if unset (dev).
        const secret = process.env.GREETER_WEBHOOK_SECRET;
        if (secret) {
            const provided = req.headers["x-greeter-secret"] || req.query.secret;
            if (provided !== secret) {
                return res.status(403).json({ message: "Invalid webhook secret" });
            }
        }

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
                    duration: parseInt(callDuration, 10) || 0,
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
                    duration: parseInt(callDuration, 10) || 0,
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

            recomputeLeadScore(callLog.leadId).catch(() => {});
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
                        duration: parseInt(callDuration, 10) || 0,
                        callType: callType || "OUTBOUND",
                        callStatus: callStatus || "COMPLETED",
                        recordingUrl: callRecording || null,
                        agentNumber: agentNumber || null,
                        callDate: callDate ? new Date(callDate) : new Date()
                    }
                });

                recomputeLeadScore(leadId).catch(() => {});
            }
        }

        res.status(200).json({ message: "Webhook received successfully" });
    } catch (error) {

        return next(error);
    }
};

// Log a manual call (existing functionality)
const logCall = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { leadId, duration, callType, notes } = req.body;

        const callLog = await prisma.callLog.create({
            data: {
                userId,
                leadId,
                duration: parseInt(duration, 10) || 0,
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

        // A logged call is engagement — refresh the lead's temperature before
        // responding so a follow-up fetch reflects the new score immediately.
        await recomputeLeadScore(leadId).catch(() => {});

        res.status(201).json(callLog);
    } catch (error) {
        return next(error);
    }
};

// Get call logs for a lead
const getCallLogs = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedToId: true } });
        if (!lead) return res.status(404).json({ message: "Lead not found" });
        if (!(await canAccessCallLead(req.user, lead.assignedToId))) {
            return res.status(403).json({ message: "Access denied" });
        }
        const logs = await prisma.callLog.findMany({
            where: { leadId },
            orderBy: { createdAt: "desc" }
        });
        res.json(logs.map(signRecording));
    } catch (error) {
        return next(error);
    }
};

// Transcribe a call recording
const transcribeCall = async (req, res, next) => {
    try {
        const { callLogId } = req.params;

        const callLog = await prisma.callLog.findUnique({
            where: { id: callLogId },
            include: { lead: { select: { assignedToId: true } } },
        });
        if (!callLog) {
            return res.status(404).json({ message: "Call log not found" });
        }
        if (!(await canAccessCallLead(req.user, callLog.lead?.assignedToId))) {
            return res.status(403).json({ message: "Access denied" });
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

        const { transcribeFromUrl, transcribeFromFile, isTranscriptionConfigured } = require("../services/transcriptionService");
        if (!isTranscriptionConfigured()) {
            return res.status(503).json({ message: "Call transcription is not configured on this server." });
        }
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

        return next(error);
    }
};

// Get all call logs for a lead (with full details)
const getCallLogDetails = async (req, res, next) => {
    try {
        const { callLogId } = req.params;
        const callLog = await prisma.callLog.findUnique({
            where: { id: callLogId },
            include: { lead: { select: { name: true, phone: true, assignedToId: true } } }
        });
        if (!callLog) {
            return res.status(404).json({ message: "Call log not found" });
        }
        if (!(await canAccessCallLead(req.user, callLog.lead?.assignedToId))) {
            return res.status(403).json({ message: "Access denied" });
        }
        res.json(signRecording(callLog));
    } catch (error) {
        return next(error);
    }
};

// Upload a recording file manually for a lead
const uploadRecording = async (req, res, next) => {
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

        await recomputeLeadScore(leadId).catch(() => {});

        res.status(201).json({
            message: "Recording uploaded successfully",
            callLog: signRecording(callLog)
        });
    } catch (error) {

        return next(error);
    }
};

// Upload an audio file and immediately transcribe it (combined workflow)
const uploadAndTranscribe = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { leadId } = req.body;

        if (!leadId) {
            return res.status(400).json({ message: "leadId is required" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No audio file uploaded" });
        }

        const { transcribeFromFile, isTranscriptionConfigured } = require("../services/transcriptionService");
        if (!isTranscriptionConfigured()) {
            return res.status(503).json({ message: "Call transcription is not configured on this server." });
        }

        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }
        if (!(await canAccessCallLead(req.user, lead.assignedToId))) {
            return res.status(403).json({ message: "Access denied" });
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
            callLog: signRecording(updated),
        });
    } catch (error) {

        return next(error);
    }
};

module.exports = { initiateCall, greeterWebhook, logCall, getCallLogs, transcribeCall, getCallLogDetails, uploadRecording, uploadAndTranscribe };
