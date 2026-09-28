import { Account, Client } from 'appwrite';

(() => {
  const cfg = window.NIKSMARVEL_ADMIN_CONFIG || {};
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const loginButton = document.getElementById('loginButton');
  const loginMessage = document.getElementById('loginMessage');
  const setupNotice = document.getElementById('setupNotice');
  const recordsBody = document.getElementById('recordsBody');
  const detailDialog = document.getElementById('detailDialog');
  const sidebar = document.getElementById('adminSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const menuButton = document.getElementById('menuButton');
  const toast = document.getElementById('toast');
  let account = null;
  let jwt = sessionStorage.getItem('nfaAdminJwt') || '';
  let rows = [];
  let openRowId = '';
  let toastTimer = null;

  const apiBase = String(cfg.apiBase || '').replace(/\/$/, '');
  const api = (path) => `${apiBase}/api${path}`;

  document.querySelectorAll('[data-public-form-link]').forEach((link) => {
    if (cfg.publicFormUrl) link.href = cfg.publicFormUrl;
    else link.hidden = true;
  });

  const escaped = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const initials = (row) => `${row.firstName?.[0] || ''}${row.lastName?.[0] || ''}`.toUpperCase() || 'N';
  const dataOf = (row) => row.data || row;
  const fullName = (row) => [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ') || 'Unnamed applicant';

  const prettyDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fullDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const bearer = () => ({ Authorization: `Bearer ${jwt}` });

  function setLoginMessage(text, good = false) {
    loginMessage.textContent = text;
    loginMessage.style.color = good ? '#56734f' : '';
  }

  function showToast(text) {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = text;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2800);
  }

  function configureAccount() {
    if (!cfg.endpoint || !cfg.projectId) return false;
    const client = new Client().setEndpoint(cfg.endpoint).setProject(cfg.projectId);
    account = new Account(client);
    return true;
  }

  async function checkServer() {
    if (!configureAccount()) {
      setupNotice.hidden = false;
      loginButton.disabled = true;
      return;
    }
    try {
      const response = await fetch(api('/health'));
      const health = await response.json();
      const ready = response.ok && health.configured === true;
      setupNotice.hidden = ready;
      loginButton.disabled = !ready;
      if (!ready) setupNotice.querySelector('span').textContent = 'Connect the academy’s private database and sign-in account before using this portal.';
    } catch {
      setupNotice.hidden = false;
      loginButton.disabled = true;
      setupNotice.querySelector('span').textContent = 'The records service is unavailable. Check the server connection and try again.';
    }
  }

  async function request(path, options = {}) {
    const response = await fetch(api(path), {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...bearer(),
        ...(options.headers || {})
      }
    });

    if (response.status === 401 || response.status === 403) {
      const error = new Error('Your academy session is no longer valid. Please sign in again.');
      error.auth = true;
      throw error;
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'The request could not be completed.');
    return result;
  }

  function updateStats() {
    const total = rows.length;
    const processed = rows.filter((raw) => Boolean(dataOf(raw).processed)).length;
    const fresh = total - processed;
    document.getElementById('recordCount').textContent = String(total);
    document.getElementById('statTotal').textContent = String(total);
    document.getElementById('statNew').textContent = String(fresh);
    document.getElementById('statProcessed').textContent = String(processed);

    const badge = document.getElementById('sidebarNewBadge');
    badge.textContent = String(fresh);
    badge.hidden = fresh === 0;

    const noun = total === 1 ? 'application' : 'applications';
    document.getElementById('recordsFootCount').textContent = `${total} ${noun}`;
  }

  function filteredRows() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const status = document.getElementById('statusFilter').value;
    return rows.filter((raw) => {
      const row = dataOf(raw);
      const haystack = `${fullName(row)} ${row.program || ''} ${row.email || ''}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const processed = Boolean(row.processed);
      const matchesStatus = status === 'all' || (status === 'processed' ? processed : !processed);
      return matchesQuery && matchesStatus;
    });
  }

  function renderRows() {
    const visible = filteredRows();
    updateStats();
    document.getElementById('recordsSummary').textContent = visible.length
      ? `Showing ${visible.length} of ${rows.length} applications`
      : rows.length ? 'No applications match this filter' : 'No applications received yet';

    if (!visible.length) {
      recordsBody.innerHTML = `<tr><td class="empty-cell" colspan="5">${rows.length ? 'No applications match your search.' : 'No applications have been received yet.'}</td></tr>`;
      return;
    }

    recordsBody.innerHTML = visible.map((raw) => {
      const row = dataOf(raw);
      const id = raw.$id || row.$id;
      const statusClass = row.processed ? 'processed' : '';
      const statusText = row.processed ? 'Processed' : 'New';
      return `<tr>
        <td data-label="Student">
          <div class="student-cell">
            <span class="avatar" aria-hidden="true">${escaped(initials(row))}</span>
            <span><span class="student-name">${escaped(fullName(row))}</span><span class="student-email">${escaped(row.email || '')}</span></span>
          </div>
        </td>
        <td class="program-cell" data-label="Program">${escaped(row.program || '—')}</td>
        <td class="date-cell" data-label="Submitted">${escaped(prettyDate(row.submissionTime || raw.$createdAt))}</td>
        <td data-label="Status"><span class="status-pill ${statusClass}">${statusText}</span></td>
        <td><button class="row-action" type="button" data-open="${escaped(id)}" aria-label="View ${escaped(fullName(row))} application">View record</button></td>
      </tr>`;
    }).join('');

    recordsBody.querySelectorAll('[data-open]').forEach((button) => {
      button.addEventListener('click', () => openDetails(button.dataset.open));
    });
  }

  function setLastRefresh() {
    const now = new Date();
    document.getElementById('lastRefresh').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  async function loadRows() {
    recordsBody.innerHTML = '<tr><td class="empty-cell" colspan="5">Loading private records…</td></tr>';
    try {
      const result = await request('/submissions');
      rows = result.rows || [];
      rows.sort((a, b) => new Date((dataOf(b).submissionTime || b.$createdAt) || 0) - new Date((dataOf(a).submissionTime || a.$createdAt) || 0));
      setLastRefresh();
      renderRows();
    } catch (error) {
      if (error.auth) return signOut(false, error.message);
      recordsBody.innerHTML = `<tr><td class="empty-cell" colspan="5">${escaped(error.message)}</td></tr>`;
      showToast(error.message);
    }
  }

  async function loadPrivateImage(fileId, imageEl) {
    if (!fileId) {
      imageEl.alt = 'No image supplied';
      return;
    }
    try {
      const response = await fetch(api(`/files/${encodeURIComponent(fileId)}`), { headers: bearer() });
      if (!response.ok) throw new Error('Image unavailable');
      const blob = await response.blob();
      imageEl.src = URL.createObjectURL(blob);
    } catch {
      imageEl.alt = 'Image could not be loaded';
    }
  }

  function detailField(label, value) {
    return `<div class="detail-item"><span>${escaped(label)}</span><strong>${escaped(value || '—')}</strong></div>`;
  }

  async function openDetails(id) {
    const raw = rows.find((item) => item.$id === id || dataOf(item).$id === id);
    if (!raw) return;
    const row = dataOf(raw);
    openRowId = id;

    document.getElementById('detailTitle').textContent = fullName(row);
    document.getElementById('detailBody').innerHTML = `
      <section class="detail-section"><h3>Student information</h3><div class="detail-grid">
        ${detailField('Full name', fullName(row))}${detailField('Email', row.email)}
        ${detailField('Date of birth', prettyDate(row.dateOfBirth))}${detailField('Marital status', row.maritalStatus)}
        ${detailField('Pregnancy status', row.pregnant)}${detailField('Phone', row.phone)}
        ${detailField('Gender', row.gender)}${detailField('Sewing experience', row.sewingExperience)}
        ${detailField('Program', row.program)}${detailField('Estimated start date', prettyDate(row.estimatedStartDate))}
        ${detailField('Residential address', [row.addressLine1, row.addressLine2, row.city, row.state].filter(Boolean).join(', '))}
        ${detailField('Submitted', fullDate(row.submissionTime || raw.$createdAt))}
      </div></section>
      <section class="detail-section"><h3>Parent / guardian</h3><div class="detail-grid">
        ${detailField('First name', row.guardianFirstName)}${detailField('Last name', row.guardianLastName)}
        ${detailField('Address', row.guardianAddress)}${detailField('Phone', row.guardianPhone)}
        ${detailField('Email', row.guardianEmail)}
      </div></section>
      <section class="detail-section"><h3>Declaration</h3><div class="detail-grid">
        ${detailField('Accepted', row.declarationAccepted ? 'Yes' : 'No')}${detailField('Status', row.processed ? 'Processed' : 'New')}
      </div></section>
      <section class="detail-section"><h3>Uploaded files</h3><div class="detail-photo-row">
        <div class="detail-photo"><img id="passportPreview" alt="Passport photograph" /><span>Passport photograph</span></div>
        <div class="detail-photo"><img id="signaturePreview" alt="Signature" /><span>Signature</span></div>
      </div></section>`;

    const button = document.getElementById('markProcessedButton');
    button.classList.toggle('is-processed', Boolean(row.processed));
    button.innerHTML = row.processed ? 'Already processed <span aria-hidden="true">✓</span>' : 'Mark as processed <span aria-hidden="true">→</span>';
    button.disabled = Boolean(row.processed);

    detailDialog.showModal();
    loadPrivateImage(row.passportFileId, document.getElementById('passportPreview'));
    loadPrivateImage(row.signatureFileId, document.getElementById('signaturePreview'));
  }

  async function markProcessed() {
    if (!openRowId) return;
    const button = document.getElementById('markProcessedButton');
    button.disabled = true;
    try {
      await request(`/submissions/${encodeURIComponent(openRowId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ processed: true })
      });
      detailDialog.close();
      showToast('Application marked as processed.');
      await loadRows();
    } catch (error) {
      button.disabled = false;
      if (error.auth) return signOut(false, error.message);
      showToast(error.message);
    }
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    sidebarOverlay.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function toggleSidebar() {
    const open = !sidebar.classList.contains('is-open');
    sidebar.classList.toggle('is-open', open);
    sidebarOverlay.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  async function showDashboard(email) {
    loginView.hidden = true;
    dashboardView.hidden = false;
    document.getElementById('signedInEmail').textContent = email || 'Academy staff';
    await loadRows();
  }

  async function signOut(callAppwrite = true, reason = '') {
    if (callAppwrite && account) {
      try { await account.deleteSession('current'); } catch { /* Local session is still cleared below. */ }
    }
    jwt = '';
    sessionStorage.removeItem('nfaAdminJwt');
    dashboardView.hidden = true;
    loginView.hidden = false;
    closeSidebar();
    if (reason) setLoginMessage(reason);
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setLoginMessage('');

    const email = String(loginForm.elements.email.value || '').trim().toLowerCase();
    const password = String(loginForm.elements.password.value || '');
    if (!email || !password) return;

    if (!configureAccount()) {
      setLoginMessage('The private portal has not been connected to Appwrite yet.');
      return;
    }

    loginButton.disabled = true;
    loginButton.innerHTML = '<span>Signing in…</span><span aria-hidden="true">→</span>';

    try {
      await account.createEmailPasswordSession(email, password);
      const sessionJwt = await account.createJWT();
      jwt = sessionJwt.jwt;
      sessionStorage.setItem('nfaAdminJwt', jwt);
      await showDashboard(email);
      loginForm.reset();
    } catch (error) {
      jwt = '';
      sessionStorage.removeItem('nfaAdminJwt');
      setLoginMessage(error.message || 'Unable to sign in. Check the account details and try again.');
    } finally {
      loginButton.disabled = false;
      loginButton.innerHTML = '<span>Sign in</span><span aria-hidden="true">→</span>';
      checkServer();
    }
  });

  document.getElementById('logoutButton').addEventListener('click', () => signOut(true));
  document.getElementById('refreshButton').addEventListener('click', loadRows);
  document.getElementById('searchInput').addEventListener('input', renderRows);
  document.getElementById('statusFilter').addEventListener('change', renderRows);
  document.getElementById('closeDialog').addEventListener('click', () => detailDialog.close());
  document.getElementById('markProcessedButton').addEventListener('click', markProcessed);
  detailDialog.addEventListener('click', (event) => { if (event.target === detailDialog) detailDialog.close(); });
  menuButton.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);
  sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeSidebar));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) closeSidebar();
  });

  async function resumeSession() {
    await checkServer();
    if (!jwt || !account) return;
    try {
      const profile = await account.get();
      await request('/submissions');
      await showDashboard(profile.email);
    } catch {
      await signOut(false);
    }
  }

  resumeSession();
})();
