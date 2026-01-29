// Netlify Function to proxy Google Drive downloads
// This bypasses CORS restrictions

const https = require('https');
const http = require('http');

// Configuration - File IDs from Google Drive
// To get a file ID: Open file in Google Drive -> Share -> Copy link
// The ID is the part between /d/ and /view or after id=
const FILES_CONFIG = {
    chat: {
        id: 'YOUR_CHAT_FILE_ID_HERE', // Replace with actual .txt file ID
        name: 'chat.txt'
    },
    // Media files from habhoub folder - add all media file IDs here
    media: [
        // Example: { id: 'FILE_ID', name: '00001-PHOTO-2024-01-15-14-30-00.jpg' }
        // Add your media files here
    ]
};

// Helper to follow redirects and get final content
function fetchWithRedirects(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'));
            return;
        }

        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchWithRedirects(res.headers.location, maxRedirects - 1)
                    .then(resolve)
                    .catch(reject);
                return;
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

// Download a file from Google Drive
async function downloadDriveFile(fileId) {
    // Direct download URL for Google Drive
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;

    try {
        const data = await fetchWithRedirects(url);
        return data;
    } catch (error) {
        console.error(`Error downloading ${fileId}:`, error);
        throw error;
    }
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { type, fileId } = event.queryStringParameters || {};

        // Get file list
        if (type === 'list') {
            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat: FILES_CONFIG.chat,
                    media: FILES_CONFIG.media
                })
            };
        }

        // Download specific file
        if (type === 'download' && fileId) {
            const data = await downloadDriveFile(fileId);

            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Content-Type': 'application/octet-stream'
                },
                body: data.toString('base64'),
                isBase64Encoded: true
            };
        }

        // Download chat file specifically
        if (type === 'chat') {
            if (!FILES_CONFIG.chat.id || FILES_CONFIG.chat.id === 'YOUR_CHAT_FILE_ID_HERE') {
                return {
                    statusCode: 400,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Chat file ID not configured' })
                };
            }

            const data = await downloadDriveFile(FILES_CONFIG.chat.id);

            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Content-Type': 'text/plain; charset=utf-8'
                },
                body: data.toString('utf-8')
            };
        }

        return {
            statusCode: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid request. Use ?type=list, ?type=chat, or ?type=download&fileId=XXX' })
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
