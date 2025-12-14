
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfile, Order, ApronRequest } from '../types';

// Mock data for route optimization (would use a real map API in prod)
interface DeliveryRoute {
    id: string;
    orderId: string | null;
    apronId: string | null;
    address: string;
    businessName: string;
    type: 'beverage' | 'apron';
    status: 'pending' | 'delivered';
    dist?: number; // Distance from current location (mock)
}

export const Driver: React.FC = () => {
    const navigate = useNavigate();
    const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentLocation, setCurrentLocation] = useState<GeolocationCoordinates | null>(null);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

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

        // Fetch delivery items
        fetchDeliveryItems();

        // Get user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setCurrentLocation(pos.coords),
                (err) => console.error("Location error", err)
            );
        }
    };

    const fetchDeliveryItems = async () => {
        setLoading(true);
        try {
            // 1. Fetch Orders (Confirmed & Pending Delivery) rather than delivered
            const { data: orders } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'confirmed') // Confirmed means ready for delivery
                .order('created_at', { ascending: true });

            // 2. Fetch Driver Apron Requests
            const { data: aprons } = await supabase
                .from('apron_requests')
                .select('*')
                .eq('status', 'pending')
                .eq('delivery_method', 'driver');

            const mixedRoutes: DeliveryRoute[] = [];

            orders?.forEach((o: Order) => {
                mixedRoutes.push({
                    id: o.id,
                    orderId: o.id,
                    apronId: null,
                    address: o.delivery_address || '주소 미상',
                    businessName: o.business_name || '상호 미상',
                    type: 'beverage',
                    status: 'pending'
                });
            });

            aprons?.forEach((a: ApronRequest) => {
                mixedRoutes.push({
                    id: a.id,
                    orderId: null,
                    apronId: a.id,
                    address: a.delivery_address || '주소 미상',
                    businessName: a.business_name || '상호 미상',
                    type: 'apron',
                    status: 'pending'
                });
            });

            // Simple mock sort by "distance" (simulated by random or just list order)
            // In real world, we'd use Kakao Map API / TMap API here.
            setRoutes(mixedRoutes);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async (route: DeliveryRoute) => {
        if (!window.confirm(`${route.businessName} 배송을 완료처리 하시겠습니까?`)) return;

        try {
            if (route.type === 'beverage' && route.orderId) {
                await supabase.from('orders').update({ status: 'delivered' }).eq('id', route.orderId);
            } else if (route.type === 'apron' && route.apronId) {
                await supabase.from('apron_requests').update({ status: 'completed' }).eq('id', route.apronId);
            }

            // Optimistic update
            setRoutes(prev => prev.filter(r => r.id !== route.id));
            alert("배송 완료 처리되었습니다.");
        } catch (e) {
            console.error(e);
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    if (loading) return <div className="p-8 text-center">로딩중...</div>;

    return (
        <div className="max-w-xl mx-auto p-4 bg-gray-100 min-h-screen">
            <h1 className="text-xl font-bold mb-4 flex items-center">
                <i className="fa-solid fa-truck text-blue-600 mr-2"></i>
                배송 매니저 대시보드
                {currentUser?.role === 'admin' && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Admin Access</span>}
            </h1>

            <div className="bg-white p-4 rounded-lg shadow mb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-sm text-gray-500">현재 대기 물량</p>
                        <p className="text-2xl font-bold text-blue-600">{routes.length}건</p>
                    </div>
                    <button
                        onClick={fetchDeliveryItems}
                        className="text-gray-500 hover:text-blue-500"
                    >
                        <i className="fa-solid fa-rotate-right text-xl"></i>
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {routes.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        배송 대기 중인 물건이 없습니다.
                    </div>
                ) : (
                    routes.map((route, idx) => (
                        <div key={route.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-xs px-2 py-1 rounded font-bold ${route.type === 'beverage' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                    {route.type === 'beverage' ? '음료 배송' : '앞치마 배송'}
                                </span>
                                <span className="text-xs text-gray-400">대기 #{idx + 1}</span>
                            </div>

                            <h3 className="font-bold text-lg text-gray-800 mb-1">{route.businessName}</h3>
                            <p className="text-gray-600 text-sm mb-3">
                                <i className="fa-solid fa-location-dot mr-1 text-red-400"></i>
                                {route.address}
                            </p>

                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <a
                                    href={`https://map.kakao.com/link/search/${encodeURIComponent(route.address)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-yellow-400 hover:bg-yellow-500 text-black text-center py-3 rounded-lg font-bold text-sm flex items-center justify-center transition"
                                >
                                    <i className="fa-solid fa-map mr-2"></i>지도 보기
                                </a>
                                <button
                                    onClick={() => handleComplete(route)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-lg font-bold text-sm flex items-center justify-center transition"
                                >
                                    <i className="fa-solid fa-check mr-2"></i>배송 완료
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
