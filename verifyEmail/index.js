
const send = require("../SharedCode/SendMail.js");
const {TableClient, odata } = require("@azure/data-tables");

/**
 * Set an email address for a new or existing user, 
 * generate and record a verification token, and send the token to the user by email.
 * @param {*} email - a valid email address (required)
 * @param {*} id - RowKey of a user. Or can be provided in header.
 * @param {*} token - If provided, check against the recorded key. If not provided, send a key. 
 */
module.exports = async function (context, req) {
    
    let token = (req?.query?.token || req?.body?.token || "").trim();
    
    let email = (req?.query?.email || req?.body?.email || "").trim().toLowerCase();
    let id = req?.query?.id || req?.headers["x-ms-client-principal-id"] || email;
    
    if (!id || !email && !token) {
        context.res = {
            status: 400,
            body: "Need id and email or token"
        };
        return;
    }
    
    context.log("X10");
    const tableClient = TableClient.fromConnectionString(process.env.AzureWebJobsStorage, "users");
    let query1 = {queryOptions: { filter: odata`RowKey eq ${id}` }};
    let theList = [];
    for await (const container of tableClient.listEntities(query1)) {
        theList.push(container);
    }
    context.log("X20");
    if (theList.length == 0) {
        context.res = {
            status: 400,
            body: "No user with id: " + id
        };
        return;
    }
    
    context.log("X30");
    if (token) await checkValidationKey(context, tableClient, theList[0], token);
    else await setValidationKey(context, tableClient, theList[0], email);
}


/** Check the token against that stored in the user record. Return in status. If OK, nullify token in record.
 * 
 */

async function checkValidationKey(context, tableClient, row, token) {
    if (row.validation != token) {
        context.log("Wrong token " + row.rowKey);
        context.res = { status: 401, body: "Wrong token" };
        return;
    }
    // context.log("Verified " + row.partitionKey + " " + row.rowKey);
    try {
        await tableClient.updateEntity({
            partitionKey: row.partitionKey, 
            rowKey:row.rowKey, 
            validation:""
        });
    } catch (e) {
        context.log("Table error: " + e);
        context.res = { status: 250, body: "Table update error " + e };
        return;
    } 
    context.res = { status: 200,
    headers: {"Content-Type":"text/html"},
     body: "<html><body><h1>Email verified - thanks!</h1></body></html>" };
}

/**  Generate a validation token, store it in validation field, send it to user.
 * @param {*} context - Azure functions context
 * @param {*} tableClient - Azure table service
 * @param {*} message - The message to be sent
 * @param {*} email - The user's email address
 * @param {*} row The existing record
 */

async function setValidationKey (context, tableClient, row, email) {
    let token = row.validation || ("" + Date.now()).substr(-4);
    let name = row.FullName || "";
    
    context.log("X50");
    try {
        await tableClient.updateEntity({
            partitionKey: row.partitionKey, 
            rowKey:row.rowKey, 
            validation: token
        });
    } catch (e) {
        context.log("Table error: " + e);
        context.res = { status: 550, body: "Table update error " + e };
        return;
    } 
    
    context.log("X60");
    let link = `https://mapdigi.azurewebsites.net/api/verifyEmail?id=${row.rowKey}&token=${token}`;
    let tokenMessage = `Hi ${name},<br/>
    Please use this code to validate your email address: <a href="${link}">${token}</a><br/>
    Best wishes<br/>
    Map Digi`;
    send.SendMail(context, [email], "Map Digi", tokenMessage, true);
    context.res = {status: 201, body: `Sent code to ${email}`}
}



