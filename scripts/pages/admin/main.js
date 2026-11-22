import {
  ERP,
  apiFetch,
  refreshMeta,
  hasPerm,
  showToast,
  bindSharedModals
} from './api.js';
import { renderAnalyticsTab } from './tab-analytics.js';
import { renderProductsTab, renderCategoriesTab } from './tab-products.js';
import { renderPurchasesTab } from './tab-purchases.js';
import { renderSalesTab, renderOrdersTab } from './tab-sales.js';
import { renderInventoryTab } from './tab-inventory.js';
import { renderCashbookTab } from './tab-cashbook.js';
import { renderPartnersTab, renderUsersTab } from './tab-partners-users.js';

const TAB_RENDERERS = {
  analytics: renderAnalyticsTab,
  products: renderProductsTab,
  categories: renderCategoriesTab,
  purchases: renderPurchasesTab,
  sales: renderSalesTab,
  orders: renderOrdersTab,
  inventory: renderInventoryTab,
  cashbook: renderCashbookTab,
  partners: renderPartnersTab,
  users: renderUsersTab
};

async function switchTab(tabKey, opts = {}) {
  const btn = document.querySelector(`#erpTabsNav .admin-tab-btn[data-tab="${tabKey}"]`);
  if (!btn || btn.style.display === 'none') {
    showToast('Vai trò hiện tại không có quyền truy cập phân hệ này.', 'err');
    return;
  }
  ERP.activeTab = tabKey;

  document.querySelectorAll('#erpTabsNav .admin-tab-btn').forEach((b) => {
    const isAct = b.dataset.tab === tabKey;
    b.classList.toggle('active', isAct);
    b.setAttribute('aria-selected', isAct ? 'true' : 'false');
  });

  document.querySelectorAll('.admin-tab-panel').forEach((p) => {
    p.classList.toggle('active', p.id === `tab-${tabKey}`);
  });

  const renderer = TAB_RENDERERS[tabKey];
  if (renderer) {
    try {
      await renderer(opts);
    } catch (err) {
      showToast(err.message || 'Lỗi tải dữ liệu phân hệ.', 'err');
    }
  }
}

ERP.switchTab = switchTab;

async function boot() {
  bindSharedModals();

  document.getElementById('erpLogoutBtn')?.addEventListener('click', () => {
    if (window.S25 && window.S25.logoutUser) window.S25.logoutUser();
    window.location.href = './login.html';
  });

  // Verify live JWT session from server
  const token = (window.S25 && window.S25.getToken && window.S25.getToken()) || '';
  if (!token) {
    window.location.href = './login.html?next=admin.html';
    return;
  }

  try {
    const me = await apiFetch('/api/auth/me');
    if (!me.user || !me.user.is_staff) {
      showToast('Tài khoản khách hàng không có quyền vào Cổng Quản Trị.', 'err');
      window.location.href = './account.html';
      return;
    }
    ERP.user = me.user;
    if (window.S25 && window.S25.setSession) {
      window.S25.setSession(token, me.user);
    }
  } catch (_) {
    window.location.href = './login.html?next=admin.html';
    return;
  }

  // Populate topbar user info
  document.getElementById('erpTopUserName').textContent = ERP.user.full_name;
  document.getElementById('erpTopUserRole').textContent = `${ERP.user.role_code} • ${ERP.user.warehouse_name || 'Toàn hệ thống 5 kho'}`;

  // Load metadata (roles, warehouses, categories, suppliers)
  await refreshMeta();

  // RBAC tab pruning
  document.querySelectorAll('#erpTabsNav .admin-tab-btn').forEach((btn) => {
    const raw = (btn.dataset.perms || '').trim();
    const allowed = !raw || hasPerm(raw.split(',').map((s) => s.trim()).filter(Boolean));
    if (!allowed) {
      btn.style.display = 'none';
    } else {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    }
  });

  // Support optional hash/query ?tab=sales
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  const firstTab = (urlTab && document.querySelector(`#erpTabsNav .admin-tab-btn[data-tab="${urlTab}"]`)?.style.display !== 'none')
    ? urlTab
    : 'analytics';
  await switchTab(firstTab);
}

boot();
