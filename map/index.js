const axios = require('axios');

module.exports = async function (context, req) {
    try {
        context.res = { body: await getFile(req.query.sort) };
    } catch (err) {
        context.res = { status: 400, body: err };
    }
}
async function getFile (sort) {
    if (sort !== "google") {
        throw new Error(`Unsupported map sort '${sort}' (Bing Maps was retired in 2025)`);
    }
    const url = `https://maps.googleapis.com/maps/api/js?key=${process.env.Client_Google_Map_K}&callback=mapModuleLoaded&libraries=places`;
    const response = await axios.get(url, { responseType: 'text' });
    return response.data;
}
