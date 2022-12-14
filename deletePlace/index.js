// needed: npm install @azure/data-tables
// https://learn.microsoft.com/en-us/azure/storage/tables/
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/tables?view=azure-node-latest
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/data-tables-readme?view=azure-node-latest

const { TableClient, odata } = require("@azure/data-tables");

module.exports = async function (context, req) {
    if (req.query.partitionKey && req.query.rowKey && (req.headers["x-ms-client-principal-id"]
        || req.query.partitionKey == process.env.TestProjectId)) {
        req.body.LastModified = Date.now();
        try {
            const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "places");
            await tableClient.deleteEntity(req.query.partitionKey, req.query.rowKey);
        } catch (err) {
            context.res = {
                status: 401,
                body: err
            }
        }

    } else {
        context.res = {
            status: 400,
            body: req
        };
        context.log("delete fail " + req.query.rowKey + ", " + req.headers["x-ms-client-principal-id"]);
    }
}