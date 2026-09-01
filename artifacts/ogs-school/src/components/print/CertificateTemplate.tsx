import DynamicSchoolLetterhead from './DynamicSchoolLetterhead';
import { useTenantSettings } from '../../context/TenantContext';

interface Props {
  type: 'graduation' | 'excellence' | 'participation' | 'merit' | 'custom';
  studentName: string;
  className?: string;
  academicYear?: string;
  description?: string;
  date?: string;
  onClose: () => void;
}

const CERT_TITLES: Record<string, string> = {
  graduation: 'CERTIFICATE OF GRADUATION',
  excellence: 'CERTIFICATE OF EXCELLENCE',
  participation: 'CERTIFICATE OF PARTICIPATION',
  merit: 'CERTIFICATE OF MERIT',
  custom: 'CERTIFICATE OF ACHIEVEMENT',
};

const CERT_TEXTS: Record<string, (name: string, school: string, cls?: string, yr?: string) => string> = {
  graduation: (n, school, cls, yr) => `This is to certify that <strong>${n}</strong> has successfully completed the prescribed course of study${cls ? ` in <strong>${cls}</strong>` : ''} for the Academic Year <strong>${yr ?? new Date().getFullYear()}</strong> at ${school}, having satisfied all the requirements for graduation.`,
  excellence: (n, _school, cls) => `This is to certify that <strong>${n}</strong>${cls ? ` of <strong>${cls}</strong>` : ''} has demonstrated outstanding academic achievement and exceptional dedication to scholarly excellence, earning this recognition.`,
  participation: (n, school) => `This is to certify that <strong>${n}</strong> actively participated and contributed meaningfully to school activities, upholding the values and traditions of ${school}.`,
  merit: (n, _school, cls) => `This is to certify that <strong>${n}</strong>${cls ? ` of <strong>${cls}</strong>` : ''} has earned this Certificate of Merit in recognition of outstanding conduct, diligence, and commitment to excellence.`,
  custom: (n, school) => `This is to certify that <strong>${n}</strong> has distinguished themselves through exemplary commitment to the pursuit of knowledge and the advancement of the values of ${school}.`,
};

export default function CertificateTemplate({ type, studentName, className, academicYear, description, date, onClose }: Props) {
  const { settings } = useTenantSettings();
  const schoolName = settings.school_name || 'the school';
  const certDate = date ?? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const certText = description ?? CERT_TEXTS[type]?.(studentName, schoolName, className, academicYear) ?? '';

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #cert-print { display: block !important; }
          #cert-print { position: fixed; top: 0; left: 0; width: 100%; }
        }
        @media screen {
          #cert-print { position: fixed; inset: 0; background: white; z-index: 100; overflow-y: auto; padding: 24px; }
        }
        .cert-page { max-width: 794px; margin: 0 auto; font-family: 'Times New Roman', serif; }
      `}</style>

      <div id="cert-print">
        <div className="cert-page">
          <div className="flex justify-end mb-3 print:hidden gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors">Close</button>
            <button onClick={() => window.print()} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">Print / Save PDF</button>
          </div>

          <div style={{
            border: '8px solid #1a3a5c',
            borderRadius: '4px',
            padding: '32px',
            background: '#fff',
            position: 'relative',
            minHeight: '700px',
          }}>
            <div style={{ position: 'absolute', inset: '12px', border: '2px solid #1a6b3a', borderRadius: '2px', pointerEvents: 'none' }} />

            <div style={{ position: 'relative' }}>
              <DynamicSchoolLetterhead />

              <div style={{ textAlign: 'center', margin: '24px 0 20px' }}>
                <div style={{
                  display: 'inline-block',
                  fontSize: '22pt',
                  fontWeight: '900',
                  letterSpacing: '3px',
                  color: '#1a3a5c',
                  borderBottom: '3px solid #1a6b3a',
                  paddingBottom: '8px',
                  fontFamily: "'Times New Roman', serif",
                }}>
                  {CERT_TITLES[type]}
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '16px 0', fontSize: '12pt', color: '#444' }}>
                This is to certify that
              </div>

              <div style={{
                textAlign: 'center',
                fontSize: '26pt',
                fontWeight: 'bold',
                color: '#1a3a5c',
                fontFamily: "'Times New Roman', serif",
                borderBottom: '2px solid #aaa',
                display: 'inline-block',
                width: '100%',
                paddingBottom: '4px',
                marginBottom: '16px',
                letterSpacing: '1px',
              }}>
                {studentName}
              </div>

              <div style={{
                textAlign: 'center',
                fontSize: '12pt',
                color: '#333',
                lineHeight: 1.8,
                maxWidth: '580px',
                margin: '0 auto 28px',
                fontFamily: "'Times New Roman', serif",
              }} dangerouslySetInnerHTML={{ __html: certText.replace(/<strong>/g, '<strong style="color:#1a3a5c">') }} />

              {academicYear && (
                <div style={{ textAlign: 'center', fontSize: '11pt', color: '#555', marginBottom: '24px' }}>
                  Academic Year: <strong>{academicYear}</strong>
                </div>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '20px',
                marginTop: '32px',
                alignItems: 'end',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '45px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '4px' }}>
                    <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#333' }}>{certDate}</div>
                  </div>
                  <div style={{ borderBottom: '1px solid #999', marginBottom: '4px' }} />
                  <div style={{ fontSize: '9pt', color: '#555' }}>Date</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '45px' }} />
                  <div style={{ borderBottom: '1px solid #999', marginBottom: '4px' }} />
                  <div style={{ fontSize: '9pt', color: '#555' }}>Principal, {schoolName}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: 'block' }}>
                      <defs>
                        <path id="ctTopArc" d="M 4,40 A 36,36 0 0,1 76,40" />
                      </defs>
                      <circle cx="40" cy="40" r="37" fill="none" stroke={settings.primary_color || '#1a3a5c'} strokeWidth="2.5" />
                      <circle cx="40" cy="40" r="30" fill="none" stroke={settings.primary_color || '#1a3a5c'} strokeWidth="0.8" />
                      <text style={{ fontSize: '6px', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', fill: settings.primary_color || '#1a3a5c', letterSpacing: '0.6px' }}>
                        <textPath href="#ctTopArc" startOffset="50%" textAnchor="middle">{schoolName.toUpperCase()}</textPath>
                      </text>
                      <line x1="24" y1="51" x2="56" y2="51" stroke={settings.primary_color || '#1a3a5c'} strokeWidth="0.6" />
                    </svg>
                  </div>
                  <div style={{ borderBottom: '1px solid #999', marginBottom: '4px', marginTop: '2px' }} />
                  <div style={{ fontSize: '9pt', color: '#555' }}>Official Stamp</div>
                </div>
              </div>

              {settings.motto && (
                <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '8pt', color: '#888', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                  <em>"{settings.motto}"{settings.address ? ` — ${settings.address}` : ''}</em>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
