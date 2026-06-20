// needed: npm install @azure/data-tables
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/data-tables-readme?view=azure-node-latest

const { TableClient } = require("@azure/data-tables");

// Permanently (hard) delete a place. This is an ADMIN-only operation: the
// normal app delete is a SOFT delete via uploadPlace (which sets the Deleted
// flag), so the client never calls this. Authorization mirrors the userRoles
// function's role model: the caller must be a superadmin ("admin") or an admin
// on the target project ("admin:<project>"). The designated test project is
// left open so the e2e suite can clean up.
module.exports = async function (context, req) {
    const partitionKey = req.query.partitionKey;
    const rowKey = req.query.rowKey;
    if (!partitionKey || !rowKey) {
        context.res = { status: 400, body: "partitionKey and rowKey are required" };
        return;
    }

    const isTest = partitionKey == process.env.TestProjectId;
    if (!isTest && !(await callerIsProjectAdmin(req, partitionKey))) {
        context.log.warn("delete denied: rowKey " + rowKey + ", principal " + (req.headers["x-ms-client-principal-id"] || "(none)"));
        context.res = { status: 403, body: "Not authorized" };
        return;
    }

    try {
        const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "places");
        await tableClient.deleteEntity(partitionKey, rowKey);
        context.res = { status: 204 };
    } catch (err) {
        context.log.error("delete error: " + (err && err.message));
        context.res = { status: 500, body: "Delete failed" };
    }
}

// True if the signed-in caller is a superadmin or an admin on `project`.
// Uses the same users table + role format ("admin", or "admin:<project>;...")
// as the userRoles function. The principal id comes from the EasyAuth header,
// which the App Service front door sets and clients cannot forge; we match it
// against the users-table RowKey in both raw and normalised form to cover how
// different functions store it.
async function callerIsProjectAdmin(req, project) {
    const rawId = req.headers["x-ms-client-principal-id"] || req.headers["test-ms-client-principal-id"] || "";
    if (!rawId) return false;
    const normId = rawId.replace(/^[0-]*/, "").replace(/-/, "");
    const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "users");
    let caller = null;
    for await (const u of tableClient.listEntities()) {
        if (u.rowKey == rawId || u.rowKey == normId) { caller = u; break; }
    }
    if (!caller || !caller.Role) return false;
    const role = caller.Role.toLowerCase();
    const proj = ("" + project).toLowerCase();
    return role == "admin" || role.split(";").some(r => r == "admin:" + proj);
}
