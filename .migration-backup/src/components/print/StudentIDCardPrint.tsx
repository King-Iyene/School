interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_id?: string;
  avatar_url?: string | null;
  class_name?: string;
  gender?: string;
  blood_group?: string;
  date_of_birth?: string;
  address?: string;
  guardian_phone?: string;
}

interface Props {
  students: Student[];
  academicYear?: string;
  onClose: () => void;
}

function StudentCard({ student, academicYear }: { student: Student; academicYear: string }) {
  const initials = `${student.first_name?.[0] ?? ''}${student.last_name?.[0] ?? ''}`.toUpperCase();
  return (
    <div style={{
      width: '85.6mm', height: '53.98mm',
      border: '1px solid #1a3a5c',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'Arial, sans-serif',
      background: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      pageBreakInside: 'avoid',
    }}>
      <div style={{ background: '#1a3a5c', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <img src="/ogs_logo_bg.png" alt="OGS" style={{ width: '22px', height: '22px', objectFit: 'contain', background: 'white', borderRadius: '50%', padding: '1px', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '7.5pt', letterSpacing: '0.5px', lineHeight: 1.1 }}>OKRIKA GRAMMAR SCHOOL</div>
          <div style={{ color: '#93c5fd', fontSize: '6pt', lineHeight: 1 }}>Perseverantia Vincit | Okrika, Rivers State</div>
        </div>
        <img src="/diocese_of_okrika_logo.jpg" alt="Diocese" style={{ width: '22px', height: '22px', objectFit: 'contain', background: 'white', borderRadius: '50%', padding: '1px', flexShrink: 0 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', padding: '5px 8px', gap: '8px' }}>
        <div style={{ flexShrink: 0 }}>
          {student.avatar_url ? (
            <img src={student.avatar_url} alt="Photo" style={{ width: '45px', height: '55px', objectFit: 'cover', border: '1.5px solid #1a3a5c', borderRadius: '3px' }} />
          ) : (
            <div style={{ width: '45px', height: '55px', border: '1.5px solid #1a3a5c', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0f2fe', color: '#1a3a5c', fontWeight: 'bold', fontSize: '14pt' }}>
              {initials}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontWeight: 'bold', fontSize: '9pt', color: '#1a3a5c', lineHeight: 1.2, marginBottom: '3px' }}>
            {student.first_name} {student.last_name}
          </div>
          {[
            ['ID', student.student_id ?? '—'],
            ['Class', student.class_name ?? '—'],
            ['Session', academicYear],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', gap: '4px', marginBottom: '1.5px' }}>
              <span style={{ color: '#666', fontSize: '6.5pt', minWidth: '34px' }}>{label}:</span>
              <span style={{ fontWeight: '600', fontSize: '6.5pt', color: '#222' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: '#f0f9ff', borderTop: '1px solid #bfdbfe', padding: '3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '5.5pt', color: '#555' }}>If found, please return to:</div>
          <div style={{ fontSize: '5.5pt', color: '#1a3a5c', fontWeight: '600' }}>Tel: 09034210590 | okrikagrammarschool.org</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <img src="/kelvin_signature_.jpeg" alt="Principal" style={{ height: '18px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
          <div style={{ borderTop: '0.5px solid #999', width: '54px', marginBottom: '1px' }} />
          <div style={{ fontSize: '5pt', color: '#555' }}>Principal</div>
        </div>
      </div>
    </div>
  );
}

export default function StudentIDCardPrint({ students, academicYear = '2025/2026', onClose }: Props) {
  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #id-card-print { display: block !important; }
          #id-card-print { position: fixed; top: 0; left: 0; width: 100%; }
        }
        @media screen {
          #id-card-print { position: fixed; inset: 0; background: #f1f5f9; z-index: 100; overflow-y: auto; padding: 24px; }
        }
        @media print {
          .id-grid { gap: 6mm !important; }
        }
      `}</style>
      <div id="id-card-print">
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="flex justify-end mb-4 gap-2 print:hidden">
            <button onClick={onClose} className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors">Close</button>
            <button onClick={() => window.print()} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">Print All Cards</button>
          </div>
          <div className="id-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-start' }}>
            {students.map(s => <StudentCard key={s.id} student={s} academicYear={academicYear} />)}
          </div>
        </div>
      </div>
    </>
  );
}
