import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ConferenceRegistration() {
  const [fullName, setFullName] = useState('');
  const [church, setChurch] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [couple, setCouple] = useState<'yes' | 'no'>('no');
  const [spouseName, setSpouseName] = useState('');
  const [spousePhone, setSpousePhone] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Use the diocese logo as favicon + set page title while on this page
  useEffect(() => {
    const prevTitle = document.title;
    document.title = '2026 Wakirike Be-Se Bible Study Conference — Registration';

    const icons = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']"));
    const previous = icons.map((el) => ({ el, href: el.href }));
    if (icons.length === 0) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = '/diocese_of_okrika_logo.jpg';
      document.head.appendChild(link);
      previous.push({ el: link, href: '' });
    } else {
      icons.forEach((el) => { el.href = '/diocese_of_okrika_logo.jpg'; });
    }

    return () => {
      document.title = prevTitle;
      previous.forEach(({ el, href }) => {
        if (href) el.href = href;
        else el.remove();
      });
    };
  }, []);

  const handleSubmit = async () => {
    const errs: Record<string, boolean> = {};
    if (!fullName.trim() || fullName.trim().length > 200) errs.fullName = true;
    if (!church.trim() || church.trim().length > 200) errs.church = true;
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) errs.email = true;
    if (phone.trim().length < 5 || phone.trim().length > 30) errs.phone = true;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const { error } = await supabase.from('conference_registrations').insert({
        full_name: fullName.trim(),
        church: church.trim(),
        email: email.trim() || null,
        phone: phone.trim(),
        is_couple: couple === 'yes',
        spouse_name: couple === 'yes' ? spouseName.trim() || null : null,
        spouse_phone: couple === 'yes' ? spousePhone.trim() || null : null,
      });
      if (error) throw error;
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitError('Registration could not be submitted. Please try again or contact the organisers.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { type?: string; placeholder?: string; error?: boolean; errorKey?: string; required?: boolean; inputMode?: 'tel' | 'email' | 'text' } = {},
  ) => (
    <div className="cr-field">
      <label className="cr-label">
        {label} {opts.required && <span className="cr-req">*</span>}
      </label>
      <input
        type={opts.type || 'text'}
        inputMode={opts.inputMode}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (opts.errorKey) setErrors((p) => ({ ...p, [opts.errorKey!]: false }));
        }}
        placeholder={opts.placeholder}
        className={`cr-input${opts.error ? ' cr-input-error' : ''}`}
      />
    </div>
  );

  return (
    <div className="cr-page">
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .cr-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: linear-gradient(170deg, #1a0800 0%, #2d1206 35%, #1a0800 70%, #0d0400 100%);
          font-family: 'Inter', sans-serif;
          color: #FFFDF5;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .cr-bg {
          position: fixed;
          inset: 0;
          background-image: url(/conference_flyer.jpg);
          background-size: cover;
          background-position: center top;
          opacity: 0.12;
          filter: saturate(0.85);
          pointer-events: none;
        }
        .cr-bg-tint {
          position: fixed;
          inset: 0;
          background: linear-gradient(170deg, rgba(26,8,0,0.6) 0%, rgba(45,18,6,0.4) 35%, rgba(26,8,0,0.65) 70%, rgba(13,4,0,0.85) 100%);
          pointer-events: none;
        }
        .cr-wrap {
          position: relative;
          width: 100%;
          max-width: 560px;
          padding: 20px 0 40px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .cr-header { text-align: center; margin-bottom: 22px; padding: 0 16px; }
        .cr-logo {
          width: 84px; height: auto; margin: 0 auto 12px; display: block;
          border-radius: 8px; filter: drop-shadow(0 4px 12px rgba(223,173,76,0.35));
        }
        .cr-org {
          font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;
          color: #EFC168; font-weight: 600; margin-bottom: 8px; line-height: 1.5;
        }
        .cr-title {
          font-family: 'Playfair Display', serif; font-weight: 900;
          font-size: clamp(22px, 6vw, 28px); line-height: 1.25; color: #FFFFFF;
          margin-bottom: 14px; text-shadow: 0 2px 8px rgba(0,0,0,0.6);
        }
        .cr-theme {
          display: inline-block; background: linear-gradient(135deg, #EFC168, #C4872A);
          color: #1a0800; font-family: 'Playfair Display', serif; font-weight: 700;
          font-size: clamp(16px, 4.5vw, 19px); padding: 8px 22px; border-radius: 6px; margin-bottom: 10px;
        }
        .cr-scripture { font-size: 14px; color: #EFC168; font-style: italic; margin-bottom: 12px; }
        .cr-meta { font-size: 15px; color: rgba(255,253,245,0.9); line-height: 1.7; }
        .cr-meta strong { color: #EFC168; font-size: 16px; }
        .cr-rule {
          width: 120px; height: 2px; border: 0;
          background: linear-gradient(90deg, transparent, #EFC168, transparent);
          margin: 18px auto 0;
        }
        .cr-card {
          background: linear-gradient(165deg, rgba(38,15,4,0.97) 0%, rgba(22,7,0,0.99) 100%);
          border: 1px solid rgba(239,193,104,0.3);
          border-radius: 16px;
          padding: 28px 20px 32px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          margin: 0 12px;
          flex: 1;
        }
        .cr-form-heading {
          font-family: 'Playfair Display', serif; font-weight: 700; font-size: 24px;
          color: #EFC168; text-align: center; margin-bottom: 24px;
        }
        .cr-field { margin-bottom: 18px; }
        .cr-label {
          display: block; font-size: 15px; font-weight: 600; color: #FFFDF5;
          margin-bottom: 8px; letter-spacing: 0.2px;
        }
        .cr-req { color: #EFC168; }
        .cr-input {
          width: 100%; padding: 15px 16px; box-sizing: border-box;
          background: rgba(255,255,255,0.09);
          border: 1.5px solid rgba(239,193,104,0.35);
          border-radius: 10px; color: #FFFFFF;
          font-family: 'Inter', sans-serif; font-size: 16px;
          outline: none; transition: border-color 0.2s, background 0.2s;
          -webkit-appearance: none; appearance: none;
        }
        .cr-input:focus { border-color: #EFC168; background: rgba(255,255,255,0.13); }
        .cr-input::placeholder { color: rgba(255,253,245,0.45); }
        .cr-input-error { border-color: #e74c3c !important; }
        .cr-divider {
          width: 100%; height: 1px; border: 0;
          background: linear-gradient(90deg, transparent, rgba(239,193,104,0.3), transparent);
          margin: 22px 0;
        }
        .cr-radio-row { display: flex; gap: 12px; }
        .cr-radio {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 15px 12px; min-height: 52px;
          background: rgba(255,255,255,0.07);
          border: 1.5px solid rgba(239,193,104,0.3);
          border-radius: 10px; cursor: pointer;
          font-size: 16px; font-weight: 600; font-family: 'Inter', sans-serif;
          color: rgba(255,253,245,0.85); transition: all 0.2s;
        }
        .cr-radio.active {
          background: rgba(239,193,104,0.18); border-color: #EFC168; color: #EFC168;
        }
        .cr-dot {
          width: 18px; height: 18px; border-radius: 50%;
          border: 2px solid rgba(239,193,104,0.5);
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .cr-radio.active .cr-dot { border-color: #EFC168; }
        .cr-dot-inner { width: 8px; height: 8px; border-radius: 50%; background: #EFC168; }
        .cr-spouse {
          border-left: 3px solid rgba(239,193,104,0.4);
          padding-left: 16px; margin-bottom: 18px;
        }
        .cr-submit {
          width: 100%; padding: 17px 24px; min-height: 56px;
          background: linear-gradient(135deg, #EFC168, #C4872A);
          border: none; border-radius: 10px; color: #1a0800;
          font-family: 'Inter', sans-serif; font-size: 17px; font-weight: 700;
          letter-spacing: 0.8px; text-transform: uppercase; cursor: pointer;
          box-shadow: 0 6px 20px rgba(239,193,104,0.25);
          transition: transform 0.15s;
        }
        .cr-submit:active { transform: scale(0.98); }
        .cr-submit:disabled { opacity: 0.7; cursor: wait; }
        .cr-error-msg { color: #ff7b6b; font-size: 15px; margin-bottom: 14px; text-align: center; font-weight: 500; }
        .cr-footer {
          text-align: center; margin-top: 24px; padding: 0 16px;
          font-size: 13px; color: rgba(255,253,245,0.55); line-height: 1.6;
        }
        .cr-footer .cr-tags { color: rgba(239,193,104,0.7); margin-top: 4px; font-weight: 500; }
        .cr-success { text-align: center; padding: 40px 12px; }
        .cr-success-icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, #EFC168, #C4872A);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 22px;
        }
        .cr-success-title {
          font-family: 'Playfair Display', serif; font-weight: 700; font-size: 26px;
          color: #EFC168; margin-bottom: 12px;
        }
        .cr-success-msg {
          font-size: 16px; color: rgba(255,253,245,0.85); line-height: 1.7;
          max-width: 360px; margin: 0 auto;
        }
        @media (min-width: 560px) {
          .cr-wrap { padding: 32px 16px 56px; }
          .cr-card { padding: 32px 30px 38px; margin: 0; flex: initial; }
          .cr-logo { width: 100px; }
          .cr-org { letter-spacing: 2.5px; }
        }
      `}</style>

      <div className="cr-bg" />
      <div className="cr-bg-tint" />

      <div className="cr-wrap">
        <div className="cr-header">
          <img src="/diocese_of_okrika_logo.jpg" alt="Diocese of Okrika" className="cr-logo" />
          <div className="cr-org">Church of Nigeria (Anglican Communion) — Diocese of Okrika</div>
          <div className="cr-title">
            2026 Wakirike Be-Se Bible Study Conference &amp; Mega Crusade
          </div>
          <div className="cr-theme">“Indwelled by the Word of God”</div>
          <div className="cr-scripture">Colossians 3:16</div>
          <div className="cr-meta">
            <strong>22nd – 24th October, 2026</strong>
            <br />
            Okrika Grammar School (OGS), Okrika
          </div>
          <hr className="cr-rule" />
        </div>

        <div className="cr-card">
          {submitted ? (
            <div className="cr-success">
              <div className="cr-success-icon">
                <svg viewBox="0 0 24 24" style={{ width: 36, height: 36, stroke: '#1a0800', fill: 'none', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="cr-success-title">Registration Complete</div>
              <div className="cr-success-msg">
                Thank you for registering for the 2026 Wakirike Be-Se Bible Study Conference &amp; Mega Crusade. We look forward to seeing you!
              </div>
            </div>
          ) : (
            <div>
              <div className="cr-form-heading">Registration Form</div>

              {field('Full Name', fullName, setFullName, { placeholder: 'Enter your full name', error: errors.fullName, errorKey: 'fullName', required: true })}
              {field('Church / Ministry', church, setChurch, { placeholder: "e.g. St. Peter's Anglican Church, Okrika", error: errors.church, errorKey: 'church', required: true })}
              {field('Email Address (optional)', email, setEmail, { type: 'email', inputMode: 'email', placeholder: 'you@example.com', error: errors.email, errorKey: 'email' })}
              {field('Telephone Number', phone, setPhone, { type: 'tel', inputMode: 'tel', placeholder: 'e.g. 08012345678', error: errors.phone, errorKey: 'phone', required: true })}

              <hr className="cr-divider" />

              <div className="cr-field">
                <label className="cr-label" style={{ marginBottom: 10 }}>
                  Coming as a couple? <span className="cr-req">*</span>
                </label>
                <div className="cr-radio-row">
                  {(['yes', 'no'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`cr-radio${couple === v ? ' active' : ''}`}
                      onClick={() => setCouple(v)}
                    >
                      <span className="cr-dot">{couple === v && <span className="cr-dot-inner" />}</span>
                      {v === 'yes' ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>

              {couple === 'yes' && (
                <div className="cr-spouse">
                  {field('Name of Spouse', spouseName, setSpouseName, { placeholder: "Spouse's full name" })}
                  {field('Phone No. of Spouse', spousePhone, setSpousePhone, { type: 'tel', inputMode: 'tel', placeholder: "Spouse's phone number" })}
                </div>
              )}

              <hr className="cr-divider" />

              {submitError && <div className="cr-error-msg">{submitError}</div>}

              <button type="button" className="cr-submit" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Register Now'}
              </button>
            </div>
          )}
        </div>

        <div className="cr-footer">
          Jesus is Lord Forever
          <br />
          <span className="cr-tags">#DOKMCC2026 #DioceseOfOkrika</span>
        </div>
      </div>
    </div>
  );
}
