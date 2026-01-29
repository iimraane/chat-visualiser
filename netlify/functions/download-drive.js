// Netlify Function to stream files directly from Google Drive
// Uses Google Drive as a direct storage/CDN

const https = require('https');

// ============================================================
// CONFIGURATION - REPLACE WITH YOUR GOOGLE DRIVE FOLDER ID
// ============================================================
// To get the folder ID:
// 1. Open the Google Drive folder
// 2. Copy the URL: https://drive.google.com/drive/folders/XXXXX
// 3. The folder ID is: XXXXX
const GOOGLE_DRIVE_FOLDER_ID = '1eBlTsDxnTwpM7BNABTgnVDdQ-blksoPw';

// Optional: Google API Key for better rate limits
// Create one at https://console.cloud.google.com/apis/credentials
// const GOOGLE_API_KEY = 'YOUR_API_KEY_HERE';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return httpsGet(res.headers.location).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// List files in a Google Drive folder (public folder)
async function listFolderFiles(folderId) {
    // Use the Google Drive embed page to get file list (works without API key)
    const embedUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}`;

    try {
        const html = await httpsGet(embedUrl);
        const htmlStr = html.toString('utf-8');

        // Parse the file entries from the HTML
        // Google Drive embed page contains file info in a specific format
        const files = [];

        // Try to extract file IDs and names from the page
        // Pattern for file entries in the embed view
        const filePattern = /\["([a-zA-Z0-9_-]{25,})","([^"]+)"/g;
        let match;

        while ((match = filePattern.exec(htmlStr)) !== null) {
            const [, fileId, fileName] = match;
            if (fileId && fileName && !fileName.includes('\\')) {
                files.push({
                    id: fileId,
                    name: decodeURIComponent(fileName.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
                        String.fromCharCode(parseInt(hex, 16))
                    ))
                });
            }
        }

        return files;
    } catch (error) {
        console.error('Error listing folder:', error);
        return [];
    }
}

// Get file content from Google Drive
async function getFileContent(fileId, asText = false) {
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const data = await httpsGet(url);
    return asText ? data.toString('utf-8') : data;
}

// Determine MIME type from filename
function getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
        'txt': 'text/plain; charset=utf-8',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'mp3': 'audio/mpeg',
        'opus': 'audio/opus',
        'm4a': 'audio/mp4',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// ============================================================
// MAIN HANDLER
// ============================================================

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { action, fileId, fileName } = event.queryStringParameters || {};

        // ACTION: List all files in the folder
        if (action === 'list') {
            const files = await listFolderFiles(GOOGLE_DRIVE_FOLDER_ID);

            // Separate chat file and media files
            const chatFile = files.find(f => f.name.endsWith('.txt'));
            const mediaFiles = files.filter(f => !f.name.endsWith('.txt'));

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
                body: JSON.stringify({
                    success: true,
                    chat: chatFile || null,
                    media: mediaFiles,
                    total: files.length
                })
            };
        }

        // ACTION: Get chat file content
        if (action === 'chat') {
            const files = await listFolderFiles(GOOGLE_DRIVE_FOLDER_ID);
            const chatFile = files.find(f => f.name.endsWith('.txt'));

            if (!chatFile) {
                return {
                    statusCode: 404,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Chat file not found in folder' })
                };
            }

            const content = await getFileContent(chatFile.id, true);

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
                body: content
            };
        }

        // ACTION: Get a specific file by ID
        if (action === 'file' && fileId) {
            const data = await getFileContent(fileId);
            const mimeType = getMimeType(fileName || 'file');

            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Content-Type': mimeType,
                    'Cache-Control': 'public, max-age=604800' // Cache media for 7 days
                },
                body: data.toString('base64'),
                isBase64Encoded: true
            };
        }

        // ACTION: Get media URL proxy (returns redirect to cached content)
        if (action === 'media' && fileName) {
            const files = await listFolderFiles(GOOGLE_DRIVE_FOLDER_ID);
            const mediaFile = files.find(f => f.name === fileName);

            if (!mediaFile) {
                return {
                    statusCode: 404,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Media file not found', fileName })
                };
            }

            const data = await getFileContent(mediaFile.id);
            const mimeType = getMimeType(fileName);

            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Content-Type': mimeType,
                    'Cache-Control': 'public, max-age=604800'
                },
                body: data.toString('base64'),
                isBase64Encoded: true
            };
        }

        return {
            statusCode: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Invalid request',
                usage: {
                    list: '?action=list',
                    chat: '?action=chat',
                    file: '?action=file&fileId=XXX&fileName=example.jpg',
                    media: '?action=media&fileName=example.jpg'
                }
            })
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
