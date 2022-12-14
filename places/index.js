// needed cd ..; npm install @azure/data-tables
// https://learn.microsoft.com/en-us/azure/storage/tables/
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/tables?view=azure-node-latest
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/data-tables-readme?view=azure-node-latest

const {TableClient, odata } = require("@azure/data-tables");
module.exports = async function (context, req) {
    const partitionKey = req?.query?.project || "Garn Fawr";
    const queryOptions = {
        queryOptions: { filter: odata`PartitionKey eq ${partitionKey}` }
    };
    const connectionString = process.env.AzureWebJobsStorage;
    const tableClient = TableClient.fromConnectionString(connectionString, "places");

    const entities = tableClient.listEntities(queryOptions);

    let theList = [];
    for await (const container of entities) {
        theList.push(container);
    }

    context.res = {
        body: theList
    }

}