const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const axios = require("axios");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get audio duration using ffprobe
 */
function getAudioDuration(filePath) {
    try {
        const result = execSync(
            `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
            { encoding: "utf-8", timeout: 10000 }
        );
        return parseFloat(result.trim());
    } catch {
        console.log("ffprobe not available, skipping duration detection.");
        return null;
    }
}

/**
 * Split audio into chunks using ffmpeg
 */
function splitAudio(filePath, chunkLengthSec = 600) {
    const duration = getAudioDuration(filePath);
    if (!duration || duration <= chunkLengthSec) {
        return [filePath];
    }

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < duration) {
        const chunkPath = path.join(dir, `${base}_chunk${index}${ext}`);
        try {
            execSync(
                `ffmpeg -y -i "${filePath}" -ss ${start} -t ${chunkLengthSec} -acodec copy "${chunkPath}"`,
                { encoding: "utf-8", timeout: 60000, stdio: "pipe" }
            );
            chunks.push(chunkPath);
        } catch (err) {
            console.error(`Failed to split chunk ${index}:`, err.message);
            break;
        }
        start += chunkLengthSec;
        index++;
    }

    return chunks.length > 0 ? chunks : [filePath];
}

/**
 * Download a recording from URL to a temp file
 */
async function downloadRecording(url, destPath) {
    const response = await axios({
        method: "GET",
        url,
        responseType: "stream",
        timeout: 60000,
    });

    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });
}

// Pass 1: Quick transcription for context
async function getQuickTranscription(filePath) {
    console.log("Pass 1: Quick transcription for context...");
    const quickTranscription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
        response_format: "text",
        language: "en",
    });

    return typeof quickTranscription === "string"
        ? quickTranscription
        : quickTranscription.text || String(quickTranscription);
}

// Pass 2: Full detailed transcription with context
async function transcribeSingleFile(filePath, contextPrompt) {
    return await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
        language: "en",
        prompt: contextPrompt,
    });
}

// Pass 3: AI analysis + summary
async function generateFullSummary(fullTranscriptText) {
    console.log("Pass 3: Generating summary + metadata...");

    const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are an expert call analyst. You are given the full English transcription of a call recording.

You must respond with ONLY a valid JSON object (no markdown, no code fences). The JSON must have these exact keys:

{
  "summary": "<comprehensive summary string>",
  "tone": "<one of: Professional, Casual, Frustrated, Polite, Aggressive, Neutral>",
  "urgency": "<one of: High, Medium, Low>",
  "emotion": "<one of: Calm, Angry, Anxious, Happy, Sad, Neutral>",
  "category": "<one of: Complaint, Inquiry, Follow-up, Sales, Support, General>",
  "sentiment": "<strictly one of: Good, Bad, Neutral>",
  "feedback": "<bullet points or a short paragraph extracting constructive feedback or key takeaways from the call>",
  "conclusion": "<how the call concluded, final agreements or tone>"
}

For the "summary" field, write a COMPREHENSIVE and DETAILED English summary including:
1. Call Overview - purpose, participants, context
2. Detailed Summary - point-by-point discussion
3. Key Points - decisions, requests, complaints
4. Actions/Outcomes - next steps, resolutions
5. Conclusion - how the call ended

Make it detailed enough that someone who didn't listen can fully understand. Write in English.`,
            },
            {
                role: "user",
                content: `Here is the full transcription of a call recording:\n\n${fullTranscriptText}\n\nGenerate the JSON response with summary and metadata.`,
            },
        ],
        max_tokens: 2000,
        temperature: 0.3,
    });

    const raw = summaryResponse.choices[0]?.message?.content?.trim() || "{}";

    try {
        const parsed = JSON.parse(raw);
        return {
            summary: parsed.summary || "",
            tone: parsed.tone || "Neutral",
            urgency: parsed.urgency || "Medium",
            emotion: parsed.emotion || "Neutral",
            category: parsed.category || "General",
            sentiment: parsed.sentiment || "Neutral",
            feedback: parsed.feedback || "No specific feedback mentioned.",
            conclusion: parsed.conclusion || "No clear conclusion.",
        };
    } catch {
        return {
            summary: raw,
            tone: "Neutral",
            urgency: "Medium",
            emotion: "Neutral",
            category: "General",
            sentiment: "Neutral",
            feedback: "Parsing failed.",
            conclusion: "Parsing failed.",
        };
    }
}

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Main transcription function - downloads recording and runs 3-pass transcription
 */
async function transcribeFromUrl(recordingUrl) {
    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const tempFile = path.join(uploadsDir, `recording_${Date.now()}.mp3`);

    try {
        console.log("Downloading recording...");
        await downloadRecording(recordingUrl, tempFile);

        return await runThreePassTranscription(tempFile, true);
    } catch (error) {
        // Cleanup on error
        try { fs.unlinkSync(tempFile); } catch { }
        throw error;
    }
}

/**
 * Transcribe from a local file path (no download needed)
 */
async function transcribeFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Recording file not found: ${filePath}`);
    }

    console.log(`Transcribing local file: ${filePath}`);
    return await runThreePassTranscription(filePath, false);
}

/**
 * Core 3-pass transcription logic
 * @param {string} filePath - Path to the audio file
 * @param {boolean} cleanup - Whether to delete the file after processing
 */
async function runThreePassTranscription(filePath, cleanup = false) {
    try {
        console.log("Starting 3-pass transcription...");

        // Pass 1
        const roughText = await getQuickTranscription(filePath);
        const contextPrompt = roughText.length > 500 ? roughText.substring(0, 500) + "..." : roughText;

        // Pass 2
        console.log("Pass 2: Full detailed transcription...");
        const chunks = splitAudio(filePath, 600);

        let allSegments = [];
        let allText = [];
        let totalDuration = 0;
        let timeOffset = 0;

        for (let i = 0; i < chunks.length; i++) {
            const transcription = await transcribeSingleFile(chunks[i], contextPrompt);

            if (transcription.text) allText.push(transcription.text);
            if (transcription.duration) totalDuration += transcription.duration;

            if (transcription.segments?.length > 0) {
                const adjusted = transcription.segments.map((seg) => ({
                    ...seg,
                    start: seg.start + timeOffset,
                    end: seg.end + timeOffset,
                }));
                allSegments = allSegments.concat(adjusted);
            }

            if (transcription.duration) timeOffset += transcription.duration;

            if (chunks[i] !== filePath) {
                try { fs.unlinkSync(chunks[i]); } catch { }
            }
        }

        const plainText = allText.join(" ");
        const duration = totalDuration > 0 ? Math.round(totalDuration) : null;

        let timestampedText = plainText;
        if (allSegments.length > 0) {
            timestampedText = allSegments
                .map((seg) => `[${formatTime(seg.start)} - ${formatTime(seg.end)}] ${seg.text.trim()}`)
                .join("\n");
        }

        // Pass 3
        const metadata = await generateFullSummary(plainText);

        console.log("Transcription complete.");

        return {
            transcription: timestampedText,
            plainText,
            duration,
            ...metadata,
        };
    } finally {
        if (cleanup) {
            try { fs.unlinkSync(filePath); } catch { }
        }
    }
}

module.exports = { transcribeFromUrl, transcribeFromFile };
