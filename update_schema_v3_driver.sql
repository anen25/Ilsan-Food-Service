-- Migration: Add driver-related fields to orders table for delivery tracking
-- Version: v3 - Driver Dashboard Enhancement

-- 1. Add driver assignment and tracking fields to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS driver_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS departed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- 2. Add assigned_region field to users (for driver region assignment)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS assigned_region TEXT;

-- 3. Update status check constraint to include 'in_transit'
-- First, drop existing constraint if exists
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new constraint with in_transit status
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled'));

-- 4. Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON public.orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON public.orders(delivered_at);
CREATE INDEX IF NOT EXISTS idx_orders_driver_confirmed ON public.orders(driver_confirmed_at);

-- 5. Add notification type constraint update
-- This ensures the notifications table accepts new types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('order_status', 'care_alert', 'notice', 'promo', 'issue', 'delivery', 'assignment'));

-- 6. Comments for documentation
COMMENT ON COLUMN public.orders.assigned_driver_id IS 'ID of the driver assigned to this delivery';
COMMENT ON COLUMN public.orders.driver_confirmed_at IS 'Timestamp when driver confirmed the assignment';
COMMENT ON COLUMN public.orders.departed_at IS 'Timestamp when driver started the delivery';
COMMENT ON COLUMN public.orders.delivered_at IS 'Timestamp when delivery was completed';
COMMENT ON COLUMN public.users.assigned_region IS 'Region assigned to driver for delivery (e.g., 일산동구, 일산서구)';

-- 7. RLS Policy for drivers to view assigned orders
-- Drop existing policy first, then create new one
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON public.orders;
CREATE POLICY "Drivers can view assigned orders"
ON public.orders FOR SELECT
USING (
    auth.uid() = assigned_driver_id
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

