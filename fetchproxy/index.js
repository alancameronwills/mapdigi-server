// https://axios-http.com/docs
const axios = require("axios");
module.exports = async function (context, req) {

    try {
        context.log(req.query.url);
        let data = await axios(req.query.url, {
            responseType: "arraybuffer",
            headers: {
                "Accept-Encoding" : "identity" // else trouble with gzipped response
            }
        });
        
        let h = data.headers;
        //context.log("returned");
        //context.log(JSON.stringify(h));
        context.res = {
            headers: {"Content-Type" : h.get("content-type")},
            status: "200",
            isRaw: true,
            body: new Uint8Array(data.data)
        };

    } catch (error) {
        context.log("X1 " + error); context.res = { status: 400, body: "" };
    }

    //context.res = {body:"hello"};
}

function stringup(data) {
    var cache = [];
    var result = JSON.stringify(data, function (key, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                // Circular reference found, discard key
                return;
            }
            // Store value in our collection
            cache.push(value);
        }
        return value;
    });
    cache = null; // Enable garbage collection
    return result;
}
