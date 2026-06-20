// Keep-warm ping. Fires every 5 minutes so the Consumption-plan worker stays
// allocated and the next real user request doesn't pay a cold start (which,
// after a day idle, was taking up to a minute to load keys/map/places).
//
// We prime BOTH storage code paths real requests use, so a warm worker doesn't
// still pay module-load + connection cost on the first hit:
//   - @azure/data-tables  : the API functions (places/uploadPlace/...).
//   - @azure/storage-blob : zz_static, which serves the static site (index.html,
//     scripts, css) by downloading blobs from the "deepmap" container. This is
//     the path that left the window blank on a cold start, so it matters most.

const { TableClient } = require("@azure/data-tables");
const { ContainerClient } = require("@azure/storage-blob");

module.exports = async function (context) {
    const connectionString = process.env.AzureWebJobsStorage;

    // Warm the table SDK + connection (used by the API functions).
    try {
        const tableClient = TableClient.fromConnectionString(connectionString, "places");
        // Pull just one row, then stop — enough to warm the SDK and connection
        // without scanning the whole partition.
        for await (const page of tableClient.listEntities().byPage({ maxPageSize: 1 })) {
            break;
        }
    } catch (e) {
        context.log.error("KeepWarm table error", e);
    }

    // Warm the blob SDK + connection by fetching the page users hit first.
    // Mirrors zz_static so the static path is primed, not just the runtime.
    try {
        const container = new ContainerClient(connectionString, "deepmap");
        await container.getBlockBlobClient("index.html").download();
    } catch (e) {
        context.log.error("KeepWarm blob error", e);
    }

    //context.log("KeepWarm ok");
}
