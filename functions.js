const sgMail = require('@sendgrid/mail')
sgMail.setApiKey("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")

var sendEmail = async function sendEmail(name , email, body) {

  const orderid = body.timestamp;

  const msg = {
    to: email,
    from: 'admin@prepflix.in',
    subject: 'GJU Order #'+ orderid + ' Confirmed',
    html: '<strong>Order Success</strong>',
  }

  const res = await sgMail.send(msg);
  console.log(res);
}
module.exports.sendEmail = sendEmail;