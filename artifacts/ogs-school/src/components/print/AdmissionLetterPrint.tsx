/**
 * Admission Letter – official offer-of-admission template. Opens a new
 * browser window with the formatted letter + acceptance slip, then triggers
 * the print dialog. All school branding/contact/payment details are passed
 * in via `SchoolBranding` — never hardcode a specific school's bank account
 * or contact details here, since this template is shared by every tenant.
 */

import { schoolCodeFromName } from '../../lib/schoolCode';

export interface SchoolBranding {
  school_name: string;
  motto?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  /** e.g. "Account Number: 0123456789 | Account Name: ... | Bank: ..." — omit if fees are collected online. */
  bank_details?: string;
}

interface Prospect {
  first_name: string;
  last_name: string;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  address?: string | null;
  city?: string | null;
  state_of_origin?: string | null;
  gender?: string | null;
  student_type?: 'day' | 'boarding' | string | null;
  class_applying_for?: string | null;
  application_ref?: string | null;
}

function pronoun(gender?: string | null) {
  const g = (gender ?? '').toLowerCase();
  if (g === 'male')   return { him: 'him', his: 'his', he: 'he' };
  if (g === 'female') return { him: 'her', his: 'her', he: 'she' };
  return { him: 'him/her', his: 'his/her', he: 'he/she' };
}

