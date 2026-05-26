const prisma = require("../utils/prisma");
const bcrypt = require("bcrypt");
const { upsertUserToStream } = require("./chatController");

// Create User (Super Admin only)
const createUser = async (req, res, next) => {
    try {
        const { name, email, phone, role, department, password, jobTitle } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        if (role === "MANAGER" && req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Only Super Admins can create Managers" });
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

        const { managerId } = req.body;
        if (managerId) {
            const { validateManagerAssignment } = require("../services/organizationService");
            const check = await validateManagerAssignment("__new__", managerId);
            if (!check.ok) return res.status(400).json({ message: check.message });
        }

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                role: role || "EMPLOYEE",
                department,
                departmentId,
                jobTitle: req.body.jobTitle,
                managerId: managerId || null,
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
        return next(error);
    }
};

// Get Team (Super Admin only)
const getTeam = async (req, res, next) => {
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
                breakStartedAt: true,
                managerId: true,
                manager: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" }
        });
        res.json(team);
    } catch (error) {
        return next(error);
    }
};

// Toggle User Access
const toggleUserAccess = async (req, res, next) => {
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
        return next(error);
    }
};

// Update User
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, phone, role, department, jobTitle, managerId } = req.body;

        if (role === "SUPER_ADMIN") {
            return res.status(403).json({ message: "Cannot assign SUPER_ADMIN role" });
        }
        if (role === "MANAGER" && req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Only Super Admins can assign the Manager role" });
        }

        if (managerId !== undefined && managerId !== null) {
            const { validateManagerAssignment } = require("../services/organizationService");
            const check = await validateManagerAssignment(id, managerId);
            if (!check.ok) return res.status(400).json({ message: check.message });
        }

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
                jobTitle,
                ...(managerId !== undefined && { managerId: managerId || null }),
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                department: true,
                jobTitle: true,
                managerId: true,
                manager: { select: { id: true, name: true } },
            }
        });

        res.json(updatedUser);
    } catch (error) {
        return next(error);
    }
};

// Hard Delete User (Remove from DB)
const deleteUser = async (req, res, next) => {
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
        return next(error);
    }
};

module.exports = {
    getTeam,
    createUser,
    toggleUserAccess,
    updateUser,
    deleteUser
};
