const prisma = require("../utils/prisma");
const bcrypt = require("bcrypt");
const { upsertUserToStream } = require("./chatController");

// Create User (Super Admin only)
const createUser = async (req, res) => {
    try {
        const { name, email, phone, role, department, password, jobTitle } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        if (role === "ADMIN" && req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Only Super Admins can create Admins" });
        }

        if (role === "SUPER_ADMIN") {
            return res.status(403).json({ message: "Cannot create Super Admin users" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Find department ID if department name is provided
        let departmentId = undefined;
        if (department) {
            const deptRecord = await prisma.department.findUnique({
                where: { name: department }
            });
            if (deptRecord) {
                departmentId = deptRecord.id;
            }
        }

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                role: role || "EMPLOYEE",
                department, // Keep string for backward compatibility or display
                departmentId, // Link to actual Department model
                jobTitle: req.body.jobTitle,
                isActive: true
            }
        });

        const { password: _, ...userWithoutPassword } = newUser;

        // Sync to Stream Chat so the new user appears in chat search immediately
        upsertUserToStream(newUser).catch(err =>
            console.error("[Chat sync] Failed to sync new user to Stream:", err.message)
        );

        res.status(201).json({ message: "User created successfully", user: userWithoutPassword });
    } catch (error) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
};

// Get Team (Super Admin only)
const getTeam = async (req, res) => {
    try {
        const team = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                department: true,
                jobTitle: true,
                createdAt: true,
                onlineStatus: true,
                breakStartedAt: true
            },
            orderBy: { createdAt: "desc" }
        });
        res.json(team);
    } catch (error) {
        res.status(500).json({ message: "Error fetching team", error: error.message });
    }
};

// Toggle User Access
const toggleUserAccess = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive },
            select: { id: true, isActive: true }
        });

        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: "Error toggling user access", error: error.message });
    }
};

// Update User
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, role, department, jobTitle } = req.body;

        // Find department ID if department name is provided
        let departmentId = undefined;
        if (department) {
            const deptRecord = await prisma.department.findUnique({
                where: { name: department }
            });
            if (deptRecord) {
                departmentId = deptRecord.id;
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                name,
                phone,
                role,
                department,
                departmentId,
                jobTitle
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                department: true,
                jobTitle: true
            }
        });

        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: "Error updating user", error: error.message });
    }
};

// Hard Delete User (Remove from DB)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Hard delete (Prisma will handle Lead/Task unassignment via SetNull)
        await prisma.user.delete({
            where: { id }
        });

        res.json({ message: "User permanently deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting user", error: error.message });
    }
};

module.exports = {
    getTeam,
    createUser,
    toggleUserAccess,
    updateUser,
    deleteUser
};
