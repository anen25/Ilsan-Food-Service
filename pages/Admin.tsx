import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Order, ApronRequest, UserProfile, Product } from '../types';
import { useNavigate } from 'react-router-dom';

export const Admin: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'orders' | 'aprons' | 'users' | 'products'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [aprons, setAprons] = useState<ApronRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // --- Filtering States ---

  // 1. Order Filters
  const [orderDateStart, setOrderDateStart] = useState('');
  const [orderDateEnd, setOrderDateEnd] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | 'pending' | 'confirmed' | 'delivered' | 'cancelled'>('ALL');
  const [orderSearchKeyword, setOrderSearchKeyword] = useState('');

  // 2. Apron Filters
  const [apronDateStart, setApronDateStart] = useState('');
  const [apronDateEnd, setApronDateEnd] = useState('');
  const [apronStatusFilter, setApronStatusFilter] = useState<'ALL' | 'pending' | 'completed'>('ALL');
  const [apronSearchKeyword, setApronSearchKeyword] = useState('');

  // 3. User Filters
  const [userSearchKeyword, setUserSearchKeyword] = useState('');

  // 4. Product Filters
  const [productCategoryFilter, setProductCategoryFilter] = useState<'ALL' | 'CAN' | 'BOTTLE' | 'WATER'>('ALL');
  const [productPepsiFilter, setProductPepsiFilter] = useState<'ALL' | 'PEPSI_ONLY'>('ALL');
  const [productSearchKeyword, setProductSearchKeyword] = useState('');

  // Product form state
  const [showProductForm, setShowProductForm] = useState(false); // Used for "Add New"
  const [editingProductId, setEditingProductId] = useState<string | null>(null); // Used for Inline Edit
  const [productForm, setProductForm] = useState({
    name: '',
    price: 0,
    category: 'CAN',
    image: '',
    is_pepsi_family: false
  });

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');

  // User Management State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<Partial<UserProfile>>({});

  // User Action Modal State
  const [showUserActionModal, setShowUserActionModal] = useState(false);
  const [userActionType, setUserActionType] = useState<'EDIT_ACCESS' | 'DELETE' | 'BLOCK' | null>(null);
  const [userActionTarget, setUserActionTarget] = useState<UserProfile | null>(null);
  const [userActionEmail, setUserActionEmail] = useState('');

  // Order Restore Modal State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreActionTarget, setRestoreActionTarget] = useState<any | null>(null);
  const [restoreActionStatus, setRestoreActionStatus] = useState('');
  const [restoreConfirmationInput, setRestoreConfirmationInput] = useState('');


  // Helper for date range buttons
  const setDateRangeHelper = (range: '1W' | '1M' | '3M', type: 'order' | 'apron') => {
    const end = new Date();
    const start = new Date();

    if (range === '1W') start.setDate(end.getDate() - 7);
    if (range === '1M') start.setMonth(end.getMonth() - 1);
    if (range === '3M') start.setMonth(end.getMonth() - 3);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    if (type === 'order') {
      setOrderDateStart(startStr);
      setOrderDateEnd(endStr);
    } else {
      setApronDateStart(startStr);
      setApronDateEnd(endStr);
    }
  };


  useEffect(() => {
    // Set default date range (this week)
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    const todayStr = today.toISOString().split('T')[0];
    const lastWeekStr = lastWeek.toISOString().split('T')[0];

    setOrderDateStart(lastWeekStr);
    setOrderDateEnd(todayStr);
    setApronDateStart(lastWeekStr);
    setApronDateEnd(todayStr);

    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('관리자 로그인이 필요합니다.');
      navigate('/');
      return;
    }

    const { data: user } = await supabase.from('users').select('role').eq('id', session.user.id).single();
    if (!user || user.role !== 'admin') {
      alert('관리자 권한이 없습니다.');
      navigate('/');
      return;
    }

    try {
      await Promise.all([fetchOrders(), fetchAprons(), fetchUsers(), fetchProducts()]);
    } catch (e) {
      console.error("Error fetching admin data", e);
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, users!orders_user_id_fkey(name, business_name, phone)')
      .order('created_at', { ascending: false });

    if (error) console.error('Orders error:', error);
    if (data) {
      const formatted = data.map((o: any) => ({
        ...o,
        user_name: o.users?.name,
        business_name: o.business_name || o.users?.business_name,
        user_phone: o.users?.phone // Keep generic user phone for reference
      }));
      setOrders(formatted);
    }
  };

  const fetchAprons = async () => {
    const { data, error } = await supabase
      .from('apron_requests')
      .select('*, users(name, business_name)')
      .order('created_at', { ascending: false });

    if (error) console.error('Aprons error:', error);
    if (data) {
      const formatted = data.map((a: any) => ({
        ...a,
        user_name: a.users?.name,
        business_name: a.users?.business_name
      }));
      setAprons(formatted);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) console.error('Users error:', error);
    if (data) setUsers(data as UserProfile[]);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) console.error('Products error:', error);
    if (data) {
      const sortedProducts = (data as Product[]).sort((a, b) => {
        const aIsCider = a.name.includes('칠성사이다');
        const bIsCider = b.name.includes('칠성사이다');
        const aIsPepsi = a.name.includes('펩시');
        const bIsPepsi = b.name.includes('펩시');

        if (aIsCider && !bIsCider) return -1;
        if (!aIsCider && bIsCider) return 1;
        if (aIsPepsi && !bIsPepsi && !bIsCider) return -1;
        if (!aIsPepsi && bIsPepsi && !aIsCider) return 1;
        return a.name.localeCompare(b.name, 'ko');
      });
      setProducts(sortedProducts);
    }
  };

  const updateOrderStatus = async (id: string, newStatus: string) => {
    const targetOrder = orders.find(o => o.id === id);
    if (!targetOrder) return;

    // 1. Safety Check: Restoring a cancelled order
    if (targetOrder.status === 'cancelled' && newStatus !== 'cancelled') {
      // Open Restore Modal
      setRestoreActionTarget(targetOrder);
      setRestoreActionStatus(newStatus);
      setRestoreConfirmationInput('');
      setShowRestoreModal(true);
      return;
    }

    // 2. Safety Check: Cancelling an order (Admin initiated)
    if (newStatus === 'cancelled') {
      if (!confirm('정말 이 주문을 [취소] 처리하시겠습니까?')) {
        fetchOrders();
        return;
      }
    }

    await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    fetchOrders();
  };

  const updateApronStatus = async (id: string, status: string) => {
    await supabase.from('apron_requests').update({ status }).eq('id', id);
    fetchAprons();
  };

  // Product CRUD
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProductId) {
      const { error } = await supabase.from('products').update({
        name: productForm.name,
        price: productForm.price,
        category: productForm.category,
        image: productForm.image || null,
        is_pepsi_family: productForm.is_pepsi_family,
        updated_at: new Date().toISOString()
      }).eq('id', editingProductId);
      if (error) { alert('상품 수정 실패: ' + error.message); return; }
      alert('상품이 수정되었습니다.');
    } else {
      const { error } = await supabase.from('products').insert({
        name: productForm.name,
        price: productForm.price,
        category: productForm.category,
        image: productForm.image || null,
        is_pepsi_family: productForm.is_pepsi_family
      });
      if (error) { alert('상품 추가 실패: ' + error.message); return; }
      alert('상품이 추가되었습니다.');
    }
    setProductForm({ name: '', price: 0, category: 'CAN', image: '', is_pepsi_family: false });
    setEditingProductId(null);
    setShowProductForm(false);
    fetchProducts();
  };

  const handleEditProduct = (product: Product) => {
    if (editingProductId === product.id) {
      // Close if already open
      setEditingProductId(null);
      setProductForm({ name: '', price: 0, category: 'CAN', image: '', is_pepsi_family: false });
      return;
    }

    // Close "Add New" if open
    setShowProductForm(false);

    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.image || '',
      is_pepsi_family: product.is_pepsi_family
    });
  };

  const initiateDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setDeleteConfirmationName('');
    setShowDeleteModal(true);
  }

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    if (deleteConfirmationName !== productToDelete.name) return;

    const { error } = await supabase.from('products').delete().eq('id', productToDelete.id);
    if (error) alert('상품 삭제 실패: ' + error.message);
    else {
      alert('상품이 삭제되었습니다.');
      fetchProducts();
    }
    setShowDeleteModal(false);
    setProductToDelete(null);
    setDeleteConfirmationName('');
  };

  // --- User Management Handlers ---

  const handleEditUserClick = (user: UserProfile) => {
    if (editingUserId === user.id) {
      setEditingUserId(null); // Just close if already open
      return;
    }
    // Open verification modal to unlock edit
    setUserActionType('EDIT_ACCESS');
    setUserActionTarget(user);
    setUserActionEmail('');
    setShowUserActionModal(true);
  };

  const handleUserFormChange = (field: keyof UserProfile, value: any) => {
    setUserForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveUser = async (user: UserProfile) => {
    if (!confirm('회원 정보를 수정하시겠습니까?')) return;

    const { error } = await supabase.from('users').update({
      name: userForm.name,
      business_name: userForm.business_name,
      business_number: userForm.business_number,
      phone: userForm.phone
    }).eq('id', user.id);

    if (error) alert('회원 정보 수정 실패: ' + error.message);
    else {
      alert('회원 정보가 수정되었습니다.');
      setEditingUserId(null);
      fetchUsers();
    }
  };

  const initiateDeleteUser = (user: UserProfile) => {
    setUserActionType('DELETE');
    setUserActionTarget(user);
    setUserActionEmail('');
    setShowUserActionModal(true);
  };

  const handleToggleBlock = (user: UserProfile) => {
    setUserActionType('BLOCK');
    setUserActionTarget(user);
    setUserActionEmail('');
    setShowUserActionModal(true);
  };

  const executeUserAction = async () => {
    if (!userActionTarget) return;
    if (userActionEmail !== userActionTarget.email) return;

    if (userActionType === 'EDIT_ACCESS') {
      // Unlock edit mode
      setEditingUserId(userActionTarget.id);
      setUserForm(userActionTarget);
    } else if (userActionType === 'DELETE') {
      const { error } = await supabase.from('users').delete().eq('id', userActionTarget.id);
      if (error) alert('회원 삭제 실패: ' + error.message);
      else {
        alert('회원 정보가 완전히 삭제되었습니다.');
        fetchUsers();
      }
    } else if (userActionType === 'BLOCK') {
      const newStatus = !userActionTarget.is_blocked;
      const { error } = await supabase.from('users').update({ is_blocked: newStatus }).eq('id', userActionTarget.id);
      if (error) alert('상태 변경 실패: ' + error.message);
      else {
        alert(newStatus ? '회원이 차단되었습니다.' : '차단이 해제되었습니다.');
        setUsers(users.map(u => u.id === userActionTarget.id ? { ...u, is_blocked: newStatus } : u));
      }
    }
    setShowUserActionModal(false);
  };

  const executeRestoreOrder = async () => {
    if (!restoreActionTarget || !restoreActionStatus) return;

    // Find target user's business number
    // We can use the 'users' array which contains all users
    const targetUser = users.find(u => u.id === restoreActionTarget.user_id);

    if (!targetUser) {
      alert('주문자 정보를 찾을 수 없어 복구가 불가능합니다.');
      return;
    }

    // Business Number Check (strict)
    // Remove dashes for comparison just in case
    const inputCleaned = restoreConfirmationInput.replace(/-/g, '').trim();
    const targetCleaned = (targetUser.business_number || '').replace(/-/g, '').trim();

    if (inputCleaned !== targetCleaned) {
      // Just return, button should be disabled anyway, but double check
      return;
    }

    await supabase.from('orders').update({ status: restoreActionStatus }).eq('id', restoreActionTarget.id);
    alert('주문 상태가 복구되었습니다.');
    fetchOrders();
    setShowRestoreModal(false);
    setRestoreActionTarget(null);
    setRestoreActionStatus('');
    setRestoreConfirmationInput('');
  };

  const handleCancelProductForm = () => {
    setShowProductForm(false);
    setEditingProductId(null);
    setProductForm({ name: '', price: 0, category: 'CAN', image: '', is_pepsi_family: false });
  };

  const handleBatchConfirm = async () => {
    // 1. Get currently filtered orders that are 'pending'
    const currentList = getFilteredOrders();
    const pendingOrders = currentList.filter(o => o.status === 'pending');

    if (pendingOrders.length === 0) {
      alert('현재 목록에 "접수대기" 상태인 주문이 없습니다.');
      return;
    }

    // 2. Safety Confirmation
    if (!confirm(`총 ${pendingOrders.length}건의 "접수대기" 주문을\n모두 "주문확정"으로 변경하시겠습니까?`)) {
      return;
    }

    // 3. Batch Update
    const pendingIds = pendingOrders.map(o => o.id);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'confirmed' })
      .in('id', pendingIds);

    if (error) {
      alert('일괄 처리 중 오류가 발생했습니다: ' + error.message);
    } else {
      alert('일괄 처리가 완료되었습니다.');
      fetchOrders(); // Refresh list
    }
  };

  const handleAddNewClick = () => {
    setEditingProductId(null); // Close any open edit types
    setProductForm({ name: '', price: 0, category: 'CAN', image: '', is_pepsi_family: false });
    setShowProductForm(true);
  }

  // --- Filtering Logic ---
  const getFilteredOrders = () => {
    return orders.filter(order => {
      // 1. Date Range
      const orderDate = order.created_at.split('T')[0];
      if (orderDateStart && orderDate < orderDateStart) return false;
      if (orderDateEnd && orderDate > orderDateEnd) return false;

      // 2. Status
      if (orderStatusFilter !== 'ALL' && order.status !== orderStatusFilter) return false;

      // 3. Keyword Search (Business Name, User Name, Phone, Address)
      if (orderSearchKeyword) {
        const keyword = orderSearchKeyword.toLowerCase();
        const businessName = (order as any).business_name?.toLowerCase() || '';
        const userName = (order as any).user_name?.toLowerCase() || '';
        const address = ((order as any).delivery_address || '').toLowerCase();
        const phone = (order as any).phone?.replace(/-/g, '') || '';
        const userPhone = (order as any).user_phone?.replace(/-/g, '') || '';
        const searchPhone = keyword.replace(/-/g, '');

        if (!businessName.includes(keyword) &&
          !userName.includes(keyword) &&
          !address.includes(keyword) &&
          !phone.includes(searchPhone) &&
          !userPhone.includes(searchPhone)) {
          return false;
        }
      }
      return true;
    });
  };

  const getFilteredAprons = () => {
    return aprons.filter(apron => {
      // 1. Date Range
      const apronDate = apron.created_at.split('T')[0];
      if (apronDateStart && apronDate < apronDateStart) return false;
      if (apronDateEnd && apronDate > apronDateEnd) return false;

      // 2. Status
      if (apronStatusFilter !== 'ALL' && apron.status !== apronStatusFilter) return false;

      // 3. Keyword Search
      if (apronSearchKeyword) {
        const keyword = apronSearchKeyword.toLowerCase();
        const businessName = (apron as any).business_name?.toLowerCase() || '';
        const userName = (apron as any).user_name?.toLowerCase() || '';

        if (!businessName.includes(keyword) && !userName.includes(keyword)) return false;
      }
      return true;
    });
  };

  const getFilteredUsers = () => {
    return users.filter(user => {
      if (!userSearchKeyword) return true;
      const keyword = userSearchKeyword.toLowerCase();

      const name = user.name?.toLowerCase() || '';
      const email = user.email?.toLowerCase() || '';
      const businessName = user.business_name?.toLowerCase() || '';
      const phone = user.phone?.replace(/-/g, '') || '';
      const businessNumber = user.business_number?.replace(/-/g, '') || '';
      const searchNumber = keyword.replace(/-/g, '');

      return name.includes(keyword) ||
        email.includes(keyword) ||
        businessName.includes(keyword) ||
        phone.includes(searchNumber) ||
        businessNumber.includes(searchNumber);
    });
  };

  const getFilteredProducts = () => {
    return products.filter(product => {
      if (productCategoryFilter !== 'ALL' && product.category !== productCategoryFilter) return false;
      if (productPepsiFilter === 'PEPSI_ONLY' && !product.is_pepsi_family) return false;
      if (productSearchKeyword) {
        if (!product.name.toLowerCase().includes(productSearchKeyword.toLowerCase())) return false;
      }
      return true;
    });
  };

  const filteredOrders = getFilteredOrders();
  const filteredAprons = getFilteredAprons();
  const filteredUsers = getFilteredUsers();
  const filteredProducts = getFilteredProducts();

  if (loading) return <div className="p-8 text-center bg-gray-100 min-h-screen pt-20">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">관리자 대시보드</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
            <p className="text-gray-500">총 주문 건수</p>
            <p className="text-3xl font-bold">{orders.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
            <p className="text-gray-500">대기중 앞치마 신청</p>
            <p className="text-3xl font-bold">{aprons.filter(a => a.status === 'pending').length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
            <p className="text-gray-500">총 회원 수</p>
            <p className="text-3xl font-bold">{users.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
            <p className="text-gray-500">등록 상품 수</p>
            <p className="text-3xl font-bold">{products.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg border-gray-100 overflow-hidden">
          <div className="flex border-b overflow-x-auto">
            {['orders', 'aprons', 'users', 'products'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-4 font-medium whitespace-nowrap transition-colors ${activeTab === tab
                  ? `bg-${tab === 'orders' ? 'blue' : tab === 'aprons' ? 'orange' : tab === 'users' ? 'green' : 'purple'}-50 text-${tab === 'orders' ? 'blue' : tab === 'aprons' ? 'orange' : tab === 'users' ? 'green' : 'purple'}-600 border-b-2 border-${tab === 'orders' ? 'blue' : tab === 'aprons' ? 'orange' : tab === 'users' ? 'green' : 'purple'}-600`
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab === 'orders' && '주문 관리'}
                {tab === 'aprons' && '앞치마 신청'}
                {tab === 'users' && '회원 목록'}
                {tab === 'products' && '상품 관리'}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* 1. ORDER MANAGEMENT */}
            {activeTab === 'orders' && (
              <div>
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap gap-4 items-end">
                  {/* ... Order filters (Same as before) ... */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">기간 조회</label>
                    <div className="flex items-center gap-2">
                      <input type="date" value={orderDateStart} onChange={(e) => setOrderDateStart(e.target.value)} className="p-2 border rounded text-sm w-32" />
                      <span className="text-gray-400">~</span>
                      <input type="date" value={orderDateEnd} onChange={(e) => setOrderDateEnd(e.target.value)} className="p-2 border rounded text-sm w-32" />
                      <div className="flex bg-gray-100 rounded p-1 ml-2">
                        <button onClick={() => setDateRangeHelper('1W', 'order')} className="px-2 py-1 text-xs hover:bg-white rounded transition-colors">1주일</button>
                        <button onClick={() => setDateRangeHelper('1M', 'order')} className="px-2 py-1 text-xs hover:bg-white rounded transition-colors">1개월</button>
                        <button onClick={() => setDateRangeHelper('3M', 'order')} className="px-2 py-1 text-xs hover:bg-white rounded transition-colors">3개월</button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">상태 필터</label>
                    <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value as any)} className="p-2 border rounded text-sm w-32">
                      <option value="ALL">전체</option>
                      <option value="pending">접수대기</option>
                      <option value="confirmed">주문확정</option>
                      <option value="delivered">배송완료</option>
                      <option value="cancelled">취소</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">통합 검색 (업소명, 주문자, 연락처)</label>
                    <div className="relative">
                      <input type="text" value={orderSearchKeyword} onChange={(e) => setOrderSearchKeyword(e.target.value)} placeholder="검색어를 입력하세요..." className="w-full p-2 pl-8 border rounded text-sm" />
                      <i className="fa-solid fa-search absolute left-2.5 top-2.5 text-gray-400"></i>
                    </div>
                  </div>
                  <button onClick={handleBatchConfirm} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-bold shadow-sm whitespace-nowrap">접수대기 일괄 확정</button>
                  <button onClick={() => { setOrderSearchKeyword(''); setOrderStatusFilter('ALL'); const t = new Date(); const l = new Date(); l.setMonth(t.getMonth() - 1); setOrderDateStart(l.toISOString().split('T')[0]); setOrderDateEnd(t.toISOString().split('T')[0]); }} className="px-3 py-2 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 text-sm whitespace-nowrap">초기화</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">업소명</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문내역</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredOrders.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">검색 결과가 없습니다.</td></tr>
                      ) : (
                        filteredOrders.map(order => (
                          <React.Fragment key={order.id}>
                            <tr
                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                            >
                              {/* ... Order Row Content (Same as before) ... */}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><i className={`fa-solid fa-chevron-${expandedOrderId === order.id ? 'down' : 'right'} text-gray-400`}></i></td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(order as any).business_name}</td>
                              <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{order.items.map((i: any) => `${i.productName}`).join(', ')} {order.items.length > 1 && ` 외 ${order.items.length - 1}건`}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.total_boxes}박스</td>
                              <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value)} className={`text-sm rounded-full px-3 py-1 font-semibold border-none focus:ring-2 focus:ring-blue-500 ${order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : order.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  <option value="pending">접수대기</option>
                                  <option value="confirmed">주문확정</option>
                                  <option value="delivered">배송완료</option>
                                  <option value="cancelled">취소</option>
                                </select>
                              </td>
                            </tr>
                            {expandedOrderId === order.id && (
                              <tr className="bg-gray-50">
                                <td colSpan={6} className="px-6 py-6">
                                  {/* ... Expanded Order Detail (Same as before) ... */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                                      <h4 className="font-bold text-gray-800 mb-4 pb-2 border-b flex items-center"><i className="fa-solid fa-cart-shopping mr-2 text-blue-600"></i>주문 상세</h4>
                                      <div className="space-y-3">
                                        {order.items.map((item: any, idx: number) => (<div key={idx} className="flex justify-between text-sm"><span className="text-gray-700">{item.productName}</span><span className="font-medium">{item.quantity}박스 × {item.price.toLocaleString()}원</span></div>))}
                                        {order.service_items && order.service_items.length > 0 && (<div className="bg-blue-50 p-3 rounded mt-2"><p className="text-xs text-blue-700 font-bold mb-2">🎁 서비스 상품 (3+1)</p>{order.service_items.map((item: any, idx: number) => (<div key={idx} className="flex justify-between text-sm text-blue-600"><span>{item.productName}</span><span>{item.quantity}박스</span></div>))}</div>)}
                                        <div className="border-t pt-3 mt-2 flex justify-between items-center"><span className="font-bold text-gray-700">총 합계</span><div className="text-right"><div className="text-xl font-bold text-blue-600">{order.total_amount.toLocaleString()}원</div><div className="text-xs text-gray-500">총 {order.total_boxes}박스</div></div></div>
                                      </div>
                                    </div>
                                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                                      <h4 className="font-bold text-gray-800 mb-4 pb-2 border-b flex items-center"><i className="fa-solid fa-truck mr-2 text-green-600"></i>배송 정보</h4>
                                      <div className="space-y-4 text-sm">
                                        <div><span className="block text-xs text-gray-500 mb-1">업소명 / 사업자번호</span><div className="font-medium text-gray-900">{(order as any).business_name} <span className="text-gray-400 font-normal ml-2">{(order as any).business_number ? (order as any).business_number : '(미등록)'}</span></div></div>
                                        <div><span className="block text-xs text-gray-500 mb-1">연락처</span><div className="font-medium text-gray-900">{(order as any).phone || (order as any).user_phone || '-'}</div></div>
                                        <div><span className="block text-xs text-gray-500 mb-1">배송지</span><div className="font-medium text-gray-900 leading-relaxed">{(order as any).delivery_address}{(order as any).detail_address && <span className="block text-gray-600">{(order as any).detail_address}</span>}</div></div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. APRON REQUESTS (Unchanged) */}
            {activeTab === 'aprons' && (
              <div>
                {/* ... Apron content (Same as before) ... */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">기간 조회</label>
                    <div className="flex items-center gap-2">
                      <input type="date" value={apronDateStart} onChange={(e) => setApronDateStart(e.target.value)} className="p-2 border rounded text-sm w-32" />
                      <span className="text-gray-400">~</span>
                      <input type="date" value={apronDateEnd} onChange={(e) => setApronDateEnd(e.target.value)} className="p-2 border rounded text-sm w-32" />
                      <div className="flex bg-gray-100 rounded p-1 ml-2">
                        <button onClick={() => setDateRangeHelper('1W', 'apron')} className="px-2 py-1 text-xs hover:bg-white rounded transition-colors">1주일</button>
                        <button onClick={() => setDateRangeHelper('1M', 'apron')} className="px-2 py-1 text-xs hover:bg-white rounded transition-colors">1개월</button>
                        <button onClick={() => setDateRangeHelper('3M', 'apron')} className="px-2 py-1 text-xs hover:bg-white rounded transition-colors">3개월</button>
                      </div>
                    </div>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">상태 필터</label><select value={apronStatusFilter} onChange={(e) => setApronStatusFilter(e.target.value as any)} className="p-2 border rounded text-sm w-32"><option value="ALL">전체</option><option value="pending">접수</option><option value="completed">발송완료</option></select></div>
                  <div className="flex-1 min-w-[200px]"><label className="block text-xs font-medium text-gray-500 mb-1">통합 검색 (업소명, 신청자)</label><div className="relative"><input type="text" value={apronSearchKeyword} onChange={(e) => setApronSearchKeyword(e.target.value)} placeholder="검색어를 입력하세요..." className="w-full p-2 pl-8 border rounded text-sm" /><i className="fa-solid fa-search absolute left-2.5 top-2.5 text-gray-400"></i></div></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">업소명 / 사업자번호</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">연락처 / 주소</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청수량</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAprons.length === 0 ? (<tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">검색 결과가 없습니다.</td></tr>) : (filteredAprons.map(req => (
                        <tr key={req.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(req.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            <div>{(req as any).business_name || '업소명 없음'}</div>
                            <div className="text-xs text-gray-400 font-normal">{(req as any).business_number || '-'}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="flex items-center gap-1"><i className="fa-solid fa-phone text-gray-400 text-xs"></i> {(req as any).phone || '-'}</div>
                            <div className="text-xs text-gray-400 mt-1 truncate max-w-[200px]" title={(req as any).delivery_address || ''}><i className="fa-solid fa-map-marker-alt text-gray-400 mr-1"></i>{(req as any).delivery_address || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold text-blue-600">{req.quantity}장</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select value={req.status} onChange={(e) => updateApronStatus(req.id, e.target.value)} className={`text-sm rounded-full px-3 py-1 font-semibold border-none focus:ring-2 focus:ring-orange-500 outline-none ${req.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              <option value="pending">접수</option>
                              <option value="completed">발송완료</option>
                            </select>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. USER LIST (Unchanged) */}
            {activeTab === 'users' && (
              <div>
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[300px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">회원 검색 (이름, 업소명, 연락처, 이메일, 사업자번호)</label>
                    <div className="relative">
                      <input type="text" value={userSearchKeyword} onChange={(e) => setUserSearchKeyword(e.target.value)} placeholder="검색어를 입력하세요..." className="w-full p-2 pl-8 border rounded text-sm" />
                      <i className="fa-solid fa-search absolute left-2.5 top-2.5 text-gray-400"></i>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일/상태</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">업소명 / 사업자번호</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">연락처 / 이메일</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredUsers.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">검색 결과가 없습니다.</td></tr>
                      ) : (
                        filteredUsers.map(u => (
                          <React.Fragment key={u.id}>
                            <tr className={`hover:bg-gray-50 ${u.is_blocked ? 'bg-red-50' : ''}`}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div>{new Date(u.created_at).toLocaleDateString()}</div>
                                {u.is_blocked && <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">차단됨</span>}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                <div className="font-semibold text-gray-700">{u.business_name || '-'}</div>
                                <div className="text-xs">{u.business_number ? u.business_number.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3') : '-'}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                <div className="text-gray-900">{u.phone ? u.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '-'}</div>
                                <div className="text-xs text-gray-400">{u.email || '-'}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                <button
                                  onClick={() => handleEditUserClick(u)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {editingUserId === u.id ? '닫기' : '수정'}
                                </button>
                                <button
                                  onClick={() => handleToggleBlock(u)}
                                  className={`font-medium ${u.is_blocked ? 'text-green-600 hover:text-green-800' : 'text-orange-600 hover:text-orange-800'}`}
                                >
                                  {u.is_blocked ? '해제' : '차단'}
                                </button>
                                { /* Delete button removed by request */}
                              </td>
                            </tr>
                            {editingUserId === u.id && (
                              <tr className="bg-blue-50 animate-fade-in">
                                <td colSpan={5} className="px-6 py-4">
                                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                                    <h4 className="font-bold text-gray-800 mb-3 text-sm">회원 정보 수정 (관리자 권한)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                      <div><label className="block text-xs font-medium text-gray-500">이름</label><input type="text" value={userForm.name || ''} onChange={(e) => handleUserFormChange('name', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
                                      <div><label className="block text-xs font-medium text-gray-500">업소명</label><input type="text" value={userForm.business_name || ''} onChange={(e) => handleUserFormChange('business_name', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
                                      <div><label className="block text-xs font-medium text-gray-500">사업자번호</label><input type="text" value={userForm.business_number || ''} onChange={(e) => handleUserFormChange('business_number', e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="'-' 없이 입력" /></div>
                                      <div><label className="block text-xs font-medium text-gray-500">연락처</label><input type="text" value={userForm.phone || ''} onChange={(e) => handleUserFormChange('phone', e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="'-' 없이 입력" /></div>
                                    </div>
                                    <div className="flex justify-end">
                                      <button onClick={() => handleSaveUser(u)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700">저장하기</button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. PRODUCT MANAGEMENT */}
            {activeTab === 'products' && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-800">상품 목록</h2>
                  <button
                    onClick={handleAddNewClick}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium transition-colors"
                  >
                    + 상품 추가
                  </button>
                </div>

                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap gap-4 items-end">
                  {/* Product Filters - Same as before */}
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label><select value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value as any)} className="p-2 border rounded text-sm min-w-[100px]"><option value="ALL">전체</option><option value="CAN">캔</option><option value="BOTTLE">페트병</option><option value="WATER">생수</option></select></div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">제품군</label><select value={productPepsiFilter} onChange={(e) => setProductPepsiFilter(e.target.value as any)} className="p-2 border rounded text-sm min-w-[120px]"><option value="ALL">전체</option><option value="PEPSI_ONLY">펩시 제품만</option></select></div>
                  <div className="flex-1 min-w-[200px]"><label className="block text-xs font-medium text-gray-500 mb-1">상품 검색</label><div className="relative"><input type="text" value={productSearchKeyword} onChange={(e) => setProductSearchKeyword(e.target.value)} placeholder="상품명 검색..." className="w-full p-2 pl-8 border rounded text-sm" /><i className="fa-solid fa-search absolute left-2.5 top-2.5 text-gray-400"></i></div></div>
                </div>

                {/* Top Add New Form (Only visible when Adding New) */}
                {showProductForm && !editingProductId && (
                  <div className="mb-6 bg-purple-50 p-6 rounded-lg border border-purple-200 animate-slide-in">
                    <h3 className="text-lg font-bold mb-4 text-purple-800">새 상품 추가</h3>
                    {/* Reuse Form Logic */}
                    <form onSubmit={handleProductSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">상품명 *</label><input type="text" required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none" placeholder="예: 펩시콜라" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">가격 (원) *</label><input type="number" required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none" placeholder="17000" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label><select required value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none"><option value="CAN">🥫 캔</option><option value="BOTTLE">🍾 페트병</option><option value="WATER">💧 생수</option></select></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label><input type="text" value={productForm.image} onChange={(e) => setProductForm({ ...productForm, image: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none" /></div>
                      </div>
                      <div className="flex items-center"><input type="checkbox" id="isPepsiFamilyNew" checked={productForm.is_pepsi_family} onChange={(e) => setProductForm({ ...productForm, is_pepsi_family: e.target.checked })} className="w-4 h-4 text-purple-600 border-gray-300 rounded" /><label htmlFor="isPepsiFamilyNew" className="ml-2 text-sm font-medium text-gray-700">펩시 제품군 (3+1 프로모션 대상)</label></div>
                      <div className="flex gap-2 justify-end"><button type="button" onClick={handleCancelProductForm} className="bg-white text-gray-700 px-6 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium">취소</button><button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium shadow-sm">상품 등록</button></div>
                    </form>
                  </div>
                )}

                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이미지</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가격</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">분류</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">{products.length === 0 ? '등록된 상품이 없습니다.' : '검색 결과가 없습니다.'}</td></tr>
                    ) : (
                      filteredProducts.map(product => (
                        <React.Fragment key={product.id}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              {product.image ? (
                                <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded border border-gray-200" />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400 text-xs">No Image</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{product.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.price.toLocaleString()}원</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category === 'CAN' ? '🥫 캔' : product.category === 'BOTTLE' ? '🍾 페트병' : '💧 생수'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {product.is_pepsi_family ? (<span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">펩시</span>) : (<span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">일반</span>)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                              <button
                                onClick={() => handleEditProduct(product)}
                                className={`font-medium ${editingProductId === product.id ? 'text-gray-900 font-bold underline' : 'text-blue-600 hover:text-blue-800'}`}
                              >
                                {editingProductId === product.id ? '수정 닫기' : '수정'}
                              </button>
                              <button
                                onClick={() => initiateDeleteProduct(product)}
                                className="text-red-600 hover:text-red-800 font-medium ml-2"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>

                          {/* INLINE EDIT FORM ROW */}
                          {editingProductId === product.id && (
                            <tr className="bg-purple-50 animate-fade-in">
                              <td colSpan={6} className="px-6 py-6 border-b border-purple-100">
                                <div className="relative">
                                  <div className="absolute left-6 -top-8 w-4 h-4 bg-purple-50 transform rotate-45 border-l border-t border-purple-100"></div> {/* Arrow Indicator */}
                                  <h4 className="font-bold text-gray-800 mb-4 flex items-center"><i className="fa-solid fa-pen-to-square mr-2 text-purple-600"></i> 상품 정보 수정</h4>
                                  <form onSubmit={handleProductSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div><label className="block text-sm font-medium text-gray-700 mb-1">상품명 *</label><input type="text" required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none bg-white" /></div>
                                      <div><label className="block text-sm font-medium text-gray-700 mb-1">가격 (원) *</label><input type="number" required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none bg-white" /></div>
                                      <div><label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label><select required value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none bg-white"><option value="CAN">🥫 캔</option><option value="BOTTLE">🍾 페트병</option><option value="WATER">💧 생수</option></select></div>
                                      <div><label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label><input type="text" value={productForm.image} onChange={(e) => setProductForm({ ...productForm, image: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none bg-white" /></div>
                                    </div>
                                    <div className="flex items-center"><input type="checkbox" id="isPepsiFamilyEdit" checked={productForm.is_pepsi_family} onChange={(e) => setProductForm({ ...productForm, is_pepsi_family: e.target.checked })} className="w-4 h-4 text-purple-600 border-gray-300 rounded bg-white" /><label htmlFor="isPepsiFamilyEdit" className="ml-2 text-sm font-medium text-gray-700">펩시 제품군 (3+1 프로모션 대상)</label></div>
                                    <div className="flex gap-2 justify-end"><button type="button" onClick={handleCancelProductForm} className="bg-white text-gray-700 px-6 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium">취소</button><button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium shadow-sm">수정 저장</button></div>
                                  </form>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Safe Delete Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <i className="fa-solid fa-triangle-exclamation text-red-600 text-xl"></i>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">상품 삭제 확인</h3>
                <p className="text-sm text-gray-500">
                  한번 삭제된 상품은 복구할 수 없습니다.<br />
                  삭제하시려면 아래 입력창에 상품명을 정확히 입력해주세요.
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 text-center">
                <p className="font-bold text-gray-800 text-sm select-all">{productToDelete.name}</p>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={deleteConfirmationName}
                  onChange={(e) => setDeleteConfirmationName(e.target.value)}
                  placeholder="상품명을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-center"
                />
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirmationName !== productToDelete.name}
                  className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all ${deleteConfirmationName === productToDelete.name
                    ? 'bg-red-600 hover:bg-red-700 shadow-lg'
                    : 'bg-gray-300 cursor-not-allowed'
                    }`}
                >
                  삭제하기
                </button>
                <button
                  onClick={() => { setShowDeleteModal(false); setProductToDelete(null); setDeleteConfirmationName(''); }}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Action Modal */}
      {showUserActionModal && userActionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${userActionType === 'DELETE' ? 'bg-red-100' : 'bg-blue-100'}`}>
                  <i className={`fa-solid ${userActionType === 'DELETE' ? 'fa-triangle-exclamation text-red-600' : 'fa-check text-blue-600'} text-xl`}></i>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {userActionType === 'DELETE' ? '회원 정보 완전 삭제' : '회원 정보 수정 확인'}
                </h3>
                <p className="text-sm text-gray-500">
                  {userActionType === 'DELETE' ? (
                    <>
                      이 작업은 되돌릴 수 없습니다.<br />
                      보안을 위해 <b>회원의 이메일 주소</b>를 입력해주세요.
                    </>
                  ) : (
                    <>
                      관리자 권한으로 정보를 수정합니다.<br />
                      확인을 위해 <b>회원의 이메일 주소</b>를 입력해주세요.
                    </>
                  )}
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 text-center">
                <p className="text-xs text-gray-500 mb-1">입력해야 할 이메일</p>
                <p className="font-bold text-gray-800 text-sm select-all">{userActionTarget.email}</p>
              </div>

              <div className="space-y-4">
                <input
                  type="email"
                  value={userActionEmail}
                  onChange={(e) => setUserActionEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 outline-none text-center ${userActionType === 'DELETE' ? 'focus:ring-red-500' : userActionType === 'BLOCK' ? 'focus:ring-orange-500' : 'focus:ring-blue-500'}`}
                />
                <button
                  onClick={executeUserAction}
                  disabled={userActionEmail !== userActionTarget.email}
                  className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all ${userActionEmail === userActionTarget.email
                    ? (userActionType === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : userActionType === 'BLOCK' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700')
                    : 'bg-gray-300 cursor-not-allowed'
                    }`}
                >
                  {userActionType === 'DELETE' ? '삭제하기' : userActionType === 'BLOCK' ? (userActionTarget.is_blocked ? '해제하기' : '차단하기') : '수정하기'}
                </button>
                <button
                  onClick={() => setShowUserActionModal(false)}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Restore Modal */}
      {showRestoreModal && restoreActionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-orange-100">
                  <i className="fa-solid fa-rotate-left text-orange-600 text-xl"></i>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">취소된 주문 복구</h3>
                <p className="text-sm text-gray-500">
                  이미 취소된 주문을 강제로 복구하려고 합니다.<br />
                  배송 사고 예방을 위해 <b>주문자의 사업자번호</b>를 입력해주세요.
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 text-center">
                <p className="text-xs text-gray-500 mb-1">입력해야 할 사업자번호</p>
                {/* We need to find the business number from users list */}
                <p className="font-bold text-gray-800 text-sm select-all">
                  {users.find(u => u.id === restoreActionTarget.user_id)?.business_number || '사업자번호 없음'}
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={restoreConfirmationInput}
                  onChange={(e) => setRestoreConfirmationInput(e.target.value)}
                  placeholder="사업자번호를 입력하세요 ('-' 제외)"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 outline-none text-center"
                />
                <button
                  onClick={executeRestoreOrder}
                  // Logic: Clean confirm input and target number, check equality
                  disabled={!users.find(u => u.id === restoreActionTarget.user_id)?.business_number || restoreConfirmationInput.replace(/-/g, '').trim() !== (users.find(u => u.id === restoreActionTarget.user_id)?.business_number || '').replace(/-/g, '').trim()}
                  className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all ${users.find(u => u.id === restoreActionTarget.user_id)?.business_number && restoreConfirmationInput.replace(/-/g, '').trim() === (users.find(u => u.id === restoreActionTarget.user_id)?.business_number || '').replace(/-/g, '').trim()
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-gray-300 cursor-not-allowed'
                    }`}
                >
                  주문 복구하기
                </button>
                <button
                  onClick={() => { setShowRestoreModal(false); setRestoreConfirmationInput(''); setRestoreActionTarget(null); }}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
