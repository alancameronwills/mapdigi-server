// Delete a project record and its published static files. Superadmin only.
// Does NOT delete the project's places.

const projects = require("../SharedCode/Projects.js");
const auth = require("../SharedCode/Auth.js");

module.exports = async function (context, req) {
    const ctx = await auth.adminContext(req);
    if (!ctx.isSuperAdmin) {
        context.res = { status: 403, body: "Only a superadmin may delete a project" };
        return;
    }
    const id = (req.body && req.body.id) || (req.query && req.query.id) || "";
    if (!id) {
        context.res = { status: 400, body: "id required" };
        return;
    }
    await projects.remove(id);
    context.res = { status: 204 };
};
