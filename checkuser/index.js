// needed: npm install @azure/data-tables
// https://learn.microsoft.com/en-us/azure/storage/tables/
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/tables?view=azure-node-latest
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/data-tables-readme?view=azure-node-latest

const {TableClient, odata } = require("@azure/data-tables");

/**  Look up a user in our users table.
    * id is 3rd party credentials (x-ms-) or can be provided explicitly.
    * If not in the table but there is an id, add the new user to the table.
    * If query includes name, display name, or role, insert them in the table entry.
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
        role: (req.query && req.query.role) || ""
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

    let result = {entries:theList, input: input};
    if (theList.length > 0) {
        const item = theList[0];
        result["name"] = item["DisplayName"] || item["FullName"] || input.name;
        result["role"] = item["Role"] || input.role;
        result["email"] = item["email"] || input.email; 
        await updateUserRow(tableClient, input, item);
    } else {
        await createUserRow(tableClient, input);
    }

    context.res = {body: result};
}

async function updateUserRow(tableClient, input, existing) {
    if (input.name != existing.FullName  
        || input.display != existing.DisplayName
        || input.email != existing.email
    ) {
        if (input.name) existing.FullName = input.name;
        if (input.email) existing.email = input.email;
        if (input.display) existing.DisplayName = input.display;
        // Don't update role - see userRoles()
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
        Role: input.role
    };
    await tableClient.upsertEntity(entity);
}