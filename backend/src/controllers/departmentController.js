const prisma = require("../utils/prisma");

// Create Department
const createDepartment = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Department name is required" });
        }

        const existingDepartment = await prisma.department.findUnique({
            where: { name }
        });

        if (existingDepartment) {
            return res.status(400).json({ message: "Department already exists" });
        }

        const department = await prisma.department.create({
            data: { name }
        });

        res.status(201).json(department);
    } catch (error) {
        res.status(500).json({ message: "Error creating department", error: error.message });
    }
};

// Get All Departments
const getDepartments = async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            orderBy: { name: "asc" },
            include: {
                _count: {
                    select: { users: true }
                }
            }
        });
        res.json(departments);
    } catch (error) {
        res.status(500).json({ message: "Error fetching departments", error: error.message });
    }
};

// Delete Department
const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;

        const department = await prisma.department.findUnique({
            where: { id },
            include: { _count: { select: { users: true } } }
        });

        if (!department) {
            return res.status(404).json({ message: "Department not found" });
        }

        if (department._count.users > 0) {
            return res.status(400).json({ message: "Cannot delete department with assigned users" });
        }

        await prisma.department.delete({ where: { id } });

        res.json({ message: "Department deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting department", error: error.message });
    }
};

// Get Single Department with Users
const getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const department = await prisma.department.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true,
                        jobTitle: true
                    }
                }
            }
        });

        if (!department) {
            return res.status(404).json({ message: "Department not found" });
        }

        res.json(department);
    } catch (error) {
        res.status(500).json({ message: "Error fetching department", error: error.message });
    }
};

module.exports = {
    createDepartment,
    getDepartments,
    getDepartmentById,
    deleteDepartment
};
