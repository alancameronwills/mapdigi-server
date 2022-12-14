// needed cd ..; npm install @azure/data-tables
// https://learn.microsoft.com/en-us/azure/storage/tables/
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/tables?view=azure-node-latest
// https://learn.microsoft.com/en-gb/javascript/api/overview/azure/data-tables-readme?view=azure-node-latest

const {TableClient, odata } = require("@azure/data-tables");
module.exports = async function (context, req) {

    const connectionString = process.env.AzureWebJobsStorage;
    const tableClient = TableClient.fromConnectionString(connectionString, "strings");

    const entities = tableClient.listEntities();

    let theList = [];
    for await (const container of entities) {
        theList.push(container);
    }

    context.res = {
        body: theList
    }

}