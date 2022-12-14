// https://docs.sendgrid.com/api-reference/mail-send/mail-send
// https://axios-http.com/
const axios = require("axios");

module.exports = {

SendMail : async function (context, recipients, subject, message, isHtml=false) {
    const apiKey = process.env.SendGridApiKey;
    const url = "https://api.sendgrid.com/v3/mail/send";
    //context.log(apiKey);
    try {
        let msg = {
            personalizations: [
                {
                    to: recipients.map(x => { return { email: x } })
                }
            ],
            from: {email: "info@pererinwyf.org", name:"Pererin Wyf"},
            reply_to: {email: "info@pererinwyf.org", name:"Pererin Wyf"},
            subject: subject,
            content: [
                {
                    type: isHtml ? "text/html" : "text/plain",
                    value: message
                }
            ]
        }
        let data = await axios({
            responseType: "arraybuffer",
            method: "post",
            url: url,
            headers: {
                "Accept-Encoding" : "identity", // else trouble with gzipped response
                "Authorization" : `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            data: JSON.stringify(msg)
        });
        
        let h = data.headers;
        //context.log("returned");
        //context.log(JSON.stringify(h));
        return {
            headers: {"Content-Type" : h.get("content-type")},
            status: "200",
            isRaw: true,
            body: new Uint8Array(data.data)
        };

    } catch (error) {
        context.log("SendMail error: " + error); 
        return { status: 400, body: JSON.stringify(error) };
    }
}
}