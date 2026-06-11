// Single encapsulation of project-record access. All project info goes through
// here so the storage method (currently the `projects` Table Storage table, with
// fast static copies of config/splash published to the deepmap blob) can change
// in one place. Server functions require this module directly; the client reaches
// the same data through the getProject HTTP function and the published static
// files. The splash HTML is deliberately NOT served through this hot path — it
// stays a fast static asset — so the loading splash can appear before anything
// is fetched.

const { TableClient, odata } = require("@azure/data-tables");

const PARTITION = "project";
const BLOB_CONTAINER = "deepmap";
const CACHE = new Map();             // id(lowercase) -> { record, at }
const TTL_MS = 5 * 60 * 1000;

function table() {
    return TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "projects");
}
// Lazy so the blob SDK is only loaded on the write/publish paths, keeping the
// read paths (uploadPlace, getProject) dependency-free.
function blobContainer() {
    const { ContainerClient } = require("@azure/storage-blob");
    return new ContainerClient(process.env.AzureWebJobsStorage, BLOB_CONTAINER);
}
function asBool(v) { return v === true || v === "true" || v === "TRUE"; }

function recordFromEntity(e) {
    return {
        id: e.rowKey,
        name: e.Name || "",
        instantContributor: asBool(e.InstantContributor),
        contributorRole: asBool(e.ContributorRole),
        config: e.Config || "",
        splash: e.Splash || ""
    };
}

// Fetch a project record by id (case-insensitive). Returns null if unknown.
async function get(id) {
    const key = ("" + (id || "")).toLowerCase();
    if (!key) return null;
    const hit = CACHE.get(key);
    if (hit && (Date.now() - hit.at) < TTL_MS) return hit.record;
    let record = null;
    try {
        record = recordFromEntity(await table().getEntity(PARTITION, key));
    } catch (err) {
        record = null;               // 404 => unknown project
    }
    CACHE.set(key, { record, at: Date.now() });
    return record;
}

async function isInstantContributor(id) {
    const p = await get(id);
    return !!(p && p.instantContributor);
}

// Summary of every project (id, name, flags). For admin tooling.
async function list() {
    const out = [];
    for await (const e of table().listEntities({ queryOptions: { filter: odata`PartitionKey eq ${PARTITION}` } })) {
        out.push({
            id: e.rowKey,
            name: e.Name || "",
            instantContributor: asBool(e.InstantContributor),
            contributorRole: asBool(e.ContributorRole)
        });
    }
    return out;
}

// Create or update a project, then publish its static config/splash files so
// the client keeps loading them as fast static assets.
// record: { id, name, instantContributor, contributorRole, config, splash }
async function put(record) {
    const key = ("" + record.id).toLowerCase();
    await table().upsertEntity({
        partitionKey: PARTITION,
        rowKey: key,
        Name: record.name || "",
        InstantContributor: !!record.instantContributor,
        ContributorRole: !!record.contributorRole,
        Config: record.config || "",
        Splash: record.splash || ""
    }, "Replace");
    CACHE.delete(key);
    await publishStatic(key, record.config, record.splash);
}

// Remove a project record and its published static files. Does NOT delete the
// project's places.
async function remove(id) {
    const key = ("" + id).toLowerCase();
    try { await table().deleteEntity(PARTITION, key); } catch (err) { /* already gone */ }
    CACHE.delete(key);
    const container = blobContainer();
    for (const ext of [".json", ".html"]) {
        try { await container.getBlockBlobClient("projects/" + key + ext).deleteIfExists(); } catch (err) { /* ignore */ }
    }
}

// Write projects/<id>.json and projects/<id>.html to the deepmap blob, so the
// client loads them as fast static assets (matching how it fetches them today).
async function publishStatic(id, config, splash) {
    const key = ("" + id).toLowerCase();
    const container = blobContainer();
    if (config != null) {
        await container.getBlockBlobClient("projects/" + key + ".json")
            .upload(config, Buffer.byteLength(config), { blobHTTPHeaders: { blobContentType: "application/json" } });
    }
    if (splash != null) {
        await container.getBlockBlobClient("projects/" + key + ".html")
            .upload(splash, Buffer.byteLength(splash), { blobHTTPHeaders: { blobContentType: "text/html" } });
    }
}

module.exports = { get, isInstantContributor, list, put, remove, publishStatic };
