module.exports = async function (context, req) {
    // The keys required by the client for various services such as maps, sign-ins, cloud storage
    // They are stored in env variables in this Function App's configuration.
        var clientKeys = {};
        for (var k in process.env) {
            if (k.startsWith("Client_")) {
                 clientKeys[k] = process.env[k];
            }
        }
        context.res = {
            body: clientKeys
        };
};