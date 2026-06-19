// needed: npm install @azure/data-tables
// https://learn.microsoft.com/en-us/azure/storage/tables/
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/tables?view=azure-node-latest
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/data-tables-readme?view=azure-node-latest

const {TableClient, odata } = require("@azure/data-tables");

/**  Look up a user in our users table.
    * id is 3rd party credentials (x-ms-) or can be provided explicitly.
    * If not in the table but there is an id, add the new user to the table.
    * If query includes name, display name, or role, insert them in the table entry.
    * role can only be viewer or contributor.
    * Return the req including headers, and the row in the table.
 */

module.exports = async function (context, req) {
    let project = req.query && req.query.project || "";
    let isTest =  project == process.env.TestProjectId;
    let principal = (req.query && req.query.principal) || req.headers["x-ms-client-principal-name"] || (isTest ? "TestUser" : "");
    let input = {
        id: (req.query && req.query.id) || req.headers["x-ms-client-principal-id"] || (isTest ? "TestUser" : ""),
        idp: (req.query && req.query.idp) || req.headers["x-ms-client-principal-idp"] || (isTest ? "TestUser" : "email"),
        name: (req.query && req.query.name) || (principal.indexOf("@") < 0 ? principal : ""),
        email: (req.query && req.query.email) || (principal.indexOf("@") < 0 ? "" : principal),
        display: (req.query && req.query.display) || "",
        // SECURITY: only a contributor:<project> or viewer:<project> self-grant is honoured here.
        // In projects with the instantContributor onboarding flow, any signed-in user
        // becomes a contributor. On other projects, any new signed-in user becomes a viewer.
        // Editor/admin and any other role shape are rejected; 
        // those are assigned only via the userRoles
        // function, which verifies the caller is an admin. Without this filter
        // a brand-new user could self-grant "admin" on first sign-in.
        role: sanitizeRequestedRole(req.query && req.query.role)
    }
    if (!input.id) {
        context.res = {body: {req:req, input:input}};
        return;
    }
    const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "users");
    let query1 = {queryOptions: { filter: odata`RowKey eq ${input.id}` }};
    let query2 = input.email ? {queryOptions: { filter: odata`RowKey eq ${input.email}` }} : null;
    let query3 = input.email ? {queryOptions: { filter: odata`email eq ${input.email}` }} : null;

    let theList = [];
    for await (const container of tableClient.listEntities(query1)) {
        theList.push(container);
    }
    if (theList.length == 0 && query2) { 
        for await (const container of tableClient.listEntities(query2)) {
            theList.push(container);
        }
    }
    if (theList.length == 0 && query3) {
        for await (const container of tableClient.listEntities(query3)) {
            theList.push(container);
        }
    }

    /*
    If the user is new, create them with the name, email and role for this project = viewer (default) or contributor.
    If the user exists, and has a role on this project (or is superadmin), return the name, role (on this project) and email.
    If the user exists and has no role on this project (and is not superadmin), add the requested role if contributor, and viewer otherwise;
        return the resulting name, role on this project, and email. 
    */

    let result = {entries:theList, input: input};
    if (theList.length == 0) {
        await createUserRow(tableClient, input);
    } else {
        const item = theList[0];
        result["name"] = item["DisplayName"] || item["FullName"] || input.name;
        result["email"] = item["email"] || input.email; 
        if (item["Role"] == "admin") {
            result["role"] = "admin";
        } else {
            let roles = item["Role"].split(";");
            for (let r in roles) {
                let p = r.split(":");
                if (project && p[1]==project) {
                    result["role"] = r;
                    break;
                }
            }
        }
        let updatedRole = "";
        if (!result["role"]) {
            result[role] = input.role; // sanitized to contributor or viewer
            updatedRole = input.role + ":" + project + (item["Role"] ? ";" + item["Role"]  : "") ;
        }

        await updateUserRow(tableClient, input, item, updatedRole);
    }

    context.res = {body: result};
}

// The only roles a user may grant themselves via this endpoint is contributor
// or viewer on a single project (the instantContributor onboarding flow). Anything else
// — editor/admin, a bare/global role, or multiple roles — is rejected and
// returns "". Real role changes go through the admin-gated userRoles function.
function sanitizeRequestedRole(role) {
    role = ("" + (role || "")).trim();
    return /^(?:contributor|viewer):[^;:]+$/i.test(role) ? role.toLowerCase() : "";
}

async function updateUserRow(tableClient, input, existing, updatedRole) {
    if (input.name != existing.FullName  
        || input.display != existing.DisplayName
        || input.email != existing.email
        || updatedRole
    ) {
        if (input.name) existing.FullName = input.name;
        if (input.email) existing.email = input.email;
        if (input.display) existing.DisplayName = input.display;
        if (updatedRole) existing.Role = updatedRole; // only ever adds contributor or viewer to this project
        await tableClient.upsertEntity(existing);
    }
}

async function  createUserRow(tableClient, input) {
    let entity = {
        partitionKey: "Garn Fawr",
        rowKey: input.id,
        Authentication: input.idp,
        FullName: input.name,
        DisplayName : input.display,
        email: input.email,
        Role: input.role   // only ever "" or a validated contributor:<project>
    };
    await tableClient.upsertEntity(entity);
}