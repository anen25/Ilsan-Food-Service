import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfile, Order, ApronRequest, OrderItem } from '../types';
import { NotificationService } from '../services/notification.service';

// 배송 아이템 인터페이스
interface DeliveryItem {
    id: string;
    orderId: string | null;
    apronId: string | null;
    address: string;
    businessName: string;
    phone: string;
    type: 'beverage' | 'apron';
    status: 'pending' | 'confirmed' | 'in_transit' | 'delivered';
    items?: OrderItem[];
    serviceItems?: OrderItem[];
    totalBoxes?: number;
    createdAt: string;
    driverConfirmedAt?: string | null;
    departedAt?: string | null;
}

// 통계 인터페이스
interface DeliveryStats {
    todayPending: number;
    todayInTransit: number;
    todayCompleted: number;
    weekCompleted: number;
    monthCompleted: number;
}

export const Driver: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'today' | 'history' | 'stats'>('today');
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

    // 배송 데이터
    const [pendingItems, setPendingItems] = useState<DeliveryItem[]>([]); // 확인 대기
    const [confirmedItems, setConfirmedItems] = useState<DeliveryItem[]>([]); // 확인완료, 배송대기
    const [inTransitItems, setInTransitItems] = useState<DeliveryItem[]>([]); // 배송중
    const [deliveryHistory, setDeliveryHistory] = useState<DeliveryItem[]>([]); // 배송 완료 이력
    const [stats, setStats] = useState<DeliveryStats>({ todayPending: 0, todayInTransit: 0, todayCompleted: 0, weekCompleted: 0, monthCompleted: 0 });

    // 필터
    const [historyDateStart, setHistoryDateStart] = useState('');
    const [historyDateEnd, setHistoryDateEnd] = useState('');

    // 확인 필요 여부
    const [hasUnconfirmed, setHasUnconfirmed] = useState(false);

    useEffect(() => {
        checkDriverAndFetch();
    }, []);

    const checkDriverAndFetch = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert('로그인이 필요합니다.');
            navigate('/');
            return;
        }

        const { data: user } = await supabase.from('users').select('*').eq('id', session.user.id).single();
        if (!user || (user.role !== 'driver' && user.role !== 'admin')) {
            alert('접근 권한이 없습니다.');
            navigate('/');
            return;
        }
        setCurrentUser(user as UserProfile);

        // 기본 날짜 설정
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        setHistoryDateEnd(today.toISOString().split('T')[0]);
        setHistoryDateStart(weekAgo.toISOString().split('T')[0]);

        // Fetch all data
        await fetchAllData();
    };
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString();

            // 1. 확인 대기 주문 (confirmed but not driver_confirmed)
            const { data: pendingOrders } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'confirmed')
                .is('driver_confirmed_at', null)
                .order('created_at', { ascending: true });

            // 2. 확인 완료, 배송 대기 (confirmed and driver_confirmed)
            const { data: confirmedOrders } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'confirmed')
                .not('driver_confirmed_at', 'is', null)
                .order('created_at', { ascending: true });

            // 3. 배송중 (in_transit)
            const { data: inTransitOrders } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'in_transit')
                .order('departed_at', { ascending: true });

            // 4. 오늘 배송 완료
            const { data: todayDelivered } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'delivered')
                .gte('delivered_at', todayStr)
                .order('delivered_at', { ascending: false });

            // 5. 앞치마 요청 (driver 배송)
            const { data: aprons } = await supabase
                .from('apron_requests')
                .select('*')
                .eq('status', 'pending')
                .eq('delivery_method', 'driver');

            // 변환 함수
            const orderToDeliveryItem = (o: Order, status: 'pending' | 'confirmed' | 'in_transit' | 'delivered'): DeliveryItem => ({
                id: o.id,
                orderId: o.id,
                apronId: null,
                address: o.delivery_address || '주소 미상',
                businessName: o.business_name || '상호 미상',
                phone: o.phone || '',
                type: 'beverage',
                status,
                items: o.items,
                serviceItems: o.service_items,
                totalBoxes: o.total_boxes,
                createdAt: o.created_at,
                driverConfirmedAt: o.driver_confirmed_at,
                departedAt: o.departed_at
            });

            const apronToDeliveryItem = (a: ApronRequest): DeliveryItem => ({
                id: a.id,
                orderId: null,
                apronId: a.id,
                address: a.delivery_address || '주소 미상',
                businessName: a.business_name || '상호 미상',
                phone: a.phone || '',
                type: 'apron',
                status: 'confirmed',
                createdAt: a.created_at
            });

            // 상태별 분류
            const pending: DeliveryItem[] = (pendingOrders || []).map(o => orderToDeliveryItem(o, 'pending'));
            const confirmed: DeliveryItem[] = [
                ...(confirmedOrders || []).map(o => orderToDeliveryItem(o, 'confirmed')),
                ...(aprons || []).map(a => apronToDeliveryItem(a))
            ];
            const inTransit: DeliveryItem[] = (inTransitOrders || []).map(o => orderToDeliveryItem(o, 'in_transit'));
            const completed: DeliveryItem[] = (todayDelivered || []).map(o => orderToDeliveryItem(o, 'delivered'));

            setPendingItems(pending);
            setConfirmedItems(confirmed);
            setInTransitItems(inTransit);
            setDeliveryHistory(completed);
            setHasUnconfirmed(pending.length > 0);

            // 통계 계산
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);

            const { count: weekCount } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'delivered')
                .gte('delivered_at', weekAgo.toISOString());

            const { count: monthCount } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'delivered')
                .gte('delivered_at', monthAgo.toISOString());

            setStats({
                todayPending: pending.length + confirmed.length,
                todayInTransit: inTransit.length,
                todayCompleted: completed.length,
                weekCompleted: weekCount || 0,
                monthCompleted: monthCount || 0
            });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // 배정 확인 처리
    const handleConfirmAssignment = async () => {
        if (pendingItems.length === 0) return;

        const orderIds = pendingItems.filter(p => p.orderId).map(p => p.orderId);

        try {
            await supabase
                .from('orders')
                .update({ driver_confirmed_at: new Date().toISOString() })
                .in('id', orderIds);

            alert(`${pendingItems.length}건 배정 확인 완료!`);
            await fetchAllData();
        } catch (e) {
            console.error(e);
            alert('확인 처리 중 오류가 발생했습니다.');
        }
    };

    // 배송 출발 처리
    const handleDepart = async (item: DeliveryItem) => {
        if (!window.confirm(`${item.businessName} 배송을 출발합니까?`)) return;

        try {
            if (item.orderId) {
                // 주문 상태 업데이트
                await supabase.from('orders').update({
                    status: 'in_transit',
                    departed_at: new Date().toISOString()
                }).eq('id', item.orderId);

                // 고객 ID 조회 후 알림 발송
                const { data: order } = await supabase
                    .from('orders')
                    .select('user_id, business_name')
                    .eq('id', item.orderId)
                    .single();

                if (order?.user_id) {
                    await NotificationService.notifyOrderStatusChange(
                        order.user_id,
                        item.orderId,
                        'in_transit',
                        order.business_name || item.businessName
                    );
                }
            }
            alert("배송 출발 처리되었습니다. 고객에게 알림이 전송되었습니다.");
            await fetchAllData();
        } catch (e) {
            console.error(e);
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    // 배송 완료 처리
    const handleComplete = async (item: DeliveryItem) => {
        if (!window.confirm(`${item.businessName} 배송을 완료처리 하시겠습니까?`)) return;

        try {
            if (item.type === 'beverage' && item.orderId) {
                // 주문 상태 업데이트
                await supabase.from('orders').update({
                    status: 'delivered',
                    delivered_at: new Date().toISOString()
                }).eq('id', item.orderId);

                // 고객 ID 조회 후 알림 발송
                const { data: order } = await supabase
                    .from('orders')
                    .select('user_id, business_name')
                    .eq('id', item.orderId)
                    .single();

                if (order?.user_id) {
                    await NotificationService.notifyOrderStatusChange(
                        order.user_id,
                        item.orderId,
                        'delivered',
                        order.business_name || item.businessName
                    );
                }
            } else if (item.type === 'apron' && item.apronId) {
                await supabase.from('apron_requests').update({ status: 'completed' }).eq('id', item.apronId);
            }

            alert("배송 완료 처리되었습니다. 고객에게 알림이 전송되었습니다.");
            await fetchAllData();
        } catch (e) {
            console.error(e);
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    // 배송 이력 조회
    const fetchHistory = async () => {
        if (!historyDateStart || !historyDateEnd) return;

        const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('status', 'delivered')
            .gte('delivered_at', historyDateStart)
            .lte('delivered_at', historyDateEnd + 'T23:59:59')
            .order('delivered_at', { ascending: false });

        if (data) {
            setDeliveryHistory(data.map(o => ({
                id: o.id,
                orderId: o.id,
                apronId: null,
                address: o.delivery_address || '',
                businessName: o.business_name || '',
                phone: o.phone || '',
                type: 'beverage' as const,
                status: 'delivered' as const,
                createdAt: o.created_at,
                departedAt: o.departed_at
            })));
        }
    };

    // 배송 카드 컴포넌트
    const DeliveryCard = ({ item, showActions, mode }: { item: DeliveryItem; showActions: boolean; mode: 'pending' | 'confirmed' | 'in_transit' | 'history' }) => (
        <div className={`bg-white p-4 rounded-lg shadow border-l-4 ${
            mode === 'pending' ? 'border-yellow-500' :
            mode === 'in_transit' ? 'border-green-500' :
            mode === 'history' ? 'border-gray-400' : 'border-blue-500'
        }`}>
            <div className="flex justify-between items-start mb-2">
                <span className={`text-xs px-2 py-1 rounded font-bold ${
                    item.type === 'beverage' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                }`}>
                    {item.type === 'beverage' ? '음료 배송' : '앞치마 배송'}
                </span>
                <span className="text-xs text-gray-400">
                    {new Date(item.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            <h3 className="font-bold text-lg text-gray-800 mb-1">{item.businessName}</h3>

            <p className="text-gray-600 text-sm mb-1">
                <i className="fa-solid fa-location-dot mr-1 text-red-400"></i>
                {item.address}
            </p>

            {item.phone && (
                <p className="text-gray-600 text-sm mb-2">
                    <i className="fa-solid fa-phone mr-1 text-green-500"></i>
                    {item.phone}
                </p>
            )}

            {/* 주문 내역 표시 */}
            {item.items && item.items.length > 0 && (
                <div className="bg-gray-50 p-2 rounded text-xs mb-3">
                    <p className="font-bold text-gray-700 mb-1">
                        <i className="fa-solid fa-box mr-1"></i>주문 내역 ({item.totalBoxes}박스)
                    </p>
                    {item.items.map((orderItem, idx) => (
                        <p key={idx} className="text-gray-600">
                            • {orderItem.productName} x {orderItem.quantity}
                        </p>
                    ))}
                    {item.serviceItems && item.serviceItems.length > 0 && (
                        <>
                            <p className="font-bold text-green-600 mt-1">서비스 품목:</p>
                            {item.serviceItems.map((sItem, idx) => (
                                <p key={idx} className="text-green-600">• {sItem.productName} x {sItem.quantity}</p>
                            ))}
                        </>
                    )}
                </div>
            )}

            {showActions && (
                <div className={`grid gap-2 mt-3 ${mode === 'confirmed' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {/* 전화 버튼 */}
                    {item.phone && (
                        <a
                            href={`tel:${item.phone}`}
                            className="bg-green-500 hover:bg-green-600 text-white text-center py-2.5 rounded-lg font-bold text-sm flex items-center justify-center transition"
                        >
                            <i className="fa-solid fa-phone mr-1"></i>전화
                        </a>
                    )}

                    {/* 지도 버튼 */}
                    <a
                        href={`https://map.kakao.com/link/search/${encodeURIComponent(item.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-yellow-400 hover:bg-yellow-500 text-black text-center py-2.5 rounded-lg font-bold text-sm flex items-center justify-center transition"
                    >
                        <i className="fa-solid fa-map mr-1"></i>지도
                    </a>

                    {/* 출발 버튼 (confirmed 상태일 때) */}
                    {mode === 'confirmed' && (
                        <button
                            onClick={() => handleDepart(item)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-center py-2.5 rounded-lg font-bold text-sm flex items-center justify-center transition"
                        >
                            <i className="fa-solid fa-truck-fast mr-1"></i>출발
                        </button>
                    )}

                    {/* 완료 버튼 (in_transit 상태일 때) */}
                    {mode === 'in_transit' && (
                        <button
                            onClick={() => handleComplete(item)}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-center py-2.5 rounded-lg font-bold text-sm flex items-center justify-center transition"
                        >
                            <i className="fa-solid fa-check mr-1"></i>완료
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    // DeliveryCard 컴포넌트 끝
    if (loading) return <div className="p-8 text-center pt-20">로딩중...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                {/* 헤더 */}
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold flex items-center">
                        <i className="fa-solid fa-truck text-blue-600 mr-2"></i>
                        배송 매니저
                        {currentUser?.role === 'admin' && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Admin</span>}
                    </h1>
                    <button onClick={fetchAllData} className="text-gray-500 hover:text-blue-500 p-2">
                        <i className="fa-solid fa-rotate-right text-xl"></i>
                    </button>
                </div>

                {/* 탭 네비게이션 */}
                <div className="flex bg-white rounded-lg shadow mb-4 overflow-hidden">
                    <button
                        onClick={() => setActiveTab('today')}
                        className={`flex-1 py-3 font-medium text-sm transition ${activeTab === 'today' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <i className="fa-solid fa-box mr-1"></i>금일 배송
                        {hasUnconfirmed && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingItems.length}</span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 font-medium text-sm transition ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <i className="fa-solid fa-clock-rotate-left mr-1"></i>배송 이력
                    </button>
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`flex-1 py-3 font-medium text-sm transition ${activeTab === 'stats' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <i className="fa-solid fa-chart-simple mr-1"></i>나의 실적
                    </button>
                </div>

                {/* ===== 금일 배송 탭 ===== */}
                {activeTab === 'today' && (
                    <div className="space-y-4">
                        {/* 요약 카드 */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-lg shadow text-center">
                                <p className="text-xs text-gray-500">대기</p>
                                <p className="text-2xl font-bold text-yellow-600">{stats.todayPending}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow text-center">
                                <p className="text-xs text-gray-500">배송중</p>
                                <p className="text-2xl font-bold text-blue-600">{stats.todayInTransit}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow text-center">
                                <p className="text-xs text-gray-500">완료</p>
                                <p className="text-2xl font-bold text-green-600">{stats.todayCompleted}</p>
                            </div>
                        </div>

                        {/* 배정 확인 필요 섹션 */}
                        {pendingItems.length > 0 && (
                            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h2 className="font-bold text-yellow-800">
                                        <i className="fa-solid fa-bell mr-2"></i>
                                        신규 배정 {pendingItems.length}건
                                    </h2>
                                    <button
                                        onClick={handleConfirmAssignment}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
                                    >
                                        <i className="fa-solid fa-check-double mr-1"></i>전체 확인
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {pendingItems.map(item => (
                                        <DeliveryCard key={item.id} item={item} showActions={false} mode="pending" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 배송 대기 섹션 */}
                        {confirmedItems.length > 0 && (
                            <div>
                                <h2 className="font-bold text-gray-700 mb-3">
                                    <i className="fa-solid fa-box mr-2 text-blue-500"></i>
                                    배송 대기 ({confirmedItems.length}건)
                                </h2>
                                <div className="space-y-3">
                                    {confirmedItems.map(item => (
                                        <DeliveryCard key={item.id} item={item} showActions={true} mode="confirmed" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 배송중 섹션 */}
                        {inTransitItems.length > 0 && (
                            <div>
                                <h2 className="font-bold text-gray-700 mb-3">
                                    <i className="fa-solid fa-truck-fast mr-2 text-green-500"></i>
                                    배송중 ({inTransitItems.length}건)
                                </h2>
                                <div className="space-y-3">
                                    {inTransitItems.map(item => (
                                        <DeliveryCard key={item.id} item={item} showActions={true} mode="in_transit" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 데이터 없음 */}
                        {pendingItems.length === 0 && confirmedItems.length === 0 && inTransitItems.length === 0 && (
                            <div className="text-center py-10 text-gray-400">
                                <i className="fa-solid fa-box-open text-4xl mb-3"></i>
                                <p>배송 대기 중인 물건이 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ===== 배송 이력 탭 ===== */}
                {activeTab === 'history' && (
                    <div className="space-y-4">
                        {/* 날짜 필터 */}
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="flex gap-2 items-center flex-wrap">
                                <input
                                    type="date"
                                    value={historyDateStart}
                                    onChange={(e) => setHistoryDateStart(e.target.value)}
                                    className="border rounded px-3 py-2 text-sm"
                                />
                                <span className="text-gray-400">~</span>
                                <input
                                    type="date"
                                    value={historyDateEnd}
                                    onChange={(e) => setHistoryDateEnd(e.target.value)}
                                    className="border rounded px-3 py-2 text-sm"
                                />
                                <button
                                    onClick={fetchHistory}
                                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold"
                                >
                                    조회
                                </button>
                            </div>
                        </div>

                        {/* 이력 목록 */}
                        {deliveryHistory.length > 0 ? (
                            <div className="space-y-3">
                                {deliveryHistory.map(item => (
                                    <DeliveryCard key={item.id} item={item} showActions={false} mode="history" />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <i className="fa-solid fa-clock-rotate-left text-4xl mb-3"></i>
                                <p>조회된 배송 이력이 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ===== 나의 실적 탭 ===== */}
                {activeTab === 'stats' && (
                    <div className="space-y-4">
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h2 className="font-bold text-gray-800 mb-4">
                                <i className="fa-solid fa-chart-simple mr-2 text-purple-500"></i>
                                배송 실적
                            </h2>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b pb-3">
                                    <span className="text-gray-600">오늘 배송 완료</span>
                                    <span className="text-2xl font-bold text-green-600">{stats.todayCompleted}건</span>
                                </div>
                                <div className="flex justify-between items-center border-b pb-3">
                                    <span className="text-gray-600">이번 주 배송 완료</span>
                                    <span className="text-2xl font-bold text-blue-600">{stats.weekCompleted}건</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">이번 달 배송 완료</span>
                                    <span className="text-2xl font-bold text-purple-600">{stats.monthCompleted}건</span>
                                </div>
                            </div>
                        </div>

                        {/* 오늘 완료 목록 */}
                        {deliveryHistory.length > 0 && (
                            <div>
                                <h3 className="font-bold text-gray-700 mb-3">
                                    <i className="fa-solid fa-check-circle mr-2 text-green-500"></i>
                                    오늘 배송 완료 ({deliveryHistory.length}건)
                                </h3>
                                <div className="space-y-3">
                                    {deliveryHistory.slice(0, 5).map(item => (
                                        <DeliveryCard key={item.id} item={item} showActions={false} mode="history" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
