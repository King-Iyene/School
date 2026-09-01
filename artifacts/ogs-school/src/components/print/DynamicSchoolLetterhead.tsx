import { useTenantSettings } from '../../context/TenantContext';

interface Props {
  compact?: boolean;
}

export default function DynamicSchoolLetterhead({ compact = false }: Props) {
  const { settings } = useTenantSettings();
  const schoolName = settings.school_name || 'School Portal';
  const contactLine = [settings.phone && `Tel: ${settings.phone}`, settings.email && `Email: ${settings.email}`]
    .filter(Boolean)
    .join('  |  ');

  return (
    <div style={{ marginBottom: compact ? '12px' : '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px' }}>
        <img src={settings.logo_url || '/ogs_logo_bg.png'} alt={`${schoolName} logo`} style={{ width: compact ? '60px' : '80px', height: compact ? '60px' : '80px', objectFit: 'contain' }} />
        <div style={{ flex: 1, textAlign: 'center', padding: '0 16px' }}>
          <div style={{ fontSize: compact ? '18pt' : '22pt', fontWeight: '900', letterSpacing: '1.5px', color: settings.primary_color || '#1a3a5c', fontFamily: "'Times New Roman', serif", lineHeight: 1.1 }}>
            {schoolName.toUpperCase()}
          </div>
          {settings.motto && (
            <div style={{ fontSize: compact ? '8.5pt' : '10pt', fontStyle: 'italic', color: settings.secondary_color || '#1a6b3a', fontWeight: '600', margin: '3px 0' }}>
              {settings.motto}
            </div>
          )}
          {settings.address && (
            <div style={{ fontSize: compact ? '8pt' : '9pt', color: '#333', lineHeight: 1.5 }}>
              {settings.address}
            </div>
          )}
          <div style={{ fontSize: compact ? '8.5pt' : '9.5pt', fontWeight: 'bold', color: settings.primary_color || '#1a3a5c', marginTop: '2px' }}>
            Office of the Principal
          </div>
          {!compact && contactLine && (
            <div style={{ fontSize: '8pt', color: '#555', marginTop: '2px' }}>
              {contactLine}
            </div>
          )}
        </div>
        <div style={{ width: compact ? '55px' : '75px' }} />
      </div>
      <div style={{ borderTop: `3px solid ${settings.primary_color || '#1a3a5c'}`, borderBottom: `1px solid ${settings.secondary_color || '#1a6b3a'}`, height: '4px', margin: '0 0 8px 0' }} />
      {compact && contactLine && (
        <div style={{ fontSize: '7.5pt', color: '#555', textAlign: 'center', marginTop: '4px' }}>
          {contactLine}
        </div>
      )}
    </div>
  );
}
