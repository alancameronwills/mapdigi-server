/** codeFromGit - Azure Function
 * Called by a GitHub webhook when code in the map client is updated.
 * Copies the code to the blob "filestore."
 * 
 * Effect is that when you check the client code into GitHub master, 
 * it is automatically updated in the live version.
 * 
 * To use this, set up GitHub's webhook option in the client code repo.
 * Get the URL of this fn from Azure Functions control panel, as it includes a Function key.
 * Webhook monitor in GitHub shows recent calls and their success/failure.
 * 
 * This deals with additions and updates to the code. It doesn't deal with
 * deletions or renamings. After checking in such changes, 
 * use Azure Storage Explorer to the remove old files from the blob container.
 */

// Azure account key is taken from the environment variable AzureWebJobsStorage.
// In that account, this is the blob location:
const blobContainer = "deepmap";

const { ContainerClient } = require("@azure/storage-blob");
//const fetch = require("node-fetch");


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
    if (!payload || !payload.repository || !payload.head_commit) {
        context.log("Bad request");
        context.res.status="400";
        return;
    }
    context.log(`Trigger from ${payload.repository.full_name}/${payload.repository.default_branch}`);
    let gitPath = `https://raw.githubusercontent.com/${payload.repository.full_name}/${payload.repository.default_branch}/`;
    // This doesn't deal with deletes. If you delete or rename an item, use 
    // Azure Storage Explorer to remove it.
    let commit = payload.head_commit;
    let fileNames = commit.modified.concat(commit.added);

    context.log(JSON.stringify(fileNames));

    let prefix = "";
    if (req.query && req.query.sub && /^\d+$/.test(req.query.sub.substr(0,1))) prefix = req.query.sub + "/";
    //if (payload.repository.id != 191463966) prefix = "2/";

    // File names are relative: e.g. index.html, img/m3.png
    let containerClient = new ContainerClient(process.env.AzureWebJobsStorage, blobContainer);

    for (var i = 0; i < fileNames.length; i++) {
        try {
            await transferToBlob(context, containerClient, gitPath, fileNames[i], prefix);
        } catch (err) { context.log(err); }
    }
    context.res = {
        // status: 200, /* Defaults to 200 */
        body: "ok"
    };

    /*
    Notice that we're moving the files one at a time into the live code.
    So for a checkin with many files:
    (a) there is a period during the updates when the code is inconsistent, 
    with some files updated and some not
    (b) there's a danger that a failure half way through could leave it inconsistent
    If doing it properly, we'd make a copy of the target blob container,
    update the contents of the copy, and then switch the names of the containers 
    to complete the transaction.
    Note that the try-catch doesn't protect against a failure half way through
    stopping the others. An exception in the child thread isn't caught by this, and 
    will leave the await waiting for ever. The process will eventually time out.
    */
};

function decode(s) {
    return s && s.replace(/%3A/g, ":").replace(/%2F/g, "/").replace(/%2C/g, ",").replace(/\+/g, " ").replace(/%20/g, " ");
}

/**
 * Copy a code file from Git to the blob 'filestore' 
 * @param {*} context - for logging
 * @param {*} name - relative file path, e.g. index.html or img/m3.png
 */
async function transferToBlob(context, containerClient, gitPath, name, prefix="", awaitDone=false) {
    let filePath = gitPath + name;
    context.log(`Transfer ${name}`);
    let blobClient = containerClient.getBlobClient(prefix+name);
    let poller = await blobClient.beginCopyFromURL(filePath);
    if (awaitDone) {
        await poller.pollUntilDone();
    }
}
