const changes = require("../SharedCode/Changes.js");
const send = require("../SharedCode/SendMail.js");
module.exports = async function (context, myTimer) {
    //await send.SendMail(context, ["alan@cameronwills.org"], "test", "<b>Test</b> <i>message</i>", true);
    await summarize(context, ["alan@cameronwills.org","rowan@span-arts.org.uk"], 7, "pererinwyf", false, true);
    await summarize(context, ["alan@cameronwills.org","asteinberg@pingry.org"], 3, "pingry");
};


async function summarize(context, recipients, days, project, doViewers=false, sendIfNoResults=false) {

    let result = `<h1>Map Digi ${project}</h1><p>New and updated places in the past ${days} days</p>`;
    let found = false;
    try {
        let places = await changes.Changes(context, days, "places", project);
        if (places.length > 0) context.log(JSON.stringify(places[0]));

        let prefix = "https://mapdigi.org/?place=";
        let outtable = places.map(t => { return { u: t.User, t: trunc(t.Text), l: prefix + t.partitionKey.replace(" ", "+") + "%7C" + t.rowKey }; });
        let outRows = "";
        for (var i = 0; i < outtable.length; i++) {
            // Exclude deleted items:
            if (outtable[i].t) { 
                found = true;
                outRows += "<tr><td>" + outtable[i].u + "</td><td><a href='" + outtable[i].l + "'>" + outtable[i].t + "</a></td></tr>";
            }
        }
        if (!found) { result += `No contributions to the map in the past ${days} days.`; }
        else result += `<table>${outRows}</table>`;
    } catch (e) { context.log("Error " + JSON.stringify(e)) }
    if (doViewers) {
        // Check viewers
        let reqbody = '{"query" : "customEvents | where timestamp > ago(7d) | summarize by user_Id '
            + '| join kind= leftanti  '
            + '( customEvents | where timestamp < ago(7d) | summarize by user_Id '
            + ') on user_Id"}';
        let uri = "https://api.applicationinsights.io/v1/apps/{app-id}/query".
            replace(/{app-id}/, process.env["APPID"]);
        let options = {
            uri: uri, method: 'POST', headers: {
                'Content-type': 'application/json;charset=utf-8',
                'Accept': 'application/json',
                'Accept-Charset': 'utf-8',
                'X-Api-Key': process.env["APIKEY"]
            },
            body: reqbody
        };

        request(options, function (error, response, resbody) {
            if (!error) {
                //context.log("c1");
                try {
                    let b = JSON.parse(resbody);
                    if (b.tables.length) {
                        result += "<p><b>" + b.tables[0].rows.length + "</b> viewers in the past week that weren't seen in past month</p>";
                    }
                    else result += error;
                } catch (eee) { context.log(eee); }
            } else context.log("Error " + error);

            result += "<p><a href='https://mapdigi.org/stats.html'>Views report</a></p>";

            send.SendMail(context, recipients, "Map Digi", result, true);
        });
    } else {
        result += "<p><a href='https://mapdigi.org/stats.html'>Views report</a></p>";
        if (sendIfNoResults || found) {
            send.SendMail(context, recipients, "Map Digi", result, true);
        }
    }

}

function trunc(s) {
    var ss = s.replace(/<[^>]*>?/g, " ");
    return (ss.length < 60 ? ss : ss.substring(0, 57) + "...");
}