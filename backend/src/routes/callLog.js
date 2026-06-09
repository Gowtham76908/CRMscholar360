const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const callLogController = require("../controllers/callLogController");
const authMiddleware = require("../middleware/authMiddleware");

// Ensure recordings directory exists
const recordingsDir = path.join(__dirname, "../../uploads/recordings");
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}

// Multer config for recording uploads
const recordingStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, recordingsDir),
    filename: (req, file, cb) => {
        // Unguessable name — the file is also access-gated, but a random name
        // removes any enumeration vector entirely.
        const uniqueName = `${crypto.randomBytes(16).toString("hex")}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const recordingUpload = multer({
    storage: recordingStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowed = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"];
        if (!allowed.includes(ext)) {
            return cb(new Error(`File type ${ext} not allowed. Accepted: ${allowed.join(", ")}`), false);
        }
        cb(null, true);
    }
});

// Greeter webhook - NO auth (Greeter calls this directly)
router.post("/greeter-webhook", callLogController.greeterWebhook);

// Protected routes
router.use(authMiddleware);

router.post("/log", callLogController.logCall);
router.post("/click2call", callLogController.initiateCall);
router.post("/upload-recording", recordingUpload.single("recording"), callLogController.uploadRecording);
router.get("/:leadId", callLogController.getCallLogs);
router.get("/detail/:callLogId", callLogController.getCallLogDetails);
router.post("/transcribe/:callLogId", callLogController.transcribeCall);
router.post("/upload-and-transcribe", recordingUpload.single("audio"), callLogController.uploadAndTranscribe);

module.exports = router;
