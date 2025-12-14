import { supabase } from '../lib/supabase';

export type NotificationType = 'order_status' | 'care_alert' | 'notice' | 'promo' | 'issue' | 'delivery' | 'assignment';

export interface NotificationRecord {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    is_read: boolean;
    action_url?: string;
    created_at: string;
}

export interface CreateNotificationParams {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    actionUrl?: string;
}

export const NotificationService = {
    // 알림 생성
    async createNotification(params: CreateNotificationParams) {
        const { userId, title, message, type, actionUrl } = params;

        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                title,
                message,
                type,
                action_url: actionUrl,
                is_read: false
            })
            .select()
            .single();

        if (error) throw error;
        return data as NotificationRecord;
    },

    // 다수 사용자에게 알림 발송
    async createBulkNotifications(userIds: string[], title: string, message: string, type: NotificationType, actionUrl?: string) {
        const notifications = userIds.map(userId => ({
            user_id: userId,
            title,
            message,
            type,
            action_url: actionUrl,
            is_read: false
        }));

        const { data, error } = await supabase
            .from('notifications')
            .insert(notifications)
            .select();

        if (error) throw error;
        return data as NotificationRecord[];
    },

    // 주문 상태 변경 알림 (고객용)
    async notifyOrderStatusChange(userId: string, orderId: string, status: string, businessName: string) {
        const statusMessages: Record<string, { title: string; message: string }> = {
            'confirmed': {
                title: '📦 주문이 확정되었습니다',
                message: `${businessName}님의 주문이 확정되었습니다. 배송 준비 중입니다.`
            },
            'in_transit': {
                title: '🚚 배송이 출발했습니다',
                message: `${businessName}님의 주문이 배송 출발했습니다. 곧 도착할 예정입니다.`
            },
            'delivered': {
                title: '✅ 배송이 완료되었습니다',
                message: `${businessName}님의 주문이 배송 완료되었습니다. 이용해 주셔서 감사합니다.`
            },
            'cancelled': {
                title: '❌ 주문이 취소되었습니다',
                message: `${businessName}님의 주문이 취소되었습니다.`
            }
        };

        const msgData = statusMessages[status];
        if (!msgData) return;

        return this.createNotification({
            userId,
            title: msgData.title,
            message: msgData.message,
            type: 'order_status',
            actionUrl: '/mypage'
        });
    },

    // 배송기사 배정 알림
    async notifyDriverAssignment(driverId: string, orderCount: number) {
        return this.createNotification({
            userId: driverId,
            title: '📦 배송 배정 알림',
            message: `오늘 ${orderCount}건의 배송이 배정되었습니다. 확인해주세요.`,
            type: 'assignment',
            actionUrl: '/driver'
        });
    },

    // 매니저 일일 알림
    async notifyManagerDailySummary(managerId: string, orderCount: number) {
        return this.createNotification({
            userId: managerId,
            title: '📋 주문 확인 알림',
            message: `오전 9시 기준 ${orderCount}건의 신규 주문이 있습니다. 확인해주세요.`,
            type: 'notice',
            actionUrl: '/manager'
        });
    },

    // Fetch my notifications
    async getMyNotifications(userId: string) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        return data as NotificationRecord[];
    },

    // Mark as read
    async markAsRead(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;
    },

    // Mark all as read
    async markAllAsRead(userId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) throw error;
    },

    // Save FCM Token (for the 'Device' layer)
    async saveFcmToken(userId: string, token: string) {
        const { error } = await supabase
            .from('users')
            .update({ fcm_token: token })
            .eq('id', userId);

        if (error) throw error;
    },

    // 읽지 않은 알림 개수
    async getUnreadCount(userId: string) {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) throw error;
        return count || 0;
    }
};
