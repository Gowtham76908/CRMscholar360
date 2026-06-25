const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const authMiddleware = require("../middleware/authMiddleware");
const prisma = require("../utils/prisma");
const { toSafeUser } = require("../utils/safeUser");
const { uploadToCloudinary } = require("../utils/cloudinary");

// Ensure upload directory exists
const uploadDir = "uploads/profiles";
const taskUploadDir = "uploads/tasks";
const resumeUploadDir = "uploads/resumes";

[uploadDir, taskUploadDir, resumeUploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure multer storage for profiles
const profileStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${req.user.userId}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Configure multer storage for tasks
const taskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, taskUploadDir);
    },
    filename: (_req, file, cb) => {
        // Unguessable name — task files are access-gated; random name kills enumeration.
        const uniqueName = `task-${crypto.randomBytes(16).toString("hex")}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter for images only
const profileFileFilter = (_req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed"));
    }
};

// Multer upload configuration for profiles
const uploadProfile = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: profileFileFilter
});

// Multer upload configuration for tasks (allows docs/pdfs too)
const uploadTask = multer({
    storage: taskStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.use(authMiddleware);

// Upload profile photo
router.post("/profile-photo", (req, res, next) => {
    uploadProfile.single("photo")(req, res, (err) => {
        if (err) {
            console.error("Multer profile photo upload error:", err);
            return res.status(400).json({
                error: {
                    code: "UPLOAD_ERROR",
                    message: err.message || "Failed to upload profile photo."
                }
            });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Try uploading to Cloudinary
        let photoUrl = await uploadToCloudinary(req.file.path, "profiles");

        // If Cloudinary succeeded, delete the local file immediately.
        // Otherwise, fall back to the relative local URL path.
        if (photoUrl) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting local file after Cloudinary upload:", err);
            });
        } else {
            photoUrl = `/uploads/profiles/${req.file.filename}`;
        }

        // Update user's profile photo in database
        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId },
            data: { profilePhoto: photoUrl }
        });

        res.json({
            message: "Profile photo uploaded successfully",
            user: toSafeUser(updatedUser)
        });
    } catch (error) {
        console.error("Profile photo upload error:", error);

        // Delete uploaded local file if database update fails
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file:", err);
            });
        }

        res.status(500).json({ message: "Failed to upload profile photo" });
    }
});

// Upload task files
router.post("/task-files", (req, res, next) => {
    uploadTask.array("files", 5)(req, res, (err) => {
        if (err) {
            console.error("Multer task files upload error:", err);
            return res.status(400).json({
                error: {
                    code: "UPLOAD_ERROR",
                    message: err.message || "Failed to upload task files."
                }
            });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }

        const filesData = req.files.map(file => ({
            fileName: file.originalname,
            fileUrl: `/uploads/tasks/${file.filename}`, // stored bare; signed at read time
            fileSize: file.size,
            mimeType: file.mimetype
        }));

        res.json({
            message: "Files uploaded successfully",
            files: filesData
        });
    } catch (error) {
        console.error("Task file upload error:", error);
        res.status(500).json({ message: "Failed to upload task files" });
    }
});

// Delete profile photo
router.delete("/profile-photo", authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { profilePhoto: true }
        });

        if (user?.profilePhoto) {
            // Delete file from filesystem only if it is a relative local path
            const isLocal = !user.profilePhoto.startsWith("http://") && !user.profilePhoto.startsWith("https://") && !user.profilePhoto.startsWith("//");
            if (isLocal) {
                const filePath = path.join(__dirname, "../..", user.profilePhoto);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            // Update database
            await prisma.user.update({
                where: { id: req.user.userId },
                data: { profilePhoto: null }
            });
        }

        res.json({ message: "Profile photo deleted successfully" });
    } catch (error) {
        console.error("Delete profile photo error:", error);
        res.status(500).json({ message: "Failed to delete profile photo" });
    }
});

// Configure multer storage for resumes
const resumeStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, resumeUploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueName = `resume-${crypto.randomBytes(16).toString("hex")}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Multer upload configuration for resumes
const uploadResume = multer({
    storage: resumeStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (_req, file, cb) => {
        const filetypes = /pdf|doc|docx|txt|rtf|odt/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype) || 
            file.mimetype === "application/pdf" || 
            file.mimetype === "application/msword" || 
            file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (extname || mimetype) {
            cb(null, true);
        } else {
            cb(new Error("Only document files (PDF, DOC, DOCX, TXT, RTF) are allowed"));
        }
    }
});

// Upload lead resume
router.post("/resume/:leadId", (req, res, next) => {
    uploadResume.single("resume")(req, res, (err) => {
        if (err) {
            console.error("Multer resume upload error:", err);
            return res.status(400).json({
                error: {
                    code: "UPLOAD_ERROR",
                    message: err.message || "Failed to upload resume."
                }
            });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { leadId } = req.params;
        const { userId } = req.user;

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        // Try uploading to Cloudinary
        let resumeUrl = await uploadToCloudinary(req.file.path, "resumes", "raw");

        // If Cloudinary succeeded, delete the local file immediately.
        // Otherwise, fall back to local URL path.
        if (resumeUrl) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting local file after Cloudinary upload:", err);
            });
        } else {
            resumeUrl = `/uploads/resumes/${req.file.filename}`;
        }

        const resumeName = req.file.originalname;

        // Update lead with resumeUrl and resumeName
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                resumeUrl,
                resumeName
            }
        });

        // Log Activity
        const logActivity = require("../utils/activityLogger");
        await logActivity({
            leadId,
            userId,
            action: "RESUME_UPLOADED",
            metadata: {
                resumeUrl,
                resumeName,
                uploadedBy: req.user.name || "System"
            }
        });

        res.json({
            message: "Resume uploaded successfully",
            resumeUrl,
            resumeName
        });
    } catch (error) {
        console.error("Resume upload error:", error);
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file:", err);
            });
        }
        res.status(500).json({ message: "Failed to upload resume" });
    }
});

module.exports = router;
