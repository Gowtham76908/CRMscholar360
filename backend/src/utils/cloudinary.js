const cloudinary = require("cloudinary").v2;

// Configure Cloudinary only if credentials are provided in env
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}

/**
 * Upload a local file to Cloudinary
 * @param {string} localFilePath - Path to local file
 * @param {string} folder - Destination folder on Cloudinary
 * @returns {Promise<string|null>} Secure URL of uploaded image or null if not configured or failed
 */
const uploadToCloudinary = async (localFilePath, folder = "profiles", resourceType = "auto") => {
    try {
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.warn("Cloudinary is not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file.");
            return null;
        }

        const result = await cloudinary.uploader.upload(localFilePath, {
            folder: `crmscholar360/${folder}`,
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
        });

        return result.secure_url;
    } catch (error) {
        console.error("Failed to upload to Cloudinary:", error);
        return null;
    }
};

module.exports = {
    cloudinary,
    uploadToCloudinary,
};
