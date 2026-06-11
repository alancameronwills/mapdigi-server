// Create or edit a project.
//   - Creating a project (no existing record) is superadmin-only.
//   - Editing requires admin on that project.
//   - The security flags (instantContributor, contributorRole) may be changed
//     only by a superadmin; for project-admins they are forced back to the
//     project's existing values, both in the promoted columns and inside the
//     stored config JSON, so a project-admin can't open up their own project.
// The whole project config (the JSON the client loads) is in `config`; the
// splash HTML is in `splash`. Both are republished as fast static files.

const projects = require("../SharedCode/Projects.js");
const auth = require("../SharedCode/Auth.js");

module.exports = async function (context, req) {
    const ctx = await auth.adminContext(req);
    const body = (req.body && typeof req.body === "object") ? req.body : {};

    let config;
    try {
        config = typeof body.config === "string" ? JSON.parse(body.config) : body.config;
    } catch (e) { config = null; }
    if (!config || typeof config !== "object" || !config.id) {
        context.res = { status: 400, body: "A config object with an id is required" };
        return;
    }
    const id = ("" + config.id).toLowerCase();
    if (!/^[a-z0-9 _-]+$/.test(id)) {
        context.res = { status: 400, body: "Invalid project id" };
        return;
    }

    const existing = await projects.get(id);
    if (!existing && !ctx.isSuperAdmin) {
        context.res = { status: 403, body: "Only a superadmin may create a project" };
        return;
    }
    if (existing && !auth.canAdminProject(ctx, id)) {
        context.res = { status: 403, body: "Not authorized for this project" };
        return;
    }

    // Security flags are superadmin-only; otherwise keep the existing values.
    if (!ctx.isSuperAdmin) {
        config.instantContributor = existing ? existing.instantContributor : false;
        config.contributorRole = existing ? existing.contributorRole : false;
    }

    await projects.put({
        id: id,
        name: config.title || "",
        instantContributor: !!config.instantContributor,
        contributorRole: !!config.contributorRole,
        config: JSON.stringify(config),
        splash: typeof body.splash === "string" ? body.splash : (existing ? existing.splash : "")
    });

    context.res = { status: 204 };
};
