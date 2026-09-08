const axios = require("axios");

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Send a transactional email via Brevo.
 * @param {Object} opts
 * @param {string} opts.to - recipient email
 * @param {string} [opts.toName] - recipient name
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text]
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendEmail = async ({ to, toName, subject, html, text }) => {
  if (!to) {
    return { success: false, error: "No recipient email provided" };
  }

  if (!process.env.BREVO_API_KEY) {
    console.warn("BREVO_API_KEY not set — skipping email send");
    return { success: false, error: "BREVO_API_KEY not configured" };
  }

  try {
    const payload = {
      sender: {
        name: process.env.BREVO_SENDER_NAME || "Rent Manager",
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
      textContent: text || html.replace(/<[^>]+>/g, " "),
    };

    const response = await axios.post(BREVO_URL, payload, {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });

    return { success: true, messageId: response.data?.messageId };
  } catch (error) {
    const errMsg =
      error.response?.data?.message ||
      error.response?.data ||
      error.message ||
      "Unknown email error";
    console.error("Brevo email send failed:", errMsg);
    return { success: false, error: errMsg };
  }
};

module.exports = { sendEmail };
