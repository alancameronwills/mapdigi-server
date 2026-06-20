// needed: npm install @azure/data-tables
const { TableClient } = require("@azure/data-tables");
const projects = require("../SharedCode/Projects.js");

// Create or update a place. A write is authorized only if:
//   - it targets the designated test project, OR
//   - the target project is instantContributor (any signed-in user may
//     contribute) — via the shared Projects encapsulation, OR
//   - the signed-in caller has a contributor/editor/admin role on the project.
// The stored row is built from a fixed set of place fields, not the raw body,
// so the request can't write to arbitrary columns.

module.exports = async function (context, req) {
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const partitionKey = body.partitionKey;
    const rowKey = body.rowKey;
    if (!partitionKey || !rowKey) {
        context.res = { status: 400, body: "partitionKey and rowKey are required" };
        return;
    }

    const principalId = req.headers["x-ms-client-principal-id"] || "";
    let authorized = partitionKey == process.env.TestProjectId;
    if (!authorized && principalId) {
        // Cheapest first: instantContributor is a cached point-read; the role
        // check scans the users table and is only needed for vetted projects.
        authorized = await projects.isInstantContributor(partitionKey)
            || await callerMayContribute(principalId, partitionKey);
    }
    if (!authorized) {
        context.log.warn("upload denied: " + rowKey + " in " + partitionKey + ", principal " + (principalId || "(none)"));
        context.res = { status: 403, body: "Not authorized" };
        return;
    }

    const entity = pickPlaceFields(body);
    entity.partitionKey = partitionKey;
    entity.rowKey = rowKey;
    entity.LastModified = Date.now();
    try {
        const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "places");
        await tableClient.upsertEntity(entity);
        context.res = { status: 204 };
    } catch (err) {
        context.log.error("upload error: " + (err && err.message));
        context.res = { status: 500, body: "Upload failed" };
    }
};

// Place columns accepted from the client; anything else is dropped so the body
// can't inject arbitrary table columns. (LastModified is set server-side.)
const PLACE_FIELDS = ["Longitude", "Latitude", "Text", "Tags", "Media", "User",
    "DisplayName", "Group", "Level", "Next", "Deleted", "Range"];
function pickPlaceFields(body) {
    const e = {};
    for (const f of PLACE_FIELDS) if (body[f] !== undefined) e[f] = body[f];
    return e;
}

// True if the signed-in caller has contributor/editor/admin on `project`.
// Same users-table role model as userRoles ("admin" global, or
// "contributor:proj;editor:proj2;..."). Principal id from the EasyAuth header,
// which the App Service front door sets and clients cannot forge.
async function callerMayContribute(principalId, project) {
    const proj = ("" + project).toLowerCase();
    const normId = principalId.replace(/^[0-]*/, "").replace(/-/, "");
    const users = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "users");
    let caller = null;
    for await (const u of users.listEntities()) {
        if (u.rowKey == principalId || u.rowKey == normId) { caller = u; break; }
    }
    if (!caller || !caller.Role) return false;
    const role = caller.Role.toLowerCase();
    const onProject = role.indexOf(":") < 0
        ? role
        : (role.split(";").find(r => r.split(":")[1] == proj) || "").split(":")[0];
    return onProject == "contributor" || onProject == "editor" || onProject == "admin";
}