function guardianSurname(name?: string | null): string {
  if (!name) return 'Parent/Guardian';
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function seqFromRef(ref?: string | null): string {
  if (!ref) return '001';
  const match = ref.match(/\d+$/);
  return match ? match[0].padStart(3, '0') : ref;
}

export function printAdmissionLetter(prospect: Prospect, admissionNumber: string, school: SchoolBranding) {
  const year = new Date().getFullYear();
  const p     = pronoun(prospect.gender);
  const fee   = prospect.student_type === 'boarding' ? '₦300,000' : '₦150,000';
  const type  = prospect.student_type === 'boarding' ? 'Boarding' : 'Day';
  const cls   = prospect.class_applying_for || '[CLASS]';
  const seq   = seqFromRef(prospect.application_ref);
  const ref   = `${schoolCodeFromName(school.school_name)}/PRIN/ADM/${year}/${seq}`;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const studentName = `${prospect.first_name} ${prospect.last_name}`.trim();
  const guardian = prospect.guardian_name || '[Parent/Guardian]';
  const surname  = guardianSurname(prospect.guardian_name);
  const primaryColor = school.primary_color || '#1a3a5c';
  const secondaryColor = school.secondary_color || '#1a6b3a';
  const contactLine = [school.phone && `Tel: ${school.phone}`, school.email && `Email: ${school.email}`].filter(Boolean).join(' &nbsp;|&nbsp; ');
  const bankBlock = school.bank_details || 'Contact the school office for payment instructions.';

  const addressLines = [
    guardian,
    `Parent/Guardian of ${studentName}`,
    prospect.address,
    prospect.city,
    prospect.state_of_origin,
  ].filter(Boolean).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Admission Letter – ${studentName}</title>
  <style>
    *  { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Times New Roman',Times,serif; font-size:11pt; color:#111;
           background:#fff; padding:0; }
    .page { width:210mm; min-height:297mm; margin:0 auto; padding:20mm 22mm 18mm; }

    /* ── Letterhead ── */
    .lh-wrap { display:flex; align-items:center; justify-content:space-between;
               padding-bottom:10px; }
    .lh-logo { width:72px; height:72px; object-fit:contain; }
    .lh-centre { flex:1; text-align:center; padding:0 14px; }
    .lh-name  { font-size:20pt; font-weight:900; letter-spacing:1.5px;
                color:${primaryColor}; line-height:1.1; }
    .lh-motto { font-size:9.5pt; font-style:italic; color:${secondaryColor};
                font-weight:600; margin:4px 0; }
    .lh-dets  { font-size:8.5pt; color:#333; line-height:1.5; }
    .lh-office{ font-size:9pt; font-weight:bold; color:${primaryColor}; margin-top:2px; }
    .lh-rule1 { border-top:3px solid ${primaryColor}; border-bottom:1px solid ${secondaryColor};
                height:4px; margin:6px 0 10px; }
    .lh-contact{ font-size:8pt; color:#555; text-align:center; margin-bottom:14px; }

    /* ── Body ── */
    .confidential { font-size:10pt; font-weight:bold; margin-bottom:14px; }
    .ref-date { margin-bottom:18px; }
    .ref-date p { margin-bottom:2px; font-size:10.5pt; }
    .address-block { margin-bottom:18px; white-space:pre-line; font-size:10.5pt;
                     line-height:1.7; }
    .salutation { margin-bottom:14px; font-size:10.5pt; }
    .subject { text-align:center; font-weight:bold; text-decoration:underline;
               text-transform:uppercase; font-size:10.5pt; margin-bottom:16px;
               letter-spacing:0.3px; }
    p.body { margin-bottom:12px; font-size:10.5pt; line-height:1.75;
             text-align:justify; }
    .indent { text-indent:36pt; }

    h3.section { font-size:10.5pt; font-weight:bold; text-transform:uppercase;
                 text-decoration:underline; margin:16px 0 8px; }
    ol.conds  { padding-left:22px; }
    ol.conds li { margin-bottom:10px; font-size:10.5pt; line-height:1.7; }
    .bank-block{ margin:6px 0 6px 0; padding-left:12px; line-height:1.8;
                 font-size:10.5pt; }
    ul.docs   { padding-left:22px; }
    ul.docs li{ margin-bottom:4px; font-size:10.5pt; }

    .closing  { margin-top:18px; font-size:10.5pt; }
    .sig-block{ margin-top:10px; font-size:10.5pt; }
    .sig-img  { height:64px; max-width:200px; object-fit:contain; display:block;
                margin-bottom:2px; }
    .sig-name { font-weight:bold; }
    .cc       { margin-top:10px; font-size:10pt; }

    /* ── Footer ── */
    .footer   { margin-top:20px; border-top:1px solid #555; padding-top:6px;
                text-align:center; font-size:8pt; color:#444; }

    /* ── Slip ── */
    .cut-line { margin:24px 0; display:flex; align-items:center; gap:8px;
                font-size:8.5pt; color:#555; white-space:nowrap; }
    .cut-line::before, .cut-line::after {
      content:''; flex:1; border-top:1px dashed #888; }

    .slip { }
    .slip-title { text-align:center; font-weight:900; font-size:13pt;
                  text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
    .slip-sub   { text-align:center; font-weight:bold; font-size:10.5pt;
                  text-transform:uppercase; text-decoration:underline;
                  margin-bottom:12px; }
    .slip-ref   { font-size:10pt; margin-bottom:14px; }
    p.slip-body { font-size:10.5pt; line-height:1.75; margin-bottom:18px; }
    .slip-fields{ display:grid; grid-template-columns:1fr 1fr; gap:10px 30px;
                  font-size:10.5pt; }
    .slip-field { border-bottom:1px solid #333; padding-bottom:2px; margin-top:4px; }
    .slip-label { font-size:8.5pt; color:#555; }

    @media print {
      .page { padding:14mm 18mm 12mm; }
      @page { margin:0; size:A4; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Letterhead -->
  <div class="lh-wrap">
    <img class="lh-logo" src="${school.logo_url || '/default-logo.png'}" alt="${school.school_name} Logo"/>
    <div class="lh-centre">
      <div class="lh-name">${school.school_name.toUpperCase()}</div>
      ${school.motto ? `<div class="lh-motto">${school.motto}</div>` : ''}
      ${school.address ? `<div class="lh-dets">${school.address}</div>` : ''}
      <div class="lh-office">OFFICE OF THE PRINCIPAL</div>
    </div>
  </div>
  <div class="lh-rule1"></div>
  ${contactLine ? `<div class="lh-contact">${contactLine}</div>` : ''}

  <!-- Letter body -->
  <p class="confidential">PRIVATE &amp; CONFIDENTIAL</p>

  <div class="ref-date">
    <p>Ref: ${ref}</p>
    <p>${today}</p>
  </div>

  <div class="address-block">${addressLines}</div>

  <p class="salutation">Dear ${surname},</p>

  <p class="subject">Offer of Admission into ${cls} for the ${year}/${year + 1} Academic Session</p>

  <p class="body indent">Following your ward's participation in the ${school.school_name} Entrance Examination and the
review of results by the school's Admissions Committee, I am pleased to inform you that admission
has been offered to <strong>${studentName}</strong> (Admission Number: <strong>${admissionNumber}</strong>) into
<strong>${cls}</strong> of ${school.school_name} for the ${year}/${year + 1} academic session.</p>

  <p class="body">${school.school_name} maintains a school culture built around strong academic
standards and a disciplined, values-driven environment${school.motto ? `, consistent with our motto, <em>${school.motto}</em>` : ''}.</p>

  <h3 class="section">Conditions of Admission</h3>
  <p class="body">This offer is subject to the following conditions being met on or before 9th September ${year}:</p>
  <ol class="conds">
    <li>
      Payment of the prescribed school fees of <strong>${fee} for ${type} students</strong> for First (1st) Term
      of the ${year}/${year + 1} Academic Session.<br/><br/>
      <div class="bank-block">${bankBlock}</div>
    </li>
    <li>Submission of the documents listed below at the point of registration.</li>
    <li>Completion and return of the signed Acceptance Slip attached to this letter.</li>
  </ol>

  <h3 class="section">Documents Required at Registration</h3>
  <ul class="docs">
    <li>2 recent passport photographs</li>
    <li>Last Result from previous school</li>
    <li>Copy of this admission letter</li>
  </ul>

  <h3 class="section">Resumption</h3>
  <p class="body">Resumption for newly admitted students is <strong>Monday 7th September ${year}</strong>. New students should
report to the school by 8:00 am for orientation, registration, and verification of documents and
uniform. Details of the approved school uniform and textbook list will be issued at registration.</p>

  <p class="body">We are confident that your ward will find in ${school.school_name} an institution committed to
academic excellence and discipline, and we look forward to welcoming <strong>${p.him}</strong> into the school family.</p>

  <p class="body">Should you require any clarification, please contact the school using the details below.</p>

  <p class="body">Congratulations, and welcome to ${school.school_name}.</p>

  <div class="closing">
    <p>Yours sincerely,</p>
  </div>
  <div class="sig-block">
    <p class="sig-name">&nbsp;</p>
    <p>Principal, ${school.school_name}</p>
  </div>
  <p class="cc">cc: Admissions File</p>

  <div class="footer">
    ${school.school_name}${contactLine ? ` &nbsp;|&nbsp; ${contactLine}` : ''}
  </div>

  <!-- Cut line -->
  <div class="cut-line">✂ &nbsp; DETACH AND RETURN TO THE SCHOOL &nbsp; ✂</div>

  <!-- Acceptance slip -->
  <div class="slip">
    <p class="slip-title">${school.school_name}</p>
    <p class="slip-sub">Admission Acceptance Slip</p>
    <p class="slip-ref">Ref: ${ref}</p>

    <p class="slip-body">I, <strong>${guardian}</strong>, acknowledge receipt of the offer of admission for <strong>${studentName}</strong>
into <strong>${cls}</strong> of ${school.school_name} for the ${year}/${year + 1} academic session, and
confirm my acceptance of the offer and the conditions stated therein.</p>

    <div class="slip-fields">
      <div>
        <div class="slip-label">Signature</div>
        <div class="slip-field">&nbsp;</div>
      </div>
      <div>
        <div class="slip-label">Date</div>
        <div class="slip-field">&nbsp;</div>
      </div>
      <div>
        <div class="slip-label">Phone Number</div>
        <div class="slip-field">${prospect.guardian_phone || '&nbsp;'}</div>
      </div>
      <div>
        <div class="slip-label">Admission Number</div>
        <div class="slip-field">${admissionNumber}</div>
      </div>
    </div>
  </div>

</div>
<script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to print the admission letter.'); return; }
  win.document.write(html);
  win.document.close();
}
