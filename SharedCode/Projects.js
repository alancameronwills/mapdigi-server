// Single encapsulation of project-record access. All project info goes through
// here so the storage method (currently the `projects` Table Storage table)
// can change in one place. Server functions require this module directly; the
// client reaches the same data through the getProject HTTP function, which is a
// thin wrapper over it. The splash HTML is deliberately NOT served through this
// hot path — it stays a fast static asset, cached/published separately — so the
// loading splash can appear before this (or anything else) is fetched.

const { TableClient } = require("@azure/data-tables");

const PARTITION = "project";
const CACHE = new Map();             // id(lowercase) -> { record, at }
const TTL_MS = 5 * 60 * 1000;

function table() {
    return TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "projects");
}
function asBool(v) { return v === true || v === "true" || v === "TRUE"; }

// Fetch a project record by id (case-insensitive). Returns null if unknown.
// Record: { id, name, instantContributor, contributorRole, config } where
// config is the raw project JSON string the client expects.
async function get(id) {
    const key = ("" + (id || "")).toLowerCase();
    if (!key) return null;
    const hit = CACHE.get(key);
    if (hit && (Date.now() - hit.at) < TTL_MS) return hit.record;
    let record = null;
    try {
        const e = await table().getEntity(PARTITION, key);
        record = {
            id: key,
            name: e.Name || "",
            instantContributor: asBool(e.InstantContributor),
            contributorRole: asBool(e.ContributorRole),
            config: e.Config || ""
        };
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

module.exports = { get, isInstantContributor };
