# Smart Notification & Customer Care System Proposal

## Goal
To implement a comprehensive notification system for order lifecycle and proactive customer care (reorder reminders) without incurring ongoing costs (Free).

## Core Strategy: The "Free" Approach
To achieve zero cost, we cannot use paid APIs like Kakao AlimTalk (approx. 15 KRW/msg) or SMS (approx. 20 KRW/msg). Instead, we will combine **Web Push Notifications (PWA)** and **Logic-based UI Alerts**.

---

## 💰 Cost Analysis & Kakao Clarification

### The Reality:

| Method | Cost | Automation | Best For |
|--------|------|------------|----------|
| **Web Push (FCM)** | 0 KRW | Yes (Full) | System Alerts (Order, Delivery) for Free |
| Kakao Channel Admin | ~15 KRW (Paid) | No (Manual) | Monthly Newsletter / Promotions |
| Kakao AlimTalk API | ~6.5 KRW (Paid) | Yes (Full) | System Alerts via Kakao (Requires BSP) |

**Final Recommendation:** Use Web Push for automated "Care" alerts (Free). Use Kakao Channel only for manual 1:1 chat inquiries (Free) or bulk ad messages (Paid).

---

## 🚀 Future Expansion: Multi-Service CS Architecture (Platform Model)

### The Concept: "Traffic Cop" Routing
The app acts like a traffic cop. It doesn't answer the questions; it just points the user to the right expert.

### Database Structure (The Blueprint)

**service_providers Table (New)**
- `id`: UUID
- `name`: "Seoul Beverage Dist.", "CleanMaster Inc."
- `cs_channel_url`: "http://pf.kakao.com/_xeExxxx" (Their Chat Link)
- `manager_phone`: "010-1234-5678"

**products Table (Update)**
- `provider_id`: FK to service_providers. (Critical: Determining who answers).

---

## 📱 Notification Features

### Web Push Notifications (FCM - Firebase Cloud Messaging)
- **Cost:** $0 (Unlimited)
- **Pros:** Works like a native app alarm. Best for "Care" feeling.
- **Cons:** User must "Allow" permissions. iOS requires adding to Home Screen (PWA).

### Supabase Realtime + UI Toasts
- **Cost:** Included in Supabase Free Tier
- **Description:** When user is online, they see immediate popups.

---

## 🔔 Role-based Notification Strategy (Final Spec)

### 1. 사용자 (User) - "안심 & 케어"

| Trigger Event | Message Logic | Button Action |
|---------------|---------------|---------------|
| 주문 접수 | "고객님, [상품명 외 N건] 주문이 접수되었습니다." | 주문내역 보기 |
| 입금 확인 | "고객님, 입금이 확인되었습니다! 💸" | - |
| 배송 출발 | "고객님, [롯데칠성]에서 배송을 시작했습니다! 🚚" | 배송조회 |
| 배송 완료 | "배송이 완료되었습니다. 오늘도 대박나세요! 🎉" | 리뷰 쓰기 |
| 재주문 케어 | "사장님, 음료 떨어지실 때 안 되셨나요? 🧐" | 장바구니 담기 |

### 2. 서비스 제공자 (Provider/Manager) - "일괄 처리 (Batch)"

| Trigger Event | Message Logic | Required Action |
|---------------|---------------|-----------------|
| 마감 시간 (14시) | "⏰ 주문 마감 시간입니다. (신규 주문 15건)" | 입금확인 및 발주서 출력 |
| 재고 경고 | "⚠️ 칠성사이다 재고가 10박스 이하입니다." | 발주 넣기 |

### 3. 플랫폼 관리자 (Admin) - "총괄 & 사고방지"

| Trigger Event | Message Logic | Note |
|---------------|---------------|------|
| 일일 브리핑 | "📅 12월 14일 마감 리포트 - 총 주문: 50건" | 매일 밤 9:00 발송 |
| 미처리 경고 | "🚨 [크린청소] 업체가 마감시간 1시간을 넘겼습니다!" | 사고 방지용 |

### 4. 배송 기사 (Driver) - "Dashboard & Action"

| Feature | Description |
|---------|-------------|
| 내 배송 리스트 | "오늘 배송할 곳: 15곳 (지도 경로 최적화 표시)" |
| 원터치 배송완료 | [배송완료] 버튼 클릭 -> 고객에게 알림 자동 발송 |
| 사진 전송 | (옵션) 문 앞에 놓은 사진 찍어서 전송 |

---

## 🛡️ 안전한 개발 전략: Git Branch & Preview Deployment

### Main 세상 (현재 운영중)
- Branch: `main`
- 주소: www.ilsan-food.com
- 원칙: 완벽하게 검증된 기능만 이곳으로 가져옵니다.

### Test 세상 (신기능 개발중)
- Branch: `feature/*`
- 주소: dev.ilsan-food.com (또는 Preview URL)
- 원칙: 마음껏 만들고 부수고 테스트합니다.

---

## 📊 Database Changes Required

### users Table (Update)
- `fcm_token` (text) - Firebase Cloud Messaging Token
- `reorder_cycle_days` (int) - Default 7
- `last_order_date` (date)
- `notification_settings` (jsonb) - `{"push_enabled": true, "marketing": true}`

### notifications Table (New)
- `id`, `user_id`, `title`, `message`, `type`, `is_read`, `action_url`, `created_at`

---

## 🎯 UI Changes Required

1. **Navbar:** Bell Icon 🔔 with unread badge
2. **Notification Center:** Drawer/Modal showing history of alerts
3. **MyPage:** "Notification Settings" (Enable Push, Set Reorder Cycle)
4. **Admin:** "Care Dashboard" showing users who reached their reorder cycle

---

## ✅ Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| notifications 테이블 | ✅ 완료 | DB 스키마 생성됨 |
| users 테이블 확장 | ✅ 완료 | fcm_token, reorder_cycle_days 등 |
| NotificationBell 컴포넌트 | ✅ 완료 | UI 구현됨 |
| NotificationContext | ✅ 완료 | 상태 관리 |
| notification.service.ts | ✅ 완료 | 조회/읽음처리 |
| Firebase FCM 설정 | ⚠️ 환경변수 필요 | 키 미등록 |
| 알림 자동 발송 로직 | ❌ 미구현 | 트리거 함수 필요 |
| Admin 케어 대시보드 | ❌ 미구현 | |
| 재주문 케어 알림 | ❌ 미구현 | |

