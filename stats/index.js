const axios = require('axios');

module.exports = async function (context, req) {
    let query = req.query.query || req.body.query;
    context.log(query);
    if (!query) {
        context.res = {status: 400}; 
        return;
    }
    try {
    let result = await getQuery(query, context);
    context.res = {
        // status: 200, /* Defaults to 200 */
        body: result
    };
    } catch(e) {
        context.res = {
            status: 440,
            body: JSON.stringify(e)
        }
    }
}


function getQuery(query, context) {
    let appId = process.env["AppIdForAppInsights"];
    let apiKey = process.env["APIKeyForAppInsights"];

    const options = {
        url: `https://api.applicationinsights.io/v1/apps/${appId}/query`,
        method: 'POST',
        headers: {
            'Content-type': 'application/json;charset=utf-8',
            'Accept': 'application/json',
            'Accept-Charset': 'utf-8',
            'X-Api-Key' : apiKey,
            "Accept-Encoding" : "identity"
        },
        data: { query : query }
    };
    return new Promise(function(resolve, reject){
        axios(options)
        .then(r => resolve(r.data))
        .catch(r => reject(r));
    });
}