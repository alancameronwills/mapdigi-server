// needed: npm install @azure/data-tables
// https://learn.microsoft.com/en-us/azure/storage/tables/
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/tables?view=azure-node-latest
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/data-tables-readme?view=azure-node-latest

const { TableClient, odata } = require("@azure/data-tables");
const { ContainerClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
    const blobContainerClient = new ContainerClient(process.env.AzureWebJobsStorage, "deepmap");
    const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "places");
    const queryOptions = {
        queryOptions: { filter: odata`PartitionKey eq ${process.env.TestProjectId}` }
    };
    
    const entities = tableClient.listEntities(queryOptions);

    let theList = [];
    for await (const container of entities) {
        theList.push(container);
    }
    for (const item of theList) {
        if (item.rowKey == "320501040707199024165") continue;
        await tableClient.deleteEntity(item.partitionKey, item.rowKey);
        let media = [];
        try { media = JSON.parse(item.Media || "[]"); } catch { }
        for (const medium of media) {
            await blobContainerClient.getBlockBlobClient("media/" + medium.id).deleteIfExists();
        }
    }


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
        context.log.warn("delete fail " + req.query.rowKey + ", " + req.headers["x-ms-client-principal-id"]);
    }
}