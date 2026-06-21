import Link from 'next/link'

export const metadata = {
  title: 'เข้าสู่ระบบ — TreasuryMS',
  description: 'ระบบจัดการการเงินสาขา คณะวิทยาการคอมพิวเตอร์',
}

export default function LoginPage() {
  const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINE_CHANNEL_ID ?? '',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/line/callback`,
    scope: 'profile openid',
    state: 'treasury-login',
  }).toString()}`

  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(155deg, #0a0f1e 0%, #0d1427 55%, #111d3a 100%)' }}
      >
        {/* Ambient orbs */}
        <div className="absolute top-[-80px] left-[-60px] w-72 h-72 orb-brand opacity-30" />
        <div className="absolute bottom-[-60px] right-[-40px] w-56 h-56 orb-gold opacity-25" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(61,82,213,0.08) 0%, transparent 70%)' }}
        />

        {/* Content */}
        <div className="relative z-10 px-14 text-center">
          {/* Logo mark */}
          <div className="w-16 h-16 rounded-2xl mx-auto mb-8 overflow-hidden flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight leading-tight mb-3">
            Treasury<br />
            <span className="text-white/40 text-2xl font-light tracking-[0.25em] uppercase">Management</span>
          </h1>
          <p className="text-[13px] text-white/35 leading-relaxed max-w-[240px] mx-auto mt-4 font-medium">
            ระบบจัดการการเงินสาขา<br />คณะวิทยาการคอมพิวเตอร์
          </p>

          {/* Decorative dots */}
          <div className="flex items-center justify-center gap-2 mt-10">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: i === 1 ? '24px' : '6px',
                  height: '6px',
                  background: i === 1
                    ? 'linear-gradient(90deg, #3d52d5, #7c94f8)'
                    : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-[360px] fade-slide-up">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-border"
              style={{ background: 'linear-gradient(135deg, #f5f7fc, #ffffff)' }}
            >
              <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <div className="text-[14px] font-black text-text-primary tracking-tight">TreasuryMS</div>
              <div className="text-[10px] text-text-muted">ระบบจัดการการเงินสาขา</div>
            </div>
          </div>

          {/* Header text */}
          <div className="mb-8">
            <h2 className="text-[26px] font-black text-text-primary tracking-tight leading-tight">
              ยินดีต้อนรับ
            </h2>
            <p className="text-[13px] text-text-muted mt-1.5 leading-relaxed">
              เข้าสู่ระบบเพื่อจัดการการเงินสาขา
            </p>
          </div>

          {/* Card */}
          <div className="bg-white border border-border rounded-2xl p-7 card-shadow">
            <p className="text-[11px] text-text-muted uppercase tracking-[0.2em] font-bold mb-5">
              เลือกวิธีเข้าสู่ระบบ
            </p>

            {/* LINE Login Button */}
            <a
              href={lineAuthUrl}
              id="line-login-btn"
              className="flex items-center justify-center gap-3 w-full text-white font-bold text-[14px] py-3.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20 hover:-translate-y-0.5 active:translate-y-0 press-down"
              style={{
                background: 'linear-gradient(135deg, #06C755 0%, #00b048 100%)',
                boxShadow: '0 4px 16px rgba(6,199,85,0.25)',
              }}
            >
              {/* LINE Icon SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.494.25l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              เข้าสู่ระบบด้วย LINE
            </a>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-text-disabled font-bold uppercase tracking-widest">หรือ</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Transparency link */}
            <Link
              href="/student/transparency"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border text-text-secondary text-[12.5px] font-semibold hover:bg-background-muted hover:border-border-strong transition-all duration-150 press-down"
            >
              ดูรายงานการเงิน (ไม่ต้องเข้าสู่ระบบ)
            </Link>
          </div>

          {/* Version */}
          <p className="text-center text-[10px] text-text-disabled mt-6 font-medium tracking-wide">
            TreasuryMS v1.0 · ระบบปลอดภัย
          </p>
        </div>
      </div>
    </div>
  )
}
