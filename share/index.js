/** share - Azure Function (route share/{id})
 * Replaces the old proxies.json "shareProxy": a share link /share/<id> 302-redirects
 * to /?place=<id>, which the client then opens. {id} is a place id "project|rowKey".
 * The runtime URL-decodes {id}; we substitute it verbatim, matching the old proxy's
 * responseOverrides behaviour (exercised by Cypress t4).
 */

module.exports = async function (context, req) {
    const id = req.params.id || "";
    context.res = {
        status: 302,
        headers: { "Location": "/?place=" + id }
    };
};
