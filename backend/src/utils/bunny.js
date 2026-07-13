const https = require("https");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

// ─── Bunny.net storage + CDN ────────────────────────────────────────────────
// Files are PUT to a Bunny Storage Zone and served through the attached CDN
// (Pull Zone). We store the stable CDN URL in the DB and sign it at read-time
// with Bunny Token Authentication, so gated documents get short-lived URLs.
//
// Required env (see .env.example):
//   BUNNY_STORAGE_ZONE        storage zone name
//   BUNNY_STORAGE_ACCESS_KEY  storage zone password (write key)
//   BUNNY_STORAGE_REGION      region prefix, e.g. "sg", "ny"; empty = default (DE)
//   BUNNY_PULL_ZONE_HOST      CDN hostname, e.g. yourzone.b-cdn.net
//   BUNNY_TOKEN_SECURITY_KEY  Token Authentication key from the Pull Zone

const ROOT_FOLDER = "crmscholar360"; // top-level prefix inside the storage zone
const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12h, matches the local-upload signer

const cfg = () => ({
    zone: process.env.BUNNY_STORAGE_ZONE,
    accessKey: process.env.BUNNY_STORAGE_ACCESS_KEY,
    region: process.env.BUNNY_STORAGE_REGION || "",
    pullHost: process.env.BUNNY_PULL_ZONE_HOST,
    tokenKey: process.env.BUNNY_TOKEN_SECURITY_KEY,
});

/** True when the storage credentials needed to upload are present. */
const isBunnyConfigured = () => {
    const { zone, accessKey, pullHost } = cfg();
    return Boolean(zone && accessKey && pullHost);
};

const storageHost = (region) =>
    region ? `${region}.storage.bunnycdn.com` : `storage.bunnycdn.com`;

/**
 * Upload a local file to Bunny Storage.
 * @param {string} localFilePath  path to the local file
 * @param {string} folder         subfolder inside the storage zone
 * @param {string} [_resourceType] accepted and ignored (kept for call-site compat)
 * @returns {Promise<string|null>} stable CDN URL, or null if unconfigured/failed.
 */
const uploadToBunny = async (localFilePath, folder = "profiles", _resourceType = "auto") => {
    const { zone, accessKey, region, pullHost } = cfg();
    if (!isBunnyConfigured()) {
        console.warn("Bunny is not configured. Add BUNNY_STORAGE_ZONE, BUNNY_STORAGE_ACCESS_KEY, and BUNNY_PULL_ZONE_HOST to your .env file.");
        return null;
    }

    // Random, unguessable object key so CDN URLs can't be enumerated even when public.
    const objectName = `${crypto.randomBytes(16).toString("hex")}${path.extname(localFilePath)}`;
    const objectPath = `/${ROOT_FOLDER}/${folder}/${objectName}`;

    try {
        const size = fs.statSync(localFilePath).size;
        await new Promise((resolve, reject) => {
            const req = https.request(
                {
                    method: "PUT",
                    host: storageHost(region),
                    path: `/${zone}${objectPath}`,
                    headers: {
                        AccessKey: accessKey,
                        "Content-Type": "application/octet-stream",
                        "Content-Length": size,
                    },
                },
                (res) => {
                    const chunks = [];
                    res.on("data", (c) => chunks.push(c));
                    res.on("end", () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) return resolve();
                        reject(new Error(`Bunny upload failed (${res.statusCode}): ${Buffer.concat(chunks).toString()}`));
                    });
                }
            );
            req.on("error", reject);
            fs.createReadStream(localFilePath).on("error", reject).pipe(req);
        });

        // Stored unsigned; signed on read via signBunnyUrl().
        return `https://${pullHost}${objectPath}`;
    } catch (error) {
        console.error("Failed to upload to Bunny:", error);
        return null;
    }
};

/** True if `url` points at our Bunny Pull Zone. */
const isBunnyUrl = (url) => {
    const { pullHost } = cfg();
    return Boolean(pullHost && typeof url === "string" && url.startsWith(`https://${pullHost}/`));
};

/**
 * Append a short-lived Bunny Token Authentication signature to a CDN URL.
 * Requires Token Authentication enabled on the Pull Zone with BUNNY_TOKEN_SECURITY_KEY.
 * If token auth isn't configured, the URL is returned unchanged (stays public).
 */
const signBunnyUrl = (url) => {
    const { tokenKey } = cfg();
    if (!tokenKey || !isBunnyUrl(url)) return url;

    const { pathname } = new URL(url);
    const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

    // Bunny basic token auth: base64(sha256(securityKey + path + expires)), url-safe.
    const token = crypto
        .createHash("sha256")
        .update(tokenKey + pathname + expires)
        .digest("base64")
        .replace(/\n/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

    return `https://${cfg().pullHost}${pathname}?token=${token}&expires=${expires}`;
};

module.exports = { uploadToBunny, isBunnyUrl, signBunnyUrl, isBunnyConfigured };
