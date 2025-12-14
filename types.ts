export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  business_name: string | null;
  business_number?: string | null;
  business_name_updated?: boolean;
  business_number_updated?: boolean;
  phone: string | null;
  role: 'user' | 'admin' | 'manager' | 'driver';
  created_at: string;
  terms_agreed_at?: string | null;
  privacy_agreed_at?: string | null;
  is_blocked?: boolean;
  // Driver & Notification fields
  assigned_region?: string | null; // 배송 담당 지역
  fcm_token?: string | null;
  notification_settings?: {
    push_enabled: boolean;
    marketing: boolean;
  };
}

export interface UserAddress {
  id: string;
  user_id: string;
  address: string;
  detail_address: string | null;
  is_main: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string | null;
  is_pepsi_family: boolean; // Vital for the 3+1 logic
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  user_id: string;
  user_name?: string; // Joined view
  business_name?: string; // Snapshot column
  phone?: string; // Snapshot column
  items: OrderItem[];
  total_amount: number;
  total_boxes: number;
  service_items: OrderItem[];
  delivery_address?: string;
  created_at: string;
  status: 'pending' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled';
  payment_method: 'credit' | 'card'; // Default 'credit'
  payment_status: 'unpaid' | 'paid'; // Default 'unpaid'
  paid_at?: string | null;
  // 배송기사 관련 필드
  assigned_driver_id?: string | null; // 배정된 배송기사
  driver_confirmed_at?: string | null; // 배송기사 확인 시간
  departed_at?: string | null; // 배송 출발 시간
  delivered_at?: string | null; // 배송 완료 시간
}

export interface ApronRequest {
  id: string;
  user_id: string;
  user_name?: string;
  business_name?: string; // Snapshot
  business_number?: string; // Snapshot
  phone?: string; // Snapshot
  delivery_address?: string; // Snapshot
  quantity: number;
  status: 'pending' | 'completed';
  delivery_method?: 'driver' | 'staff'; // 'driver' = with beverage, 'staff' = direct delivery
  created_at: string;
}
