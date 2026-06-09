const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const authMiddleware = require("../middleware/authMiddleware");
const prisma = require("../utils/prisma");
const { toSafeUser } = require("../utils/safeUser");

// Ensure upload directory exists
const uploadDir = "uploads/profiles";
const taskUploadDir = "uploads/tasks";

[uploadDir, taskUploadDir].forEach(dir => {
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
router.post("/profile-photo", uploadProfile.single("photo"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const photoUrl = `/uploads/profiles/${req.file.filename}`;

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

        // Delete uploaded file if database update fails
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file:", err);
            });
        }

        res.status(500).json({ message: "Failed to upload profile photo" });
    }
});

// Upload task files
router.post("/task-files", uploadTask.array("files", 5), async (req, res) => {
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
            // Delete file from filesystem
            const filePath = path.join(__dirname, "../..", user.profilePhoto);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
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

module.exports = router;
