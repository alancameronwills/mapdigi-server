// Console: npm install request --save

let request = require('request');

module.exports = async function (context, req) {

try {
    let content = await getFile(req.query.sort, context);
    context.res = {
        body: content
    }
} catch (err){
        context.res = {
            status: 400,
            body: err
        }};
}
async function getFile (filename, context) {
    var rawFN = filename == "google"
    ? `https://maps.googleapis.com/maps/api/js?key=${process.env.Client_Google_Map_K}&callback=mapModuleLoaded&libraries=places`
    : `https://www.bing.com/api/maps/mapcontrol?key=${process.env.Client_Map_K}&callback=mapModuleLoaded`;
    
    return new Promise (function (resolve, reject) {
        request(rawFN, function (error, response, body) {
            if (error) {
                reject (error);
            }
            else {
                resolve(body);
            }    
        });
    });
}