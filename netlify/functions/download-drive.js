// Netlify Function to stream files directly from Google Drive
// Uses Google Drive as a direct storage/CDN

const https = require('https');

// ============================================================
// CONFIGURATION
// ============================================================
// The folder ID from your Google Drive link
const GOOGLE_DRIVE_FOLDER_ID = '1eBlTsDxnTwpM7BNABTgnVDdQ-blksoPw';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function httpsGet(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                ...options.headers
            }
        }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return httpsGet(res.headers.location, options).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });
        req.on('error', reject);
    });
}

// Get file content from Google Drive using direct download URL
async function getFileContent(fileId, isText = false) {
    // Try the export URL first (works better for shared files)
    const url = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    const data = await httpsGet(url);
    return isText ? data.toString('utf-8') : data;
}

// List files using Google Drive's public folder viewer
async function listFolderFiles(folderId) {
    try {
        // Use the folder view page which contains file info
        const viewUrl = `https://drive.google.com/drive/folders/${folderId}`;
        const html = await httpsGet(viewUrl);
        const htmlStr = html.toString('utf-8');

        const files = [];

        // Look for file entries in the Google Drive folder page
        // Format: ["fileId","fileName",... 
        // Also try the data format used in Google Drive
        const patterns = [
            // Pattern 1: Standard file entries
            /\["([\w-]{20,})","([^"]+\.\w{2,4})"/g,
            // Pattern 2: Alternate format
            /"([\w-]{25,})"[^"]*"name":"([^"]+\.\w{2,4})"/g,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(htmlStr)) !== null) {
                const [, fileId, fileName] = match;
                // Filter out non-file IDs and decode unicode
                if (fileId && fileName && fileId.length >= 20 && !files.some(f => f.id === fileId)) {
                    const decodedName = fileName.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
                        String.fromCharCode(parseInt(hex, 16))
                    );
                    files.push({ id: fileId, name: decodedName });
                }
            }
        }

        // If pattern matching fails, try extracting from data-id attributes
        if (files.length === 0) {
            const dataIdPattern = /data-id="([\w-]{25,})"/g;
            const namePattern = /aria-label="([^"]+\.\w{2,4})"/g;

            let ids = [];
            let names = [];
            let match;

            while ((match = dataIdPattern.exec(htmlStr)) !== null) {
                ids.push(match[1]);
            }
            while ((match = namePattern.exec(htmlStr)) !== null) {
                names.push(match[1]);
            }

            // Match IDs with names (they should be in same order)
            for (let i = 0; i < Math.min(ids.length, names.length); i++) {
                files.push({ id: ids[i], name: names[i] });
            }
        }

        console.log(`Found ${files.length} files in folder ${folderId}`);
        return files;
    } catch (error) {
        console.error('Error listing folder:', error);
        return [];
    }
}

// Determine MIME type from filename
function getMimeType(filename) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
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
        'Cache-Control': 'public, max-age=3600'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = event.queryStringParameters || {};
        const action = params.action || params.type; // Support both old and new param names

        // ACTION: List all files
        if (action === 'list') {
            const files = await listFolderFiles(GOOGLE_DRIVE_FOLDER_ID);

            // Separate chat file and media files
            const chatFile = files.find(f => f.name.toLowerCase().endsWith('.txt'));
            const mediaFiles = files.filter(f => !f.name.toLowerCase().endsWith('.txt'));

            // If no files found via scraping, return a helpful error
            if (files.length === 0) {
                return {
                    statusCode: 200,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        success: false,
                        error: 'Could not list folder contents. Make sure the folder is publicly shared.',
                        folderId: GOOGLE_DRIVE_FOLDER_ID
                    })
                };
            }

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
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
            // First get the file list to find the chat file
            const files = await listFolderFiles(GOOGLE_DRIVE_FOLDER_ID);
            const chatFile = files.find(f => f.name.toLowerCase().endsWith('.txt'));

            if (!chatFile) {
                // Fallback: try to fetch directly if we have a known chat file ID
                return {
                    statusCode: 404,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        error: 'Chat file not found',
                        filesFound: files.length
                    })
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
        if ((action === 'file' || action === 'download') && params.fileId) {
            const data = await getFileContent(params.fileId);
            const mimeType = getMimeType(params.fileName || 'file');

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

        // ACTION: Get media by filename
        if (action === 'media' && params.fileName) {
            const files = await listFolderFiles(GOOGLE_DRIVE_FOLDER_ID);
            const mediaFile = files.find(f => f.name === params.fileName);

            if (!mediaFile) {
                return {
                    statusCode: 404,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Media not found', fileName: params.fileName })
                };
            }

            const data = await getFileContent(mediaFile.id);
            const mimeType = getMimeType(params.fileName);

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
                usage: '?action=list | ?action=chat | ?action=file&fileId=XXX | ?action=media&fileName=XXX'
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
