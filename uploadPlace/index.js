// needed: npm install @azure/data-tables
// https://learn.microsoft.com/en-us/azure/storage/tables/
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/tables?view=azure-node-latest
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/data-tables-readme?view=azure-node-latest

const { TableClient, odata } = require("@azure/data-tables");

module.exports = async function (context, req) {
    let project = req.query && req.query.project || "";
    if (req.body.rowKey && (req.headers["x-ms-client-principal-id"]
        || req.body.partitionKey == process.env.TestProjectId)) {
        req.body.LastModified = Date.now();
        try {
            const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "places");
            await tableClient.upsertEntity(req.body);
            context.res = {
                status: 204,
                body: req.body
            }
        } catch (err) {
            context.res = {
                status: 401,
                body: err
            }
        }

    } else {
        context.log("upload fail " + req.body.rowKey + ", " + req.headers["x-ms-client-principal-id"]);
        context.res = {
            status: 400,
            body: req
        };
    }
}