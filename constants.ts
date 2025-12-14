// Supabase Configuration
// 환경변수에서 가져오고, 없으면 빈 문자열 (개발용 fallback 제거 - 보안상 환경변수 필수)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 환경변수 누락 시 경고
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
}
