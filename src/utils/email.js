const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must be set in environment variables to send email.",
    );
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  return transporter;
}

async function sendPasswordResetOTP(toEmail, name, otp) {
  const mailer = getTransporter();

  await mailer.sendMail({
    from: `"Digital Logics Studio" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: "Your password reset code",
    text: `Hi ${name},\n\nYour password reset code is ${otp}. It expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">Reset your password</h2>
        <p>Hi ${name},</p>
        <p>Use the code below to reset your Digital Logics Studio password. This code expires in <strong>10 minutes</strong>.</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f4f4f5; padding: 16px 24px; text-align: center; border-radius: 8px;">${otp}</p>
        <p style="color: #666; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

function baseLayout(heading, bodyHtml) {
  const appUrl = process.env.CLIENT_URL || "#";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <h2 style="color: #111; margin-bottom: 4px;">${heading}</h2>
      ${bodyHtml}
      <a href="${appUrl}" style="display:inline-block; margin-top: 20px; background:#111; color:#fff; text-decoration:none; padding: 10px 18px; border-radius: 6px; font-size: 14px;">Open Digital Logics Studio</a>
      <hr style="border:none; border-top:1px solid #eee; margin: 28px 0 12px;" />
      <p style="color:#999; font-size:12px;">
        You're receiving this because you have an account on Digital Logics Studio.
        Manage your email preferences from your account settings.
      </p>
    </div>
  `;
}

/** Welcome email — sent once, right after signup. */
function buildWelcomeEmail(user) {
  const subject = "Welcome to Digital Logics Studio";
  const html = baseLayout(
    `Welcome, ${user.name}`,
    `<p>Your account is ready. Digital Logics Studio helps you practice digital logic design problems with instant feedback.</p>
     <p>Jump in and solve your first problem to start tracking progress.</p>`,
  );
  const text = `Hi ${user.name},\n\nWelcome to Digital Logics Studio! Your account is ready — start practicing at ${process.env.CLIENT_URL || ""}`;
  return { subject, html, text };
}

/** Milestone email — sent once per threshold (5, 10, 25 problems solved, etc). */
function buildMilestoneEmail(user, milestone) {
  const subject = `You've solved ${milestone} problems`;
  const html = baseLayout(
    `Nice work, ${user.name} 🎉`,
    `<p>You've just crossed <strong>${milestone} solved problems</strong> on Digital Logics Studio.</p>
     <p>Keep the streak going — there's always another topic to explore.</p>`,
  );
  const text = `Hi ${user.name},\n\nYou've solved ${milestone} problems on Digital Logics Studio. Keep it up!`;
  return { subject, html, text };
}

/** Weekly digest — sent when a user has had activity since their last digest. */
function buildWeeklyDigestEmail(user, stats) {
  const subject = "Your week on Digital Logics Studio";
  const html = baseLayout(
    `Here's your week, ${user.name}`,
    `<ul style="padding-left: 18px; line-height: 1.8;">
       <li><strong>${stats.attempts}</strong> attempts made</li>
       <li><strong>${stats.solved}</strong> problems solved</li>
       <li><strong>${stats.topicsOpened}</strong> topics opened</li>
     </ul>
     <p>Consistent practice is what moves the needle — see you again this week.</p>`,
  );
  const text = `Hi ${user.name},\n\nYour week: ${stats.attempts} attempts, ${stats.solved} solved, ${stats.topicsOpened} topics opened.`;
  return { subject, html, text };
}

/** Inactivity reminder — sent when a user has gone quiet for a while. */
function buildInactivityEmail(user, daysInactive) {
  const subject = "We miss you at Digital Logics Studio";
  const html = baseLayout(
    `It's been ${daysInactive} days, ${user.name}`,
    `<p>Your progress is saved and waiting for you. A quick session today keeps things fresh.</p>`,
  );
  const text = `Hi ${user.name},\n\nIt's been ${daysInactive} days since your last session on Digital Logics Studio. Your progress is saved — come back anytime.`;
  return { subject, html, text };
}

module.exports = {
  getTransporter,
  sendPasswordResetOTP,
  buildWelcomeEmail,
  buildMilestoneEmail,
  buildWeeklyDigestEmail,
  buildInactivityEmail,
};
