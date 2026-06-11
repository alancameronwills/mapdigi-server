// Encapsulates admin authorization, mirroring the userRoles model:
//   global role "admin"           => superadmin (administers every project)
//   role contains "admin:<proj>"  => admin of that project
// The principal id comes from the EasyAuth header, which the App Service front
// door sets and clients cannot forge.

const { TableClient } = require("@azure/data-tables");

// Resolve the caller's admin context from the request.
// Returns { id, role, isSuperAdmin, adminProjects:[lowercased project ids] }.
// id is "" when the caller is not signed in.
async function adminContext(req) {
    const rawId = (req.headers && (req.headers["x-ms-client-principal-id"] || req.headers["test-ms-client-principal-id"])) || "";
    if (!rawId) return { id: "", role: "", isSuperAdmin: false, adminProjects: [] };
    const normId = rawId.replace(/^[0-]*/, "").replace(/-/, "");
    const users = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "users");
    let caller = null;
    for await (const u of users.listEntities()) {
        if (u.rowKey == rawId || u.rowKey == normId) { caller = u; break; }
    }
    const role = (caller && caller.Role || "").toLowerCase();
    return {
        id: normId,
        role: role,
        isSuperAdmin: role == "admin",
        adminProjects: role.split(";").filter(r => r.indexOf("admin:") == 0).map(r => r.split(":")[1]).filter(Boolean)
    };
}

// True if this admin context may administer the given project.
function canAdminProject(ctx, projectId) {
    const p = ("" + (projectId || "")).toLowerCase();
    return !!(ctx && (ctx.isSuperAdmin || (p && ctx.adminProjects.indexOf(p) >= 0)));
}

module.exports = { adminContext, canAdminProject };
