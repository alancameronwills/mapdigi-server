// https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-delete-javascript
// https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/blockblobclient

const { ContainerClient } = require("@azure/storage-blob");

module.exports = async function (context, myTimer) {
    await containerCleanup("placesbackup", context);
    await containerCleanup("stringsbackup", context);
    await containerCleanup("usersbackup", context);
};

async function containerCleanup(containerName, context) {
    context.log(`Inspecting ${containerName}:`);
    let toClean = [];
    let monthAgo = Date.now() - 24 * 60 * 60 * 1000 * 30;
    let prvsMonth = -1;
    const containerClient = new ContainerClient(process.env.AzureWebJobsStorage, containerName);
    try {
        for await (const blob of containerClient.listBlobsFlat()) {
            let fileDate = blob.properties.createdOn;
            let fileMonth = fileDate.getMonth();
            let fileTime = fileDate.getTime();
            //context.log(`${containerName} | ${blob.name} month: ${fileMonth} time: ${fileTime}`);
            if (fileTime < monthAgo && fileMonth == prvsMonth) {
                toClean.push(blob.name);
            } else {
                prvsMonth = fileMonth;
            }
        }
        context.log(`Cleaning ${containerName}:`);
        for (var i = 0; i < toClean.length; i++) {
            context.log("  " + toClean[i]);
            await containerClient.deleteBlob(toClean[i]);
        }

    } catch (e) {
        context.log(e);
    }
}