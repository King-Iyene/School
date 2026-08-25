interface Props {
  compact?: boolean;
}

export default function OGSLetterhead({ compact = false }: Props) {
  return (
    <div style={{ marginBottom: compact ? '12px' : '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px' }}>
        <img src="/ogs_logo_bg.png" alt="OGS Logo" style={{ width: compact ? '60px' : '80px', height: compact ? '60px' : '80px', objectFit: 'contain' }} />
        <div style={{ flex: 1, textAlign: 'center', padding: '0 16px' }}>
          <div style={{ fontSize: compact ? '18pt' : '22pt', fontWeight: '900', letterSpacing: '1.5px', color: '#1a3a5c', fontFamily: "'Times New Roman', serif", lineHeight: 1.1 }}>
            OKRIKA GRAMMAR SCHOOL
          </div>
          <div style={{ fontSize: compact ? '8.5pt' : '10pt', fontStyle: 'italic', color: '#1a6b3a', fontWeight: '600', margin: '3px 0' }}>
            Founded 1940 | Perseverantia Vincit
          </div>
          <div style={{ fontSize: compact ? '8pt' : '9pt', color: '#333', lineHeight: 1.5 }}>
            Diocese of Okrika | Church of Nigeria (Anglican Communion)<br />
            Okrika, Rivers State, Nigeria
          </div>
          <div style={{ fontSize: compact ? '8.5pt' : '9.5pt', fontWeight: 'bold', color: '#1a3a5c', marginTop: '2px' }}>
            Office of the Principal
          </div>
          {!compact && (
            <div style={{ fontSize: '8pt', color: '#555', marginTop: '2px' }}>
              Tel: 09034210590 &nbsp;|&nbsp; Website: okrikagrammarschool.org &nbsp;|&nbsp; Email: info@okrikagrammarschool.org
            </div>
          )}
        </div>
        <img src="/diocese_of_okrika_logo.jpg" alt="Diocese of Okrika" style={{ width: compact ? '55px' : '75px', height: compact ? '55px' : '75px', objectFit: 'contain' }} />
      </div>
      <div style={{ borderTop: '3px solid #1a3a5c', borderBottom: '1px solid #1a6b3a', height: '4px', margin: '0 0 8px 0' }} />
      {compact && (
        <div style={{ fontSize: '7.5pt', color: '#555', textAlign: 'center', marginTop: '4px' }}>
          Tel: 09034210590 | Website: okrikagrammarschool.org | Email: info@okrikagrammarschool.org
        </div>
      )}
    </div>
  );
}
