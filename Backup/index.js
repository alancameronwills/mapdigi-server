// https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/blockblobclient
// https://learn.microsoft.com/en-us/javascript/api/@azure/data-tables/tableclient


const { TableClient, odata } = require("@azure/data-tables");
const { BlockBlobClient } = require("@azure/storage-blob");

module.exports = async function (context) {
    await backup("places", context);
    await backup("users", context);
    await backup("strings", context);
}

async function backup(table, context) {
    const connectionString = process.env.AzureWebJobsStorage;
    const tableClient = TableClient.fromConnectionString(connectionString, table);
    const entities = tableClient.listEntities();
    let theList = [];
    for await (const container of entities) {
        theList.push(container);
    }
    context.log(`${table} ${theList.length}`);
    const blobClient = new BlockBlobClient(connectionString, `${table}backup`, new Date().toISOString()+".json");
    try {
        const content = JSON.stringify(theList);
        await blobClient.upload(content, content.length);
    } catch (e) {
        context.log(e);
    }
}