
const send = require( "../SharedCode/SendMail.js")

module.exports = async function (context, req) {
    context.res = await send.SendMail(context, ["alan@cameronwills.org"], "Test", "This is a test message");
}
