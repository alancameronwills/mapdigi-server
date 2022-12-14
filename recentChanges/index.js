const changes = require("../SharedCode/Changes.js");

module.exports = async function (context, req) {
    let days = 0 + req.query.days || 3;
    let project = req.query.project || "pererinwyf";
    let places = await changes.Changes(context, days, "places", project);
    // context.log("Found " + places.length);
    let table = [];
    for (let i = 0; i < places.length; i++) {
        let place = places[i];
        // context.log(JSON.stringify(place));
        if (place.Deleted) continue;
        let id = place.partitionKey.replace(" ", "+") + "%7C" + place.rowKey;
        table.push({
            user: place.User,
            id: id,
            title: place.Text.replace(/(<div|<p|<br).*/s, "").replace(/<[^>]*>/g, "").trim(),
            modified: place.timestamp
        });
    }
    context.res = {
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: table
    };
}