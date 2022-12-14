const {TableClient, odata } = require("@azure/data-tables");

module.exports = {
	Changes : async function (context, days, tableName, partitionKey) {
        context.log("Changes " + days);
	    let since = new Date();
        since.setDate(since.getDate() - days);
        let filterTerms = [];
        if (partitionKey) filterTerms.push(odata`PartitionKey eq ${partitionKey}`);
        filterTerms.push(odata`Timestamp ge datetime'${since.toISOString()}'`);

        let filter = filterTerms.join(' and ');
        context.log(filter);
        const queryOptions = {
            queryOptions: { filter: filter}
        };
        const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, tableName);
        const listIterator = tableClient.listEntities(queryOptions);
        let items = [];
        for await (const item of listIterator) {
            items.push(item);
        }
        return items;
	}
}