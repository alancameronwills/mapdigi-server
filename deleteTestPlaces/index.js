// needed: npm install @azure/data-tables
// https://learn.microsoft.com/en-us/azure/storage/tables/
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/tables?view=azure-node-latest
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/data-tables-readme?view=azure-node-latest

const { TableClient, odata } = require("@azure/data-tables");
const { BlobContainerClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
    const blobContainerClient = new BlobContainerClient(process.env.AzureWebJobsStorage, "deepmap");
    const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "places");
    const queryOptions = {
        queryOptions: { filter: odata`PartitionKey eq ${process.env.TestProjectId}` }
    };
    
    const entities = tableClient.listEntities(queryOptions);

    let theList = [];
    for await (const container of entities) {
        theList.push(container);
    }
    theList.forEach(item => {
        if (item.rowKey == "320501040707199024165") continue;
        await tableClient.deleteEntity(item.partitionKey, item.rowKey);
        let media = JSON.parse(item.Media);
        media.forEach(medium => {
            await blobContainerClient.DeleteBlobIfExistsAsync("media/"+medium.id, 1);
        })
    })


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