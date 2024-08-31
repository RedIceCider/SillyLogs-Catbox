const { Catbox } = require('node-catbox');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const os = require('os');

// parse the request body because it is not already parsed
// BECAUSE WHY WOULD YOU THINK THAT  ???
// why would you expect to be able to get your body with req.body
// that would make sense so, no, we dont do that
async function parseRequestBody(req) {
    if (req.body) {
        return req.body;
    }

    const rawBody = await new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            resolve(body);
        });
    });

    try {
        return JSON.parse(rawBody);
    } catch (parseError) {
        console.error("Error parsing request body:", parseError);
        throw new Error("Invalid JSON in request body");
    }
}

/**
 * Initialize plugin.
 * @param {import('express').Router} router Express router
 * @returns {Promise<any>} Promise that resolves when plugin is initialized
 */
async function init(router) {
    // Upload file by path
    // Required body: filepath: path/to/file.ext
    // userhash
    router.post('/uploadFile', async (req, res) => {
        try {
            const parsedBody = await parseRequestBody(req);
            const [filepath, userhash] = [parsedBody.filepath, parsedBody.userhash];        
            // No userhash means Anonymous upload
            const catbox = userhash ? new Catbox(userhash) : new Catbox();

            // console.log("Filepath received: ", filepath);

            if (!filepath) {
                return res.status(400).send("Filepath is required");
            }
            const pathComponents = filepath.split('/');
            const fullPath = path.resolve(process.cwd(), 'data', 'default-user', ...pathComponents);

            // console.log("Absolute Filepath: ", fullPath);

            // Check if file exists
            try {
                await fs.access(fullPath);
            } catch (error) {
                return res.status(400).send(`File does not exist or is not accessible: ${fullPath}`);
            }

            const response = await catbox.uploadFile({ path: fullPath });
            console.log("SillyLogs: Uploaded image:", response);
            res.send(response);
        } catch (e) {
            console.error("Error: ", e);
            // Yeah I am a pro-grammer.
            if (e.message.includes("Not signed in")) {
                return res.status(401).send("Invalid user hash provided.");
            }
            res.status(500).send("An unkown error occured.");
        }
    });

    // Create temp JSON file and upload
    router.post('/uploadJson', async (req, res) => {
        try {
            const parsedBody = await parseRequestBody(req);
            const userhash = parsedBody.userhash;
            const chatlog = parsedBody.chatlog;
            if (!chatlog) {
                return res.status(400).send("Chatlog missing.");
            }
            // console.log("Chatlog received: ", chatlog);

            // Create a temporary file to write JSON content
            const tempDir = os.tmpdir();
            const tempFilePath = path.join(tempDir, 'chatlog.json');
            await fs.writeFile(tempFilePath, JSON.stringify(chatlog, null, 2), 'utf8');

            const catbox = new Catbox(userhash);
            const response = await catbox.uploadFile({ path: tempFilePath });

            // Delete the temp file after upload
            await fs.unlink(tempFilePath);
            console.log("SillyLogs: Uploaded JSON: ", response);
            res.send(response);
        } catch (e) {
            console.error("Error: ", e);
            res.status(500).send("An error occurred while handling the request");
        }
    });

    console.log("SillyLogs-Catbox plugin loaded.");
    return Promise.resolve();
}

module.exports = {
    init,
    info: {
        id: 'catbox',
        name: 'SillyLogs-Catbox',
        description: 'Add routers for catbox uploading'
    }
}
