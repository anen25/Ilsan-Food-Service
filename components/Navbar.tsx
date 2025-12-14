import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { NotificationBell } from './NotificationBell';

interface MobileNavLinkProps {
  to: string;
  children: React.ReactNode;
  currentPath: string;
  onClose: () => void;
}

const MobileNavLink: React.FC<MobileNavLinkProps> = ({ to, children, currentPath, onClose }) => (
  <Link
    to={to}
    onClick={onClose}
    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${currentPath === to
      ? 'bg-blue-100 text-blue-700'
      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
      }`}
  >
    {children}
  </Link>
);

export const Navbar: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [realName, setRealName] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // 이름 유효성 검사 함수
  const isInvalidName = (name: string | null) => {
    if (!name || name.length < 2) return true;
    if (/^[?ㅇㅁㄱㄴㄷㄹㅅㅈㅊㅋㅌㅍㅎ]+$/.test(name)) return true;
    if (name === '회원' || name === 'unknown' || name === 'user') return true;
    return false;
  };

  // Ref to track current user ID without closure staleness
  const userIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Optimization: Ignore token refreshes to prevent redundant profile fetches
      if (event === 'TOKEN_REFRESHED') return;

      if (session) {
        // Only fetch profile if it's a new user or different from current
        if (userIdRef.current !== session.user.id) {
          await ensureUserProfile(session);
        }

        // Redirect to order page after successful login
        if (event === 'SIGNED_IN' && location.pathname === '/') {
          navigate('/order');
        }
      } else {
        setUser(null);
        userIdRef.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, [location, navigate]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      if (userIdRef.current !== session.user.id) {
        await ensureUserProfile(session);
      }
    } else {
      setUser(null);
      userIdRef.current = null;
    }
  };

  const ensureUserProfile = async (session: any) => {
    // Optimistic set to prevent double-fetch while awaiting
    userIdRef.current = session.user.id;

    try {
      // 1. Try to get existing profile
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data && !error) {
        setUser(data as UserProfile);
        // Check if user needs to agree to terms
        if (!data.terms_agreed_at || !data.privacy_agreed_at) {
          setShowAgreementModal(true);
        }
      } else {
        // 2. Create profile if it doesn't exist
        const newProfile = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata.full_name || session.user.user_metadata.name || '회원',
          role: 'user', // Default role
        };

        const { error: insertError } = await supabase.from('users').insert(newProfile);

        if (!insertError) {
          setUser({ ...newProfile, created_at: new Date().toISOString() } as UserProfile);
        } else {
          console.error("Error creating user profile:", insertError);
          // If failed, reset ref so we try again next time?
          userIdRef.current = null;
        }
      }
    } catch (e) {
      console.error(e);
      userIdRef.current = null;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
    setIsOpen(false);
  };

  const handleAgree = async () => {
    if (!user || !termsChecked || !privacyChecked) {
      alert('이용약관과 개인정보처리방침에 모두 동의해주세요.');
      return;
    }

    // 이름이 이상한 경우 실명 입력 확인
    if (isInvalidName(user.name) && !realName.trim()) {
      alert('실명을 입력해주세요.');
      return;
    }

    const now = new Date().toISOString();
    const updateData: any = {
      terms_agreed_at: now,
      privacy_agreed_at: now,
    };

    // 이름이 이상한 경우 실명으로 업데이트
    if (isInvalidName(user.name) && realName.trim()) {
      updateData.name = realName.trim();
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating agreement:', error);
      alert('동의 처리 중 오류가 발생했습니다.');
    } else {
      setUser({ ...user, ...updateData });
      setShowAgreementModal(false);
      setTermsChecked(false);
      setPrivacyChecked(false);
      setRealName('');
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <img
                src="/외식업 중앙회 가로.jpg"
                alt="한국외식업중앙회 경기도북부지회 고양시일산서구지부"
                className="h-14 md:h-16 max-w-[260px] md:max-w-none object-contain"
              />
            </Link>
          </div>

          <div className="hidden md:flex md:items-center md:space-x-4">
            {user ? (
              <>
                <Link to="/order" className="text-gray-700 hover:text-blue-600 font-medium">상품 주문</Link>
                <Link to="/mypage" className="text-gray-700 hover:text-blue-600 font-medium">마이페이지</Link>
                {(user.role === 'admin' || user.role === 'manager') && (
                  <Link to="/manager" className="text-blue-600 font-bold hover:text-blue-800">
                    <i className="fa-solid fa-user-tie mr-1"></i>매니저
                  </Link>
                )}
                {(user.role === 'admin' || user.role === 'driver') && (
                  <Link to="/driver" className="text-green-600 font-bold hover:text-green-800">
                    <i className="fa-solid fa-truck mr-1"></i>배송 매니저
                  </Link>
                )}
                {isAdmin && (
                  <Link to="/admin" className="text-red-600 font-bold hover:text-red-800">관리자</Link>
                )}
                <span className="text-gray-400">|</span>
                <NotificationBell />
                <span className="text-sm text-gray-600">{user.business_name || user.name}님</span>
                <button
                  onClick={handleLogout}
                  className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm hover:bg-gray-300"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button
                onClick={async () => {
                  await supabase.auth.signInWithOAuth({
                    provider: 'kakao',
                    options: {
                      redirectTo: window.location.origin,
                      queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                      },
                      scopes: 'account_email profile_nickname'
                    }
                  });
                }}
                className="bg-yellow-400 text-black px-4 py-2 rounded-md text-sm font-bold hover:bg-yellow-500 shadow-sm"
              >
                <i className="fa-solid fa-comment mr-2"></i>카카오 로그인
              </button>
            )}
          </div>

          <div className="-mr-2 flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
            >
              <i className={`fa-solid ${isOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {user ? (
              <>
                <div className="px-3 py-2 text-sm text-gray-500 font-semibold">
                  {user.business_name || user.name}님 환영합니다.
                </div>
                <MobileNavLink to="/order" currentPath={location.pathname} onClose={() => setIsOpen(false)}>
                  상품 주문
                </MobileNavLink>
                <MobileNavLink to="/mypage" currentPath={location.pathname} onClose={() => setIsOpen(false)}>
                  마이페이지
                </MobileNavLink>
                {(user.role === 'admin' || user.role === 'manager') && (
                  <MobileNavLink to="/manager" currentPath={location.pathname} onClose={() => setIsOpen(false)}>
                    매니저 대시보드
                  </MobileNavLink>
                )}
                {(user.role === 'admin' || user.role === 'driver') && (
                  <MobileNavLink to="/driver" currentPath={location.pathname} onClose={() => setIsOpen(false)}>
                    배송 매니저
                  </MobileNavLink>
                )}
                {isAdmin && (
                  <MobileNavLink to="/admin" currentPath={location.pathname} onClose={() => setIsOpen(false)}>
                    관리자 페이지
                  </MobileNavLink>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button
                onClick={async () => {
                  await supabase.auth.signInWithOAuth({
                    provider: 'kakao',
                    options: {
                      redirectTo: window.location.origin,
                      queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                      },
                      scopes: 'account_email profile_nickname'
                    }
                  });
                }}
                className="w-full text-left block px-3 py-2 rounded-md text-base font-medium bg-yellow-400 text-black"
              >
                <i className="fa-solid fa-comment mr-2"></i>카카오 로그인
              </button>
            )}
          </div>
        </div>
      )}

      {/* Agreement Modal */}
      {showAgreementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">서비스 이용 동의</h2>
              <p className="text-sm text-gray-600 mb-6">
                서비스 이용을 위해 아래 약관에 동의해주세요.
              </p>

              {/* 이름이 이상한 경우만 실명 입력 필드 표시 */}
              {user && isInvalidName(user.name) && (
                <div className="mb-6 p-4 border-2 border-yellow-400 rounded-lg bg-yellow-50">
                  <div className="flex items-center mb-2">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-semibold text-yellow-800">
                      카카오 계정 이름이 확인되지 않습니다
                    </p>
                  </div>
                  <p className="text-xs text-yellow-700 mb-3">
                    서비스 이용을 위해 실명을 입력해주세요.
                  </p>
                  <input
                    type="text"
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    placeholder="실명을 입력해주세요 (예: 홍길동)"
                    className="w-full px-4 py-2 border border-yellow-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    required
                  />
                </div>
              )}

              {/* Terms Checkbox */}
              <div className="mb-4 p-4 border rounded-lg">
                <div className="flex items-start mb-2">
                  <input
                    type="checkbox"
                    id="terms-check"
                    checked={termsChecked}
                    onChange={(e) => setTermsChecked(e.target.checked)}
                    className="mt-1 mr-3 w-4 h-4"
                  />
                  <label htmlFor="terms-check" className="flex-1">
                    <span className="font-semibold text-gray-900">[필수]</span> 이용약관에 동의합니다.
                  </label>
                  <Link
                    to="/terms"
                    target="_blank"
                    className="text-blue-600 text-sm underline hover:text-blue-800"
                  >
                    전문보기
                  </Link>
                </div>
              </div>

              {/* Privacy Checkbox */}
              <div className="mb-6 p-4 border rounded-lg">
                <div className="flex items-start mb-2">
                  <input
                    type="checkbox"
                    id="privacy-check"
                    checked={privacyChecked}
                    onChange={(e) => setPrivacyChecked(e.target.checked)}
                    className="mt-1 mr-3 w-4 h-4"
                  />
                  <label htmlFor="privacy-check" className="flex-1">
                    <span className="font-semibold text-gray-900">[필수]</span> 개인정보처리방침에 동의합니다.
                  </label>
                  <Link
                    to="/privacy"
                    target="_blank"
                    className="text-blue-600 text-sm underline hover:text-blue-800"
                  >
                    전문보기
                  </Link>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAgree}
                  disabled={!termsChecked || !privacyChecked}
                  className={`flex-1 py-3 rounded-lg font-semibold transition ${termsChecked && privacyChecked
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  동의하고 시작하기
                </button>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setShowAgreementModal(false);
                    setTermsChecked(false);
                    setPrivacyChecked(false);
                    setRealName('');
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  취소
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                동의하지 않으시면 서비스를 이용하실 수 없습니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
