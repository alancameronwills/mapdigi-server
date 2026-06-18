/** static - Azure Function (catch-all {*path})
 * Serves the static site from the "deepmap" blob container, replacing the old
 * Azure Functions Proxies (proxies.json: root/htmlProxy/cssProxy/imgProxy/
 * scriptsProxy/projectsProxy). Bytes are streamed through the host exactly as the
 * reverse-proxy did, so there is no behaviour or caching change.
 *
 * Routing: this is a {*path} catch-all. The explicit "api/..." routes on the real
 * API functions, and "share/{id}", are more specific and take precedence, so this
 * only handles everything else (/, /index.html, /css/*, /img/*, /scripts/*, ...).
 *
 * The container connection comes from AzureWebJobsStorage, as in codeFromGit.
 */

const { ContainerClient } = require("@azure/storage-blob");

const blobContainer = "deepmap";

module.exports = async function (context, req) {
    // {*path} is already URL-decoded by the runtime; "" / undefined means the root.
    let name = (req.params.path || "").replace(/^\/+/, "");
    if (name === "") name = "index.html";

    // Defend against path traversal out of the container.
    if (name.split("/").some(seg => seg === "..")) {
        context.res = { status: 400, body: "Bad path" };
        return;
    }

    try {
        const container = new ContainerClient(process.env.AzureWebJobsStorage, blobContainer);
        const blob = container.getBlockBlobClient(name);

        if ((req.method || "GET").toUpperCase() === "HEAD") {
            const props = await blob.getProperties();
            context.res = {
                status: 200,
                headers: { "Content-Type": props.contentType || "application/octet-stream" }
            };
            return;
        }

        const dl = await blob.download();
        const body = await streamToBuffer(dl.readableStreamBody);
        context.res = {
            status: 200,
            headers: { "Content-Type": dl.contentType || "application/octet-stream" },
            isRaw: true,
            body: body
        };
    } catch (err) {
        if (err && (err.statusCode === 404 || err.code === "BlobNotFound")) {
            context.res = { status: 404, body: "Not found" };
            return;
        }
        context.log(`static: failed serving '${name}': ${err && err.message}`);
        context.res = { status: 500, body: "Error" };
    }
};

function streamToBuffer(readable) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readable.on("data", d => chunks.push(d instanceof Buffer ? d : Buffer.from(d)));
        readable.on("end", () => resolve(Buffer.concat(chunks)));
        readable.on("error", reject);
    });
}
