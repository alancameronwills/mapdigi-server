// Public read API for a project's config — the client's entry point to the
// same project data the server uses (via the shared Projects encapsulation).
// Returns the project JSON the client expects, by id (case-insensitive).
// NB: the loading splash is NOT served here; it stays a fast static asset so it
// can appear before this is fetched.

const projects = require("../SharedCode/Projects.js");

module.exports = async function (context, req) {
    const id = (req.query && req.query.id) || "";
    if (!id) {
        context.res = { status: 400, body: "id required" };
        return;
    }
    const project = await projects.get(id);
    if (!project || !project.config) {
        context.res = { status: 404, body: "Unknown project" };
        return;
    }
    context.res = {
        headers: { "Content-Type": "application/json" },
        body: project.config        // the raw project JSON string
    };
};
