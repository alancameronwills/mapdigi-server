/** codeFromGit - Azure Function
 * Called by a GitHub webhook when code in the map client is updated.
 * Copies the changed files to the blob "filestore" (the deepmap container),
 * so checking client code into GitHub master updates the live site.
 *
 * To use this, set up GitHub's webhook in the client repo with the URL of this
 * function (including its function key). The GitHub webhook monitor shows
 * recent calls and their success/failure.
 *
 * Deals with additions and updates, not deletions/renames. After deleting or
 * renaming, use Azure Storage Explorer to remove the old blob.
 *
 * Files are downloaded here (following redirects) and uploaded directly, rather
 * than via beginCopyFromURL — that server-side copy was fire-and-forget and not
 * awaited, so a slow/failed/redirected copy could silently leave a 0-byte file
 * live. Now an empty or failed download throws, the file is skipped, and the
 * response is a 500 listing the failures (visible in the webhook monitor).
 */

const https = require("https");

// Azure account key is taken from the environment variable AzureWebJobsStorage.
const blobContainer = "deepmap";

const { ContainerClient } = require("@azure/storage-blob");

/** Called by the GitHub HTML webhook */
module.exports = async function (context, req) {

    // Decipher the hook, which is a multipart HTTP request:
    // Split into the major and subparts; somewhere in there is "payload":
    let bitsa = decodeURI(req.body).split("&");
    let bits = {};
    for (var i = 0; i < bitsa.length; i++) {
        var kv = bitsa[i].split('=');
        var v = decode(kv[1]);
        bits[kv[0]] = v;
    }
    let payload = bits.payload && JSON.parse(bits.payload) || "";
    if (!payload || !payload["repository"] || !payload["commits"]) {
        context.log.warn("Bad request");
        context.res = { status: 400, body: "Bad request" };
        return;
    }
    if (payload["ref"] != "refs/heads/master") {
        context.log(`Trigger from a non-master branch: ${payload["ref"]}`);
        return;
    }
    context.log(`Trigger from ${payload.repository.full_name}/${payload.repository.default_branch}`);
    let gitPath = `https://raw.githubusercontent.com/${payload.repository.full_name}/${payload.repository.default_branch}/`;
    // This doesn't deal with deletes. If you delete or rename an item, use
    // Azure Storage Explorer to remove it.
    let fileNameSet = {};
    payload.commits.forEach(commit => {
        commit.modified.forEach(item => fileNameSet[item] = 1);
        commit.added.forEach(item => fileNameSet[item] = 1);
    })
    let fileNameList = Object.keys(fileNameSet);

    context.log(JSON.stringify(fileNameList));

    let prefix = "";
    if (req.query && req.query.sub && /^\d+$/.test(req.query.sub.substr(0, 1))) prefix = req.query.sub + "/";

    // File names are relative: e.g. index.html, img/m3.png
    let containerClient = new ContainerClient(process.env.AzureWebJobsStorage, blobContainer);

    let errors = [];
    for (var i = 0; i < fileNameList.length; i++) {
        try {
            await transferToBlob(context, containerClient, gitPath, fileNameList[i], prefix);
        } catch (err) {
            context.log.error(`FAILED ${fileNameList[i]}: ${err && err.message}`);
            errors.push(`${fileNameList[i]}: ${err && err.message}`);
        }
    }
    context.res = errors.length
        ? { status: 500, body: "Some files failed:\n" + errors.join("\n") }
        : { body: "ok" };
};

function decode(s) {
    return s && s.replace(/%3A/g, ":").replace(/%2F/g, "/").replace(/%2C/g, ",").replace(/\+/g, " ").replace(/%20/g, " ");
}

/**
 * Download a code file from Git and upload it to the blob. Throws if the
 * download is empty or fails, so the caller can report it rather than
 * publishing an empty file.
 * @param {*} name - relative file path, e.g. index.html or img/m3.png
 */
async function transferToBlob(context, containerClient, gitPath, name, prefix = "") {
    let filePath = gitPath + encodeURI(name);
    let contentType = mime(name);
    context.log(`Transfer ${name}  type ${contentType}`);
    let data = await fetchBuffer(filePath);
    if (!data || data.length === 0) {
        throw new Error(`empty download from ${filePath}`);
    }
    let blockBlob = containerClient.getBlockBlobClient(prefix + name);
    await blockBlob.upload(data, data.length, { blobHTTPHeaders: { blobContentType: contentType } });
}

/** GET a URL into a Buffer, following redirects. Rejects on non-200. */
function fetchBuffer(url, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                if (redirectsLeft <= 0) { reject(new Error("too many redirects")); return; }
                let next = new URL(res.headers.location, url).toString();
                resolve(fetchBuffer(next, redirectsLeft - 1));
                return;
            }
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error("status " + res.statusCode));
                return;
            }
            let chunks = [];
            res.on("data", c => chunks.push(c));
            res.on("end", () => resolve(Buffer.concat(chunks)));
        }).on("error", reject);
    });
}

/** Return the mime type based on the filename extension.
 *  Needed because mime type from git stream isn't sufficiently accurate.
 */
function mime(filename) {
    try {
        var ex = filename.match(/\.[^.]*$/)[0].toLowerCase();
        if (ex == ".js") return "application/javascript";
        if (ex == ".html") return "text/html";
        if (ex == ".htm") return "text/html";
        if (ex == ".txt") return "text/plain";
        if (ex == ".md") return "text/markdown";
        if (ex == ".json") return "application/json";
        if (ex == ".css") return "text/css";
        if (ex == ".ico") return "image/x-icon";
        if (ex == ".pdf") return "application/pdf";
        if (ex == ".gif") return "image/gif";
        if (ex == ".mp3") return "audio/mpeg";
        if (ex == ".png") return "image/png";
        if (ex == ".jpg") return "image/jpeg";
        if (ex == ".jpeg") return "image/jpeg";
    } catch (e) { }
    return "application/octet-stream";
}
