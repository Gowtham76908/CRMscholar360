const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

function getKey() {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error("ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes)");
    }
    return Buffer.from(hex, "hex");
}

function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decrypt(ciphertext) {
    const key = getKey();
    const [ivHex, authTagHex, dataHex] = ciphertext.split(":");
    if (!ivHex || !authTagHex || !dataHex) throw new Error("Malformed ciphertext");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return decipher.update(Buffer.from(dataHex, "hex")) + decipher.final("utf8");
}

module.exports = { encrypt, decrypt };
