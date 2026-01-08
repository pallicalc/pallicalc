const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// --- YOUR EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "pallicalc@gmail.com",
    // The code you provided (spaces are fine)
    pass: "oika rndw rpzd uzrq" 
  }
});

exports.requestTransferLink = functions.https.onCall(async (data, context) => {
  // 1. Security Check: User must be logged in
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const uid = context.auth.uid;
  const userEmail = context.auth.token.email;

  // 2. Security Check: User must be an Institution Admin
  // We check the database to confirm their role
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'institutionAdmin') {
     throw new functions.https.HttpsError('permission-denied', 'You are not an admin.');
  }

  try {
    // 3. Create the "Magic Key" (Custom Token)
    // This token allows the person who clicks the link to log in AS this user.
    const customToken = await admin.auth().createCustomToken(uid);

    // 4. Create the Link
    // This points to your specific website page
    const transferLink = `https://pallicalc.pages.dev/transfer-complete.html?token=${customToken}`;

    // 5. Send the Email
    const mailOptions = {
      from: '"PalliCalc Security" <pallicalc@gmail.com>',
      to: userEmail, // Sends to the current admin's email
      subject: 'Action Required: Transfer Admin Account',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2c3e50;">Admin Transfer Request</h2>
          <p>You requested to transfer your <strong>PalliCalc Institution Admin</strong> account.</p>
          <p>If you are handing this account over to a new person (or changing your own email), click the button below.</p>
          
          <div style="margin: 30px 0;">
            <a href="${transferLink}" style="background-color: #d32f2f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
               Authorize & Start Transfer
            </a>
          </div>

          <p style="font-size: 14px; color: #666;">
            <strong>Warning:</strong> Clicking this link will allow anyone who has it to access your account. 
            Do not share this email unless you are transferring the account to someone else.
          </p>
          <p style="font-size: 12px; color: #999;">Link expires in 60 minutes.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: "Link sent to " + userEmail };

  } catch (error) {
    console.error("Transfer Error:", error);
    throw new functions.https.HttpsError('internal', 'Email failed to send. Check server logs.');
  }
});