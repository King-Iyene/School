import { Router } from 'express';
import { logger } from '../lib/logger';

const router = Router();

const FROM = 'Okrika Grammar School <admissions@okrikagrammarschool.org>';
const STATUS_URL = 'https://eportal.okrikagrammarschool.org/application-status';

function admissionWelcomeHtml(p: {
  firstName: string;
  lastName: string;
  applicationRef: string;
  classApplyingFor: string;
  guardianName: string;
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Application Received – Okrika Grammar School</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#0d9488);padding:36px 40px;text-align:center;">
            <img src="https://eportal.okrikagrammarschool.org/ogs_logo_bg.png" alt="OGS Logo" width="72" height="72"
              style="border-radius:14px;background:rgba(255,255,255,0.15);padding:6px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;" />
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px;">
              Okrika Grammar School
            </h1>
            <p style="color:#a7f3d0;margin:6px 0 0;font-size:14px;">Anglican Communion · Est. 1944</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">

            <!-- Greeting -->
            <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#0f172a;">
              Dear ${p.guardianName},
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Thank you for submitting an admission application for <strong>${p.firstName} ${p.lastName}</strong>
              to Okrika Grammar School. We are delighted to receive your interest and look forward to welcoming
              ${p.firstName} into our school community.
            </p>

            <!-- Application ref card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;">Application Reference</p>
                  <p style="margin:0 0 12px;font-size:28px;font-weight:800;color:#14532d;font-family:monospace;letter-spacing:2px;">${p.applicationRef}</p>
                  <p style="margin:0;font-size:13px;color:#166534;">
                    Class applied for: <strong>${p.classApplyingFor || 'Not specified'}</strong>
                  </p>
                </td>
              </tr>
            </table>

            <!-- Step 1: Pay fee -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="padding:20px 24px;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;">
                  <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#92400e;">
                    ① Pay the ₦5,000 Application Fee
                  </p>
                  <p style="margin:0 0 14px;font-size:14px;color:#78350f;line-height:1.6;">
                    To proceed with your application, please make a bank transfer of <strong>₦5,000</strong>
                    to the account below. After payment, visit the portal to confirm your transfer.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #fde68a;">
                    <tr style="background:#fef3c7;">
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;">Bank</td>
                      <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#1e293b;text-align:right;">Ecobank Nigeria</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;border-top:1px solid #fde68a;">Account Number</td>
                      <td style="padding:10px 16px;font-size:18px;font-weight:800;color:#1e293b;font-family:monospace;text-align:right;border-top:1px solid #fde68a;letter-spacing:2px;">0562040932</td>
                    </tr>
                    <tr style="background:#fef3c7;">
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;border-top:1px solid #fde68a;">Account Name</td>
                      <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;text-align:right;border-top:1px solid #fde68a;">Okrika Grammar School<br/>(Anglican Communion)</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;border-top:1px solid #fde68a;">Amount</td>
                      <td style="padding:10px 16px;font-size:18px;font-weight:800;color:#059669;text-align:right;border-top:1px solid #fde68a;">₦5,000</td>
                    </tr>
                  </table>
                  <p style="margin:12px 0 0;font-size:13px;color:#92400e;background:#fef3c7;border-radius:8px;padding:10px 14px;">
                    ⚠️ <strong>Important:</strong> Use your application reference <strong>${p.applicationRef}</strong>
                    as the payment narration so we can identify your transfer.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Step 2: Entrance Exam -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="padding:20px 24px;background:#eff6ff;border:1.5px solid #93c5fd;border-radius:12px;">
                  <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1d4ed8;">
                    ② Prepare for the Entrance Examination
                  </p>
                  <p style="margin:0 0 12px;font-size:14px;color:#1e40af;line-height:1.6;">
                    After your payment is verified, you will be invited to sit the OGS Entrance Examination.
                    Here is how to prepare:
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${[
                      ['📖', 'English Language', 'Reading comprehension, grammar, essay writing, and vocabulary.'],
                      ['🔢', 'Mathematics', 'Arithmetic, basic algebra, fractions, percentages, and word problems.'],
                      ['🌍', 'General Knowledge', 'Current affairs, Nigerian history, civics, and general science.'],
                    ].map(([icon, subject, desc]) => `
                    <tr>
                      <td style="padding:8px 0;vertical-align:top;">
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:2px 10px 2px 0;font-size:18px;vertical-align:top;">${icon}</td>
                            <td>
                              <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1e3a8a;">${subject}</p>
                              <p style="margin:0;font-size:13px;color:#3b82f6;">${desc}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>`).join('')}
                  </table>
                </td>
              </tr>
            </table>

            <!-- Step 3: Interview -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;background:#faf5ff;border:1.5px solid #d8b4fe;border-radius:12px;">
                  <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#7c3aed;">
                    ③ Principal's Interview
                  </p>
                  <p style="margin:0;font-size:14px;color:#6d28d9;line-height:1.6;">
                    Successful candidates from the entrance exam will be invited for a brief interview
                    with the Principal. Dress neatly, arrive on time, and be prepared to speak about
                    your interests and goals.
                  </p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${STATUS_URL}" style="display:inline-block;background:linear-gradient(135deg,#059669,#0d9488);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
                    Track Your Application Status
                  </a>
                </td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;" />

            <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6;">
              If you have any questions, please contact our admissions office:
            </p>
            <p style="margin:0;font-size:13px;color:#0f172a;">
              📧 <a href="mailto:admissions@okrikagrammarschool.org" style="color:#059669;text-decoration:none;">admissions@okrikagrammarschool.org</a>
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;">
              Okrika Grammar School (Anglican Communion)
            </p>
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              This email was sent because an admission application was submitted for ${p.firstName} ${p.lastName}.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

router.post('/api/email/admission-welcome', async (req, res) => {
  const { firstName, lastName, guardianName, guardianEmail, applicationRef, classApplyingFor } = req.body ?? {};

  if (!guardianEmail || !applicationRef) {
    return res.status(400).json({ error: 'guardianEmail and applicationRef are required' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('RESEND_API_KEY not set — skipping admission welcome email');
    return res.status(200).json({ skipped: true, reason: 'RESEND_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [guardianEmail],
        subject: `Application Received – ${firstName} ${lastName} | Okrika Grammar School`,
        html: admissionWelcomeHtml({ firstName, lastName, guardianName, applicationRef, classApplyingFor }),
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      logger.error({ data }, 'Resend API error');
      return res.status(502).json({ error: data?.message ?? 'Email send failed' });
    }

    logger.info({ id: data.id, to: guardianEmail }, 'Admission welcome email sent');
    return res.status(200).json({ ok: true, id: data.id });
  } catch (err: any) {
    logger.error({ err }, 'Failed to send admission email');
    return res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   Admission confirmation email  (sent when a student is formally admitted)
───────────────────────────────────────────────────────────────────────────── */

function admissionConfirmHtml(p: {
  firstName: string;
  lastName: string;
  guardianName: string;
  admissionNumber: string;
  studentType: 'boarding' | 'day' | string;
  classAdmittedFor: string;
  password: string;
  resumptionDate: string;
}) {
  const fee     = p.studentType === 'boarding' ? '₦300,000' : '₦150,000';
  const typeStr = p.studentType === 'boarding' ? 'Boarding' : 'Day';
  const loginId = p.admissionNumber; // admission number is the login username

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Admission Confirmed – Okrika Grammar School</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#0d9488);padding:36px 40px;text-align:center;">
            <img src="https://eportal.okrikagrammarschool.org/ogs_logo_bg.png" alt="OGS Logo" width="72" height="72"
              style="border-radius:14px;background:rgba(255,255,255,0.15);padding:6px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;" />
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px;">
              Okrika Grammar School
            </h1>
            <p style="color:#a7f3d0;margin:6px 0 0;font-size:14px;">Anglican Communion · Est. 1944</p>
          </td>
        </tr>

        <!-- Congratulations banner -->
        <tr>
          <td style="background:#f0fdf4;border-bottom:2px solid #86efac;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:28px;">🎉</p>
            <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#14532d;">Congratulations!</h2>
            <p style="margin:0;font-size:15px;color:#166534;line-height:1.6;">
              <strong>${p.firstName} ${p.lastName}</strong> has been officially admitted to<br/>
              <strong>Okrika Grammar School</strong>.
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">

            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Dear ${p.guardianName},<br/><br/>
              We are thrilled to inform you that <strong>${p.firstName} ${p.lastName}</strong> has been
              successfully admitted to Okrika Grammar School as a <strong>${typeStr} student</strong>.
              Please find all the important details below.
            </p>

            <!-- Admission card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;">Admission Number</p>
                  <p style="margin:0 0 14px;font-size:30px;font-weight:800;color:#14532d;font-family:monospace;letter-spacing:3px;">${p.admissionNumber}</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#166534;"><strong>Class:</strong></td>
                      <td style="padding:4px 0;font-size:13px;color:#166534;text-align:right;">${p.classAdmittedFor || 'To be confirmed'}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#166534;border-top:1px solid #bbf7d0;"><strong>Student Type:</strong></td>
                      <td style="padding:4px 0;font-size:13px;color:#166534;border-top:1px solid #bbf7d0;text-align:right;">${typeStr}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#166534;border-top:1px solid #bbf7d0;"><strong>Resumption Date:</strong></td>
                      <td style="padding:4px 0;font-size:13px;font-weight:700;color:#059669;border-top:1px solid #bbf7d0;text-align:right;">${p.resumptionDate}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Login credentials -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:12px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1d4ed8;">🔐 Student Portal Login Credentials</p>
                  <p style="margin:0 0 14px;font-size:13px;color:#1e40af;line-height:1.6;">
                    Use these credentials to access the OGS student portal at
                    <a href="https://eportal.okrikagrammarschool.org" style="color:#1d4ed8;">eportal.okrikagrammarschool.org</a>.
                    Please keep them safe and change the password after first login.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #bfdbfe;">
                    <tr style="background:#dbeafe;">
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#1e40af;text-transform:uppercase;">Username / Admission No.</td>
                      <td style="padding:10px 16px;font-size:16px;font-weight:800;color:#1e3a8a;text-align:right;font-family:monospace;letter-spacing:1px;">${loginId}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#1e40af;text-transform:uppercase;border-top:1px solid #bfdbfe;">Password</td>
                      <td style="padding:10px 16px;font-size:16px;font-weight:800;color:#1e3a8a;text-align:right;font-family:monospace;border-top:1px solid #bfdbfe;">${p.password}</td>
                    </tr>
                  </table>
                  <p style="margin:10px 0 0;font-size:12px;color:#1e40af;background:#dbeafe;border-radius:8px;padding:8px 12px;">
                    ⚠️ Please change your password after your first login for security.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Fee payment -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;">
                  <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#92400e;">
                    💳 Pay Your School Fees — ${fee} (${typeStr})
                  </p>
                  <p style="margin:0 0 14px;font-size:14px;color:#78350f;line-height:1.6;">
                    Please make payment of <strong>${fee}</strong> (First Term school fees for ${typeStr} students)
                    to the account below before resumption. Use your admission number
                    <strong>${p.admissionNumber}</strong> as the payment narration.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #fde68a;">
                    <tr style="background:#fef3c7;">
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;">Bank</td>
                      <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#1e293b;text-align:right;">Ecobank Nigeria</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;border-top:1px solid #fde68a;">Account Number</td>
                      <td style="padding:10px 16px;font-size:18px;font-weight:800;color:#1e293b;font-family:monospace;text-align:right;border-top:1px solid #fde68a;letter-spacing:2px;">0562040932</td>
                    </tr>
                    <tr style="background:#fef3c7;">
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;border-top:1px solid #fde68a;">Account Name</td>
                      <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;text-align:right;border-top:1px solid #fde68a;">Okrika Grammar School<br/>(Anglican Communion)</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;border-top:1px solid #fde68a;">Amount</td>
                      <td style="padding:10px 16px;font-size:18px;font-weight:800;color:#059669;text-align:right;border-top:1px solid #fde68a;">${fee}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Next steps -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border:1.5px solid #d8b4fe;border-radius:12px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#7c3aed;">📋 Before Resumption Checklist</p>
                  ${[
                    ['💳', 'Pay school fees of <strong>' + fee + '</strong> before ' + p.resumptionDate + '.'],
                    ['👕', 'Purchase the OGS school uniform from the school store or approved vendors.'],
                    ['📚', 'Obtain the booklist from the school office and purchase required textbooks.'],
                    ['🏥', 'Submit any medical records or special health notes to the school nurse.'],
                    ['🔐', 'Log in to the student portal and change your default password.'],
                  ].map(([icon, text]) => `
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                    <tr>
                      <td style="width:28px;vertical-align:top;font-size:16px;padding-top:1px;">${icon}</td>
                      <td style="font-size:14px;color:#4c1d95;line-height:1.6;">${text}</td>
                    </tr>
                  </table>`).join('')}
                </td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;" />

            <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6;">
              For enquiries, contact our admissions office:
            </p>
            <p style="margin:0;font-size:13px;color:#0f172a;">
              📧 <a href="mailto:admissions@okrikagrammarschool.org" style="color:#059669;text-decoration:none;">admissions@okrikagrammarschool.org</a>
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;">
              Okrika Grammar School (Anglican Communion) · Est. 1944
            </p>
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              This email was sent to the parent/guardian of ${p.firstName} ${p.lastName} upon formal admission.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

router.post('/api/email/admission-confirm', async (req, res) => {
  const {
    firstName, lastName, guardianName, guardianEmail,
    admissionNumber, studentType, classAdmittedFor, password,
    resumptionDate,
  } = req.body ?? {};

  if (!guardianEmail || !admissionNumber) {
    return res.status(400).json({ error: 'guardianEmail and admissionNumber are required' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('RESEND_API_KEY not set — skipping admission confirmation email');
    return res.status(200).json({ skipped: true, reason: 'RESEND_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [guardianEmail],
        subject: `Admission Confirmed – ${firstName} ${lastName} | Okrika Grammar School`,
        html: admissionConfirmHtml({
          firstName, lastName, guardianName: guardianName || 'Parent/Guardian',
          admissionNumber, studentType: studentType || 'day',
          classAdmittedFor: classAdmittedFor || '',
          password, resumptionDate: resumptionDate || '7th September, 2025',
        }),
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      logger.error({ data }, 'Resend API error (admission-confirm)');
      return res.status(502).json({ error: data?.message ?? 'Email send failed' });
    }

    logger.info({ id: data.id, to: guardianEmail }, 'Admission confirmation email sent');
    return res.status(200).json({ ok: true, id: data.id });
  } catch (err: any) {
    logger.error({ err }, 'Failed to send admission confirmation email');
    return res.status(500).json({ error: err.message });
  }
});

export default router;
