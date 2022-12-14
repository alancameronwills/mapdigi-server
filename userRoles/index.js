/** 
 * 1. Check requesting user is admin on the project
 * 2. Apply any requested change to user role on the project. 
 * 3. Return all current users with roles on this project, and also users with no roles on any project
 * @param {*} project - project id -- inferred if you are admin on one project
 * @param {*} user - RowKey of known user - i.e. user who has signed in at least once.
 * @param {*} role - role to set for that user. Omit to just remove existing role.
 */


const { TableClient, odata } = require("@azure/data-tables");

module.exports = async function (context, req) {

    // Requesting user must be signed in through Microsoft or Google.
    // If so, Azure adds this header to each incoming request:
    let adminUserId = (req.headers["x-ms-client-principal-id"] || req.headers["test-ms-client-principal-id"] || "").replace(/^[0-]*/, "").replace(/-/,"");
    if (!adminUserId) {
        context.res = { status: 401, body: "Not signed in" };
        return;
    }

    let project = (req?.query?.project || "").toLowerCase();
    let userId = req?.query?.user || "";
    let newRole = (req?.query?.role || "").toLowerCase();


    // Get the whole table:
    const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "users");
    let users = [];
    for await (const container of tableClient.listEntities()) {
        users.push(container);
    }

    // PartitionKey is ignored. RowKey is Azure sign-in id.
    let adminUser = users.find(u => u.rowKey == adminUserId);
    if (!adminUser) {
        context.res = {body: "No user with id " + adminUserId, status: 401};
        return;
    }
    let adminRole = adminUser.Role.toLowerCase();
    if (!project && adminRole != "admin") {
        let adminOf = adminRole.split(";").find(r => r.indexOf("admin:") == 0);
        if (adminOf) project = adminOf.split(":")[1];
    }
    // Role format is either just "admin" for superadmin, or "admin:project1;contributor:project2;..."
    let ok = adminRole == "admin" || project && adminRole.split(";").some(r => r == "admin:" + project);
    if (!ok) {
        context.res = { status: 401, body: "Not authorized" };
        return;
    }
    // User is authorized, so whatever the outcome we can return the table of users:
    let showUsers = adminRole == "admin"
        ? users
        // Project admins see users with a defined role on their project, and users who have signed in but have no role yet:
        : users.filter(u => { let role = u.Role; return !role || role.indexOf(":" + project) >= 0; });
    let response = { status: 200, body: { myId: adminUserId, myRole: adminRole, project: project, users: showUsers } };
    // (Although we may be about to change one of the entries in place)

    let user = userId && showUsers.find(u => u.rowKey == userId);
    if (user && project && userId != adminUserId) {
        // Get existing roles, but exclude this project:
        let userRoles = user.Role.toLowerCase()
            .split(";")
            .filter(r => r && r.indexOf(":" + project) < 0); // all but this project
        if (newRole) userRoles.push(newRole + ":" + project);
        // Update in place, for returning as HTML result:
        user.Role = userRoles.join(";");
        let update = { partitionKey: user.partitionKey, rowKey: userId, Role: user.Role };
        await tableClient.upsertEntity(update);
    }
    context.res = {
        // status: 200, /* Defaults to 200 */
        body: response
    };
}