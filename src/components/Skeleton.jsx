const shimmer = `
  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }
`

const SkeletonBox = ({ width = '100%', height = '16px', borderRadius = '8px', style = {} }) => (
  <>
    <style>{shimmer}</style>
    <div style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '1000px 100%',
      animation: 'shimmer 2s infinite linear',
      ...style
    }} />
  </>
)

export const SkeletonCard = () => (
  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.25rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
      <SkeletonBox width="42px" height="42px" borderRadius="50%" />
      <SkeletonBox width="120px" height="16px" />
    </div>
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
      <SkeletonBox width="60px" height="22px" borderRadius="100px" />
      <SkeletonBox width="80px" height="22px" borderRadius="100px" />
      <SkeletonBox width="50px" height="22px" borderRadius="100px" />
    </div>
    <SkeletonBox width="100%" height="34px" borderRadius="8px" />
  </div>
)

export const SkeletonMessage = ({ isMine }) => (
  <div style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexDirection: isMine ? 'row-reverse' : 'row' }}>
    <SkeletonBox width="32px" height="32px" borderRadius="50%" />
    <SkeletonBox width={`${100 + Math.random() * 150}px`} height="38px" borderRadius={isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px'} />
  </div>
)

export const SkeletonConversation = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px' }}>
    <SkeletonBox width="46px" height="46px" borderRadius="50%" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <SkeletonBox width="140px" height="14px" />
      <SkeletonBox width="200px" height="12px" />
    </div>
    <SkeletonBox width="40px" height="12px" />
  </div>
)

export const SkeletonProfile = () => (
  <div style={{ maxWidth: '650px', margin: '0 auto', padding: '2rem' }}>
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '2rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <SkeletonBox width="80px" height="80px" borderRadius="50%" />
      <SkeletonBox width="160px" height="22px" />
      <SkeletonBox width="120px" height="16px" />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <SkeletonBox width="80px" height="28px" borderRadius="100px" />
        <SkeletonBox width="80px" height="28px" borderRadius="100px" />
      </div>
      <SkeletonBox width="140px" height="40px" borderRadius="10px" />
    </div>
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[1,2,3,4].map(i => <SkeletonBox key={i} width="100%" height="48px" borderRadius="10px" />)}
    </div>
  </div>
)

export default SkeletonBox