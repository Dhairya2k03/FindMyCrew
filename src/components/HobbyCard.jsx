export default function HobbyCard({ profile }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '12px', padding: '1.25rem', width: '220px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ marginBottom: '0.75rem', color: '#1a1a2e' }}>
        {profile.username || profile.email?.split('@')[0]}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
        {(profile.hobbies || []).map(h => (
          <span key={h} style={{ background: '#6c63ff', color: 'white', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem' }}>
            {h}
          </span>
        ))}
      </div>
    </div>
  )
}