const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Administration',
  admin: 'Admin',
  principal: 'Principal',
  head_teacher: 'Head Teacher',
  teacher: 'Teacher',
  nur_prim_teacher: 'Nur & Prim Teacher',
  non_teaching_staff: 'Non-Teaching Staff',
  matron: 'Matron',
  porter: 'Porter',
  cleaner: 'Cleaner',
  admin_support: 'Admin Support',
  accountant: 'Accountant',
  security_officer: 'Security Officer',
  staff: 'Staff',
};

const ROLE_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  super_admin:        { bg: '#1a3a5c', text: '#1a3a5c', badge: '#b45309' },
  admin:              { bg: '#1a3a5c', text: '#1a3a5c', badge: '#b45309' },
  principal:          { bg: '#1a3a5c', text: '#1a3a5c', badge: '#7c3aed' },
  head_teacher:       { bg: '#1a3a5c', text: '#1a3a5c', badge: '#0369a1' },
  teacher:            { bg: '#1a3a5c', text: '#1a3a5c', badge: '#1a6b3a' },
  nur_prim_teacher:   { bg: '#1a3a5c', text: '#1a3a5c', badge: '#059669' },
  non_teaching_staff: { bg: '#1a3a5c', text: '#1a3a5c', badge: '#374151' },
  matron:             { bg: '#1a3a5c', text: '#1a3a5c', badge: '#be185d' },
  porter:             { bg: '#1a3a5c', text: '#1a3a5c', badge: '#92400e' },
  cleaner:            { bg: '#1a3a5c', text: '#1a3a5c', badge: '#065f46' },
  admin_support:      { bg: '#1a3a5c', text: '#1a3a5c', badge: '#1e40af' },
  accountant:         { bg: '#1a3a5c', text: '#1a3a5c', badge: '#7c3aed' },
  security_officer:   { bg: '#1a3a5c', text: '#1a3a5c', badge: '#dc2626' },
  staff:              { bg: '#1a3a5c', text: '#1a3a5c', badge: '#374151' },
};

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: string;
  phone?: string;
  staff_id?: string;
  avatar_url?: string | null;
  department?: string;
  join_date?: string;
}

interface Props {
  staff: StaffMember[];
  academicYear?: string;
  onClose: () => void;
}

function StaffCard({ member, academicYear }: { member: StaffMember; academicYear: string }) {
  const initials = `${member.first_name?.[0] ?? ''}${member.last_name?.[0] ?? ''}`.toUpperCase();
  const colors = ROLE_COLORS[member.role] ?? ROLE_COLORS.staff;
  const roleLabel = ROLE_LABELS[member.role] ?? member.role;

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
      pageBreakInside: 'avoid',
    }}>
      <div style={{ background: colors.bg, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <img src="/ogs_logo_bg.png" alt="OGS" style={{ width: '22px', height: '22px', objectFit: 'contain', background: 'white', borderRadius: '50%', padding: '1px', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '7.5pt', letterSpacing: '0.5px', lineHeight: 1.1 }}>OKRIKA GRAMMAR SCHOOL</div>
          <div style={{ color: '#93c5fd', fontSize: '6pt', lineHeight: 1 }}>Perseverantia Vincit | Okrika, Rivers State</div>
        </div>
        <img src="/diocese_of_okrika_logo.jpg" alt="Diocese" style={{ width: '22px', height: '22px', objectFit: 'contain', background: 'white', borderRadius: '50%', padding: '1px', flexShrink: 0 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', padding: '5px 8px', gap: '8px' }}>
        <div style={{ flexShrink: 0 }}>
          {member.avatar_url ? (
            <img src={member.avatar_url} alt="Photo" style={{ width: '45px', height: '55px', objectFit: 'cover', border: '1.5px solid #1a3a5c', borderRadius: '3px' }} />
          ) : (
            <div style={{ width: '45px', height: '55px', border: '1.5px solid #1a3a5c', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dbeafe', color: '#1a3a5c', fontWeight: 'bold', fontSize: '14pt' }}>
              {initials}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontWeight: 'bold', fontSize: '9pt', color: '#1a3a5c', lineHeight: 1.2, marginBottom: '3px' }}>
            {member.first_name} {member.last_name}
          </div>
          <div style={{ display: 'inline-block', background: colors.badge, color: 'white', fontSize: '6pt', fontWeight: 'bold', padding: '1px 6px', borderRadius: '3px', marginBottom: '4px' }}>
            {roleLabel}
          </div>
          {[
            ['Staff ID', member.staff_id ?? member.email?.split('@')[0] ?? '—'],
            ['Session', academicYear],
            member.phone ? ['Phone', member.phone] : null,
          ].filter(Boolean).map(row => {
            const [label, val] = row as [string, string];
            return (
              <div key={label} style={{ display: 'flex', gap: '4px', marginBottom: '1.5px' }}>
                <span style={{ color: '#666', fontSize: '6.5pt', minWidth: '38px' }}>{label}:</span>
                <span style={{ fontWeight: '600', fontSize: '6.5pt', color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background: '#f0f9ff', borderTop: '1px solid #bfdbfe', padding: '3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '5.5pt', color: '#555' }}>Okrika Grammar School — Diocese of Okrika</div>
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

export default function StaffIDCardPrint({ staff, academicYear = '2025/2026', onClose }: Props) {
  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #staff-id-print { display: block !important; }
          #staff-id-print { position: fixed; top: 0; left: 0; width: 100%; }
        }
        @media screen {
          #staff-id-print { position: fixed; inset: 0; background: #f1f5f9; z-index: 100; overflow-y: auto; padding: 24px; }
        }
      `}</style>
      <div id="staff-id-print">
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="flex justify-end mb-4 gap-2 print:hidden">
            <button onClick={onClose} className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors">Close</button>
            <button onClick={() => window.print()} className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors">Print All Cards</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-start' }}>
            {staff.map(m => <StaffCard key={m.id} member={m} academicYear={academicYear} />)}
          </div>
        </div>
      </div>
    </>
  );
}
