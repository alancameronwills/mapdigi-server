// List the projects the signed-in admin may manage. Superadmins get all;
// project-admins get only theirs. Drives the admin console's project list.

const projects = require("../SharedCode/Projects.js");
const auth = require("../SharedCode/Auth.js");

module.exports = async function (context, req) {
    const ctx = await auth.adminContext(req);
    if (!ctx.isSuperAdmin && ctx.adminProjects.length == 0) {
        context.res = { status: 403, body: "Not authorized" };
        return;
    }
    const all = await projects.list();
    const visible = ctx.isSuperAdmin ? all : all.filter(p => ctx.adminProjects.indexOf(p.id) >= 0);
    context.res = { body: { isSuperAdmin: ctx.isSuperAdmin, projects: visible } };
};
