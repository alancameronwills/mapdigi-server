// Keep-warm ping. Fires every 5 minutes so the Consumption-plan worker stays
// allocated and the next real user request doesn't pay a cold start (which,
// after a day idle, was taking up to a minute to load keys/map/places).
// Does a tiny table touch as well as just being invoked, so the @azure/data-tables
// module and the storage connection are primed, not only the runtime.

const { TableClient } = require("@azure/data-tables");

module.exports = async function (context) {
    const connectionString = process.env.AzureWebJobsStorage;
    const tableClient = TableClient.fromConnectionString(connectionString, "places");
    try {
        // Pull just one row, then stop — enough to warm the SDK and connection
        // without scanning the whole partition.
        for await (const page of tableClient.listEntities().byPage({ maxPageSize: 1 })) {
            break;
        }
        context.log("KeepWarm ok");
    } catch (e) {
        context.log("KeepWarm error", e);
    }
}
