const weddingDate = new Date('2026-11-14T10:00:00-06:00');
const cfg = window.WEDDING_CONFIG || {};
const configured = Boolean(
  cfg.supabaseUrl && !cfg.supabaseUrl.includes('YOUR_') &&
  cfg.supabaseAnonKey && !cfg.supabaseAnonKey.includes('YOUR_')
);
const db = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
const isAdminPortal = /(?:^|\/)command-center\.html$/.test(window.location.pathname);
const app = document.getElementById('app');

let page = isAdminPortal ? 'admin' : 'splash';
let adminView = 'dashboard';
let session = null;
let loadingAdmin = false;
let adminError = '';
let adminData = {
  invitations: [],
  rsvps: [],
  jobs: [],
  assignments: [],
  registry: [],
  photos: []
};

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function titleCase(value = '') {
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date(value));
}

function nav(next) {
  if (next === 'admin' && !isAdminPortal) return;
  page = next;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (next === 'admin') loadAdmin();
}

function setAdminView(next) {
  adminView = next;
  render();
}

function shell(content) {
  if (isAdminPortal) {
    return `<div class="app-shell admin-app">
      <header class="site-header admin-header">
        <div class="brand">Jordan <span>&</span> Rochelle</div>
        <span class="private-label">Private Command Center</span>
      </header>
      ${content}
      <footer><span>♥</span> Jordan & Rochelle · Private administration</footer>
    </div>`;
  }

  return `<div class="app-shell">
    <header class="site-header">
      <button class="brand" onclick="nav('home')">Jordan <span>&</span> Rochelle</button>
      <nav class="desktop-nav">
        <button onclick="nav('rsvp')">RSVP</button>
        <button onclick="nav('details')">Wedding Details</button>
        <button onclick="nav('registry')">Gift Registry</button>
        <button onclick="nav('photos')">Photo Album</button>
      </nav>
    </header>
    ${content}
    <footer><span>♥</span> Jordan & Rochelle · November 14, 2026</footer>
  </div>`;
}

function render() {
  if (page === 'splash') {
    app.innerHTML = `<main class="splash"><div class="splash-overlay"></div><section class="splash-card">
      <p class="eyebrow">Together with our families</p>
      <h1>Jordan <span>&</span> Rochelle</h1>
      <p class="date">November 14, 2026</p>
      <p class="location">📍 4-H Building · Milbank, South Dakota</p>
      <button class="primary large" onclick="nav('home')">Enter Our Wedding Website</button>
    </section></main>`;
    return;
  }

  let content = '';
  if (page === 'home') content = renderHome();
  if (page === 'rsvp') content = renderRsvp();
  if (page === 'details') content = renderDetails();
  if (page === 'registry') content = renderRegistry();
  if (page === 'photos') content = renderPhotos();
  if (page === 'admin' && isAdminPortal) content = renderAdmin();
  app.innerHTML = shell(content);
}

function renderHome() {
  return `<main><section class="hero"><div>
    <p class="eyebrow">We’re getting married</p><h2>Celebrate with us</h2>
    <p class="lead">We are excited to celebrate our wedding with our family and friends. Please RSVP and find the details for our special day below.</p>
    <button class="primary" onclick="nav('rsvp')">RSVP Now</button>
  </div>${publicFavoritePhotoUrl ? `<div class="hero-photo hero-engagement-photo"><img src="${esc(publicFavoritePhotoUrl)}" alt="${esc(publicFavoritePhoto?.caption || 'Jordan and Rochelle engagement photo')}"></div>` : `<div class="hero-photo placeholder-photo">${publicFavoriteLoading ? 'Loading our favorite engagement photo…' : 'Your favorite engagement photo'}</div>`}</section>
  <section class="quick-grid">
    ${card('👥', 'RSVP', 'Tell us whether you can celebrate with us.', 'rsvp')}
    ${card('📅', 'Wedding Details', 'Saturday, November 14, 2026 at 10:00 AM.', 'details')}
    ${card('🎁', 'Gift Registry', 'Browse gifts and registry links chosen by Jordan and Rochelle.', 'registry')}
    ${card('📷', 'Photo Album', 'Photos chosen by Jordan and Rochelle.', 'photos')}
  </section></main>`;
}

function renderRsvp() {
  return `<main class="content-page"><div class="page-heading"><p class="eyebrow">Please respond</p>
    <h2>Wedding RSVP</h2><p>No account or password is required.</p></div>
    <form class="rsvp-form" onsubmit="submitRsvp(event)">
      <h3>Your information</h3><div class="form-grid">
        ${field('First name', 'first_name', true)}${field('Last name', 'last_name', true)}
        ${field('Street address', 'street_address', true, true)}${field('City', 'city', true)}
        ${field('State', 'state', true)}${field('ZIP code', 'zip_code', true)}
        ${field('Phone number', 'phone', true)}${field('Email (optional)', 'email')}
      </div>
      <h3>Will you attend?</h3><div class="choice-row">
        <label><input type="radio" name="attendance" value="attending" checked> Yes, I’ll be there</label>
        <label><input type="radio" name="attendance" value="declined"> Sorry, I can’t make it</label>
      </div>
      <div class="form-grid">
        ${numberField('Number of adults', 'adult_count', 1)}${numberField('Number of children', 'child_count', 0)}
        ${field('Additional guest names', 'additional_guests', false, true)}
        <label class="field wide"><span>Notes, allergies, or special needs</span><textarea name="notes" rows="4"></textarea></label>
      </div>
      <div id="rsvp-message"></div><button class="primary" type="submit">Submit RSVP</button>
    </form></main>`;
}

function renderDetails() {
  return `<main class="content-page"><div class="page-heading"><p class="eyebrow">Save the date</p><h2>Wedding Details</h2></div>
    <section class="detail-card"><div class="big-icon">📅</div><div><h3>Saturday, November 14, 2026</h3><p>The ceremony begins at 10:00 AM.</p></div></section>
    <section class="detail-card"><div class="big-icon">📍</div><div><h3>4-H Building</h3><p>Milbank, South Dakota</p><p class="muted">Directions, parking details, and other instructions can be added here.</p></div></section>
  </main>`;
}

function renderRegistry() {
  return `<main class="content-page"><div class="page-heading"><p class="eyebrow">With gratitude</p><h2>Gift Registry</h2></div>
    <div class="empty-state"><div class="big-icon">🎁</div><h3>Registry coming soon</h3><p>Registry links will appear here when you add them in the Command Center.</p></div>
  </main>`;
}

function renderPhotos() {
  return `<main class="content-page"><div class="page-heading"><p class="eyebrow">Our memories</p><h2>Photo Album</h2><p>Only photos selected by Jordan and Rochelle will be shown here.</p></div>
    <div class="photo-grid">${[1, 2, 3, 4, 5, 6].map((number) => `<div class="album-placeholder">Selected photo ${number}</div>`).join('')}</div>
  </main>`;
}

function renderAdmin() {
  if (!configured) {
    return `<main class="content-page admin-page"><div class="page-heading"><p class="eyebrow">Setup needed</p><h2>Connect Supabase</h2><p>Open <strong>config.js</strong> and add your Supabase project URL and publishable key.</p></div></main>`;
  }

  if (!session) {
    return `<main class="content-page admin-page"><div class="page-heading"><p class="eyebrow">Private area</p><h2>Wedding Command Center</h2><p>Approved administrators only.</p></div>
      <form class="login-card" onsubmit="adminLogin(event)">${field('Email', 'email', true)}
        <label class="field"><span>Password</span><input type="password" name="password" required autocomplete="current-password"></label>
        <div id="login-message"></div><button class="primary" type="submit">Sign In</button>
      </form></main>`;
  }

  return `<main class="command-layout">
    <aside class="command-sidebar">
      <div class="sidebar-wedding"><span>Wedding date</span><strong>Nov. 14, 2026</strong></div>
      ${sidebarButton('dashboard', '⌂', 'Dashboard')}
      ${sidebarButton('review', '✉', 'RSVP Review', needsReview().length)}
      ${sidebarButton('invitations', '👥', 'Invite List')}
      ${sidebarButton('jobs', '✓', 'Wedding Jobs')}
      ${sidebarButton('registry', '🎁', 'Registry')}
      ${sidebarButton('photos', '▧', 'Photos')}
      ${sidebarButton('summary', '▤', 'Wedding Summary')}
      ${sidebarButton('settings', '⚙', 'Settings')}
      <button class="sidebar-signout" onclick="adminLogout()">Sign out</button>
    </aside>
    <section class="command-main">
      <div class="command-mobile-nav"><label>Command Center<select onchange="setAdminView(this.value)">
        ${['dashboard','review','invitations','jobs','registry','photos','summary','settings'].map((view) => `<option value="${view}" ${view === adminView ? 'selected' : ''}>${titleCase(view)}</option>`).join('')}
      </select></label></div>
      ${loadingAdmin ? '<div class="loading-card">Loading wedding information…</div>' : renderAdminView()}
    </section>
  </main>`;
}

function sidebarButton(view, icon, label, badge = 0) {
  return `<button class="sidebar-button ${adminView === view ? 'active' : ''}" onclick="setAdminView('${view}')">
    <span class="sidebar-icon">${icon}</span><span>${label}</span>${badge ? `<b>${badge}</b>` : ''}
  </button>`;
}

function renderAdminView() {
  if (adminError) return `<div class="error-card"><h2>Could not load the Command Center</h2><p>${esc(adminError)}</p><button class="primary" onclick="loadAdmin()">Try Again</button></div>`;
  if (adminView === 'dashboard') return renderDashboard();
  if (adminView === 'review') return renderReview();
  if (adminView === 'invitations') return renderInvitations();
  if (adminView === 'jobs') return renderJobs();
  if (adminView === 'registry') return placeholderAdminPage('Gift Registry', 'Registry management is the next module after guest management.');
  if (adminView === 'photos') return placeholderAdminPage('Photo Manager', 'This will manage your private library and the selected guest album.');
  if (adminView === 'summary') return renderSummary();
  if (adminView === 'settings') return placeholderAdminPage('Settings', 'Wedding details and public-page visibility controls will be added here.');
  return renderDashboard();
}

function dashboardMetrics() {
  const attendingResponses = adminData.rsvps.filter((item) => item.attendance === 'attending');
  return {
    invitedPeople: adminData.invitations.reduce((sum, item) => sum + Number(item.max_guests || 0), 0),
    responses: adminData.rsvps.length,
    attendingPeople: attendingResponses.reduce((sum, item) => sum + Number(item.adult_count || 0) + Number(item.child_count || 0), 0),
    declinedResponses: adminData.rsvps.filter((item) => item.attendance === 'declined').length,
    review: needsReview().length
  };
}

function needsReview() {
  return adminData.rsvps.filter((item) => item.verification_status === 'needs_review');
}

function renderDashboard() {
  const metrics = dashboardMetrics();
  const milliseconds = Math.max(0, weddingDate.getTime() - Date.now());
  const days = Math.ceil(milliseconds / 86400000);
  const recent = adminData.rsvps.slice(0, 6);
  const openJobs = adminData.jobs.reduce((sum, job) => sum + Number(job.openings || 0), 0);

  return `<div class="admin-view">
    <div class="view-heading"><div><p class="eyebrow">Welcome back</p><h1>Wedding Command Center</h1><p>Signed in as ${esc(session.user.email)}</p></div><button class="secondary" onclick="loadAdmin()">Refresh</button></div>
    <div class="private-countdown"><span>Private countdown</span><strong>${days}</strong><em>days until “I do”</em></div>
    <section class="metric-grid">
      ${metricCard('Invited people', metrics.invitedPeople, 'Based on invitation limits')}
      ${metricCard('RSVPs received', metrics.responses, 'Submitted responses')}
      ${metricCard('Attending', metrics.attendingPeople, 'Adults and children')}
      ${metricCard('Declined', metrics.declinedResponses, 'Responses declined')}
      ${metricCard('Needs review', metrics.review, metrics.review ? 'Action required' : 'All caught up', metrics.review > 0)}
    </section>
    <section class="attention-grid">
      <article class="admin-panel"><div class="panel-heading"><h2>Needs attention</h2></div>
        <button class="attention-item" onclick="setAdminView('review')"><span>${metrics.review} RSVP${metrics.review === 1 ? '' : 's'} need review</span><b>Review →</b></button>
        <button class="attention-item" onclick="setAdminView('jobs')"><span>${openJobs} job opening${openJobs === 1 ? '' : 's'} listed</span><b>View →</b></button>
      </article>
      <article class="admin-panel"><div class="panel-heading"><h2>Recent RSVPs</h2><button onclick="setAdminView('review')">View all</button></div>
        ${recent.length ? recent.map((item) => `<div class="recent-row"><div><strong>${esc(item.first_name)} ${esc(item.last_name)}</strong><span>${titleCase(item.attendance)} · ${formatDate(item.created_at)}</span></div>${statusPill(item.verification_status)}</div>`).join('') : '<p class="muted">No RSVP responses yet.</p>'}
      </article>
    </section>
  </div>`;
}

function metricCard(label, value, detail, alert = false) {
  return `<article class="metric-card ${alert ? 'metric-alert' : ''}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function renderReview() {
  const review = needsReview();
  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Guest responses</p><h1>RSVP Review</h1><p>Match, verify, or reject submissions that need your attention.</p></div></div>
    ${review.length ? `<div class="review-list">${review.map(renderReviewCard).join('')}</div>` : `<div class="empty-state admin-empty"><div class="big-icon">✓</div><h2>All caught up</h2><p>There are no RSVP submissions waiting for review.</p></div>`}
  </div>`;
}

function renderReviewCard(rsvp) {
  const invitationOptions = adminData.invitations.map((invitation) => `<option value="${invitation.id}">${esc(invitation.household_name)} — ${esc(invitation.primary_first_name)} ${esc(invitation.primary_last_name)}</option>`).join('');
  return `<article class="review-card">
    <div class="review-card-top"><div><h2>${esc(rsvp.first_name)} ${esc(rsvp.last_name)}</h2><p>${titleCase(rsvp.attendance)} · Submitted ${formatDate(rsvp.created_at)}</p></div>${statusPill(rsvp.verification_status)}</div>
    <div class="review-details">
      <div><span>Address</span><strong>${esc(rsvp.street_address)}<br>${esc(rsvp.city)}, ${esc(rsvp.state)} ${esc(rsvp.zip_code)}</strong></div>
      <div><span>Contact</span><strong>${esc(rsvp.phone)}${rsvp.email ? `<br>${esc(rsvp.email)}` : ''}</strong></div>
      <div><span>Party</span><strong>${rsvp.adult_count} adult${rsvp.adult_count === 1 ? '' : 's'}, ${rsvp.child_count} child${rsvp.child_count === 1 ? '' : 'ren'}</strong></div>
      <div><span>Additional guests</span><strong>${esc(rsvp.additional_guests || 'None listed')}</strong></div>
    </div>
    ${rsvp.notes ? `<div class="review-notes"><span>Notes</span><p>${esc(rsvp.notes)}</p></div>` : ''}
    <div class="match-row"><label><span>Match to invitation</span><select id="match-${rsvp.id}"><option value="">Choose a household…</option>${invitationOptions}</select></label>
      <button class="primary" onclick="matchRsvp('${rsvp.id}')">Match & Verify</button>
    </div>
    <div class="review-actions"><button class="secondary" onclick="verifyRsvp('${rsvp.id}')">Verify Without Match</button><button class="secondary" onclick="createInvitationFromRsvp('${rsvp.id}')">Create Invitation</button><button class="danger-button" onclick="rejectRsvp('${rsvp.id}')">Reject</button></div>
  </article>`;
}

function renderInvitations() {
  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Master guest list</p><h1>Invite List</h1><p>${adminData.invitations.length} household invitation${adminData.invitations.length === 1 ? '' : 's'}</p></div><button class="primary" onclick="openInvitationDialog()">Add Invitation</button></div>
    <div class="admin-panel"><div class="toolbar"><input id="invite-search" type="search" placeholder="Search households or names" oninput="filterInvitations(this.value)"></div><div id="invitation-table">${invitationTable(adminData.invitations)}</div></div>
  </div>`;
}

function invitationTable(items) {
  if (!items.length) return '<p class="muted">No invitations found.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Household</th><th>Primary contact</th><th>Contact</th><th>Allowed</th><th>Status</th></tr></thead><tbody>
    ${items.map((item) => `<tr><td><strong>${esc(item.household_name)}</strong></td><td>${esc(item.primary_first_name)} ${esc(item.primary_last_name)}</td><td>${esc(item.phone || item.email || '—')}</td><td>${item.max_guests}</td><td>${statusPill(item.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function filterInvitations(query) {
  const normalized = String(query || '').trim().toLowerCase();
  const filtered = !normalized ? adminData.invitations : adminData.invitations.filter((item) => [item.household_name, item.primary_first_name, item.primary_last_name, item.phone, item.email].some((value) => String(value || '').toLowerCase().includes(normalized)));
  document.getElementById('invitation-table').innerHTML = invitationTable(filtered);
}

function renderJobs() {
  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Wedding helpers</p><h1>Wedding Jobs</h1><p>Create jobs and track how many openings remain.</p></div><button class="primary" onclick="openJobDialog()">Add Wedding Job</button></div>
    <div class="admin-panel">${adminData.jobs.length ? `<div class="table-wrap"><table><thead><tr><th>Job</th><th>Location</th><th>Start</th><th>Openings</th><th>Volunteer</th></tr></thead><tbody>${adminData.jobs.map((job) => `<tr><td><strong>${esc(job.title)}</strong><br><small>${esc(job.description || '')}</small></td><td>${esc(job.location || '—')}</td><td>${formatDate(job.starts_at)}</td><td>${job.openings}</td><td>${job.allow_volunteers ? 'Available' : 'Assigned only'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No wedding jobs have been added yet.</p>'}</div>
  </div>`;
}

function renderSummary() {
  const metrics = dashboardMetrics();
  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">At a glance</p><h1>Wedding Summary</h1><p>Live totals from Supabase.</p></div></div>
    <section class="metric-grid">${metricCard('Invited people', metrics.invitedPeople, '')}${metricCard('Responses', metrics.responses, '')}${metricCard('Attending people', metrics.attendingPeople, '')}${metricCard('Declined responses', metrics.declinedResponses, '')}${metricCard('Needs review', metrics.review, '', metrics.review > 0)}</section>
  </div>`;
}

function placeholderAdminPage(title, description) {
  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Command Center</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div></div><div class="empty-state admin-empty"><div class="big-icon">◆</div><h2>Ready for the next build</h2><p>The database foundation is already in place.</p></div></div>`;
}

function statusPill(status) {
  const safe = String(status || 'unknown');
  return `<span class="status-pill status-${esc(safe)}">${esc(titleCase(safe))}</span>`;
}

function card(icon, title, text, destination) {
  return `<button class="info-card" onclick="nav('${destination}')"><span>${icon}</span><h3>${title}</h3><p>${text}</p></button>`;
}
function field(label, name, required = false, wide = false) {
  return `<label class="field ${wide ? 'wide' : ''}"><span>${label}</span><input name="${name}" ${required ? 'required' : ''}></label>`;
}
function numberField(label, name, value) {
  return `<label class="field"><span>${label}</span><input type="number" name="${name}" min="0" max="20" value="${value}" required></label>`;
}

async function submitRsvp(event) {
  event.preventDefault();
  const button = event.target.querySelector('button[type=submit]');
  const message = document.getElementById('rsvp-message');
  if (!configured) {
    message.innerHTML = '<p class="error">The RSVP system has not been connected yet.</p>';
    return;
  }

  button.disabled = true;
  button.textContent = 'Submitting…';
  message.innerHTML = '';
  const form = new FormData(event.target);
  const payload = {
    invitation_id: null,
    first_name: String(form.get('first_name')).trim(),
    last_name: String(form.get('last_name')).trim(),
    street_address: String(form.get('street_address')).trim(),
    city: String(form.get('city')).trim(),
    state: String(form.get('state')).trim(),
    zip_code: String(form.get('zip_code')).trim(),
    phone: String(form.get('phone')).trim(),
    email: String(form.get('email') || '').trim() || null,
    attendance: form.get('attendance'),
    adult_count: Number(form.get('adult_count') || 0),
    child_count: Number(form.get('child_count') || 0),
    additional_guests: String(form.get('additional_guests') || '').trim() || null,
    notes: String(form.get('notes') || '').trim() || null,
    verification_status: 'needs_review',
    submitted_by_admin: false
  };

  const { error } = await db.from('rsvps').insert(payload);
  if (error) {
    message.innerHTML = `<p class="error">We could not save your RSVP. ${esc(error.message)}</p>`;
    button.disabled = false;
    button.textContent = 'Submit RSVP';
    return;
  }

  event.target.outerHTML = `<div class="success-card"><div class="big-icon">♥</div><h2>Thank you!</h2><p>Your RSVP has been received. We can’t wait to celebrate with you on November 14, 2026.</p></div>`;
}

async function adminLogin(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const message = document.getElementById('login-message');
  message.innerHTML = '';
  const { data, error } = await db.auth.signInWithPassword({
    email: form.get('email'), password: form.get('password')
  });
  if (error) {
    message.innerHTML = `<p class="error">${esc(error.message)}</p>`;
    return;
  }
  session = data.session;
  await loadAdmin();
}

async function adminLogout() {
  await db.auth.signOut();
  session = null;
  adminData = { invitations: [], rsvps: [], jobs: [], assignments: [], registry: [], photos: [] };
  render();
}

async function loadAdmin() {
  if (!db || loadingAdmin) return;
  loadingAdmin = true;
  adminError = '';
  render();

  const { data: authData, error: authError } = await db.auth.getSession();
  if (authError) {
    loadingAdmin = false;
    adminError = authError.message;
    render();
    return;
  }
  session = authData.session;
  if (!session) {
    loadingAdmin = false;
    render();
    return;
  }

  const [invitations, rsvps, jobs, assignments, registry, photos, duplicateDismissals, invitationPeople, rsvpPeople, settings, adminUsers] = await Promise.all([
    db.from('invitations').select('*').order('household_name', { ascending: true }),
    db.from('rsvps').select('*').order('created_at', { ascending: false }),
    db.from('wedding_jobs').select('*').order('starts_at', { ascending: true, nullsFirst: false }),
    db.from('job_assignments').select('*').order('created_at', { ascending: false }),
    db.from('registry_items').select('*').order('sort_order', { ascending: true }),
    db.from('photos').select('*').order('sort_order', { ascending: true }),
    db.from('duplicate_dismissals').select('*').order('created_at', { ascending: false }),
    db.from('invitation_people').select('*').order('sort_order', { ascending: true }),
    db.from('rsvp_people').select('*').order('sort_order', { ascending: true }),
    db.from('wedding_settings').select('*').eq('id', 1).maybeSingle(),
    db.from('admin_users').select('*').order('created_at', { ascending: true })
  ]);

  const firstError = [invitations, rsvps, jobs, assignments, registry, photos, duplicateDismissals, invitationPeople, rsvpPeople, settings, adminUsers].find((result) => result.error)?.error;
  if (firstError) {
    adminError = `${firstError.message} Make sure this account exists in admin_users.`;
  } else {
    adminData = {
      invitations: invitations.data || [], rsvps: rsvps.data || [], jobs: jobs.data || [],
      assignments: assignments.data || [], registry: registry.data || [], photos: photos.data || [],
      duplicateDismissals: duplicateDismissals.data || [],
      invitationPeople: invitationPeople.data || [],
      rsvpPeople: rsvpPeople.data || [],
      settings: settings.data || {},
      adminUsers: adminUsers.data || []
    };
    publicWeddingSettings = settings.data || {};
  }
  loadingAdmin = false;
  render();
}

async function updateRsvp(id, changes) {
  const { error } = await db.from('rsvps').update(changes).eq('id', id);
  if (error) {
    window.alert(error.message);
    return false;
  }
  await loadAdmin();
  return true;
}

async function matchRsvp(id) {
  const select = document.getElementById(`match-${id}`);
  if (!select?.value) {
    window.alert('Choose an invitation first.');
    return;
  }
  const invitationId = select.value;
  const success = await updateRsvp(id, { invitation_id: invitationId, verification_status: 'verified' });
  if (success) {
    await db.from('invitations').update({ status: 'responded' }).eq('id', invitationId);
    await loadAdmin();
  }
}

async function verifyRsvp(id) {
  if (!window.confirm('Verify this RSVP without matching it to an invitation?')) return;
  await updateRsvp(id, { verification_status: 'verified' });
}

async function rejectRsvp(id) {
  if (!window.confirm('Reject this RSVP? It will remain stored but marked rejected.')) return;
  await updateRsvp(id, { verification_status: 'rejected' });
}

async function createInvitationFromRsvp(id) {
  const rsvp = adminData.rsvps.find((item) => item.id === id);
  if (!rsvp) return;
  const household = window.prompt('Household name:', `${rsvp.last_name} Household`);
  if (!household) return;
  const maxGuests = Math.max(1, Number(rsvp.adult_count || 0) + Number(rsvp.child_count || 0));
  const { data, error } = await db.from('invitations').insert({
    household_name: household,
    primary_first_name: rsvp.first_name,
    primary_last_name: rsvp.last_name,
    street_address: rsvp.street_address,
    city: rsvp.city,
    state: rsvp.state,
    zip_code: rsvp.zip_code,
    phone: rsvp.phone,
    email: rsvp.email,
    max_guests: maxGuests,
    status: 'responded'
  }).select('id').single();
  if (error) {
    window.alert(error.message);
    return;
  }
  await updateRsvp(id, { invitation_id: data.id, verification_status: 'verified' });
}

function openInvitationDialog() {
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="saveInvitation(event)">
    <div class="modal-heading"><h2>Add Invitation</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">${field('Household name', 'household_name', true, true)}${field('Primary first name', 'primary_first_name', true)}${field('Primary last name', 'primary_last_name', true)}${numberField('Maximum guests', 'max_guests', 1)}${field('Phone', 'phone')}${field('Email', 'email')}${field('Street address', 'street_address', false, true)}${field('City', 'city')}${field('State', 'state')}${field('ZIP code', 'zip_code')}</div>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save Invitation</button></div>
  </form></div>`);
}

async function saveInvitation(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());
  payload.max_guests = Number(payload.max_guests || 1);
  payload.status = 'invited';
  for (const key of ['phone', 'email', 'street_address', 'city', 'state', 'zip_code']) payload[key] = payload[key] || null;
  const { error } = await db.from('invitations').insert(payload);
  if (error) return window.alert(error.message);
  closeModal();
  await loadAdmin();
}

function openJobDialog() {
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="saveJob(event)">
    <div class="modal-heading"><h2>Add Wedding Job</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">${field('Job title', 'title', true, true)}${field('Location', 'location')}${numberField('Openings', 'openings', 1)}<label class="field wide"><span>Description or instructions</span><textarea name="description" rows="4"></textarea></label><label class="field wide checkbox-field"><input type="checkbox" name="allow_volunteers"><span>Show this as an available volunteer job</span></label></div>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save Job</button></div>
  </form></div>`);
}

async function saveJob(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const { error } = await db.from('wedding_jobs').insert({
    title: String(form.get('title')).trim(),
    location: String(form.get('location') || '').trim() || null,
    description: String(form.get('description') || '').trim() || null,
    openings: Number(form.get('openings') || 1),
    allow_volunteers: form.get('allow_volunteers') === 'on'
  });
  if (error) return window.alert(error.message);
  closeModal();
  await loadAdmin();
}

function closeModal() {
  document.getElementById('modal')?.remove();
}

if (db) {
  db.auth.onAuthStateChange((_event, newSession) => {
    session = newSession;
    if (isAdminPortal && page === 'admin' && !loadingAdmin) loadAdmin();
  });
}


// Command Center v2 enhancements
let selectedReviewId = null;
let reviewSearch = '';

function toast(message, type = 'success') {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  item.textContent = message;
  region.appendChild(item);
  requestAnimationFrame(() => item.classList.add('show'));
  setTimeout(() => {
    item.classList.remove('show');
    setTimeout(() => item.remove(), 220);
  }, 3200);
}

function renderReview() {
  const all = needsReview();
  const query = reviewSearch.trim().toLowerCase();
  const filtered = query ? all.filter((item) => [item.first_name, item.last_name, item.phone, item.email, item.city, item.additional_guests]
    .some((value) => String(value || '').toLowerCase().includes(query))) : all;

  if (!selectedReviewId || !filtered.some((item) => item.id === selectedReviewId)) {
    selectedReviewId = filtered[0]?.id || null;
  }
  const selected = filtered.find((item) => item.id === selectedReviewId);

  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Guest responses</p><h1>RSVP Review</h1><p>Review one response at a time without losing your place.</p></div></div>
    ${all.length ? `<div class="review-toolbar"><input type="search" value="${esc(reviewSearch)}" placeholder="Search pending RSVPs" oninput="setReviewSearch(this.value)"><span>${filtered.length} of ${all.length} waiting</span></div>
    <div class="review-split">
      <aside class="review-queue">${filtered.length ? filtered.map((item) => `<button class="queue-item ${item.id === selectedReviewId ? 'active' : ''}" onclick="selectReview('${item.id}')"><strong>${esc(item.first_name)} ${esc(item.last_name)}</strong><span>${titleCase(item.attendance)} · ${formatDate(item.created_at)}</span></button>`).join('') : '<p class="muted queue-empty">No matching RSVPs.</p>'}</aside>
      <section class="review-detail">${selected ? renderReviewDetail(selected) : '<div class="empty-state admin-empty"><h2>No response selected</h2></div>'}</section>
    </div>` : `<div class="empty-state admin-empty"><div class="big-icon">✓</div><h2>All caught up</h2><p>There are no RSVP submissions waiting for review.</p></div>`}
  </div>`;
}

function setReviewSearch(value) {
  reviewSearch = value;
  render();
  const input = document.querySelector('.review-toolbar input');
  input?.focus();
  input?.setSelectionRange(value.length, value.length);
}

function selectReview(id) {
  selectedReviewId = id;
  render();
}

function suggestedInvitations(rsvp) {
  const last = String(rsvp.last_name || '').toLowerCase();
  const city = String(rsvp.city || '').toLowerCase();
  return [...adminData.invitations].sort((a, b) => {
    const score = (item) => (String(item.primary_last_name || '').toLowerCase() === last ? 3 : 0) +
      (String(item.household_name || '').toLowerCase().includes(last) ? 2 : 0) +
      (city && String(item.city || '').toLowerCase() === city ? 1 : 0);
    return score(b) - score(a) || String(a.household_name).localeCompare(String(b.household_name));
  });
}

function renderReviewDetail(rsvp) {
  const invitationOptions = suggestedInvitations(rsvp).map((invitation) => `<option value="${invitation.id}">${esc(invitation.household_name)} — ${esc(invitation.primary_first_name)} ${esc(invitation.primary_last_name)}</option>`).join('');
  return `<article class="review-card review-card-detail">
    <div class="review-card-top"><div><h2>${esc(rsvp.first_name)} ${esc(rsvp.last_name)}</h2><p>${titleCase(rsvp.attendance)} · Submitted ${formatDate(rsvp.created_at)}</p></div>${statusPill(rsvp.verification_status)}</div>
    <div class="review-details">
      <div><span>Address</span><strong>${esc(rsvp.street_address)}<br>${esc(rsvp.city)}, ${esc(rsvp.state)} ${esc(rsvp.zip_code)}</strong></div>
      <div><span>Contact</span><strong>${esc(rsvp.phone)}${rsvp.email ? `<br>${esc(rsvp.email)}` : ''}</strong></div>
      <div><span>Party</span><strong>${rsvp.adult_count} adult${rsvp.adult_count === 1 ? '' : 's'}, ${rsvp.child_count} child${rsvp.child_count === 1 ? '' : 'ren'}</strong></div>
      <div><span>Additional guests</span><strong>${esc(rsvp.additional_guests || 'None listed')}</strong></div>
    </div>
    ${rsvp.notes ? `<div class="review-notes"><span>Notes</span><p>${esc(rsvp.notes)}</p></div>` : ''}
    <div class="match-row"><label><span>Suggested invitation matches</span><select id="match-${rsvp.id}"><option value="">Choose a household…</option>${invitationOptions}</select></label><button class="primary" onclick="matchRsvp('${rsvp.id}')">Match & Verify</button></div>
    <div class="review-actions"><button class="secondary" onclick="openRsvpDialog('${rsvp.id}')">Edit RSVP</button><button class="secondary" onclick="verifyRsvp('${rsvp.id}')">Verify Without Match</button><button class="secondary" onclick="createInvitationFromRsvp('${rsvp.id}')">Create Invitation</button><button class="danger-button" onclick="rejectRsvp('${rsvp.id}')">Reject</button></div>
  </article>`;
}

function renderInvitations() {
  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Master guest list</p><h1>Invite List</h1><p>${adminData.invitations.length} household invitation${adminData.invitations.length === 1 ? '' : 's'}</p></div><div class="heading-actions"><button class="secondary" onclick="document.getElementById('csv-file').click()">Import CSV</button><button class="secondary" onclick="exportInvitationsCsv()">Export CSV</button><button class="primary" onclick="openInvitationDialog()">Add Invitation</button><input id="csv-file" hidden type="file" accept=".csv,text/csv" onchange="importInvitationsCsv(event)"></div></div>
    <div class="admin-panel"><div class="toolbar"><input id="invite-search" type="search" placeholder="Search households, names, phone, or email" oninput="filterInvitations(this.value)"></div><div id="invitation-table">${invitationTable(adminData.invitations)}</div></div>
  </div>`;
}

function invitationTable(items) {
  if (!items.length) return '<p class="muted">No invitations found.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Household</th><th>Primary contact</th><th>Contact</th><th>Allowed</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${items.map((item) => `<tr><td><strong>${esc(item.household_name)}</strong><br><small>${esc([item.city, item.state].filter(Boolean).join(', '))}</small></td><td>${esc(item.primary_first_name)} ${esc(item.primary_last_name)}</td><td>${esc(item.phone || item.email || '—')}</td><td>${item.max_guests}</td><td>${statusPill(item.status)}</td><td><div class="table-actions"><button onclick="openInvitationDialog('${item.id}')">Edit</button><button class="danger-text" onclick="deleteInvitation('${item.id}')">Delete</button></div></td></tr>`).join('')}
  </tbody></table></div>`;
}

function openInvitationDialog(id = null) {
  const item = id ? adminData.invitations.find((entry) => entry.id === id) : null;
  const value = (name) => esc(item?.[name] ?? '');
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="saveInvitation(event, '${id || ''}')">
    <div class="modal-heading"><h2>${item ? 'Edit' : 'Add'} Invitation</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">
      <label class="field wide"><span>Household name</span><input name="household_name" required value="${value('household_name')}"></label>
      <label class="field"><span>Primary first name</span><input name="primary_first_name" required value="${value('primary_first_name')}"></label>
      <label class="field"><span>Primary last name</span><input name="primary_last_name" required value="${value('primary_last_name')}"></label>
      <label class="field"><span>Maximum guests</span><input type="number" name="max_guests" min="0" max="50" required value="${item?.max_guests ?? 1}"></label>
      <label class="field"><span>Status</span><select name="status">${['invited','responded','declined','cancelled'].map((s) => `<option value="${s}" ${item?.status === s ? 'selected' : ''}>${titleCase(s)}</option>`).join('')}</select></label>
      ${['phone','email','street_address','city','state','zip_code'].map((name) => `<label class="field ${name === 'street_address' ? 'wide' : ''}"><span>${titleCase(name)}</span><input name="${name}" value="${value(name)}"></label>`).join('')}
      <label class="field wide"><span>Private notes</span><textarea name="private_notes" rows="4">${value('private_notes')}</textarea></label>
    </div>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save Invitation</button></div>
  </form></div>`);
}

async function saveInvitation(event, id = '') {
  event.preventDefault();
  const submit = event.target.querySelector('[type=submit]');
  submit.disabled = true;
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());
  payload.max_guests = Number(payload.max_guests || 1);
  for (const key of ['phone','email','street_address','city','state','zip_code','private_notes']) payload[key] = String(payload[key] || '').trim() || null;
  const result = id ? await db.from('invitations').update(payload).eq('id', id) : await db.from('invitations').insert(payload);
  if (result.error) {
    toast(result.error.message, 'error');
    submit.disabled = false;
    return;
  }
  closeModal();
  toast(id ? 'Invitation updated.' : 'Invitation added.');
  await loadAdmin();
}

async function deleteInvitation(id) {
  const item = adminData.invitations.find((entry) => entry.id === id);
  if (!window.confirm(`Delete ${item?.household_name || 'this invitation'}? Linked RSVPs will remain, but become unmatched.`)) return;
  const { error } = await db.from('invitations').delete().eq('id', id);
  if (error) return toast(error.message, 'error');
  toast('Invitation deleted.');
  await loadAdmin();
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportInvitationsCsv() {
  const columns = ['household_name','primary_first_name','primary_last_name','street_address','city','state','zip_code','phone','email','max_guests','status','private_notes'];
  const csv = [columns.join(','), ...adminData.invitations.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `jordan-rochelle-invitations-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast('Invitation list exported.');
}

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); row = []; value = '';
    } else value += char;
  }
  row.push(value); if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

async function importInvitationsCsv(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return toast('The CSV has no invitation rows.', 'error');
  const headers = rows[0].map((item) => item.trim());
  const required = ['household_name','primary_first_name','primary_last_name'];
  if (required.some((name) => !headers.includes(name))) return toast(`CSV must include: ${required.join(', ')}`, 'error');
  const payload = rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() || null]))).map((row) => ({
    household_name: row.household_name,
    primary_first_name: row.primary_first_name,
    primary_last_name: row.primary_last_name,
    street_address: row.street_address,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
    phone: row.phone,
    email: row.email,
    max_guests: Number(row.max_guests || 1),
    status: ['invited','responded','declined','cancelled'].includes(row.status) ? row.status : 'invited',
    private_notes: row.private_notes
  })).filter((row) => row.household_name && row.primary_first_name && row.primary_last_name);
  if (!payload.length) return toast('No valid invitation rows were found.', 'error');
  if (!window.confirm(`Import ${payload.length} invitation${payload.length === 1 ? '' : 's'}?`)) return;
  const { error } = await db.from('invitations').insert(payload);
  if (error) return toast(error.message, 'error');
  toast(`${payload.length} invitation${payload.length === 1 ? '' : 's'} imported.`);
  await loadAdmin();
}

function openRsvpDialog(id) {
  const item = adminData.rsvps.find((entry) => entry.id === id);
  if (!item) return;
  const value = (name) => esc(item[name] ?? '');
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="saveRsvpEdit(event, '${id}')">
    <div class="modal-heading"><h2>Edit RSVP</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">
      ${['first_name','last_name','street_address','city','state','zip_code','phone','email'].map((name) => `<label class="field ${name === 'street_address' ? 'wide' : ''}"><span>${titleCase(name)}</span><input name="${name}" ${name !== 'email' ? 'required' : ''} value="${value(name)}"></label>`).join('')}
      <label class="field"><span>Attendance</span><select name="attendance"><option value="attending" ${item.attendance === 'attending' ? 'selected' : ''}>Attending</option><option value="declined" ${item.attendance === 'declined' ? 'selected' : ''}>Declined</option></select></label>
      <label class="field"><span>Adults</span><input type="number" min="0" name="adult_count" value="${item.adult_count}"></label>
      <label class="field"><span>Children</span><input type="number" min="0" name="child_count" value="${item.child_count}"></label>
      <label class="field wide"><span>Additional guests</span><input name="additional_guests" value="${value('additional_guests')}"></label>
      <label class="field wide"><span>Notes</span><textarea name="notes" rows="4">${value('notes')}</textarea></label>
    </div><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save RSVP</button></div>
  </form></div>`);
}

async function saveRsvpEdit(event, id) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());
  payload.adult_count = Number(payload.adult_count || 0);
  payload.child_count = Number(payload.child_count || 0);
  for (const key of ['email','additional_guests','notes']) payload[key] = String(payload[key] || '').trim() || null;
  const { error } = await db.from('rsvps').update(payload).eq('id', id);
  if (error) return toast(error.message, 'error');
  closeModal();
  toast('RSVP updated.');
  await loadAdmin();
  selectedReviewId = id;
}

async function updateRsvp(id, changes) {
  const { error } = await db.from('rsvps').update(changes).eq('id', id);
  if (error) {
    toast(error.message, 'error');
    return false;
  }
  await loadAdmin();
  return true;
}

async function matchRsvp(id) {
  const select = document.getElementById(`match-${id}`);
  if (!select?.value) return toast('Choose an invitation first.', 'error');
  const invitationId = select.value;
  const { error } = await db.from('rsvps').update({ invitation_id: invitationId, verification_status: 'verified' }).eq('id', id);
  if (error) return toast(error.message, 'error');
  const invitation = adminData.invitations.find((item) => item.id === invitationId);
  const { error: invitationError } = await db.from('invitations').update({ status: 'responded' }).eq('id', invitationId);
  if (invitationError) return toast(invitationError.message, 'error');
  toast(`RSVP matched to ${invitation?.household_name || 'invitation'}.`);
  selectedReviewId = null;
  await loadAdmin();
}

async function verifyRsvp(id) {
  if (!window.confirm('Verify this RSVP without matching it to an invitation?')) return;
  if (await updateRsvp(id, { verification_status: 'verified' })) { selectedReviewId = null; toast('RSVP verified.'); }
}

async function rejectRsvp(id) {
  if (!window.confirm('Reject this RSVP? It will remain stored but marked rejected.')) return;
  if (await updateRsvp(id, { verification_status: 'rejected' })) { selectedReviewId = null; toast('RSVP rejected.'); }
}

async function createInvitationFromRsvp(id) {
  const rsvp = adminData.rsvps.find((item) => item.id === id);
  if (!rsvp) return;
  const household = window.prompt('Household name:', `${rsvp.last_name} Household`);
  if (!household) return;
  const maxGuests = Math.max(1, Number(rsvp.adult_count || 0) + Number(rsvp.child_count || 0));
  const { data, error } = await db.from('invitations').insert({ household_name: household, primary_first_name: rsvp.first_name, primary_last_name: rsvp.last_name, street_address: rsvp.street_address, city: rsvp.city, state: rsvp.state, zip_code: rsvp.zip_code, phone: rsvp.phone, email: rsvp.email, max_guests: maxGuests, status: 'responded' }).select('id').single();
  if (error) return toast(error.message, 'error');
  const { error: updateError } = await db.from('rsvps').update({ invitation_id: data.id, verification_status: 'verified' }).eq('id', id);
  if (updateError) return toast(updateError.message, 'error');
  selectedReviewId = null;
  toast('Invitation created and RSVP verified.');
  await loadAdmin();
}

render();
if (isAdminPortal) loadAdmin();

// Command Center v0.3.0 — Guest Profiles
let selectedGuestId = null;
let selectedInvitationProfileId = null;
let guestSearch = '';

function renderAdmin() {
  if (!configured) {
    return `<main class="content-page admin-page"><div class="page-heading"><p class="eyebrow">Setup needed</p><h2>Connect Supabase</h2><p>Open <strong>config.js</strong> and add your Supabase project URL and publishable key.</p></div></main>`;
  }
  if (!session) {
    return `<main class="content-page admin-page"><div class="page-heading"><p class="eyebrow">Private area</p><h2>Wedding Command Center</h2><p>Approved administrators only.</p></div>
      <form class="login-card" onsubmit="adminLogin(event)">${field('Email', 'email', true)}
        <label class="field"><span>Password</span><input type="password" name="password" required autocomplete="current-password"></label>
        <div id="login-message"></div><button class="primary" type="submit">Sign In</button>
      </form></main>`;
  }

  const views = ['dashboard','review','invitations','guests','jobs','registry','photos','summary','settings'];
  return `<main class="command-layout">
    <aside class="command-sidebar">
      <div class="sidebar-wedding"><span>Wedding date</span><strong>Nov. 14, 2026</strong></div>
      ${sidebarButton('dashboard', '⌂', 'Dashboard')}
      ${sidebarButton('review', '✉', 'RSVP Review', needsReview().length)}
      ${sidebarButton('invitations', '👥', 'Invite List')}
      ${sidebarButton('guests', '♙', 'Guest Profiles')}
      ${sidebarButton('jobs', '✓', 'Wedding Jobs')}
      ${sidebarButton('registry', '🎁', 'Registry')}
      ${sidebarButton('photos', '▧', 'Photos')}
      ${sidebarButton('summary', '▤', 'Wedding Summary')}
      ${sidebarButton('settings', '⚙', 'Settings')}
      <button class="sidebar-signout" onclick="adminLogout()">Sign out</button>
    </aside>
    <section class="command-main">
      <div class="command-mobile-nav"><label>Command Center<select onchange="setAdminView(this.value)">
        ${views.map((view) => `<option value="${view}" ${view === adminView ? 'selected' : ''}>${view === 'guests' ? 'Guest Profiles' : titleCase(view)}</option>`).join('')}
      </select></label></div>
      ${loadingAdmin ? '<div class="loading-card">Loading wedding information…</div>' : renderAdminView()}
    </section>
  </main>`;
}

function renderAdminView() {
  if (adminError) return `<div class="error-card"><h2>Could not load the Command Center</h2><p>${esc(adminError)}</p><button class="primary" onclick="loadAdmin()">Try Again</button></div>`;
  if (adminView === 'dashboard') return renderDashboard();
  if (adminView === 'review') return renderReview();
  if (adminView === 'invitations') return renderInvitations();
  if (adminView === 'guests') return renderGuestProfiles();
  if (adminView === 'jobs') return renderJobs();
  if (adminView === 'registry') return placeholderAdminPage('Gift Registry', 'Registry management is the next module after guest management.');
  if (adminView === 'photos') return placeholderAdminPage('Photo Manager', 'This will manage your private library and the selected guest album.');
  if (adminView === 'summary') return renderSummary();
  if (adminView === 'settings') return placeholderAdminPage('Settings', 'Wedding details and public-page visibility controls will be added here.');
  return renderDashboard();
}

function guestRecords() {
  const rsvpRecords = adminData.rsvps.map((rsvp) => {
    const invitation = adminData.invitations.find((item) => item.id === rsvp.invitation_id) || null;
    return {
      type: 'rsvp',
      key: `rsvp:${rsvp.id}`,
      id: rsvp.id,
      invitationId: invitation?.id || null,
      name: `${rsvp.first_name || ''} ${rsvp.last_name || ''}`.trim(),
      household: invitation?.household_name || 'Unmatched RSVP',
      phone: rsvp.phone || invitation?.phone || '',
      email: rsvp.email || invitation?.email || '',
      city: rsvp.city || invitation?.city || '',
      state: rsvp.state || invitation?.state || '',
      attendance: rsvp.attendance,
      verification: rsvp.verification_status,
      rsvp,
      invitation
    };
  });

  const invitationOnly = adminData.invitations
    .filter((invitation) => !adminData.rsvps.some((rsvp) => rsvp.invitation_id === invitation.id))
    .map((invitation) => ({
      type: 'invitation',
      key: `invitation:${invitation.id}`,
      id: invitation.id,
      invitationId: invitation.id,
      name: `${invitation.primary_first_name || ''} ${invitation.primary_last_name || ''}`.trim(),
      household: invitation.household_name,
      phone: invitation.phone || '',
      email: invitation.email || '',
      city: invitation.city || '',
      state: invitation.state || '',
      attendance: null,
      verification: null,
      rsvp: null,
      invitation
    }));

  return [...rsvpRecords, ...invitationOnly].sort((a, b) => a.name.localeCompare(b.name));
}

function setGuestSearch(value) {
  guestSearch = value;
  render();
  const input = document.querySelector('#guest-search');
  input?.focus();
  input?.setSelectionRange(value.length, value.length);
}

function selectGuestRecord(key) {
  const [type, id] = key.split(':');
  selectedGuestId = type === 'rsvp' ? id : null;
  selectedInvitationProfileId = type === 'invitation' ? id : null;
  render();
}

function openGuestByRsvp(id) {
  adminView = 'guests';
  selectedGuestId = id;
  selectedInvitationProfileId = null;
  render();
}

function openGuestByInvitation(id) {
  adminView = 'guests';
  const linked = adminData.rsvps.find((rsvp) => rsvp.invitation_id === id);
  selectedGuestId = linked?.id || null;
  selectedInvitationProfileId = linked ? null : id;
  render();
}

function renderGuestProfiles() {
  const all = guestRecords();
  const query = guestSearch.trim().toLowerCase();
  const filtered = query ? all.filter((record) => [record.name, record.household, record.phone, record.email, record.city, record.state, record.rsvp?.additional_guests, record.invitation?.private_notes]
    .some((value) => String(value || '').toLowerCase().includes(query))) : all;

  let selected = null;
  if (selectedGuestId) selected = filtered.find((record) => record.type === 'rsvp' && record.id === selectedGuestId) || null;
  if (!selected && selectedInvitationProfileId) selected = filtered.find((record) => record.type === 'invitation' && record.id === selectedInvitationProfileId) || null;
  if (!selected && filtered.length) {
    selected = filtered[0];
    selectedGuestId = selected.type === 'rsvp' ? selected.id : null;
    selectedInvitationProfileId = selected.type === 'invitation' ? selected.id : null;
  }

  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">People & households</p><h1>Guest Profiles</h1><p>Contact details, RSVP information, private notes, and wedding jobs in one place.</p></div></div>
    <div class="guest-toolbar"><input id="guest-search" type="search" value="${esc(guestSearch)}" placeholder="Search name, household, phone, email, city, or notes" oninput="setGuestSearch(this.value)"><span>${filtered.length} profile${filtered.length === 1 ? '' : 's'}</span></div>
    <div class="guest-split">
      <aside class="guest-list">${filtered.length ? filtered.map((record) => renderGuestListItem(record, selected?.key === record.key)).join('') : '<p class="muted guest-empty">No matching guests.</p>'}</aside>
      <section class="guest-profile-detail">${selected ? renderGuestProfile(selected) : '<div class="empty-state admin-empty"><h2>No guest selected</h2></div>'}</section>
    </div>
  </div>`;
}

function renderGuestListItem(record, active) {
  const sub = record.rsvp ? `${titleCase(record.rsvp.attendance)} · ${record.household}` : `No RSVP yet · ${record.household}`;
  return `<button class="guest-list-item ${active ? 'active' : ''}" onclick="selectGuestRecord('${record.key}')">
    <span class="guest-avatar">${esc((record.name || '?').charAt(0).toUpperCase())}</span>
    <span class="guest-list-copy"><strong>${esc(record.name || record.household)}</strong><small>${esc(sub)}</small></span>
    ${record.rsvp ? statusPill(record.rsvp.verification_status) : statusPill(record.invitation.status)}
  </button>`;
}

function profileAddress(record) {
  const source = record.rsvp || record.invitation || {};
  return [source.street_address, [source.city, source.state].filter(Boolean).join(', '), source.zip_code].filter(Boolean).map(esc).join('<br>') || '—';
}

function renderGuestProfile(record) {
  const rsvp = record.rsvp;
  const invitation = record.invitation;
  const assignments = adminData.assignments.filter((assignment) =>
    (rsvp && assignment.rsvp_id === rsvp.id) ||
    (invitation && assignment.invitation_id === invitation.id)
  );
  const partyCount = rsvp ? Number(rsvp.adult_count || 0) + Number(rsvp.child_count || 0) : null;

  return `<article class="guest-profile-card">
    <div class="guest-profile-header"><div><p class="eyebrow">${esc(record.household)}</p><h2>${esc(record.name || record.household)}</h2><div class="profile-pills">${rsvp ? statusPill(rsvp.attendance) + statusPill(rsvp.verification_status) : statusPill(invitation?.status || 'invited')}</div></div>
      <div class="profile-actions">${rsvp ? `<button class="secondary" onclick="openRsvpDialog('${rsvp.id}')">Edit RSVP</button>` : ''}${invitation ? `<button class="secondary" onclick="openInvitationDialog('${invitation.id}')">Edit Invitation</button>` : ''}</div>
    </div>

    <div class="profile-info-grid">
      <div class="profile-info"><span>Phone</span><strong>${esc(record.phone || '—')}</strong></div>
      <div class="profile-info"><span>Email</span><strong>${esc(record.email || '—')}</strong></div>
      <div class="profile-info"><span>Address</span><strong>${profileAddress(record)}</strong></div>
      <div class="profile-info"><span>Household</span><strong>${esc(record.household || '—')}</strong></div>
      ${rsvp ? `<div class="profile-info"><span>Party</span><strong>${partyCount} total · ${rsvp.adult_count} adult${rsvp.adult_count === 1 ? '' : 's'} · ${rsvp.child_count} child${rsvp.child_count === 1 ? '' : 'ren'}</strong></div>
      <div class="profile-info"><span>Additional guests</span><strong>${esc(rsvp.additional_guests || 'None listed')}</strong></div>` : `<div class="profile-info"><span>Allowed guests</span><strong>${invitation?.max_guests ?? '—'}</strong></div><div class="profile-info"><span>RSVP</span><strong>Not received yet</strong></div>`}
    </div>

    ${rsvp?.notes ? `<section class="profile-section"><div class="profile-section-heading"><h3>Guest notes</h3></div><p>${esc(rsvp.notes)}</p></section>` : ''}
    <section class="profile-section"><div class="profile-section-heading"><h3>Private admin notes</h3>${invitation ? `<button onclick="editPrivateNotes('${invitation.id}')">Edit</button>` : ''}</div><p class="private-note-copy">${esc(invitation?.private_notes || 'No private notes yet.')}</p></section>

    <section class="profile-section"><div class="profile-section-heading"><h3>Wedding jobs</h3><button onclick="openAssignmentDialog('${rsvp?.id || ''}', '${invitation?.id || ''}', '${esc(record.name)}')">Assign job</button></div>
      ${assignments.length ? `<div class="assignment-list">${assignments.map(renderAssignmentRow).join('')}</div>` : '<p class="muted">No wedding jobs assigned.</p>'}
    </section>

    <section class="profile-section"><div class="profile-section-heading"><h3>Record activity</h3></div>${renderProfileActivity(record, assignments)}</section>
  </article>`;
}

function renderAssignmentRow(assignment) {
  const job = adminData.jobs.find((item) => item.id === assignment.job_id);
  return `<div class="assignment-row"><div><strong>${esc(job?.title || 'Wedding job')}</strong><span>${esc(assignment.person_name || '')}${assignment.instructions ? ` · ${esc(assignment.instructions)}` : ''}</span></div><div class="assignment-row-actions">${statusPill(assignment.status || 'assigned')}<button class="danger-text" onclick="removeAssignment('${assignment.id}')">Remove</button></div></div>`;
}

function renderProfileActivity(record, assignments) {
  const activity = [];
  const invitation = record.invitation;
  const rsvp = record.rsvp;
  if (invitation?.created_at) activity.push({ date: invitation.created_at, title: 'Invitation added', detail: invitation.household_name });
  if (rsvp?.created_at) activity.push({ date: rsvp.created_at, title: 'RSVP submitted', detail: titleCase(rsvp.attendance) });
  if (rsvp?.updated_at && rsvp.updated_at !== rsvp.created_at) activity.push({ date: rsvp.updated_at, title: 'RSVP last updated', detail: titleCase(rsvp.verification_status) });
  if (rsvp?.verification_status) activity.push({ date: rsvp.updated_at || rsvp.created_at, title: 'Current verification', detail: titleCase(rsvp.verification_status) });
  assignments.forEach((assignment) => {
    const job = adminData.jobs.find((item) => item.id === assignment.job_id);
    activity.push({ date: assignment.created_at, title: 'Job assigned', detail: job?.title || assignment.person_name || 'Wedding job' });
  });
  activity.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  if (!activity.length) return '<p class="muted">No activity recorded yet.</p>';
  return `<div class="activity-list">${activity.map((item) => `<div class="activity-row"><span class="activity-dot"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.detail || '')}</p><small>${formatDate(item.date)}</small></div></div>`).join('')}</div>`;
}

function editPrivateNotes(invitationId) {
  const invitation = adminData.invitations.find((item) => item.id === invitationId);
  if (!invitation) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="savePrivateNotes(event, '${invitationId}')">
    <div class="modal-heading"><h2>Private Admin Notes</h2><button type="button" onclick="closeModal()">×</button></div>
    <label class="field"><span>Only admins can see these notes</span><textarea name="private_notes" rows="7">${esc(invitation.private_notes || '')}</textarea></label>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save Notes</button></div>
  </form></div>`);
}

async function savePrivateNotes(event, invitationId) {
  event.preventDefault();
  const form = new FormData(event.target);
  const privateNotes = String(form.get('private_notes') || '').trim() || null;
  const { error } = await db.from('invitations').update({ private_notes: privateNotes }).eq('id', invitationId);
  if (error) return toast(error.message, 'error');
  closeModal();
  toast('Private notes saved.');
  await loadAdmin();
}

function openAssignmentDialog(rsvpId = '', invitationId = '', personName = '') {
  if (!adminData.jobs.length) return toast('Add a wedding job first.', 'error');
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="saveAssignment(event, '${rsvpId}', '${invitationId}')">
    <div class="modal-heading"><h2>Assign Wedding Job</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">
      <label class="field wide"><span>Person</span><input name="person_name" required value="${esc(personName)}"></label>
      <label class="field wide"><span>Wedding job</span><select name="job_id" required><option value="">Choose a job…</option>${adminData.jobs.map((job) => `<option value="${job.id}">${esc(job.title)}</option>`).join('')}</select></label>
      <label class="field"><span>Status</span><select name="status"><option value="assigned">Assigned</option><option value="confirmed">Confirmed</option><option value="volunteered">Volunteered</option></select></label>
      <label class="field wide"><span>Instructions</span><textarea name="instructions" rows="4" placeholder="Arrival time, responsibilities, or anything they need to know"></textarea></label>
    </div>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Assign Job</button></div>
  </form></div>`);
}

async function saveAssignment(event, rsvpId = '', invitationId = '') {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    job_id: form.get('job_id'),
    rsvp_id: rsvpId || null,
    invitation_id: invitationId || null,
    person_name: String(form.get('person_name') || '').trim(),
    status: String(form.get('status') || 'assigned'),
    instructions: String(form.get('instructions') || '').trim() || null
  };
  const { error } = await db.from('job_assignments').insert(payload);
  if (error) return toast(error.message, 'error');
  closeModal();
  toast('Wedding job assigned.');
  await loadAdmin();
}

async function removeAssignment(id) {
  if (!window.confirm('Remove this wedding job assignment?')) return;
  const { error } = await db.from('job_assignments').delete().eq('id', id);
  if (error) return toast(error.message, 'error');
  toast('Job assignment removed.');
  await loadAdmin();
}

function invitationTable(items) {
  if (!items.length) return '<p class="muted">No invitations found.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Household</th><th>Primary contact</th><th>Contact</th><th>Allowed</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${items.map((item) => `<tr><td><strong>${esc(item.household_name)}</strong><br><small>${esc([item.city, item.state].filter(Boolean).join(', '))}</small></td><td>${esc(item.primary_first_name)} ${esc(item.primary_last_name)}</td><td>${esc(item.phone || item.email || '—')}</td><td>${item.max_guests}</td><td>${statusPill(item.status)}</td><td><div class="table-actions"><button onclick="openGuestByInvitation('${item.id}')">Profile</button><button onclick="openInvitationDialog('${item.id}')">Edit</button><button class="danger-text" onclick="deleteInvitation('${item.id}')">Delete</button></div></td></tr>`).join('')}
  </tbody></table></div>`;
}


// Command Center v0.4.0 — Wedding Jobs
let selectedJobId = null;
let jobSearch = '';

function jobAssignments(jobId) {
  return adminData.assignments.filter((assignment) => assignment.job_id === jobId);
}

function jobStats(job) {
  const assignments = jobAssignments(job.id);
  const filled = assignments.filter((item) => String(item.status || 'assigned').toLowerCase() !== 'cancelled').length;
  const needed = Math.max(0, Number(job.openings || 0));
  return { assignments, filled, needed, remaining: Math.max(0, needed - filled) };
}

function weddingJobTotals() {
  const stats = adminData.jobs.map((job) => jobStats(job));
  return {
    jobs: adminData.jobs.length,
    positions: stats.reduce((sum, item) => sum + item.needed, 0),
    filled: stats.reduce((sum, item) => sum + Math.min(item.filled, item.needed), 0),
    remaining: stats.reduce((sum, item) => sum + item.remaining, 0)
  };
}

function setJobSearch(value) {
  jobSearch = value;
  render();
  const input = document.getElementById('job-search');
  input?.focus();
  input?.setSelectionRange(value.length, value.length);
}

function selectJob(id) {
  selectedJobId = id;
  render();
}

function renderJobs() {
  const query = jobSearch.trim().toLowerCase();
  const filtered = query ? adminData.jobs.filter((job) => [job.title, job.description, job.location]
    .some((value) => String(value || '').toLowerCase().includes(query))) : adminData.jobs;

  let selected = selectedJobId ? filtered.find((job) => job.id === selectedJobId) : null;
  if (!selected && filtered.length) {
    selected = filtered[0];
    selectedJobId = selected.id;
  }
  if (!filtered.length) selectedJobId = null;

  const totals = weddingJobTotals();
  return `<div class="admin-view">
    <div class="view-heading"><div><p class="eyebrow">Wedding helpers</p><h1>Wedding Jobs</h1><p>Create jobs, assign people, and see what still needs help.</p></div><button class="primary" onclick="openJobDialog()">Add Wedding Job</button></div>
    <section class="job-metric-grid">
      ${metricCard('Jobs', totals.jobs, 'Wedding-day responsibilities')}
      ${metricCard('Positions needed', totals.positions, 'Total people requested')}
      ${metricCard('Assigned', totals.filled, 'Filled positions')}
      ${metricCard('Still needed', totals.remaining, totals.remaining ? 'Needs attention' : 'All positions filled', totals.remaining > 0)}
    </section>
    <div class="job-toolbar"><input id="job-search" type="search" value="${esc(jobSearch)}" placeholder="Search jobs, locations, or instructions" oninput="setJobSearch(this.value)"><span>${filtered.length} job${filtered.length === 1 ? '' : 's'}</span></div>
    <div class="job-split">
      <aside class="job-list">${filtered.length ? filtered.map((job) => renderJobListItem(job, selected?.id === job.id)).join('') : '<p class="muted job-empty">No matching wedding jobs.</p>'}</aside>
      <section class="job-detail">${selected ? renderJobDetail(selected) : '<div class="empty-state admin-empty"><div class="big-icon">✓</div><h2>No wedding jobs yet</h2><p>Add a job when you are ready to assign helpers.</p><button class="primary" onclick="openJobDialog()">Add Wedding Job</button></div>'}</section>
    </div>
  </div>`;
}

function renderJobListItem(job, active) {
  const stats = jobStats(job);
  return `<button class="job-list-item ${active ? 'active' : ''}" onclick="selectJob('${job.id}')">
    <span class="job-list-copy"><strong>${esc(job.title)}</strong><small>${esc(job.location || 'No location set')}</small></span>
    <span class="job-list-count ${stats.remaining ? 'open' : 'filled'}">${stats.remaining ? `${stats.remaining} open` : 'Filled'}</span>
  </button>`;
}

function renderJobDetail(job) {
  const stats = jobStats(job);
  return `<article class="job-detail-card">
    <div class="job-detail-header">
      <div><p class="eyebrow">${job.allow_volunteers ? 'Available to volunteers' : 'Assigned by Jordan & Rochelle'}</p><h2>${esc(job.title)}</h2><div class="profile-pills">${stats.remaining ? statusPill('needs_review').replace('Needs Review', `${stats.remaining} Still Needed`) : statusPill('verified').replace('Verified', 'Fully Staffed')}</div></div>
      <div class="profile-actions"><button class="secondary" onclick="openJobDialog('${job.id}')">Edit Job</button><button class="danger-button" onclick="deleteJob('${job.id}')">Delete Job</button></div>
    </div>
    <div class="job-info-grid">
      <div class="profile-info"><span>People needed</span><strong>${stats.needed}</strong></div>
      <div class="profile-info"><span>Assigned</span><strong>${stats.filled}</strong></div>
      <div class="profile-info"><span>Still needed</span><strong>${stats.remaining}</strong></div>
      <div class="profile-info"><span>Starts</span><strong>${formatDate(job.starts_at)}</strong></div>
      <div class="profile-info"><span>Location</span><strong>${esc(job.location || '—')}</strong></div>
      <div class="profile-info"><span>Volunteer signup</span><strong>${job.allow_volunteers ? 'Available' : 'Not shown to guests'}</strong></div>
    </div>
    <section class="profile-section"><div class="profile-section-heading"><h3>Instructions</h3></div><p class="job-description">${esc(job.description || 'No instructions added yet.')}</p></section>
    <section class="profile-section"><div class="profile-section-heading"><h3>Assigned people</h3><button onclick="openJobAssignmentDialog('${job.id}')">Assign Guest</button></div>
      ${stats.assignments.length ? `<div class="assignment-list">${stats.assignments.map((assignment) => renderJobAssignmentRow(assignment)).join('')}</div>` : '<p class="muted">No one has been assigned to this job yet.</p>'}
    </section>
  </article>`;
}

function renderJobAssignmentRow(assignment) {
  const linkedRsvp = assignment.rsvp_id ? adminData.rsvps.find((item) => item.id === assignment.rsvp_id) : null;
  const linkedInvitation = assignment.invitation_id ? adminData.invitations.find((item) => item.id === assignment.invitation_id) : null;
  const openAction = linkedRsvp ? `openGuestByRsvp('${linkedRsvp.id}')` : linkedInvitation ? `openGuestByInvitation('${linkedInvitation.id}')` : '';
  return `<div class="assignment-row"><div><strong>${esc(assignment.person_name || 'Assigned helper')}</strong><span>${esc(assignment.instructions || 'No special instructions')}${assignment.status ? ` · ${esc(titleCase(assignment.status))}` : ''}</span></div><div class="assignment-row-actions">${openAction ? `<button onclick="${openAction}">Open profile</button>` : ''}<button class="danger-text" onclick="removeAssignment('${assignment.id}')">Remove</button></div></div>`;
}

function jobDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function openJobDialog(id = '') {
  const job = id ? adminData.jobs.find((item) => item.id === id) : null;
  const title = job ? 'Edit Wedding Job' : 'Add Wedding Job';
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="saveJob(event)">
    <input type="hidden" name="job_id" value="${esc(job?.id || '')}">
    <div class="modal-heading"><h2>${title}</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">
      <label class="field wide"><span>Job title</span><input name="title" required value="${esc(job?.title || '')}"></label>
      <label class="field"><span>Location</span><input name="location" value="${esc(job?.location || '')}"></label>
      <label class="field"><span>People needed</span><input type="number" name="openings" min="0" max="100" value="${Number(job?.openings ?? 1)}" required></label>
      <label class="field wide"><span>Start date & time (optional)</span><input type="datetime-local" name="starts_at" value="${jobDateTimeLocal(job?.starts_at)}"></label>
      <label class="field wide"><span>Description or instructions</span><textarea name="description" rows="5">${esc(job?.description || '')}</textarea></label>
      <label class="field wide checkbox-field"><input type="checkbox" name="allow_volunteers" ${job?.allow_volunteers ? 'checked' : ''}><span>Show this as an available volunteer job</span></label>
    </div>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">${job ? 'Save Changes' : 'Save Job'}</button></div>
  </form></div>`);
}

async function saveJob(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const id = String(form.get('job_id') || '');
  const startsAtValue = String(form.get('starts_at') || '').trim();
  const payload = {
    title: String(form.get('title')).trim(),
    location: String(form.get('location') || '').trim() || null,
    description: String(form.get('description') || '').trim() || null,
    starts_at: startsAtValue ? new Date(startsAtValue).toISOString() : null,
    openings: Math.max(0, Number(form.get('openings') || 0)),
    allow_volunteers: form.get('allow_volunteers') === 'on'
  };
  const result = id ? await db.from('wedding_jobs').update(payload).eq('id', id) : await db.from('wedding_jobs').insert(payload).select('id').single();
  if (result.error) return toast(result.error.message, 'error');
  if (!id && result.data?.id) selectedJobId = result.data.id;
  closeModal();
  toast(id ? 'Wedding job updated.' : 'Wedding job added.');
  await loadAdmin();
}

function assignmentGuestOptions() {
  return guestRecords().map((record) => {
    const rsvpId = record.rsvp?.id || '';
    const invitationId = record.invitation?.id || record.invitationId || '';
    const value = [record.key, rsvpId, invitationId].join('|');
    return `<option value="${esc(value)}">${esc(record.name || record.household)} — ${esc(record.household)}</option>`;
  }).join('');
}

function openJobAssignmentDialog(jobId) {
  const job = adminData.jobs.find((item) => item.id === jobId);
  if (!job) return;
  const options = assignmentGuestOptions();
  if (!options) return toast('Add an invitation or RSVP before assigning a job.', 'error');
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="saveJobAssignment(event)">
    <input type="hidden" name="job_id" value="${esc(job.id)}">
    <div class="modal-heading"><h2>Assign ${esc(job.title)}</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">
      <label class="field wide"><span>Guest or household</span><select name="guest_record" required><option value="">Choose a person…</option>${options}</select></label>
      <label class="field"><span>Status</span><select name="status"><option value="assigned">Assigned</option><option value="confirmed">Confirmed</option><option value="volunteered">Volunteered</option></select></label>
      <label class="field wide"><span>Instructions for this person (optional)</span><textarea name="instructions" rows="4"></textarea></label>
    </div>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Assign Guest</button></div>
  </form></div>`);
}

async function saveJobAssignment(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const [recordKey, rsvpId, invitationId] = String(form.get('guest_record') || '').split('|');
  const record = guestRecords().find((item) => item.key === recordKey);
  if (!record) return toast('Choose a guest first.', 'error');
  const jobId = String(form.get('job_id'));
  const duplicate = adminData.assignments.some((item) => item.job_id === jobId && ((rsvpId && item.rsvp_id === rsvpId) || (invitationId && item.invitation_id === invitationId) || item.person_name === record.name));
  if (duplicate) return toast('That person is already assigned to this job.', 'error');
  const payload = {
    job_id: jobId,
    rsvp_id: rsvpId || null,
    invitation_id: invitationId || null,
    person_name: record.name || record.household,
    status: String(form.get('status') || 'assigned'),
    instructions: String(form.get('instructions') || '').trim() || null
  };
  const { error } = await db.from('job_assignments').insert(payload);
  if (error) return toast(error.message, 'error');
  closeModal();
  toast(`${record.name || record.household} assigned.`);
  await loadAdmin();
}

async function deleteJob(id) {
  const job = adminData.jobs.find((item) => item.id === id);
  if (!job) return;
  const assignments = jobAssignments(id);
  const warning = assignments.length
    ? `Delete “${job.title}”? This job has ${assignments.length} assigned ${assignments.length === 1 ? 'person' : 'people'}. Their job assignments will also be removed.`
    : `Delete “${job.title}”? This cannot be undone.`;
  if (!window.confirm(warning)) return;

  if (assignments.length) {
    const { error: assignmentError } = await db.from('job_assignments').delete().eq('job_id', id);
    if (assignmentError) return toast(`Could not remove assignments: ${assignmentError.message}`, 'error');
  }
  const { error } = await db.from('wedding_jobs').delete().eq('id', id);
  if (error) return toast(error.message, 'error');
  selectedJobId = null;
  toast('Wedding job deleted.');
  await loadAdmin();
}

// v0.4.0 dashboard: show genuinely unfilled positions rather than total requested positions.
function renderDashboard() {
  const metrics = dashboardMetrics();
  const milliseconds = Math.max(0, weddingDate.getTime() - Date.now());
  const days = Math.ceil(milliseconds / 86400000);
  const recent = adminData.rsvps.slice(0, 6);
  const jobTotals = weddingJobTotals();

  return `<div class="admin-view">
    <div class="view-heading"><div><p class="eyebrow">Welcome back</p><h1>Wedding Command Center</h1><p>Signed in as ${esc(session.user.email)}</p></div><button class="secondary" onclick="loadAdmin()">Refresh</button></div>
    <div class="private-countdown"><span>Private countdown</span><strong>${days}</strong><em>days until “I do”</em></div>
    <section class="metric-grid">
      ${metricCard('Invited people', metrics.invitedPeople, 'Based on invitation limits')}
      ${metricCard('RSVPs received', metrics.responses, 'Submitted responses')}
      ${metricCard('Attending', metrics.attendingPeople, 'Adults and children')}
      ${metricCard('Declined', metrics.declinedResponses, 'Responses declined')}
      ${metricCard('Needs review', metrics.review, metrics.review ? 'Action required' : 'All caught up', metrics.review > 0)}
    </section>
    <section class="attention-grid">
      <article class="admin-panel"><div class="panel-heading"><h2>Needs attention</h2></div>
        <button class="attention-item" onclick="setAdminView('review')"><span>${metrics.review} RSVP${metrics.review === 1 ? '' : 's'} need review</span><b>Review →</b></button>
        <button class="attention-item" onclick="setAdminView('jobs')"><span>${jobTotals.remaining} wedding-job position${jobTotals.remaining === 1 ? '' : 's'} still need help</span><b>View →</b></button>
      </article>
      <article class="admin-panel"><div class="panel-heading"><h2>Recent RSVPs</h2><button onclick="setAdminView('review')">View all</button></div>
        ${recent.length ? recent.map((item) => `<div class="recent-row"><div><strong>${esc(item.first_name)} ${esc(item.last_name)}</strong><span>${titleCase(item.attendance)} · ${formatDate(item.created_at)}</span></div>${statusPill(item.verification_status)}</div>`).join('') : '<p class="muted">No RSVP responses yet.</p>'}
      </article>
    </section>
  </div>`;
}

// Command Center v0.5.0 — Registry Manager
let registrySearch = '';
let selectedRegistryId = null;
let publicRegistry = [];
let publicRegistryLoading = false;
let publicRegistryError = '';

function safeUrl(value = '') {
  try {
    const url = new URL(String(value).trim(), window.location.href);
    return (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : '';
  } catch {
    return '';
  }
}

// Public navigation now loads live registry items only when a guest opens the registry.
function nav(next) {
  if (next === 'admin' && !isAdminPortal) return;
  page = next;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (next === 'admin') loadAdmin();
  if (next === 'registry' && !isAdminPortal) loadPublicRegistry();
}

async function loadPublicRegistry() {
  if (!db || publicRegistryLoading) return;
  publicRegistryLoading = true;
  publicRegistryError = '';
  if (page === 'registry') render();
  const { data, error } = await db.from('registry_items').select('*').eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  publicRegistryLoading = false;
  if (error) {
    publicRegistryError = error.message;
    publicRegistry = [];
  } else {
    publicRegistry = data || [];
  }
  if (page === 'registry') render();
}

function renderRegistry() {
  let body = '';
  if (!configured) {
    body = `<div class="empty-state"><div class="big-icon">🎁</div><h3>Registry coming soon</h3><p>The registry is not connected yet.</p></div>`;
  } else if (publicRegistryLoading) {
    body = `<div class="loading-card">Loading our registry…</div>`;
  } else if (publicRegistryError) {
    body = `<div class="error-card"><h3>We couldn't load the registry.</h3><p>Please try again in a moment.</p><button class="primary" onclick="loadPublicRegistry()">Try Again</button></div>`;
  } else if (!publicRegistry.length) {
    body = `<div class="empty-state"><div class="big-icon">🎁</div><h3>Registry coming soon</h3><p>Jordan and Rochelle will add registry information here.</p></div>`;
  } else {
    body = `<div class="public-registry-grid">${publicRegistry.map(renderPublicRegistryItem).join('')}</div>`;
  }
  return `<main class="content-page"><div class="page-heading"><p class="eyebrow">With gratitude</p><h2>Gift Registry</h2><p>Your presence at our wedding means so much to us. If you would like to give a gift, our registry items are below.</p></div>${body}</main>`;
}

function renderPublicRegistryItem(item) {
  const itemUrl = safeUrl(item.item_url);
  const imageUrl = safeUrl(item.image_url);
  return `<article class="public-registry-card">
    ${imageUrl ? `<div class="registry-image-wrap"><img src="${esc(imageUrl)}" alt="${esc(item.title)}" loading="lazy" onerror="this.parentElement.classList.add('image-failed');this.remove()"></div>` : `<div class="registry-image-wrap registry-image-placeholder">🎁</div>`}
    <div class="public-registry-copy">
      ${item.store_name ? `<p class="registry-store">${esc(item.store_name)}</p>` : ''}
      <h3>${esc(item.title)}</h3>
      ${item.description ? `<p>${esc(item.description)}</p>` : ''}
      ${itemUrl ? `<a class="primary registry-link" href="${esc(itemUrl)}" target="_blank" rel="noopener noreferrer">View Gift</a>` : ''}
    </div>
  </article>`;
}

function renderAdminView() {
  if (adminError) return `<div class="error-card"><h2>Could not load the Command Center</h2><p>${esc(adminError)}</p><button class="primary" onclick="loadAdmin()">Try Again</button></div>`;
  if (adminView === 'dashboard') return renderDashboard();
  if (adminView === 'review') return renderReview();
  if (adminView === 'invitations') return renderInvitations();
  if (adminView === 'guests') return renderGuestProfiles();
  if (adminView === 'jobs') return renderJobs();
  if (adminView === 'registry') return renderRegistryManager();
  if (adminView === 'photos') return placeholderAdminPage('Photo Manager', 'This will manage your private library and the selected guest album.');
  if (adminView === 'summary') return renderSummary();
  if (adminView === 'settings') return placeholderAdminPage('Settings', 'Wedding details and public-page visibility controls will be added here.');
  return renderDashboard();
}

function registryItemsSorted() {
  return [...adminData.registry].sort((a, b) => {
    const order = Number(a.sort_order || 0) - Number(b.sort_order || 0);
    if (order) return order;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
}

function setRegistrySearch(value) {
  registrySearch = value;
  render();
  const input = document.querySelector('#registry-search');
  input?.focus();
  input?.setSelectionRange(value.length, value.length);
}

function selectRegistryItem(id) {
  selectedRegistryId = id;
  render();
}

function renderRegistryManager() {
  const all = registryItemsSorted();
  const query = registrySearch.trim().toLowerCase();
  const filtered = query ? all.filter((item) => [item.title, item.description, item.store_name, item.item_url]
    .some((value) => String(value || '').toLowerCase().includes(query))) : all;
  const activeCount = all.filter((item) => item.is_active).length;
  const hiddenCount = all.length - activeCount;

  let selected = filtered.find((item) => item.id === selectedRegistryId) || null;
  if (!selected && filtered.length) {
    selected = filtered[0];
    selectedRegistryId = selected.id;
  }

  return `<div class="admin-view">
    <div class="view-heading"><div><p class="eyebrow">Gifts & stores</p><h1>Registry Manager</h1><p>Add registry items and control exactly what guests can see.</p></div><button class="primary" onclick="openRegistryDialog()">Add Registry Item</button></div>
    <section class="registry-metric-grid">
      ${metricCard('Registry items', all.length, 'Total items')}
      ${metricCard('Visible', activeCount, 'Shown to guests')}
      ${metricCard('Hidden', hiddenCount, 'Admin only')}
    </section>
    <div class="registry-toolbar"><input id="registry-search" type="search" value="${esc(registrySearch)}" placeholder="Search gifts, stores, or descriptions" oninput="setRegistrySearch(this.value)"><span>${filtered.length} item${filtered.length === 1 ? '' : 's'}</span></div>
    <div class="registry-split">
      <aside class="registry-list">${filtered.length ? filtered.map((item) => renderRegistryListItem(item, selected?.id === item.id)).join('') : '<p class="muted registry-empty">No matching registry items.</p>'}</aside>
      <section class="registry-detail">${selected ? renderRegistryDetail(selected, all) : `<div class="empty-state admin-empty"><div class="big-icon">🎁</div><h2>No registry items yet</h2><p>Add your first registry item when you are ready.</p><button class="primary" onclick="openRegistryDialog()">Add Registry Item</button></div>`}</section>
    </div>
    ${all.length ? `<section class="admin-panel registry-preview-panel"><div class="panel-heading"><div><h2>Guest preview</h2><p class="muted">Only visible items appear below, in guest order.</p></div></div><div class="registry-preview-grid">${all.filter((item) => item.is_active).map(renderRegistryPreviewItem).join('') || '<p class="muted">No items are currently visible to guests.</p>'}</div></section>` : ''}
  </div>`;
}

function renderRegistryListItem(item, active) {
  return `<button class="registry-list-item ${active ? 'active' : ''}" onclick="selectRegistryItem('${item.id}')">
    <span class="registry-list-copy"><strong>${esc(item.title)}</strong><small>${esc(item.store_name || 'No store listed')}</small></span>
    <span class="registry-visibility ${item.is_active ? 'visible' : 'hidden'}">${item.is_active ? 'Visible' : 'Hidden'}</span>
  </button>`;
}

function renderRegistryPreviewItem(item) {
  const image = safeUrl(item.image_url);
  return `<article class="registry-preview-card">
    ${image ? `<img src="${esc(image)}" alt="${esc(item.title)}" loading="lazy">` : '<div class="registry-preview-placeholder">🎁</div>'}
    <div><strong>${esc(item.title)}</strong><span>${esc(item.store_name || '')}</span></div>
  </article>`;
}

function renderRegistryDetail(item, all) {
  const index = all.findIndex((entry) => entry.id === item.id);
  const itemUrl = safeUrl(item.item_url);
  const imageUrl = safeUrl(item.image_url);
  return `<article class="registry-detail-card">
    <div class="registry-detail-header">
      <div><p class="eyebrow">Registry item</p><h2>${esc(item.title)}</h2><div class="profile-pills"><span class="registry-visibility ${item.is_active ? 'visible' : 'hidden'}">${item.is_active ? 'Visible to guests' : 'Hidden from guests'}</span></div></div>
      <div class="profile-actions"><button class="secondary" onclick="openRegistryDialog('${item.id}')">Edit</button><button class="danger-button" onclick="deleteRegistryItem('${item.id}')">Delete</button></div>
    </div>
    <div class="registry-detail-body">
      <div class="registry-detail-image">${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(item.title)}">` : '<div class="registry-large-placeholder">🎁</div>'}</div>
      <div>
        <div class="profile-info-grid registry-info-grid">
          <div class="profile-info"><span>Store</span><strong>${esc(item.store_name || '—')}</strong></div>
          <div class="profile-info"><span>Guest order</span><strong>${index + 1} of ${all.length}</strong></div>
          <div class="profile-info"><span>Visibility</span><strong>${item.is_active ? 'Shown on public registry' : 'Hidden from public registry'}</strong></div>
          <div class="profile-info"><span>Link</span><strong>${itemUrl ? `<a href="${esc(itemUrl)}" target="_blank" rel="noopener noreferrer">Open store page ↗</a>` : '—'}</strong></div>
        </div>
        ${item.description ? `<section class="profile-section"><h3>Description</h3><p class="job-description">${esc(item.description)}</p></section>` : ''}
        <section class="profile-section"><div class="registry-action-grid">
          <button class="secondary" onclick="toggleRegistryVisibility('${item.id}')">${item.is_active ? 'Hide from Guests' : 'Show to Guests'}</button>
          <button class="secondary" onclick="moveRegistryItem('${item.id}', -1)" ${index <= 0 ? 'disabled' : ''}>Move Up</button>
          <button class="secondary" onclick="moveRegistryItem('${item.id}', 1)" ${index >= all.length - 1 ? 'disabled' : ''}>Move Down</button>
        </div></section>
      </div>
    </div>
  </article>`;
}

function openRegistryDialog(id = '') {
  const item = id ? adminData.registry.find((entry) => entry.id === id) : null;
  const nextOrder = registryItemsSorted().length ? Math.max(...registryItemsSorted().map((entry) => Number(entry.sort_order || 0))) + 10 : 10;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="saveRegistryItem(event)">
    <input type="hidden" name="registry_id" value="${esc(item?.id || '')}">
    <div class="modal-heading"><h2>${item ? 'Edit Registry Item' : 'Add Registry Item'}</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">
      <label class="field wide"><span>Gift or item name</span><input name="title" required value="${esc(item?.title || '')}"></label>
      <label class="field"><span>Store name (optional)</span><input name="store_name" value="${esc(item?.store_name || '')}"></label>
      <label class="field"><span>Sort order</span><input type="number" name="sort_order" min="0" step="1" value="${Number(item?.sort_order ?? nextOrder)}"></label>
      <label class="field wide"><span>Store/item URL (optional)</span><input type="url" name="item_url" placeholder="https://…" value="${esc(item?.item_url || '')}"></label>
      <label class="field wide"><span>Image URL (optional)</span><input type="url" name="image_url" placeholder="https://…" value="${esc(item?.image_url || '')}"></label>
      <label class="field wide"><span>Description (optional)</span><textarea name="description" rows="4">${esc(item?.description || '')}</textarea></label>
      <label class="field wide checkbox-field"><input type="checkbox" name="is_active" ${item ? (item.is_active ? 'checked' : '') : 'checked'}><span>Show this item on the guest registry</span></label>
    </div>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">${item ? 'Save Changes' : 'Add Item'}</button></div>
  </form></div>`);
}

async function saveRegistryItem(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const id = String(form.get('registry_id') || '');
  const itemUrl = String(form.get('item_url') || '').trim();
  const imageUrl = String(form.get('image_url') || '').trim();
  if (itemUrl && !safeUrl(itemUrl)) return toast('The store link must start with http:// or https://.', 'error');
  if (imageUrl && !safeUrl(imageUrl)) return toast('The image link must start with http:// or https://.', 'error');
  const payload = {
    title: String(form.get('title') || '').trim(),
    description: String(form.get('description') || '').trim() || null,
    store_name: String(form.get('store_name') || '').trim() || null,
    item_url: itemUrl || null,
    image_url: imageUrl || null,
    is_active: form.get('is_active') === 'on',
    sort_order: Math.max(0, Number(form.get('sort_order') || 0))
  };
  const result = id ? await db.from('registry_items').update(payload).eq('id', id) : await db.from('registry_items').insert(payload).select('id').single();
  if (result.error) return toast(result.error.message, 'error');
  if (!id && result.data?.id) selectedRegistryId = result.data.id;
  closeModal();
  toast(id ? 'Registry item updated.' : 'Registry item added.');
  await loadAdmin();
}

async function toggleRegistryVisibility(id) {
  const item = adminData.registry.find((entry) => entry.id === id);
  if (!item) return;
  const { error } = await db.from('registry_items').update({ is_active: !item.is_active }).eq('id', id);
  if (error) return toast(error.message, 'error');
  toast(item.is_active ? 'Registry item hidden from guests.' : 'Registry item is now visible to guests.');
  await loadAdmin();
}

async function moveRegistryItem(id, direction) {
  const ordered = registryItemsSorted();
  const index = ordered.findIndex((entry) => entry.id === id);
  const target = index + Number(direction);
  if (index < 0 || target < 0 || target >= ordered.length) return;
  const [moved] = ordered.splice(index, 1);
  ordered.splice(target, 0, moved);
  const updates = await Promise.all(ordered.map((entry, position) => db.from('registry_items').update({ sort_order: (position + 1) * 10 }).eq('id', entry.id)));
  const error = updates.find((result) => result.error)?.error;
  if (error) return toast(error.message, 'error');
  selectedRegistryId = id;
  toast('Registry order updated.');
  await loadAdmin();
}

async function deleteRegistryItem(id) {
  const item = adminData.registry.find((entry) => entry.id === id);
  if (!item) return;
  if (!window.confirm(`Delete “${item.title}” from the registry? This cannot be undone.`)) return;
  const { error } = await db.from('registry_items').delete().eq('id', id);
  if (error) return toast(error.message, 'error');
  selectedRegistryId = null;
  toast('Registry item deleted.');
  await loadAdmin();
}

// Command Center v0.6.0 — Photo Manager
const PHOTO_BUCKET = 'wedding-photos';
let photoSearch = '';
let selectedPhotoId = null;
let photoUrlCache = new Map();
let publicPhotos = [];
let publicPhotoUrls = new Map();
let publicPhotosLoading = false;
let publicPhotosError = '';
let publicFavoritePhoto = null;
let publicFavoritePhotoUrl = '';
let publicFavoriteLoading = false;

function photoFileName(path = '') {
  const part = String(path).split('/').pop() || 'photo';
  return part.replace(/^[0-9a-f-]{20,}-/i, '');
}

async function signedPhotoUrl(path, expiresIn = 3600) {
  if (!db || !path) return '';
  const { data, error } = await db.storage.from(PHOTO_BUCKET).createSignedUrl(path, expiresIn);
  if (error) return '';
  return data?.signedUrl || '';
}

async function loadPublicFavoritePhoto() {
  if (!db || publicFavoriteLoading) return;
  publicFavoriteLoading = true;
  if (page === 'home') render();
  const { data, error } = await db.from('photos').select('*').eq('is_favorite_engagement', true).limit(1).maybeSingle();
  if (!error && data) {
    publicFavoritePhoto = data;
    publicFavoritePhotoUrl = await signedPhotoUrl(data.storage_path, 1800);
  } else {
    publicFavoritePhoto = null;
    publicFavoritePhotoUrl = '';
  }
  publicFavoriteLoading = false;
  if (page === 'home') render();
}

async function hydrateAdminPhotoUrls() {
  if (!db || !session) return;
  const missing = adminData.photos.filter((photo) => !photoUrlCache.has(photo.storage_path));
  await Promise.all(missing.map(async (photo) => {
    const url = await signedPhotoUrl(photo.storage_path, 3600);
    photoUrlCache.set(photo.storage_path, url);
  }));
  if (isAdminPortal && page === 'admin' && adminView === 'photos') render();
}

async function loadPublicPhotos() {
  if (!db || publicPhotosLoading) return;
  publicPhotosLoading = true;
  publicPhotosError = '';
  if (page === 'photos') render();
  const { data, error } = await db.from('photos').select('*').eq('show_in_guest_album', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) {
    publicPhotos = [];
    publicPhotosError = error.message;
    publicPhotosLoading = false;
    if (page === 'photos') render();
    return;
  }
  publicPhotos = data || [];
  publicPhotoUrls = new Map();
  await Promise.all(publicPhotos.map(async (photo) => {
    publicPhotoUrls.set(photo.storage_path, await signedPhotoUrl(photo.storage_path, 1800));
  }));
  publicPhotosLoading = false;
  if (page === 'photos') render();
}

// Extend public navigation to load both live registry items and the curated guest album.
function nav(next) {
  if (next === 'admin' && !isAdminPortal) return;
  page = next;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (next === 'admin') loadAdmin();
  if (next === 'home' && !isAdminPortal) loadPublicFavoritePhoto();
  if (next === 'registry' && !isAdminPortal) loadPublicRegistry();
  if (next === 'photos' && !isAdminPortal) loadPublicPhotos();
}

function renderPhotos() {
  let body = '';
  if (!configured) {
    body = `<div class="empty-state"><div class="big-icon">📷</div><h3>Photo album coming soon</h3><p>The album is not connected yet.</p></div>`;
  } else if (publicPhotosLoading) {
    body = `<div class="loading-card">Loading our photos…</div>`;
  } else if (publicPhotosError) {
    body = `<div class="error-card"><h3>We couldn't load the photo album.</h3><p>Please try again in a moment.</p><button class="primary" onclick="loadPublicPhotos()">Try Again</button></div>`;
  } else if (!publicPhotos.length) {
    body = `<div class="empty-state"><div class="big-icon">📷</div><h3>Photos coming soon</h3><p>Jordan and Rochelle will share selected photos here.</p></div>`;
  } else {
    body = `<div class="public-photo-grid">${publicPhotos.map((photo) => {
      const url = publicPhotoUrls.get(photo.storage_path) || '';
      return `<figure class="public-photo-card">${url ? `<img src="${esc(url)}" alt="${esc(photo.caption || 'Jordan and Rochelle wedding photo')}" loading="lazy">` : '<div class="photo-load-failed">Photo unavailable</div>'}${photo.caption ? `<figcaption>${esc(photo.caption)}</figcaption>` : ''}</figure>`;
    }).join('')}</div>`;
  }
  return `<main class="content-page"><div class="page-heading"><p class="eyebrow">Our memories</p><h2>Photo Album</h2><p>A collection of favorite photos selected by Jordan and Rochelle.</p></div>${body}</main>`;
}

function setAdminView(next) {
  adminView = next;
  render();
  if (next === 'photos') hydrateAdminPhotoUrls();
}

function renderAdminView() {
  if (adminError) return `<div class="error-card"><h2>Could not load the Command Center</h2><p>${esc(adminError)}</p><button class="primary" onclick="loadAdmin()">Try Again</button></div>`;
  if (adminView === 'dashboard') return renderDashboard();
  if (adminView === 'review') return renderReview();
  if (adminView === 'invitations') return renderInvitations();
  if (adminView === 'guests') return renderGuestProfiles();
  if (adminView === 'jobs') return renderJobs();
  if (adminView === 'registry') return renderRegistryManager();
  if (adminView === 'photos') return renderPhotoManager();
  if (adminView === 'summary') return renderSummary();
  if (adminView === 'settings') return placeholderAdminPage('Settings', 'Wedding details and public-page visibility controls will be added here.');
  return renderDashboard();
}

function sortedPhotos() {
  return [...adminData.photos].sort((a, b) => {
    const order = Number(a.sort_order || 0) - Number(b.sort_order || 0);
    if (order) return order;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
}

function setPhotoSearch(value) {
  photoSearch = value;
  render();
  const input = document.querySelector('#photo-search');
  input?.focus();
  input?.setSelectionRange(value.length, value.length);
}

function selectPhoto(id) {
  selectedPhotoId = id;
  render();
}

function photoThumb(photo, className = '') {
  const url = photoUrlCache.get(photo.storage_path) || '';
  return url ? `<img class="${className}" src="${esc(url)}" alt="${esc(photo.caption || photoFileName(photo.storage_path))}" loading="lazy">` : `<div class="photo-placeholder ${className}">📷</div>`;
}

function renderPhotoManager() {
  const all = sortedPhotos();
  const query = photoSearch.trim().toLowerCase();
  const filtered = query ? all.filter((photo) => [photo.caption, photo.storage_path].some((value) => String(value || '').toLowerCase().includes(query))) : all;
  const guestCount = all.filter((photo) => photo.show_in_guest_album).length;
  const favorite = all.find((photo) => photo.is_favorite_engagement) || null;
  let selected = filtered.find((photo) => photo.id === selectedPhotoId) || null;
  if (!selected && filtered.length) {
    selected = filtered[0];
    selectedPhotoId = selected.id;
  }
  if (all.some((photo) => !photoUrlCache.has(photo.storage_path))) setTimeout(hydrateAdminPhotoUrls, 0);

  return `<div class="admin-view">
    <div class="view-heading"><div><p class="eyebrow">Private library & guest album</p><h1>Photo Manager</h1><p>Keep your full photo library private and choose exactly which pictures guests can see.</p></div><button class="primary" onclick="openPhotoUploadDialog()">Upload Photos</button></div>
    <section class="registry-metric-grid">
      ${metricCard('Private library', all.length, 'Total uploaded photos')}
      ${metricCard('Guest album', guestCount, 'Visible to guests')}
      ${metricCard('Private only', all.length - guestCount, 'Jordan & Rochelle only')}
      ${metricCard('Homepage favorite', favorite ? 1 : 0, favorite ? 'Selected' : 'Not selected')}
    </section>
    <div class="registry-toolbar"><input id="photo-search" type="search" value="${esc(photoSearch)}" placeholder="Search captions or file names" oninput="setPhotoSearch(this.value)"><span>${filtered.length} photo${filtered.length === 1 ? '' : 's'}</span></div>
    <div class="photo-manager-split">
      <aside class="photo-admin-grid">${filtered.length ? filtered.map((photo) => `<button class="photo-admin-tile ${selected?.id === photo.id ? 'active' : ''}" onclick="selectPhoto('${photo.id}')">${photoThumb(photo)}<span class="photo-tile-copy"><strong>${esc(photo.caption || photoFileName(photo.storage_path))}</strong><small>${photo.is_favorite_engagement ? '★ Homepage favorite · ' : ''}${photo.show_in_guest_album ? 'Guest album' : 'Private only'}</small></span></button>`).join('') : '<p class="muted">No matching photos.</p>'}</aside>
      <section class="photo-detail">${selected ? renderPhotoDetail(selected, all) : `<div class="empty-state admin-empty"><div class="big-icon">📷</div><h2>No photos yet</h2><p>Upload photos to create your private library.</p><button class="primary" onclick="openPhotoUploadDialog()">Upload Photos</button></div>`}</section>
    </div>
    ${guestCount ? `<section class="admin-panel photo-preview-panel"><div class="panel-heading"><div><h2>Guest album preview</h2><p class="muted">Only these selected photos appear on the public website.</p></div></div><div class="photo-preview-grid">${all.filter((photo) => photo.show_in_guest_album).map((photo) => `<figure>${photoThumb(photo)}${photo.caption ? `<figcaption>${esc(photo.caption)}</figcaption>` : ''}</figure>`).join('')}</div></section>` : ''}
  </div>`;
}

function renderPhotoDetail(photo, all) {
  const index = all.findIndex((entry) => entry.id === photo.id);
  return `<article class="photo-detail-card">
    <div class="registry-detail-header"><div><p class="eyebrow">Photo</p><h2>${esc(photo.caption || photoFileName(photo.storage_path))}</h2><div class="profile-pills"><span class="registry-visibility ${photo.show_in_guest_album ? 'visible' : 'hidden'}">${photo.show_in_guest_album ? 'Visible in guest album' : 'Private library'}</span>${photo.is_favorite_engagement ? '<span class="registry-visibility favorite-photo-badge">★ Homepage favorite</span>' : ''}</div></div><div class="profile-actions"><button class="secondary" onclick="openPhotoEditDialog('${photo.id}')">Edit</button><button class="danger-button" onclick="deletePhoto('${photo.id}')">Delete</button></div></div>
    <div class="photo-detail-image">${photoThumb(photo)}</div>
    <div class="profile-info-grid">
      <div class="profile-info"><span>File</span><strong>${esc(photoFileName(photo.storage_path))}</strong></div>
      <div class="profile-info"><span>Guest order</span><strong>${index + 1} of ${all.length}</strong></div>
      <div class="profile-info"><span>Uploaded</span><strong>${formatDate(photo.created_at)}</strong></div>
      <div class="profile-info"><span>Visibility</span><strong>${photo.show_in_guest_album ? 'Guest album' : 'Private library only'}</strong></div>
    </div>
    <section class="profile-section"><div class="registry-action-grid">
      <button class="primary" onclick="setFavoriteEngagementPhoto('${photo.id}')">${photo.is_favorite_engagement ? '★ Homepage Favorite' : 'Set as Homepage Favorite'}</button>
      <button class="secondary" onclick="toggleGuestAlbum('${photo.id}')">${photo.show_in_guest_album ? 'Remove from Guest Album' : 'Add to Guest Album'}</button>
      <button class="secondary" ${index <= 0 ? 'disabled' : ''} onclick="movePhoto('${photo.id}', -1)">Move Earlier</button>
      <button class="secondary" ${index >= all.length - 1 ? 'disabled' : ''} onclick="movePhoto('${photo.id}', 1)">Move Later</button>
    </div></section>
  </article>`;
}

function openPhotoUploadDialog() {
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="uploadPhotos(event)">
    <div class="modal-heading"><h2>Upload Photos</h2><button type="button" onclick="closeModal()">×</button></div>
    <label class="field wide"><span>Choose photo files</span><input type="file" name="photos" accept="image/jpeg,image/png,image/webp,image/gif" multiple required></label>
    <label class="field wide"><span>Caption (optional — used when uploading one photo)</span><input name="caption" placeholder="Our engagement photo"></label>
    <label class="choice-card"><input type="checkbox" name="show_in_guest_album"><span><strong>Add to guest album</strong><small>Guests will be able to see uploaded photos immediately.</small></span></label>
    <p class="muted">Your private library is visible only in the Command Center. You can change guest visibility at any time.</p>
    <div id="photo-upload-progress"></div>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Upload</button></div>
  </form></div>`);
}

async function uploadPhotos(event) {
  event.preventDefault();
  const form = event.target;
  const files = [...(form.elements.photos.files || [])];
  if (!files.length) return toast('Choose at least one photo.', 'error');
  const button = form.querySelector('button[type=submit]');
  const progress = document.getElementById('photo-upload-progress');
  button.disabled = true;
  const show = form.elements.show_in_guest_album.checked;
  const singleCaption = String(form.elements.caption.value || '').trim();
  const existing = sortedPhotos();
  let nextOrder = existing.length ? Math.max(...existing.map((photo) => Number(photo.sort_order || 0))) + 1 : 0;

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    progress.innerHTML = `<p class="muted">Uploading ${i + 1} of ${files.length}: ${esc(file.name)}</p>`;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
    const path = `library/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await db.storage.from(PHOTO_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (uploadError) {
      button.disabled = false;
      return toast(`Could not upload ${file.name}: ${uploadError.message}`, 'error');
    }
    const { error: rowError } = await db.from('photos').insert({
      storage_path: path,
      caption: files.length === 1 ? (singleCaption || null) : null,
      show_in_guest_album: show,
      sort_order: nextOrder++,
      uploaded_by: session.user.id
    });
    if (rowError) {
      await db.storage.from(PHOTO_BUCKET).remove([path]);
      button.disabled = false;
      return toast(`Photo uploaded but could not be saved: ${rowError.message}`, 'error');
    }
  }
  closeModal();
  toast(`${files.length} photo${files.length === 1 ? '' : 's'} uploaded.`);
  photoUrlCache.clear();
  await loadAdmin();
  await hydrateAdminPhotoUrls();
}

function openPhotoEditDialog(id) {
  const photo = adminData.photos.find((item) => item.id === id);
  if (!photo) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="savePhotoEdit(event, '${id}')">
    <div class="modal-heading"><h2>Edit Photo</h2><button type="button" onclick="closeModal()">×</button></div>
    <label class="field wide"><span>Caption</span><input name="caption" value="${esc(photo.caption || '')}" placeholder="Optional caption"></label>
    <label class="choice-card"><input type="checkbox" name="show_in_guest_album" ${photo.show_in_guest_album ? 'checked' : ''}><span><strong>Show in guest album</strong><small>Turn this off to keep the photo private.</small></span></label>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save Photo</button></div>
  </form></div>`);
}

async function savePhotoEdit(event, id) {
  event.preventDefault();
  const form = event.target;
  const { error } = await db.from('photos').update({
    caption: String(form.elements.caption.value || '').trim() || null,
    show_in_guest_album: form.elements.show_in_guest_album.checked
  }).eq('id', id);
  if (error) return toast(error.message, 'error');
  closeModal();
  toast('Photo updated.');
  await loadAdmin();
  await hydrateAdminPhotoUrls();
}

async function setFavoriteEngagementPhoto(id) {
  const photo = adminData.photos.find((item) => item.id === id);
  if (!photo) return;
  const currentFavorite = adminData.photos.find((item) => item.is_favorite_engagement && item.id !== id);
  if (currentFavorite) {
    const { error: clearError } = await db.from('photos').update({ is_favorite_engagement: false }).eq('id', currentFavorite.id);
    if (clearError) return toast(clearError.message, 'error');
  }
  const { error } = await db.from('photos').update({ is_favorite_engagement: true }).eq('id', id);
  if (error) return toast(error.message, 'error');
  publicFavoritePhoto = null;
  publicFavoritePhotoUrl = '';
  toast('Homepage engagement photo updated.');
  await loadAdmin();
  await hydrateAdminPhotoUrls();
}

async function toggleGuestAlbum(id) {
  const photo = adminData.photos.find((item) => item.id === id);
  if (!photo) return;
  const { error } = await db.from('photos').update({ show_in_guest_album: !photo.show_in_guest_album }).eq('id', id);
  if (error) return toast(error.message, 'error');
  toast(photo.show_in_guest_album ? 'Removed from guest album.' : 'Added to guest album.');
  await loadAdmin();
  await hydrateAdminPhotoUrls();
}

async function movePhoto(id, direction) {
  const all = sortedPhotos();
  const index = all.findIndex((photo) => photo.id === id);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= all.length) return;
  const current = all[index];
  const swap = all[swapIndex];
  const currentOrder = Number(current.sort_order || index);
  const swapOrder = Number(swap.sort_order || swapIndex);
  const [a, b] = await Promise.all([
    db.from('photos').update({ sort_order: swapOrder }).eq('id', current.id),
    db.from('photos').update({ sort_order: currentOrder }).eq('id', swap.id)
  ]);
  if (a.error || b.error) return toast((a.error || b.error).message, 'error');
  await loadAdmin();
  await hydrateAdminPhotoUrls();
}

async function deletePhoto(id) {
  const photo = adminData.photos.find((item) => item.id === id);
  if (!photo) return;
  const label = photo.caption || photoFileName(photo.storage_path);
  if (!window.confirm(`Delete “${label}”? This will permanently remove the photo file and its album record.`)) return;
  const { error: storageError } = await db.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  if (storageError) return toast(storageError.message, 'error');
  const { error: rowError } = await db.from('photos').delete().eq('id', id);
  if (rowError) return toast(rowError.message, 'error');
  photoUrlCache.delete(photo.storage_path);
  selectedPhotoId = null;
  toast('Photo deleted.');
  await loadAdmin();
  await hydrateAdminPhotoUrls();
}


/* ===== v0.6.2 planning polish ===== */
let publicWeddingSettings = {};
let publicRsvpPeople = [];

function mainMenuButton() {
  return `<button class="secondary main-menu-button" onclick="nav('home')">← Main Menu</button>`;
}

function renderRsvp() {
  return `<main class="content-page">${mainMenuButton()}<div class="page-heading"><p class="eyebrow">Please respond</p>
    <h2>Wedding RSVP</h2><p>Please list the name of every adult and child who will be attending.</p></div>
    <form class="rsvp-form" onsubmit="submitRsvpV062(event)">
      <h3>Main contact</h3><div class="form-grid">
        ${field('First name', 'first_name', true)}${field('Last name', 'last_name', true)}
        ${field('Street address', 'street_address', true, true)}${field('City', 'city', true)}
        ${field('State', 'state', true)}${field('ZIP code', 'zip_code', true)}
        ${field('Phone number', 'phone', true)}${field('Email (optional)', 'email')}
      </div>
      <h3>Will you attend?</h3><div class="choice-row">
        <label><input type="radio" name="attendance" value="attending" checked onchange="updatePeopleFields()"> Yes, I’ll be there</label>
        <label><input type="radio" name="attendance" value="declined" onchange="updatePeopleFields()"> Sorry, I can’t make it</label>
      </div>
      <div id="people-builder">
        <div class="form-grid">
          ${numberField('Number of adults', 'adult_count', 1)}${numberField('Number of children', 'child_count', 0)}
        </div>
        <div id="named-people"></div>
      </div>
      <label class="field wide"><span>Notes, allergies, or special needs</span><textarea name="notes" rows="4"></textarea></label>
      <div id="rsvp-message"></div><button class="primary" type="submit">Submit RSVP</button>
    </form></main>`;
}

function updatePeopleFields() {
  const form = document.querySelector('.rsvp-form');
  if (!form) return;
  const attending = form.querySelector('input[name="attendance"]:checked')?.value === 'attending';
  const builder = document.getElementById('people-builder');
  if (builder) builder.style.display = attending ? '' : 'none';
  if (!attending) return;
  const adults = Math.max(1, Number(form.elements.adult_count?.value || 1));
  const children = Math.max(0, Number(form.elements.child_count?.value || 0));
  const first = form.elements.first_name?.value || '';
  const last = form.elements.last_name?.value || '';
  let fields = `<h3>Names of everyone attending</h3><p class="muted">The main contact is included as Adult 1.</p><div class="people-name-grid">`;
  for (let i=0;i<adults;i++) {
    fields += `<label class="field"><span>Adult ${i+1}</span><input name="adult_name_${i}" required value="${i===0 ? esc((first+' '+last).trim()) : ''}" placeholder="Full name"></label>`;
  }
  for (let i=0;i<children;i++) {
    fields += `<label class="field"><span>Child ${i+1}</span><input name="child_name_${i}" required placeholder="Full name"></label>`;
  }
  fields += `</div>`;
  const target = document.getElementById('named-people');
  if (target) target.innerHTML = fields;
}
document.addEventListener('input', (e) => {
  if (e.target?.closest('.rsvp-form') && ['adult_count','child_count','first_name','last_name'].includes(e.target.name)) updatePeopleFields();
});

async function submitRsvpV062(event) {
  event.preventDefault();
  const button = event.target.querySelector('button[type=submit]');
  const message = document.getElementById('rsvp-message');
  if (!configured) return message.innerHTML = '<p class="error">The RSVP system has not been connected yet.</p>';
  button.disabled = true; button.textContent = 'Submitting…';
  const form = new FormData(event.target);
  const attendance = form.get('attendance');
  const adultCount = attendance === 'attending' ? Number(form.get('adult_count') || 0) : 0;
  const childCount = attendance === 'attending' ? Number(form.get('child_count') || 0) : 0;
  const people = [];
  if (attendance === 'attending') {
    for (let i=0;i<adultCount;i++) people.push({ person_name: String(form.get(`adult_name_${i}`)||'').trim(), person_type:'adult', sort_order:i });
    for (let i=0;i<childCount;i++) people.push({ person_name: String(form.get(`child_name_${i}`)||'').trim(), person_type:'child', sort_order:adultCount+i });
    if (people.some(p => !p.person_name)) { button.disabled=false; button.textContent='Submit RSVP'; return message.innerHTML='<p class="error">Please enter a name for everyone attending.</p>'; }
  }
  const payload = {
    invitation_id:null, first_name:String(form.get('first_name')).trim(), last_name:String(form.get('last_name')).trim(),
    street_address:String(form.get('street_address')).trim(), city:String(form.get('city')).trim(), state:String(form.get('state')).trim(),
    zip_code:String(form.get('zip_code')).trim(), phone:String(form.get('phone')).trim(), email:String(form.get('email')||'').trim()||null,
    attendance, adult_count:adultCount, child_count:childCount,
    additional_guests: people.slice(1).map(p=>p.person_name).join(', ') || null,
    notes:String(form.get('notes')||'').trim()||null, verification_status:'needs_review', submitted_by_admin:false
  };
  const { data, error } = await db.from('rsvps').insert(payload).select('id').single();
  if (error) { button.disabled=false; button.textContent='Submit RSVP'; return message.innerHTML=`<p class="error">${esc(error.message)}</p>`; }
  if (people.length) {
    const { error: peopleError } = await db.from('rsvp_people').insert(people.map(p=>({...p,rsvp_id:data.id})));
    if (peopleError) { button.disabled=false; button.textContent='Submit RSVP'; return message.innerHTML=`<p class="error">RSVP saved, but the guest names could not be saved: ${esc(peopleError.message)}</p>`; }
  }
  event.target.outerHTML = `<div class="success-card"><div class="big-icon">♥</div><h2>Thank you!</h2><p>Your RSVP and guest names have been received.</p>${mainMenuButton()}</div>`;
}

function renderDetails() {
  const s = publicWeddingSettings;
  const details = s.details_text || 'Additional wedding-day details will be posted here.';
  const parking = s.parking_text || '';
  const query = encodeURIComponent(s.map_query || '4-H Building Milbank South Dakota');
  return `<main class="content-page">${mainMenuButton()}<div class="page-heading"><p class="eyebrow">Save the date</p><h2>Wedding Details</h2></div>
    <section class="detail-card"><div class="big-icon">📅</div><div><h3>${esc(s.wedding_date_label || 'Saturday, November 14, 2026')}</h3><p>${esc(s.ceremony_time_label || 'The ceremony begins at 10:00 AM.')}</p></div></section>
    <section class="detail-card"><div class="big-icon">📍</div><div><h3>${esc(s.venue_name || '4-H Building')}</h3><p>${esc(s.venue_address || 'Milbank, South Dakota')}</p></div></section>
    <section class="admin-panel public-details-copy"><h3>Wedding Day Information</h3><p>${esc(details).replace(/\n/g,'<br>')}</p>${parking ? `<h3>Parking & Directions</h3><p>${esc(parking).replace(/\n/g,'<br>')}</p>`:''}</section>
    <section class="map-card"><iframe title="Wedding venue map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${query}&output=embed"></iframe></section>
  </main>`;
}

function renderRegistry() {
  const amazon = safeUrl(publicWeddingSettings.amazon_registry_url);
  const other = safeUrl(publicWeddingSettings.other_registry_url);
  let body = '';
  if (amazon || other) body += `<div class="registry-link-row">${amazon?`<a class="primary" target="_blank" rel="noopener" href="${esc(amazon)}">View Our Amazon Registry</a>`:''}${other?`<a class="secondary registry-external" target="_blank" rel="noopener" href="${esc(other)}">View Other Registry</a>`:''}</div>`;
  if (publicRegistryLoading) body += `<div class="loading-card">Loading our gift list…</div>`;
  else if (publicRegistry.length) body += `<h3 class="gift-list-heading">Gifts You Can Bring to the Wedding</h3><div class="public-registry-grid">${publicRegistry.map(renderPublicRegistryItem).join('')}</div>`;
  else body += `<div class="empty-state"><div class="big-icon">🎁</div><h3>Gift list coming soon</h3><p>Registry links and gift ideas will appear here.</p></div>`;
  return `<main class="content-page">${mainMenuButton()}<div class="page-heading"><p class="eyebrow">With gratitude</p><h2>Gift Registry</h2><p>Your presence means so much to us. Gifts are optional.</p></div>${body}</main>`;
}

function renderPhotos() {
  let body = publicPhotosLoading ? '<div class="loading-card">Loading photos…</div>' : (publicPhotos.length ? `<div class="public-photo-grid">${publicPhotos.map(renderPublicPhoto).join('')}</div>` : '<div class="empty-state"><div class="big-icon">📷</div><h3>Photos coming soon</h3></div>');
  return `<main class="content-page">${mainMenuButton()}<div class="page-heading"><p class="eyebrow">Our memories</p><h2>Photo Album</h2><p>Photos selected by Jordan and Rochelle.</p></div>${body}</main>`;
}

const baseLoadAdminV062 = loadAdmin;
loadAdmin = async function() {
  await baseLoadAdminV062();
  if (!db || !session) return;
  const [peopleRes, settingsRes] = await Promise.all([
    db.from('rsvp_people').select('*').order('sort_order'),
    db.from('wedding_settings').select('*').eq('id', 1).maybeSingle()
  ]);
  adminData.rsvpPeople = peopleRes.data || [];
  adminData.settings = settingsRes.data || {};
  render();
};

const baseLoadPublicRegistryV062 = loadPublicRegistry;
loadPublicRegistry = async function() {
  await baseLoadPublicRegistryV062();
  if (db) {
    const {data} = await db.from('wedding_settings').select('*').eq('id',1).maybeSingle();
    publicWeddingSettings = data || {};
    render();
  }
};

const baseRenderAdminViewV062 = renderAdminView;
renderAdminView = function() {
  if (adminView === 'settings') return renderWeddingSettingsV062();
  if (adminView === 'registry') return renderRegistryManagerV062();
  if (adminView === 'invitations') return renderInvitationsV062();
  const html = baseRenderAdminViewV062();
  if (adminView === 'review' || adminView === 'guests') setTimeout(enhanceGuestNamesV062,0);
  return html;
};

function enhanceGuestNamesV062() {
  // Named attendees are available to the profile/review screens without changing the existing layout.
  document.querySelectorAll('[data-rsvp-id]').forEach(()=>{});
}

function renderInvitationsV062() {
  const original = renderInvitations();
  return original
    .replace('Import CSV</button>', 'Import Excel / CSV</button>')
    .replace('accept=".csv,text/csv" onchange="importInvitationsCsv(event)"', 'accept=".xlsx,.xls,.csv" onchange="importInvitationsExcelV062(event)"');
}

async function importInvitationsExcelV062(event) {
  const file = event.target.files?.[0]; event.target.value='';
  if (!file) return;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), {type:'array'});
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''});
    if (!rows.length) return toast('The spreadsheet has no invitation rows.','error');
    const norm = rows.map(r => {
      const get=(...keys)=>{ for(const k of keys){ const found=Object.keys(r).find(x=>x.toLowerCase().replace(/[^a-z0-9]/g,'')===k); if(found) return r[found]; } return ''; };
      const first=String(get('primaryfirstname','firstname','first')||'').trim();
      const last=String(get('primarylastname','lastname','last')||'').trim();
      return {
        household_name: `${first} ${last}`.trim(),
        primary_first_name:first, primary_last_name:last,
        street_address:String(get('streetaddress','address')||'').trim()||null,
        city:String(get('city')||'').trim()||null, state:String(get('state')||'').trim()||null,
        zip_code:String(get('zipcode','zip')||'').trim()||null, phone:String(get('phone','phonenumber')||'').trim()||null,
        email:String(get('email')||'').trim()||null, max_guests:Number(get('maxguests','guests')||1)||1, status:'invited'
      };
    }).filter(r=>r.primary_first_name && r.primary_last_name);
    if (!norm.length) return toast('Could not find first and last name columns.','error');
    if (!confirm(`Import ${norm.length} invitations? Household names will match the main guest name.`)) return;
    const {error}=await db.from('invitations').insert(norm);
    if(error) return toast(error.message,'error');
    toast(`${norm.length} invitations imported.`); await loadAdmin();
  } catch(e) { toast(`Could not read spreadsheet: ${e.message}`,'error'); }
}

function renderRegistryManagerV062() {
  const base = renderRegistryManager();
  return base.replace(
    '<button class="primary" onclick="openRegistryDialog()">Add Registry Item</button>',
    '<div class="heading-actions"><button class="secondary" onclick="document.getElementById(\'gift-import\').click()">Import Gift List</button><input id="gift-import" hidden type="file" accept=".xlsx,.xls,.csv" onchange="importGiftListV062(event)"><button class="primary" onclick="openRegistryDialog()">Add Gift</button></div>'
  );
}

async function importGiftListV062(event) {
  const file=event.target.files?.[0]; event.target.value=''; if(!file) return;
  try {
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    const start=registryItemsSorted().length*10+10;
    const items=rows.map((r,i)=>{
      const keys=Object.fromEntries(Object.entries(r).map(([k,v])=>[k.toLowerCase().replace(/[^a-z0-9]/g,''),v]));
      return {title:String(keys.title||keys.gift||keys.item||'').trim(),description:String(keys.description||'').trim()||null,store_name:String(keys.store||keys.storename||'').trim()||null,item_url:String(keys.url||keys.link||keys.itemurl||'').trim()||null,image_url:String(keys.image||keys.imageurl||'').trim()||null,is_active:true,sort_order:start+i*10};
    }).filter(x=>x.title);
    if(!items.length) return toast('Your gift list needs a Title, Gift, or Item column.','error');
    if(!confirm(`Import ${items.length} gift items?`)) return;
    const {error}=await db.from('registry_items').insert(items); if(error) return toast(error.message,'error');
    toast(`${items.length} gifts imported.`); await loadAdmin();
  } catch(e){toast(`Could not read gift list: ${e.message}`,'error');}
}

function renderWeddingSettingsV062() {
  const s=adminData.settings||{};
  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Public website</p><h1>Wedding Details & Registry Links</h1><p>Edit what guests see without changing code.</p></div></div>
  <form class="admin-panel settings-form" onsubmit="saveWeddingSettingsV062(event)">
    <div class="form-grid">
      <label class="field"><span>Venue name</span><input name="venue_name" value="${esc(s.venue_name||'4-H Building')}"></label>
      <label class="field"><span>Venue address / location</span><input name="venue_address" value="${esc(s.venue_address||'Milbank, South Dakota')}"></label>
      <label class="field wide"><span>Map search</span><input name="map_query" value="${esc(s.map_query||'4-H Building Milbank South Dakota')}"><small>Use the venue name plus city/state if the map marker needs adjusting.</small></label>
      <label class="field"><span>Wedding date label</span><input name="wedding_date_label" value="${esc(s.wedding_date_label||'Saturday, November 14, 2026')}"></label>
      <label class="field"><span>Ceremony time text</span><input name="ceremony_time_label" value="${esc(s.ceremony_time_label||'The ceremony begins at 10:00 AM.')}"></label>
      <label class="field wide"><span>Wedding day details</span><textarea name="details_text" rows="6">${esc(s.details_text||'')}</textarea></label>
      <label class="field wide"><span>Parking & directions</span><textarea name="parking_text" rows="4">${esc(s.parking_text||'')}</textarea></label>
      <label class="field wide"><span>Amazon Wedding Registry URL</span><input type="url" name="amazon_registry_url" value="${esc(s.amazon_registry_url||'')}" placeholder="Paste your Amazon registry link"></label>
      <label class="field wide"><span>Other registry URL (optional)</span><input type="url" name="other_registry_url" value="${esc(s.other_registry_url||'')}" placeholder="Another registry or gift page"></label>
    </div><button class="primary" type="submit">Save Wedding Details</button>
  </form></div>`;
}

async function saveWeddingSettingsV062(event) {
  event.preventDefault(); const f=new FormData(event.target);
  const row={id:1};
  ['venue_name','venue_address','map_query','wedding_date_label','ceremony_time_label','details_text','parking_text','amazon_registry_url','other_registry_url'].forEach(k=>row[k]=String(f.get(k)||'').trim()||null);
  const {error}=await db.from('wedding_settings').upsert(row);
  if(error) return toast(error.message,'error');
  adminData.settings=row; publicWeddingSettings=row; toast('Wedding details saved.'); render();
}

// Load public settings alongside the existing public registry initialization.
if (!isAdminPortal && configured) {
  db.from('wedding_settings').select('*').eq('id',1).maybeSingle().then(({data})=>{ publicWeddingSettings=data||{}; render(); });
}


const baseRenderGuestProfileV062 = renderGuestProfile;
renderGuestProfile = function(record) {
  let html = baseRenderGuestProfileV062(record);
  if (record.rsvp) {
    const people=(adminData.rsvpPeople||[]).filter(p=>p.rsvp_id===record.rsvp.id).sort((a,b)=>a.sort_order-b.sort_order);
    if (people.length) {
      const block=`<section class="profile-section"><div class="profile-section-heading"><h3>Everyone attending</h3></div><div class="named-attendee-list">${people.map(p=>`<div><strong>${esc(p.person_name)}</strong><span>${titleCase(p.person_type)}</span></div>`).join('')}</div></section>`;
      html=html.replace(`${record.rsvp?.notes ? `<section class="profile-section">` : '<section class="profile-section">'}`, block + `${record.rsvp?.notes ? `<section class="profile-section">` : '<section class="profile-section">'}`);
    }
  }
  return html;
};

saveInvitation = async function(event, id='') {
  event.preventDefault();
  const submit=event.target.querySelector('[type=submit]'); submit.disabled=true;
  const form=new FormData(event.target);
  const first=String(form.get('primary_first_name')||'').trim(), last=String(form.get('primary_last_name')||'').trim();
  const payload=Object.fromEntries(form.entries());
  payload.household_name=`${first} ${last}`.trim();
  payload.primary_first_name=first; payload.primary_last_name=last; payload.max_guests=Number(payload.max_guests||1);
  for(const key of ['phone','email','street_address','city','state','zip_code','private_notes']) payload[key]=String(payload[key]||'').trim()||null;
  const result=id?await db.from('invitations').update(payload).eq('id',id):await db.from('invitations').insert(payload);
  if(result.error){toast(result.error.message,'error');submit.disabled=false;return;}
  closeModal(); toast(id?'Invitation updated.':'Invitation added.'); await loadAdmin();
};


/* ===== v0.6.3 email, individual jobs, Excel and gallery reliability patch ===== */

async function ensureXlsxV063() {
  if (window.XLSX) return window.XLSX;
  const sources = [
    'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
  ];
  for (const src of sources) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      if (window.XLSX) return window.XLSX;
    } catch {}
  }
  throw new Error('The Excel reader could not load. Check your internet connection and try again, or import a CSV file.');
}

importInvitationsExcelV062 = async function(event) {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  try {
    const XLSX = await ensureXlsxV063();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (!rows.length) return toast('The spreadsheet has no invitation rows.', 'error');
    const norm = rows.map(r => {
      const get = (...keys) => {
        for (const k of keys) {
          const found = Object.keys(r).find(x => x.toLowerCase().replace(/[^a-z0-9]/g, '') === k);
          if (found) return r[found];
        }
        return '';
      };
      const first = String(get('primaryfirstname','firstname','first') || '').trim();
      const last = String(get('primarylastname','lastname','last') || '').trim();
      return {
        household_name: `${first} ${last}`.trim(),
        primary_first_name: first,
        primary_last_name: last,
        street_address: String(get('streetaddress','address') || '').trim() || null,
        city: String(get('city') || '').trim() || null,
        state: String(get('state') || '').trim() || null,
        zip_code: String(get('zipcode','zip') || '').trim() || null,
        phone: String(get('phone','phonenumber') || '').trim() || null,
        email: String(get('email') || '').trim() || null,
        max_guests: Number(get('maxguests','guests') || 1) || 1,
        status: 'invited'
      };
    }).filter(r => r.primary_first_name && r.primary_last_name);
    if (!norm.length) return toast('Could not find first and last name columns.', 'error');
    if (!confirm(`Import ${norm.length} invitations? Household names will match the main guest name.`)) return;
    const { error } = await db.from('invitations').insert(norm);
    if (error) return toast(error.message, 'error');
    toast(`${norm.length} invitations imported.`);
    await loadAdmin();
  } catch (e) {
    toast(`Could not import spreadsheet: ${e.message}`, 'error');
  }
};

importGiftListV062 = async function(event) {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  try {
    const XLSX = await ensureXlsxV063();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const start = registryItemsSorted().length * 10 + 10;
    const items = rows.map((r, i) => {
      const keys = Object.fromEntries(Object.entries(r).map(([k,v]) => [k.toLowerCase().replace(/[^a-z0-9]/g,''), v]));
      return {
        title: String(keys.title || keys.gift || keys.item || '').trim(),
        description: String(keys.description || '').trim() || null,
        store_name: String(keys.store || keys.storename || '').trim() || null,
        item_url: String(keys.url || keys.link || keys.itemurl || '').trim() || null,
        image_url: String(keys.image || keys.imageurl || '').trim() || null,
        is_active: true,
        sort_order: start + i * 10
      };
    }).filter(x => x.title);
    if (!items.length) return toast('Your gift list needs a Title, Gift, or Item column.', 'error');
    if (!confirm(`Import ${items.length} gift items?`)) return;
    const { error } = await db.from('registry_items').insert(items);
    if (error) return toast(error.message, 'error');
    toast(`${items.length} gifts imported.`);
    await loadAdmin();
  } catch (e) {
    toast(`Could not import gift list: ${e.message}`, 'error');
  }
};

async function sendRsvpConfirmationV063(rsvpId) {
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !rsvpId) return;
  try {
    await fetch(`${cfg.supabaseUrl}/functions/v1/send-rsvp-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': cfg.supabaseAnonKey },
      body: JSON.stringify({ rsvp_id: rsvpId })
    });
  } catch (error) {
    console.warn('RSVP was saved, but confirmation email could not be requested.', error);
  }
}

submitRsvpV062 = async function(event) {
  event.preventDefault();
  const button = event.target.querySelector('button[type=submit]');
  const message = document.getElementById('rsvp-message');
  if (!configured) return message.innerHTML = '<p class="error">The RSVP system has not been connected yet.</p>';
  button.disabled = true; button.textContent = 'Submitting…';
  const form = new FormData(event.target);
  const attendance = form.get('attendance');
  const adultCount = attendance === 'attending' ? Number(form.get('adult_count') || 0) : 0;
  const childCount = attendance === 'attending' ? Number(form.get('child_count') || 0) : 0;
  const people = [];
  if (attendance === 'attending') {
    for (let i=0;i<adultCount;i++) people.push({ person_name: String(form.get(`adult_name_${i}`)||'').trim(), person_type:'adult', sort_order:i });
    for (let i=0;i<childCount;i++) people.push({ person_name: String(form.get(`child_name_${i}`)||'').trim(), person_type:'child', sort_order:adultCount+i });
    if (people.some(p => !p.person_name)) {
      button.disabled=false; button.textContent='Submit RSVP';
      return message.innerHTML='<p class="error">Please enter a name for everyone attending.</p>';
    }
  }
  const email = String(form.get('email') || '').trim() || null;
  const payload = {
    invitation_id:null, first_name:String(form.get('first_name')).trim(), last_name:String(form.get('last_name')).trim(),
    street_address:String(form.get('street_address')).trim(), city:String(form.get('city')).trim(), state:String(form.get('state')).trim(),
    zip_code:String(form.get('zip_code')).trim(), phone:String(form.get('phone')).trim(), email,
    attendance, adult_count:adultCount, child_count:childCount,
    additional_guests: people.slice(1).map(p=>p.person_name).join(', ') || null,
    notes:String(form.get('notes')||'').trim()||null, verification_status:'needs_review', submitted_by_admin:false
  };
  const { data, error } = await db.from('rsvps').insert(payload).select('id').single();
  if (error) {
    button.disabled=false; button.textContent='Submit RSVP';
    return message.innerHTML=`<p class="error">${esc(error.message)}</p>`;
  }
  if (people.length) {
    const { error: peopleError } = await db.from('rsvp_people').insert(people.map(p=>({...p,rsvp_id:data.id})));
    if (peopleError) {
      button.disabled=false; button.textContent='Submit RSVP';
      return message.innerHTML=`<p class="error">RSVP saved, but the guest names could not be saved: ${esc(peopleError.message)}</p>`;
    }
  }
  if (email) sendRsvpConfirmationV063(data.id);
  event.target.outerHTML = `<div class="success-card"><div class="big-icon">♥</div><h2>Thank you!</h2><p>Your RSVP and guest names have been received.</p>${email ? '<p class="muted">We’ll also send an acknowledgement to the email address you provided.</p>' : ''}${mainMenuButton()}</div>`;
};

// Gallery: show the album immediately, then hydrate signed URLs in the background.
function renderPublicPhoto(photo) {
  const url = publicPhotoUrls.get(photo.storage_path);
  if (url === null) {
    return `<figure class="public-photo-card"><div class="photo-load-failed"><span>Photo unavailable</span><button class="secondary mini-button" onclick="retryPublicPhotoV063('${esc(photo.storage_path)}')">Retry</button></div>${photo.caption ? `<figcaption>${esc(photo.caption)}</figcaption>` : ''}</figure>`;
  }
  if (!url) {
    return `<figure class="public-photo-card"><div class="photo-skeleton"><span>Loading photo…</span></div>${photo.caption ? `<figcaption>${esc(photo.caption)}</figcaption>` : ''}</figure>`;
  }
  return `<figure class="public-photo-card"><img src="${esc(url)}" alt="${esc(photo.caption || 'Jordan and Rochelle wedding photo')}" loading="lazy" onerror="publicPhotoImageErrorV063('${esc(photo.storage_path)}')">${photo.caption ? `<figcaption>${esc(photo.caption)}</figcaption>` : ''}</figure>`;
}

loadPublicPhotos = async function(force = false) {
  if (!db || (publicPhotosLoading && !force)) return;
  publicPhotosLoading = true;
  publicPhotosError = '';
  if (page === 'photos') render();
  const { data, error } = await db.from('photos').select('*').eq('show_in_guest_album', true)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  publicPhotosLoading = false;
  if (error) {
    publicPhotos = [];
    publicPhotosError = error.message;
    if (page === 'photos') render();
    return;
  }
  publicPhotos = data || [];
  publicPhotoUrls = new Map(publicPhotos.map(photo => [photo.storage_path, undefined]));
  if (page === 'photos') render();

  const paths = publicPhotos.map(photo => photo.storage_path).filter(Boolean);
  if (!paths.length) return;
  try {
    const { data: signed, error: signError } = await db.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
    if (signError) throw signError;
    (signed || []).forEach((item, index) => {
      const path = item.path || paths[index];
      publicPhotoUrls.set(path, item.signedUrl || null);
    });
  } catch (error) {
    console.warn('Batch photo signing failed; retrying individually.', error);
    await Promise.all(paths.map(async path => {
      try {
        const { data: signed, error } = await db.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
        publicPhotoUrls.set(path, error ? null : (signed?.signedUrl || null));
      } catch {
        publicPhotoUrls.set(path, null);
      }
    }));
  }
  if (page === 'photos') render();
};

async function retryPublicPhotoV063(path) {
  publicPhotoUrls.set(path, undefined);
  render();
  try {
    const { data, error } = await db.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
    publicPhotoUrls.set(path, error ? null : (data?.signedUrl || null));
  } catch {
    publicPhotoUrls.set(path, null);
  }
  render();
}

function publicPhotoImageErrorV063(path) {
  publicPhotoUrls.set(path, null);
  render();
}

renderPhotos = function() {
  let body = '';
  if (!configured) {
    body = '<div class="empty-state"><div class="big-icon">📷</div><h3>Photo album coming soon</h3></div>';
  } else if (publicPhotosLoading && !publicPhotos.length) {
    body = '<div class="loading-card">Loading album…</div>';
  } else if (publicPhotosError) {
    body = `<div class="error-card"><h3>We couldn't load the album.</h3><p>${esc(publicPhotosError)}</p><button class="primary" onclick="loadPublicPhotos(true)">Try Again</button></div>`;
  } else if (!publicPhotos.length) {
    body = '<div class="empty-state"><div class="big-icon">📷</div><h3>Photos coming soon</h3></div>';
  } else {
    body = `<div class="public-photo-grid">${publicPhotos.map(renderPublicPhoto).join('')}</div>`;
  }
  return `<main class="content-page">${mainMenuButton()}<div class="page-heading"><p class="eyebrow">Our memories</p><h2>Photo Album</h2><p>Photos selected by Jordan and Rochelle.</p></div>${body}</main>`;
};

loadPublicFavoritePhoto = async function() {
  if (!db || publicFavoriteLoading) return;
  publicFavoriteLoading = true;
  if (page === 'home') render();
  try {
    const { data, error } = await db.from('photos').select('*').eq('is_favorite_engagement', true).limit(1).maybeSingle();
    if (error || !data) {
      publicFavoritePhoto = null;
      publicFavoritePhotoUrl = '';
    } else {
      publicFavoritePhoto = data;
      const { data: signed, error: signError } = await db.storage.from(PHOTO_BUCKET).createSignedUrl(data.storage_path, 3600);
      publicFavoritePhotoUrl = signError ? '' : (signed?.signedUrl || '');
    }
  } catch {
    publicFavoritePhotoUrl = '';
  }
  publicFavoriteLoading = false;
  if (page === 'home') render();
};

// Individual people from each RSVP are assignable to wedding jobs.
function assignmentPeopleV063() {
  const rows = [];
  const rsvps = adminData.rsvps || [];
  const people = adminData.rsvpPeople || [];
  const invitations = adminData.invitations || [];

  rsvps.forEach(rsvp => {
    const invitation = rsvp.invitation_id ? invitations.find(i => i.id === rsvp.invitation_id) : null;
    const household = invitation?.household_name || `${rsvp.first_name} ${rsvp.last_name}`.trim();
    const members = people.filter(p => p.rsvp_id === rsvp.id);
    if (members.length) {
      members.forEach(member => rows.push({
        key: `person:${member.id}`,
        person_id: member.id,
        rsvp_id: rsvp.id,
        invitation_id: rsvp.invitation_id || null,
        person_name: member.person_name,
        household,
        email: rsvp.email || invitation?.email || ''
      }));
    } else {
      rows.push({
        key: `rsvp:${rsvp.id}`,
        person_id: null,
        rsvp_id: rsvp.id,
        invitation_id: rsvp.invitation_id || null,
        person_name: `${rsvp.first_name} ${rsvp.last_name}`.trim(),
        household,
        email: rsvp.email || invitation?.email || ''
      });
    }
  });

  invitations.forEach(invitation => {
    const already = rsvps.some(r => r.invitation_id === invitation.id);
    if (!already) rows.push({
      key: `invite:${invitation.id}`,
      person_id: null,
      rsvp_id: null,
      invitation_id: invitation.id,
      person_name: `${invitation.primary_first_name} ${invitation.primary_last_name}`.trim() || invitation.household_name,
      household: invitation.household_name,
      email: invitation.email || ''
    });
  });
  return rows.sort((a,b) => a.person_name.localeCompare(b.person_name));
}

assignmentGuestOptions = function() {
  return assignmentPeopleV063().map(record =>
    `<option value="${esc(record.key)}">${esc(record.person_name)} — ${esc(record.household)}</option>`
  ).join('');
};

function selectedAssignmentPersonV063(key) {
  return assignmentPeopleV063().find(item => item.key === key) || null;
}

function fillAssignmentEmailV063(key) {
  const person = selectedAssignmentPersonV063(key);
  const emailInput = document.querySelector('#assignment-email-v063');
  if (emailInput && person) emailInput.value = person.email || '';
}

openJobAssignmentDialog = function(jobId) {
  const job = adminData.jobs.find(item => item.id === jobId);
  if (!job) return;
  const options = assignmentGuestOptions();
  if (!options) return toast('Add an invitation or RSVP before assigning a job.', 'error');

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="saveJobAssignment(event)">
    <input type="hidden" name="job_id" value="${esc(job.id)}">
    <div class="modal-heading"><h2>Assign ${esc(job.title)}</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">
      <label class="field wide"><span>Person</span><select name="guest_record" required onchange="fillAssignmentEmailV063(this.value)"><option value="">Choose a person…</option>${options}</select></label>
      <label class="field wide"><span>Email for this job request</span><input id="assignment-email-v063" type="email" name="contact_email" placeholder="Can use the household email or a different email"></label>
      <label class="field wide"><span>How should this start?</span>
        <select name="status">
          <option value="awaiting_response">Send email request and wait for response</option>
          <option value="accepted">They already said yes (phone, text, or in person)</option>
          <option value="assigned">Assign without sending an email yet</option>
        </select>
      </label>
      <label class="field wide"><span>Instructions for this person (optional)</span><textarea name="instructions" rows="4"></textarea></label>
    </div>
    <p class="muted">If this person does not have their own email, you can use the main household email.</p>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save Assignment</button></div>
  </form></div>`);
};

saveJobAssignment = async function(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const record = selectedAssignmentPersonV063(String(form.get('guest_record') || ''));
  if (!record) return toast('Choose a person first.', 'error');

  const jobId = String(form.get('job_id'));
  const desiredStatus = String(form.get('status') || 'assigned');
  const email = String(form.get('contact_email') || '').trim() || null;
  if (desiredStatus === 'awaiting_response' && !email) return toast('Enter an email address to send a job request.', 'error');

  const duplicate = adminData.assignments.some(item =>
    item.job_id === jobId &&
    ((record.person_id && item.rsvp_person_id === record.person_id) ||
     (!record.person_id && item.person_name === record.person_name && item.rsvp_id === record.rsvp_id))
  );
  if (duplicate) return toast('That person is already assigned to this job.', 'error');

  const now = new Date().toISOString();
  const payload = {
    job_id: jobId,
    rsvp_id: record.rsvp_id || null,
    invitation_id: record.invitation_id || null,
    rsvp_person_id: record.person_id || null,
    person_name: record.person_name,
    contact_email: email,
    status: desiredStatus,
    instructions: String(form.get('instructions') || '').trim() || null,
    responded_at: desiredStatus === 'accepted' ? now : null,
    response_method: desiredStatus === 'accepted' ? 'admin' : null
  };
  const { data, error } = await db.from('job_assignments').insert(payload).select('id').single();
  if (error) return toast(error.message, 'error');

  if (desiredStatus === 'awaiting_response') {
    const { error: emailError } = await db.functions.invoke('send-job-request', { body: { assignment_id: data.id } });
    if (emailError) {
      await db.from('job_assignments').update({ status: 'assigned' }).eq('id', data.id);
      closeModal();
      toast(`Assignment saved, but the email could not be sent: ${emailError.message}`, 'error');
      await loadAdmin();
      return;
    }
  }

  closeModal();
  toast(desiredStatus === 'accepted' ? `${record.person_name} marked accepted.` : `${record.person_name} assigned.`);
  await loadAdmin();
};

async function markAssignmentResponseV063(id, status) {
  const label = status === 'accepted' ? 'accepted' : 'declined';
  if (!confirm(`Mark this person as ${label}?`)) return;
  const { error } = await db.from('job_assignments').update({
    status,
    responded_at: new Date().toISOString(),
    response_method: 'admin'
  }).eq('id', id);
  if (error) return toast(error.message, 'error');
  toast(`Job marked ${label}.`);
  await loadAdmin();
}

async function resendJobRequestV063(id) {
  const assignment = adminData.assignments.find(a => a.id === id);
  if (!assignment?.contact_email) return toast('Add an email address to this assignment first.', 'error');
  toast('Sending job request…');
  const { error } = await db.functions.invoke('send-job-request', { body: { assignment_id: id } });
  if (error) return toast(error.message, 'error');
  toast('Job request email sent.');
  await loadAdmin();
}

function assignmentStatusActionsV063(assignment) {
  const status = String(assignment.status || 'assigned');
  let buttons = '';
  if (status !== 'accepted') buttons += `<button onclick="markAssignmentResponseV063('${assignment.id}','accepted')">Mark Accepted</button>`;
  if (status !== 'declined') buttons += `<button onclick="markAssignmentResponseV063('${assignment.id}','declined')">Mark Declined</button>`;
  if (assignment.contact_email) buttons += `<button onclick="resendJobRequestV063('${assignment.id}')">${status === 'awaiting_response' ? 'Resend Email' : 'Send Email Request'}</button>`;
  return buttons;
}

renderJobAssignmentRow = function(assignment) {
  const linkedRsvp = assignment.rsvp_id ? adminData.rsvps.find(item => item.id === assignment.rsvp_id) : null;
  const linkedInvitation = assignment.invitation_id ? adminData.invitations.find(item => item.id === assignment.invitation_id) : null;
  const openAction = linkedRsvp ? `selectGuestRecord('rsvp-${linkedRsvp.id}');setAdminView('guests')` : (linkedInvitation ? `selectGuestRecord('invitation-${linkedInvitation.id}');setAdminView('guests')` : '');
  const responseText = assignment.responded_at
    ? ` · ${assignment.response_method === 'admin' ? 'confirmed by admin' : 'responded by email'} ${formatDate(assignment.responded_at)}`
    : (assignment.requested_at ? ` · request sent ${formatDate(assignment.requested_at)}` : '');
  return `<div class="assignment-row assignment-row-v063">
    <div><strong>${esc(assignment.person_name || 'Assigned helper')}</strong><span>${esc(assignment.instructions || 'No special instructions')}${responseText}</span>${assignment.contact_email ? `<small>${esc(assignment.contact_email)}</small>` : ''}</div>
    <div class="assignment-row-actions">${statusPill(assignment.status || 'assigned')}${assignmentStatusActionsV063(assignment)}${openAction ? `<button onclick="${openAction}">Open profile</button>` : ''}<button class="danger-text" onclick="removeAssignment('${assignment.id}')">Remove</button></div>
  </div>`;
};

renderAssignmentRow = function(assignment) {
  const job = adminData.jobs.find(item => item.id === assignment.job_id);
  const responseText = assignment.responded_at
    ? ` · ${assignment.response_method === 'admin' ? 'confirmed by admin' : 'responded by email'}`
    : '';
  return `<div class="assignment-row assignment-row-v063"><div><strong>${esc(job?.title || 'Wedding job')}</strong><span>${esc(assignment.person_name || '')}${assignment.instructions ? ` · ${esc(assignment.instructions)}` : ''}${responseText}</span></div><div class="assignment-row-actions">${statusPill(assignment.status || 'assigned')}${assignmentStatusActionsV063(assignment)}<button class="danger-text" onclick="removeAssignment('${assignment.id}')">Remove</button></div></div>`;
};

// Make guest-profile job sections match the specific household person when possible.
const baseRenderGuestProfileV063 = renderGuestProfile;
renderGuestProfile = function(record) {
  let html = baseRenderGuestProfileV063(record);
  if (!record.rsvp) return html;
  const members = (adminData.rsvpPeople || []).filter(p => p.rsvp_id === record.rsvp.id);
  if (!members.length) return html;
  const jobAssignments = adminData.assignments.filter(a => a.rsvp_id === record.rsvp.id);
  const personBlock = `<section class="profile-section"><div class="profile-section-heading"><h3>Household People & Jobs</h3></div>
    <div class="household-person-list">${members.map(member => {
      const jobs = jobAssignments.filter(a => a.rsvp_person_id === member.id);
      return `<div class="household-person-row"><div><strong>${esc(member.person_name)}</strong><span>${titleCase(member.person_type)}</span></div><div>${jobs.length ? jobs.map(renderAssignmentRow).join('') : '<span class="muted">No job assigned</span>'}</div></div>`;
    }).join('')}</div>
  </section>`;
  return html.replace('<section class="profile-section"><div class="profile-section-heading"><h3>Record activity</h3>', personBlock + '<section class="profile-section"><div class="profile-section-heading"><h3>Record activity</h3>');
};

// Ensure the latest named people and settings are loaded before assignment dialogs are used.
const baseLoadAdminV063 = loadAdmin;
loadAdmin = async function() {
  await baseLoadAdminV063();
  if (!db || !session) return;
  // v0.6.2 already loads these; this is an idempotent fallback for older cached code.
  if (!Array.isArray(adminData.rsvpPeople)) {
    const { data } = await db.from('rsvp_people').select('*').order('sort_order');
    adminData.rsvpPeople = data || [];
  }
  render();
};


/* v0.6.3 follow-up fixes: household assignment from guest profile + declined jobs don't fill openings */

jobStats = function(job) {
  const assignments = jobAssignments(job.id);
  const inactive = new Set(['cancelled', 'declined', 'rejected']);
  const filled = assignments.filter(item => !inactive.has(String(item.status || 'assigned').toLowerCase())).length;
  const needed = Math.max(0, Number(job.openings || 0));
  return { assignments, filled, needed, remaining: Math.max(0, needed - filled) };
};

openAssignmentDialog = function(rsvpId = '', invitationId = '', personName = '') {
  if (!adminData.jobs.length) return toast('Add a wedding job first.', 'error');

  const allPeople = assignmentPeopleV063();
  let people = allPeople.filter(p =>
    (rsvpId && p.rsvp_id === rsvpId) ||
    (!rsvpId && invitationId && p.invitation_id === invitationId)
  );
  if (!people.length && personName) {
    people = [{
      key: `fallback:${rsvpId || invitationId || personName}`,
      person_id: null,
      rsvp_id: rsvpId || null,
      invitation_id: invitationId || null,
      person_name: personName,
      household: personName,
      email: ''
    }];
  }

  window._profileAssignmentPeopleV063 = people;
  const options = people.map(p => `<option value="${esc(p.key)}">${esc(p.person_name)}</option>`).join('');

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="saveProfileAssignmentV063(event)">
    <div class="modal-heading"><h2>Assign Wedding Job</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">
      <label class="field wide"><span>Person in this household</span><select name="guest_record" required onchange="fillProfileAssignmentEmailV063(this.value)"><option value="">Choose a person…</option>${options}</select></label>
      <label class="field wide"><span>Wedding job</span><select name="job_id" required><option value="">Choose a job…</option>${adminData.jobs.map(job => `<option value="${job.id}">${esc(job.title)}</option>`).join('')}</select></label>
      <label class="field wide"><span>Email for job request</span><input id="profile-assignment-email-v063" type="email" name="contact_email" placeholder="Household email or this person's email"></label>
      <label class="field wide"><span>How should this start?</span><select name="status">
        <option value="awaiting_response">Send email request and wait for response</option>
        <option value="accepted">They already said yes</option>
        <option value="assigned">Assign without sending email yet</option>
      </select></label>
      <label class="field wide"><span>Instructions</span><textarea name="instructions" rows="4"></textarea></label>
    </div>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save Assignment</button></div>
  </form></div>`);
};

function fillProfileAssignmentEmailV063(key) {
  const person = (window._profileAssignmentPeopleV063 || []).find(p => p.key === key);
  const input = document.getElementById('profile-assignment-email-v063');
  if (input && person) input.value = person.email || '';
}

async function saveProfileAssignmentV063(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const person = (window._profileAssignmentPeopleV063 || []).find(p => p.key === String(form.get('guest_record') || ''));
  if (!person) return toast('Choose a person first.', 'error');

  const jobId = String(form.get('job_id') || '');
  const status = String(form.get('status') || 'assigned');
  const email = String(form.get('contact_email') || '').trim() || null;
  if (status === 'awaiting_response' && !email) return toast('Enter an email address to send a job request.', 'error');

  const duplicate = adminData.assignments.some(item =>
    item.job_id === jobId &&
    ((person.person_id && item.rsvp_person_id === person.person_id) ||
     (!person.person_id && item.rsvp_id === person.rsvp_id && item.person_name === person.person_name))
  );
  if (duplicate) return toast('That person is already assigned to this job.', 'error');

  const now = new Date().toISOString();
  const payload = {
    job_id: jobId,
    rsvp_id: person.rsvp_id || null,
    invitation_id: person.invitation_id || null,
    rsvp_person_id: person.person_id || null,
    person_name: person.person_name,
    contact_email: email,
    status,
    instructions: String(form.get('instructions') || '').trim() || null,
    responded_at: status === 'accepted' ? now : null,
    response_method: status === 'accepted' ? 'admin' : null
  };

  const { data, error } = await db.from('job_assignments').insert(payload).select('id').single();
  if (error) return toast(error.message, 'error');

  if (status === 'awaiting_response') {
    const { error: emailError } = await db.functions.invoke('send-job-request', { body: { assignment_id: data.id } });
    if (emailError) {
      await db.from('job_assignments').update({ status: 'assigned' }).eq('id', data.id);
      closeModal();
      toast(`Assignment saved, but email could not be sent: ${emailError.message}`, 'error');
      await loadAdmin();
      return;
    }
  }

  closeModal();
  toast(status === 'accepted' ? `${person.person_name} marked accepted.` : `${person.person_name} assigned.`);
  await loadAdmin();
}


/* ===== v0.7.0 Settings ===== */
let adminUserDetailsV070 = [];
let adminUsersLoadingV070 = false;
let passwordRecoveryV070 = false;

function settingsV070() {
  return (isAdminPortal ? (adminData.settings || publicWeddingSettings || {}) : (publicWeddingSettings || {}));
}

function settingV070(key, fallback = '') {
  const value = settingsV070()?.[key];
  return value === null || value === undefined || value === '' ? fallback : value;
}

function booleanSettingV070(key, fallback = true) {
  const value = settingsV070()?.[key];
  return value === null || value === undefined ? fallback : Boolean(value);
}

function coupleNamesV070() {
  return {
    first: settingV070('partner_one_name', 'Jordan'),
    second: settingV070('partner_two_name', 'Rochelle')
  };
}

function coupleDisplayV070() {
  const names = coupleNamesV070();
  return `${names.first} & ${names.second}`;
}

function weddingDateValueV070() {
  return String(settingV070('wedding_date', '2026-11-14')).slice(0, 10);
}

function weddingTimeValueV070() {
  return String(settingV070('ceremony_time', '10:00:00')).slice(0, 5);
}

function weddingDateObjectV070() {
  const date = weddingDateValueV070();
  const time = weddingTimeValueV070() || '10:00';
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date('2026-11-14T10:00:00');
}

function weddingDateLongV070() {
  const stored = settingsV070()?.wedding_date_label;
  if (stored) return stored;
  return new Intl.DateTimeFormat('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }).format(weddingDateObjectV070());
}

function weddingDateShortV070() {
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric' }).format(weddingDateObjectV070());
}

function ceremonyTimeTextV070() {
  const stored = settingsV070()?.ceremony_time_label;
  if (stored) return stored;
  return `The ceremony begins at ${new Intl.DateTimeFormat('en-US', { hour:'numeric', minute:'2-digit' }).format(weddingDateObjectV070())}.`;
}

function venueLocationV070() {
  const city = settingV070('venue_city', 'Milbank');
  const state = settingV070('venue_state', 'South Dakota');
  return [city, state].filter(Boolean).join(', ');
}

function venueAddressLineV070() {
  const address = settingV070('venue_address', '');
  const location = venueLocationV070();
  if (!address) return location;
  if (address.toLowerCase() === location.toLowerCase()) return location;
  return `${address}${location ? ` · ${location}` : ''}`;
}

function footerTextV070() {
  return `${coupleDisplayV070()} · ${new Intl.DateTimeFormat('en-US', { month:'long', day:'numeric', year:'numeric' }).format(weddingDateObjectV070())}`;
}

shell = function(content) {
  const names = coupleNamesV070();
  if (isAdminPortal) {
    return `<div class="app-shell admin-app">
      <header class="site-header admin-header"><div class="brand">${esc(names.first)} <span>&</span> ${esc(names.second)}</div><span class="private-label">Private Command Center</span></header>
      ${content}<footer><span>♥</span> ${esc(coupleDisplayV070())} · Private administration</footer></div>`;
  }
  const registryVisible = booleanSettingV070('registry_visible', true);
  const photosVisible = booleanSettingV070('guest_album_visible', true);
  return `<div class="app-shell"><header class="site-header">
    <button class="brand" onclick="nav('home')">${esc(names.first)} <span>&</span> ${esc(names.second)}</button>
    <nav class="desktop-nav"><button onclick="nav('rsvp')">RSVP</button><button onclick="nav('details')">Wedding Details</button>${registryVisible ? `<button onclick="nav('registry')">Gift Registry</button>` : ''}${photosVisible ? `<button onclick="nav('photos')">Photo Album</button>` : ''}</nav>
    </header>${content}<footer><span>♥</span> ${esc(footerTextV070())}</footer></div>`;
};

render = function() {
  if (page === 'splash') {
    const names = coupleNamesV070();
    app.innerHTML = `<main class="splash"><div class="splash-overlay"></div><section class="splash-card">
      <p class="eyebrow">Together with our families</p><h1>${esc(names.first)} <span>&</span> ${esc(names.second)}</h1>
      <p class="date">${esc(new Intl.DateTimeFormat('en-US', { month:'long', day:'numeric', year:'numeric' }).format(weddingDateObjectV070()))}</p>
      <p class="location">📍 ${esc(settingV070('venue_name','4-H Building'))} · ${esc(venueLocationV070())}</p>
      <button class="primary large" onclick="nav('home')">Enter Our Wedding Website</button></section></main>`;
    return;
  }
  let content = '';
  if (page === 'home') content = renderHome();
  if (page === 'rsvp') content = renderRsvp();
  if (page === 'details') content = renderDetails();
  if (page === 'registry') content = renderRegistry();
  if (page === 'photos') content = renderPhotos();
  if (page === 'admin' && isAdminPortal) content = renderAdmin();
  app.innerHTML = shell(content);
};

renderHome = function() {
  const rsvpOpen = booleanSettingV070('rsvp_open', true);
  const registryVisible = booleanSettingV070('registry_visible', true);
  const photosVisible = booleanSettingV070('guest_album_visible', true);
  const heading = settingV070('welcome_heading', 'Celebrate with us');
  const welcome = settingV070('welcome_message', 'We are excited to celebrate our wedding with our family and friends. Please RSVP and find the details for our special day below.');
  const cards = [
    card('👥', 'RSVP', rsvpOpen ? 'Tell us whether you can celebrate with us.' : 'RSVPs are currently closed.', 'rsvp'),
    card('📅', 'Wedding Details', `${weddingDateLongV070()} · ${ceremonyTimeTextV070().replace('The ceremony begins at ','').replace('.','')}`, 'details')
  ];
  if (registryVisible) cards.push(card('🎁', 'Gift Registry', 'Browse our registry links and gift ideas.', 'registry'));
  if (photosVisible) cards.push(card('📷', 'Photo Album', `Photos chosen by ${esc(coupleDisplayV070())}.`, 'photos'));
  return `<main><section class="hero"><div><p class="eyebrow">We’re getting married</p><h2>${esc(heading)}</h2>
    <p class="lead">${esc(welcome).replace(/\n/g,'<br>')}</p><button class="primary" onclick="nav('rsvp')">${rsvpOpen ? 'RSVP Now' : 'RSVP Information'}</button>
    </div>${publicFavoritePhotoUrl ? `<div class="hero-photo hero-engagement-photo"><img src="${esc(publicFavoritePhotoUrl)}" alt="${esc(publicFavoritePhoto?.caption || `${coupleDisplayV070()} engagement photo`)}" onerror="this.closest('.hero-photo').classList.add('photo-error')"></div>` : `<div class="hero-photo placeholder-photo">${publicFavoriteLoading ? 'Loading our favorite engagement photo…' : 'Our favorite engagement photo'}</div>`}</section>
    <section class="quick-grid">${cards.join('')}</section></main>`;
};

const renderRsvpV070Form = renderRsvp;
renderRsvp = function() {
  if (!booleanSettingV070('rsvp_open', true)) {
    return `<main class="content-page">${mainMenuButton()}<div class="page-heading"><p class="eyebrow">RSVP</p><h2>RSVPs are currently closed</h2><p>${esc(settingV070('rsvp_closed_message', 'Please contact Jordan or Rochelle if you need to make or change an RSVP.'))}</p></div></main>`;
  }
  return renderRsvpV070Form();
};

renderDetails = function() {
  const s = settingsV070();
  const details = settingV070('details_text', 'Additional wedding-day details will be posted here.');
  const parking = settingV070('parking_text', '');
  const query = encodeURIComponent(settingV070('map_query', `${settingV070('venue_name','4-H Building')} ${venueLocationV070()}`));
  return `<main class="content-page">${mainMenuButton()}<div class="page-heading"><p class="eyebrow">Save the date</p><h2>Wedding Details</h2></div>
    <section class="detail-card"><div class="big-icon">📅</div><div><h3>${esc(weddingDateLongV070())}</h3><p>${esc(ceremonyTimeTextV070())}</p></div></section>
    <section class="detail-card"><div class="big-icon">📍</div><div><h3>${esc(settingV070('venue_name','4-H Building'))}</h3><p>${esc(venueAddressLineV070())}</p></div></section>
    <section class="admin-panel public-details-copy"><h3>Wedding Day Information</h3><p>${esc(details).replace(/\n/g,'<br>')}</p>${parking ? `<h3>Parking & Directions</h3><p>${esc(parking).replace(/\n/g,'<br>')}</p>` : ''}</section>
    <section class="map-card"><iframe title="Wedding venue map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${query}&output=embed"></iframe></section></main>`;
};

const renderRegistryV070Visible = renderRegistry;
renderRegistry = function() {
  if (!booleanSettingV070('registry_visible', true)) {
    return `<main class="content-page">${mainMenuButton()}<div class="empty-state"><div class="big-icon">🎁</div><h2>Gift Registry</h2><p>The registry is not currently being shown on our wedding website.</p></div></main>`;
  }
  return renderRegistryV070Visible();
};

const renderPhotosV070Visible = renderPhotos;
renderPhotos = function() {
  if (!booleanSettingV070('guest_album_visible', true)) {
    return `<main class="content-page">${mainMenuButton()}<div class="empty-state"><div class="big-icon">📷</div><h2>Photo Album</h2><p>The photo album is not currently being shown on our wedding website.</p></div></main>`;
  }
  return renderPhotosV070Visible();
};

renderDashboard = function() {
  const metrics = dashboardMetrics();
  const milliseconds = Math.max(0, weddingDateObjectV070().getTime() - Date.now());
  const days = Math.ceil(milliseconds / 86400000);
  const recent = adminData.rsvps.slice(0, 6);
  const jobTotals = weddingJobTotals();
  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Welcome back</p><h1>Wedding Command Center</h1><p>Signed in as ${esc(session.user.email)}</p></div><button class="secondary" onclick="loadAdmin()">Refresh</button></div>
    <div class="private-countdown"><span>Private countdown</span><strong>${days}</strong><em>days until “I do”</em></div>
    <section class="metric-grid">${metricCard('Invited people', metrics.invitedPeople, 'Based on invitation limits')}${metricCard('RSVPs received', metrics.responses, 'Submitted responses')}${metricCard('Attending', metrics.attendingPeople, 'Adults and children')}${metricCard('Declined', metrics.declinedResponses, 'Responses declined')}${metricCard('Needs review', metrics.review, metrics.review ? 'Action required' : 'All caught up', metrics.review > 0)}</section>
    <section class="attention-grid"><article class="admin-panel"><div class="panel-heading"><h2>Needs attention</h2></div><button class="attention-item" onclick="setAdminView('review')"><span>${metrics.review} RSVP${metrics.review === 1 ? '' : 's'} need review</span><b>Review →</b></button><button class="attention-item" onclick="setAdminView('jobs')"><span>${jobTotals.remaining} wedding-job position${jobTotals.remaining === 1 ? '' : 's'} still need help</span><b>View →</b></button></article>
      <article class="admin-panel"><div class="panel-heading"><h2>Recent RSVPs</h2><button onclick="setAdminView('review')">View all</button></div>${recent.length ? recent.map((item) => `<div class="recent-row"><div><strong>${esc(item.first_name)} ${esc(item.last_name)}</strong><span>${titleCase(item.attendance)} · ${formatDate(item.created_at)}</span></div>${statusPill(item.verification_status)}</div>`).join('') : '<p class="muted">No RSVP responses yet.</p>'}</article></section></div>`;
};

renderAdmin = function() {
  if (!configured) return `<main class="content-page admin-page"><div class="page-heading"><p class="eyebrow">Setup needed</p><h2>Connect Supabase</h2><p>Open <strong>config.js</strong> and add your Supabase project URL and publishable key.</p></div></main>`;
  if (passwordRecoveryV070 && session) {
    return `<main class="content-page admin-page"><div class="page-heading"><p class="eyebrow">Admin account</p><h2>Choose a new password</h2><p>Enter the new password you want to use for the Wedding Command Center.</p></div>
      <form class="login-card" onsubmit="saveRecoveredPasswordV070(event)"><label class="field"><span>New password</span><input type="password" name="password" minlength="8" required autocomplete="new-password"></label><label class="field"><span>Confirm new password</span><input type="password" name="confirm_password" minlength="8" required autocomplete="new-password"></label><div id="login-message"></div><button class="primary" type="submit">Save New Password</button></form></main>`;
  }
  if (!session) {
    return `<main class="content-page admin-page"><div class="page-heading"><p class="eyebrow">Private area</p><h2>Wedding Command Center</h2><p>Approved administrators only.</p></div>
      <form class="login-card" onsubmit="adminLogin(event)">${field('Email','email',true)}<label class="field"><span>Password</span><input type="password" name="password" required autocomplete="current-password"></label><div id="login-message"></div><button class="primary" type="submit">Sign In</button><button class="login-link-button" type="button" onclick="forgotAdminPasswordV070()">Forgot password?</button></form></main>`;
  }
  const views = ['dashboard','review','invitations','guests','jobs','registry','photos','summary','settings'];
  return `<main class="command-layout"><aside class="command-sidebar"><div class="sidebar-wedding"><span>Wedding date</span><strong>${esc(weddingDateShortV070())}</strong></div>
    ${sidebarButton('dashboard','⌂','Dashboard')}${sidebarButton('review','✉','RSVP Review',needsReview().length)}${sidebarButton('invitations','👥','Invite List')}${sidebarButton('guests','♙','Guest Profiles')}${sidebarButton('jobs','✓','Wedding Jobs')}${sidebarButton('registry','🎁','Registry')}${sidebarButton('photos','▧','Photos')}${sidebarButton('summary','▤','Wedding Summary')}${sidebarButton('settings','⚙','Settings')}<button class="sidebar-signout" onclick="adminLogout()">Sign out</button></aside>
    <section class="command-main"><div class="command-mobile-nav"><label>Command Center<select onchange="setAdminView(this.value)">${views.map(view => `<option value="${view}" ${view === adminView ? 'selected' : ''}>${view === 'guests' ? 'Guest Profiles' : titleCase(view)}</option>`).join('')}</select></label></div>${loadingAdmin ? '<div class="loading-card">Loading wedding information…</div>' : renderAdminView()}</section></main>`;
};

const baseRenderAdminViewV070 = renderAdminView;
renderAdminView = function() {
  if (adminView === 'settings') return renderSettingsV070();
  return baseRenderAdminViewV070();
};

function renderSettingsV070() {
  const s = adminData.settings || {};
  const adminRows = (adminData.adminUsers || []).map(row => {
    const details = adminUserDetailsV070.find(x => x.user_id === row.user_id) || {};
    const isMe = row.user_id === session?.user?.id;
    return `<div class="admin-user-row"><div><strong>${esc(row.display_name || details.email || 'Administrator')}</strong><span>${esc(details.email || (isMe ? session.user.email : 'Email available after admin service is deployed'))}</span>${isMe ? '<small>You</small>' : ''}</div><div class="admin-user-actions">${details.email ? `<button onclick="sendAdminResetV070('${esc(row.user_id)}')">Send Password Reset</button>` : ''}${!isMe ? `<button class="danger-text" onclick="removeAdminV070('${esc(row.user_id)}')">Remove</button>` : ''}</div></div>`;
  }).join('');
  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Website controls</p><h1>Settings</h1><p>Change the information and sections guests see without editing the website files.</p></div><button class="secondary" onclick="previewGuestSiteV070()">Open Guest Site</button></div>
    <form onsubmit="saveSettingsV070(event)" class="settings-stack">
      <section class="admin-panel settings-section"><div class="panel-heading"><div><h2>Wedding & Welcome</h2><p class="muted">These values update the public site and private countdown.</p></div></div><div class="form-grid">
        <label class="field"><span>First name</span><input name="partner_one_name" required value="${esc(s.partner_one_name || 'Jordan')}"></label><label class="field"><span>Second name</span><input name="partner_two_name" required value="${esc(s.partner_two_name || 'Rochelle')}"></label>
        <label class="field"><span>Wedding date</span><input type="date" name="wedding_date" required value="${esc(String(s.wedding_date || '2026-11-14').slice(0,10))}"></label><label class="field"><span>Ceremony time</span><input type="time" name="ceremony_time" required value="${esc(String(s.ceremony_time || '10:00:00').slice(0,5))}"></label>
        <label class="field"><span>Venue name</span><input name="venue_name" value="${esc(s.venue_name || '4-H Building')}"></label><label class="field"><span>Venue street address / description</span><input name="venue_address" value="${esc(s.venue_address || '')}"></label>
        <label class="field"><span>City</span><input name="venue_city" value="${esc(s.venue_city || 'Milbank')}"></label><label class="field"><span>State</span><input name="venue_state" value="${esc(s.venue_state || 'South Dakota')}"></label>
        <label class="field wide"><span>Homepage heading</span><input name="welcome_heading" value="${esc(s.welcome_heading || 'Celebrate with us')}"></label><label class="field wide"><span>Homepage welcome message</span><textarea name="welcome_message" rows="4">${esc(s.welcome_message || 'We are excited to celebrate our wedding with our family and friends. Please RSVP and find the details for our special day below.')}</textarea></label>
      </div></section>
      <section class="admin-panel settings-section"><div class="panel-heading"><div><h2>Wedding Details Page</h2><p class="muted">Directions and information shown to guests.</p></div></div><div class="form-grid">
        <label class="field wide"><span>Map search</span><input name="map_query" value="${esc(s.map_query || '4-H Building Milbank South Dakota')}"><small>Usually the venue name plus city and state works best.</small></label>
        <label class="field wide"><span>Wedding day information</span><textarea name="details_text" rows="6">${esc(s.details_text || '')}</textarea></label><label class="field wide"><span>Parking & directions</span><textarea name="parking_text" rows="4">${esc(s.parking_text || '')}</textarea></label>
      </div></section>
      <section class="admin-panel settings-section"><div class="panel-heading"><div><h2>Guest Site Controls</h2><p class="muted">Turn guest-facing sections on or off.</p></div></div><div class="settings-toggle-grid">
        ${toggleSettingV070('rsvp_open','RSVPs open','Guests can submit new RSVPs.', s.rsvp_open !== false)}${toggleSettingV070('registry_visible','Gift Registry visible','Show Gift Registry in the guest menu and homepage.', s.registry_visible !== false)}${toggleSettingV070('guest_album_visible','Photo Album visible','Show the selected guest photo album.', s.guest_album_visible !== false)}
      </div><label class="field wide settings-closed-message"><span>Message shown when RSVPs are closed</span><input name="rsvp_closed_message" value="${esc(s.rsvp_closed_message || 'Please contact Jordan or Rochelle if you need to make or change an RSVP.')}"></label></section>
      <section class="admin-panel settings-section"><div class="panel-heading"><div><h2>Registry Links</h2><p class="muted">External registries plus your own imported gift list.</p></div></div><div class="form-grid"><label class="field wide"><span>Amazon Wedding Registry URL</span><input type="url" name="amazon_registry_url" value="${esc(s.amazon_registry_url || '')}" placeholder="Paste your Amazon registry link"></label><label class="field wide"><span>Other registry URL</span><input type="url" name="other_registry_url" value="${esc(s.other_registry_url || '')}" placeholder="Optional second registry"></label></div></section>
      <div class="settings-save-bar"><button class="primary" type="submit">Save Settings</button><span>Changes appear on the guest site after saving.</span></div>
    </form>
    <section class="admin-panel settings-section admin-users-section"><div class="panel-heading"><div><h2>Command Center Administrators</h2><p class="muted">Administrators sign in separately and never appear on the public website.</p></div><button class="primary" onclick="openAddAdminV070()">Add Administrator</button></div>
      ${adminUsersLoadingV070 ? '<div class="loading-card">Loading administrator emails…</div>' : `<div class="admin-users-list">${adminRows || '<p class="muted">No administrators found.</p>'}</div>`}
      <p class="settings-security-note">Passwords are handled by Supabase Auth. They are never stored in the wedding website files.</p></section>
  </div>`;
}

function toggleSettingV070(name, title, description, checked) {
  return `<label class="settings-toggle"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span class="toggle-switch"></span><span><strong>${esc(title)}</strong><small>${esc(description)}</small></span></label>`;
}

async function saveSettingsV070(event) {
  event.preventDefault();
  const button = event.submitter || event.target.querySelector('[type=submit]');
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  const f = new FormData(event.target);
  const dateValue = String(f.get('wedding_date') || '2026-11-14');
  const timeValue = String(f.get('ceremony_time') || '10:00');
  const displayDate = new Date(`${dateValue}T12:00:00`);
  const displayTime = new Date(`${dateValue}T${timeValue}:00`);
  const row = {
    id:1,
    partner_one_name:String(f.get('partner_one_name') || '').trim(), partner_two_name:String(f.get('partner_two_name') || '').trim(),
    wedding_date:dateValue, ceremony_time:timeValue,
    wedding_date_label:new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(displayDate),
    ceremony_time_label:`The ceremony begins at ${new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(displayTime)}.`,
    venue_name:String(f.get('venue_name') || '').trim() || null, venue_address:String(f.get('venue_address') || '').trim() || null,
    venue_city:String(f.get('venue_city') || '').trim() || null, venue_state:String(f.get('venue_state') || '').trim() || null,
    welcome_heading:String(f.get('welcome_heading') || '').trim() || null, welcome_message:String(f.get('welcome_message') || '').trim() || null,
    map_query:String(f.get('map_query') || '').trim() || null, details_text:String(f.get('details_text') || '').trim() || null, parking_text:String(f.get('parking_text') || '').trim() || null,
    rsvp_open:f.get('rsvp_open') === 'on', registry_visible:f.get('registry_visible') === 'on', guest_album_visible:f.get('guest_album_visible') === 'on',
    rsvp_closed_message:String(f.get('rsvp_closed_message') || '').trim() || null,
    amazon_registry_url:String(f.get('amazon_registry_url') || '').trim() || null, other_registry_url:String(f.get('other_registry_url') || '').trim() || null,
    updated_at:new Date().toISOString()
  };
  const { error } = await db.from('wedding_settings').upsert(row);
  if (button) { button.disabled = false; button.textContent = 'Save Settings'; }
  if (error) return toast(error.message, 'error');
  adminData.settings = row; publicWeddingSettings = row; toast('Settings saved.'); render();
}

function previewGuestSiteV070() { window.open('/', '_blank', 'noopener'); }

const baseSetAdminViewV070 = setAdminView;
setAdminView = function(next) {
  adminView = next; render();
  if (next === 'settings') refreshAdminUsersV070();
};

const baseLoadAdminV070 = loadAdmin;
loadAdmin = async function() {
  await baseLoadAdminV070();
  if (!db || !session) return;
  const [settingsResult, adminsResult] = await Promise.all([
    db.from('wedding_settings').select('*').eq('id',1).maybeSingle(),
    db.from('admin_users').select('*').order('created_at',{ascending:true})
  ]);
  if (!settingsResult.error) { adminData.settings = settingsResult.data || {}; publicWeddingSettings = settingsResult.data || {}; }
  if (!adminsResult.error) adminData.adminUsers = adminsResult.data || [];
  render();
  if (adminView === 'settings') refreshAdminUsersV070();
};

async function refreshAdminUsersV070() {
  if (!session || adminUsersLoadingV070) return;
  adminUsersLoadingV070 = true; render();
  try {
    const { data, error } = await db.functions.invoke('manage-admin-users', { body:{ action:'list' } });
    if (error) throw error;
    adminUserDetailsV070 = data?.admins || [];
  } catch (error) {
    console.warn('Administrator email service is not deployed yet.', error);
    adminUserDetailsV070 = [];
  }
  adminUsersLoadingV070 = false; render();
}

function openAddAdminV070() {
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card" onsubmit="inviteAdminV070(event)"><div class="modal-heading"><h2>Add Administrator</h2><button type="button" onclick="closeModal()">×</button></div><div class="form-grid">
    <label class="field wide"><span>Name</span><input name="display_name" required placeholder="Example: Rochelle"></label><label class="field wide"><span>Email</span><input type="email" name="email" required placeholder="name@example.com"></label></div><p class="muted">They will receive a secure email link to choose their Command Center password.</p><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Send Admin Invite</button></div></form></div>`);
}

async function inviteAdminV070(event) {
  event.preventDefault(); const f = new FormData(event.target); const button = event.submitter; if (button) button.disabled = true;
  const { data, error } = await db.functions.invoke('manage-admin-users',{body:{action:'invite', email:String(f.get('email')).trim(), display_name:String(f.get('display_name')).trim()}});
  if (button) button.disabled = false;
  if (error || data?.error) return toast(data?.error || error?.message || 'Could not add administrator.', 'error');
  closeModal(); toast('Administrator added and password link sent.'); await loadAdmin();
}

async function removeAdminV070(userId) {
  if (!confirm('Remove this administrator from the Wedding Command Center? Their Supabase Auth account will not be deleted.')) return;
  const { data, error } = await db.functions.invoke('manage-admin-users',{body:{action:'remove', user_id:userId}});
  if (error || data?.error) return toast(data?.error || error?.message || 'Could not remove administrator.','error');
  toast('Administrator removed.'); await loadAdmin();
}

async function sendAdminResetV070(userId) {
  if (!confirm('Send this administrator a secure password-reset email?')) return;
  const { data, error } = await db.functions.invoke('manage-admin-users',{body:{action:'reset', user_id:userId}});
  if (error || data?.error) return toast(data?.error || error?.message || 'Could not send password reset.','error');
  toast('Password reset email sent.');
}

async function forgotAdminPasswordV070() {
  const email = prompt('Enter your Command Center email address:');
  if (!email) return;
  const redirectTo = `${window.location.origin}/command-center.html?reset-password=1`;
  const { error } = await db.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) return toast(error.message,'error');
  toast('Password reset email sent. Check your inbox.');
}

async function saveRecoveredPasswordV070(event) {
  event.preventDefault(); const f = new FormData(event.target); const password = String(f.get('password') || ''); const confirmPassword = String(f.get('confirm_password') || ''); const message = document.getElementById('login-message');
  if (password !== confirmPassword) { message.innerHTML = '<p class="error">The passwords do not match.</p>'; return; }
  const { error } = await db.auth.updateUser({ password });
  if (error) { message.innerHTML = `<p class="error">${esc(error.message)}</p>`; return; }
  passwordRecoveryV070 = false; toast('Password updated.'); await loadAdmin();
}

if (db) {
  db.auth.onAuthStateChange((event, newSession) => {
    if (event === 'PASSWORD_RECOVERY') { passwordRecoveryV070 = true; session = newSession; render(); }
  });
}

// Re-render once v0.7.0 overrides are installed.
render();
if (isAdminPortal && session) loadAdmin();


/* ===== v0.7.1 RSVP merge + reviewed queue + claim-a-gift registry ===== */

let reviewModeV071 = 'pending';

function rsvpPeopleV071(rsvpId) {
  return (adminData.rsvpPeople || [])
    .filter(p => p.rsvp_id === rsvpId)
    .sort((a,b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function reviewedRsvpsV071() {
  return (adminData.rsvps || []).filter(r => r.verification_status !== 'needs_review');
}

function setReviewModeV071(mode) {
  reviewModeV071 = mode === 'reviewed' ? 'reviewed' : 'pending';
  selectedReviewId = null;
  reviewSearch = '';
  render();
}

function reviewMatchesV071(item, query) {
  const invitation = item.invitation_id ? adminData.invitations.find(i => i.id === item.invitation_id) : null;
  const people = rsvpPeopleV071(item.id).map(p => p.person_name).join(' ');
  return [
    item.first_name, item.last_name, item.phone, item.email, item.city,
    item.additional_guests, invitation?.household_name, people
  ].some(value => String(value || '').toLowerCase().includes(query));
}

function renderReviewV071() {
  const pending = needsReview();
  const reviewed = reviewedRsvpsV071();
  const source = reviewModeV071 === 'reviewed' ? reviewed : pending;
  const query = reviewSearch.trim().toLowerCase();
  const filtered = query ? source.filter(item => reviewMatchesV071(item, query)) : source;

  if (!selectedReviewId || !filtered.some(item => item.id === selectedReviewId)) {
    selectedReviewId = filtered[0]?.id || null;
  }
  const selected = filtered.find(item => item.id === selectedReviewId);

  const tabs = `<div class="review-tabs-v071">
    <button class="${reviewModeV071 === 'pending' ? 'active' : ''}" onclick="setReviewModeV071('pending')">Needs Review <span>${pending.length}</span></button>
    <button class="${reviewModeV071 === 'reviewed' ? 'active' : ''}" onclick="setReviewModeV071('reviewed')">Reviewed RSVPs <span>${reviewed.length}</span></button>
  </div>`;

  let body = '';
  if (!source.length && reviewModeV071 === 'pending') {
    body = `<div class="empty-state admin-empty"><div class="big-icon">✓</div><h2>All caught up</h2>
      <p>There are no new RSVP submissions waiting for approval.</p>
      <button class="primary" onclick="setReviewModeV071('reviewed')">View Reviewed RSVPs</button></div>`;
  } else if (!source.length) {
    body = `<div class="empty-state admin-empty"><h2>No reviewed RSVPs yet</h2><button class="secondary" onclick="setReviewModeV071('pending')">Back to Needs Review</button></div>`;
  } else {
    body = `<div class="review-toolbar"><input type="search" value="${esc(reviewSearch)}" placeholder="Search ${reviewModeV071 === 'pending' ? 'new' : 'reviewed'} RSVPs" oninput="setReviewSearch(this.value)">
      <span>${filtered.length} of ${source.length}</span></div>
      <div class="review-split">
        <aside class="review-queue">${filtered.length ? filtered.map(item => {
          const invitation = item.invitation_id ? adminData.invitations.find(i => i.id === item.invitation_id) : null;
          return `<button class="queue-item ${item.id === selectedReviewId ? 'active' : ''}" onclick="selectReview('${item.id}')">
            <strong>${esc(item.first_name)} ${esc(item.last_name)}</strong>
            <span>${titleCase(item.attendance)} · ${formatDate(item.created_at)}</span>
            ${reviewModeV071 === 'reviewed' ? `<small>${esc(invitation?.household_name || titleCase(item.verification_status))}</small>` : ''}
          </button>`;
        }).join('') : '<p class="muted queue-empty">No matching RSVPs.</p>'}</aside>
        <section class="review-detail">${selected ? renderReviewDetailV071(selected) : '<div class="empty-state admin-empty"><h2>No response selected</h2></div>'}</section>
      </div>`;
  }

  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Guest responses</p><h1>RSVP Review</h1>
    <p>New submissions stay separate from RSVPs you have already reviewed.</p></div></div>${tabs}${body}</div>`;
}

function renderReviewDetailV071(rsvp) {
  const invitation = rsvp.invitation_id ? adminData.invitations.find(i => i.id === rsvp.invitation_id) : null;
  const people = rsvpPeopleV071(rsvp.id);
  const peopleHtml = people.length
    ? `<div class="review-people-v071">${people.map(p => `<div><strong>${esc(p.person_name)}</strong><span>${titleCase(p.person_type)}</span></div>`).join('')}</div>`
    : `<p class="muted">${esc(rsvp.additional_guests || 'No additional named guests stored.')}</p>`;

  const mergeButton = rsvp.verification_status !== 'rejected'
    ? `<button class="primary" onclick="openMergeRsvpDialogV071('${rsvp.id}')">${invitation ? 'Change / Merge Household' : 'Merge with Invitation'}</button>`
    : '';

  return `<article class="review-card review-card-detail">
    <div class="review-card-top"><div><h2>${esc(rsvp.first_name)} ${esc(rsvp.last_name)}</h2><p>${titleCase(rsvp.attendance)} · Submitted ${formatDate(rsvp.created_at)}</p></div>${statusPill(rsvp.verification_status)}</div>
    ${invitation ? `<div class="linked-household-v071"><span>Linked household</span><strong>${esc(invitation.household_name)}</strong></div>` : ''}
    <div class="review-details">
      <div><span>Address</span><strong>${esc(rsvp.street_address || '—')}<br>${esc([rsvp.city, rsvp.state, rsvp.zip_code].filter(Boolean).join(', '))}</strong></div>
      <div><span>Contact</span><strong>${esc(rsvp.phone || '—')}${rsvp.email ? `<br>${esc(rsvp.email)}` : ''}</strong></div>
      <div><span>Party</span><strong>${rsvp.adult_count} adult${rsvp.adult_count === 1 ? '' : 's'}, ${rsvp.child_count} child${rsvp.child_count === 1 ? '' : 'ren'}</strong></div>
      <div><span>Review status</span><strong>${titleCase(rsvp.verification_status)}</strong></div>
    </div>
    <section class="profile-section"><h3>Everyone on this RSVP</h3>${peopleHtml}</section>
    ${rsvp.notes ? `<div class="review-notes"><span>Notes</span><p>${esc(rsvp.notes)}</p></div>` : ''}
    <div class="review-actions">${mergeButton}<button class="secondary" onclick="openRsvpDialog('${rsvp.id}')">Edit RSVP</button>
      ${rsvp.verification_status === 'needs_review' ? `<button class="secondary" onclick="verifyRsvp('${rsvp.id}')">Verify Without Match</button><button class="secondary" onclick="createInvitationFromRsvp('${rsvp.id}')">Create Invitation</button><button class="danger-button" onclick="rejectRsvp('${rsvp.id}')">Reject</button>` : ''}
    </div>
  </article>`;
}

function mergeRsvpPreviewHtmlV071(rsvp, invitation) {
  if (!invitation) return '<p class="muted">Choose an invitation to compare the records.</p>';
  const people = rsvpPeopleV071(rsvp.id);
  const rsvpNames = people.length ? people.map(p => p.person_name).join(', ') : `${rsvp.first_name} ${rsvp.last_name}`;
  return `<div class="merge-compare-v071">
    <section><p class="eyebrow">RSVP submission</p><h3>${esc(rsvp.first_name)} ${esc(rsvp.last_name)}</h3>
      <dl><dt>People</dt><dd>${esc(rsvpNames)}</dd><dt>Phone</dt><dd>${esc(rsvp.phone || '—')}</dd><dt>Email</dt><dd>${esc(rsvp.email || '—')}</dd>
      <dt>Address</dt><dd>${esc([rsvp.street_address, rsvp.city, rsvp.state, rsvp.zip_code].filter(Boolean).join(', ') || '—')}</dd></dl>
    </section>
    <div class="merge-arrow-v071">→</div>
    <section><p class="eyebrow">Invitation household kept</p><h3>${esc(invitation.household_name)}</h3>
      <dl><dt>Main name</dt><dd>${esc(invitation.primary_first_name)} ${esc(invitation.primary_last_name)}</dd><dt>Phone</dt><dd>${esc(invitation.phone || '—')}</dd><dt>Email</dt><dd>${esc(invitation.email || '—')}</dd>
      <dt>Address</dt><dd>${esc([invitation.street_address, invitation.city, invitation.state, invitation.zip_code].filter(Boolean).join(', ') || '—')}</dd></dl>
    </section>
  </div>`;
}

function openMergeRsvpDialogV071(rsvpId) {
  const rsvp = adminData.rsvps.find(r => r.id === rsvpId);
  if (!rsvp) return;
  const choices = suggestedInvitations(rsvp);
  const initialId = rsvp.invitation_id || choices[0]?.id || '';
  const initial = adminData.invitations.find(i => i.id === initialId);
  const options = choices.map(i => `<option value="${i.id}" ${i.id === initialId ? 'selected' : ''}>${esc(i.household_name)} — ${esc(i.primary_first_name)} ${esc(i.primary_last_name)}</option>`).join('');

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card modal-wide-v071" onsubmit="saveMergeRsvpV071(event,'${rsvp.id}')">
    <div class="modal-heading"><div><p class="eyebrow">Merge household</p><h2>Connect RSVP to Invitation</h2></div><button type="button" onclick="closeModal()">×</button></div>
    <label class="field wide"><span>Invitation household</span><select name="invitation_id" required onchange="updateMergeRsvpPreviewV071('${rsvp.id}',this.value)"><option value="">Choose a household…</option>${options}</select></label>
    <div id="merge-rsvp-preview-v071">${mergeRsvpPreviewHtmlV071(rsvp, initial)}</div>
    <fieldset class="merge-choice-v071"><legend>Contact information on the invitation</legend>
      <label><input type="radio" name="contact_source" value="rsvp" checked><span><strong>Use the RSVP contact details</strong><small>Recommended when the RSVP has the newest phone, email, or address. Blank RSVP fields will not erase existing information.</small></span></label>
      <label><input type="radio" name="contact_source" value="invitation"><span><strong>Keep the invitation contact details</strong><small>The RSVP stays attached, but the existing invitation contact information remains the household contact.</small></span></label>
    </fieldset>
    <p class="merge-note-v071">The invitation household and main name stay intact. All named adults/children and wedding-job assignments stay connected to the RSVP.</p>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Merge & Verify</button></div>
  </form></div>`);
}

function updateMergeRsvpPreviewV071(rsvpId, invitationId) {
  const rsvp = adminData.rsvps.find(r => r.id === rsvpId);
  const invitation = adminData.invitations.find(i => i.id === invitationId);
  const target = document.getElementById('merge-rsvp-preview-v071');
  if (target && rsvp) target.innerHTML = mergeRsvpPreviewHtmlV071(rsvp, invitation);
}

async function saveMergeRsvpV071(event, rsvpId) {
  event.preventDefault();
  const f = new FormData(event.target);
  const invitationId = String(f.get('invitation_id') || '');
  if (!invitationId) return toast('Choose an invitation household.', 'error');
  const button = event.submitter;
  if (button) button.disabled = true;
  const { data, error } = await db.rpc('merge_rsvp_into_invitation', {
    p_rsvp_id: rsvpId,
    p_invitation_id: invitationId,
    p_contact_source: String(f.get('contact_source') || 'rsvp')
  });
  if (error) {
    if (button) button.disabled = false;
    return toast(error.message, 'error');
  }
  closeModal();
  toast('RSVP merged into the invitation household.');
  await loadAdmin();
}

const invitationTableBeforeV071 = invitationTable;
invitationTable = function(items) {
  if (!items.length) return '<p class="muted">No invitations found.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Household</th><th>Primary contact</th><th>Contact</th><th>Allowed</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${items.map(item => `<tr><td><strong>${esc(item.household_name)}</strong><br><small>${esc([item.city,item.state].filter(Boolean).join(', '))}</small></td>
      <td>${esc(item.primary_first_name)} ${esc(item.primary_last_name)}</td><td>${esc(item.phone || item.email || '—')}</td><td>${item.max_guests}</td><td>${statusPill(item.status)}</td>
      <td><div class="table-actions"><button onclick="openInvitationDialog('${item.id}')">Edit</button><button onclick="openMergeInvitationDialogV071('${item.id}')">Merge Duplicate</button><button class="danger-text" onclick="deleteInvitation('${item.id}')">Delete</button></div></td></tr>`).join('')}
  </tbody></table></div>`;
};

function mergeInvitationPreviewV071(source, target) {
  if (!target) return '<p class="muted">Choose the household you want to keep.</p>';
  const linkedRsvps = (adminData.rsvps || []).filter(r => r.invitation_id === source.id);
  return `<div class="merge-compare-v071">
    <section class="merge-source-v071"><p class="eyebrow">Will be merged & removed</p><h3>${esc(source.household_name)}</h3><p>${linkedRsvps.length} linked RSVP${linkedRsvps.length === 1 ? '' : 's'}</p>
      <small>${esc(source.phone || source.email || 'No contact info')}</small></section>
    <div class="merge-arrow-v071">→</div>
    <section><p class="eyebrow">Household kept</p><h3>${esc(target.household_name)}</h3><p>${esc(target.primary_first_name)} ${esc(target.primary_last_name)}</p>
      <small>${esc(target.phone || target.email || 'No contact info')}</small></section>
  </div>`;
}

function openMergeInvitationDialogV071(sourceId) {
  const source = adminData.invitations.find(i => i.id === sourceId);
  if (!source) return;
  const targets = adminData.invitations.filter(i => i.id !== sourceId);
  if (!targets.length) return toast('There is no other invitation to merge this household into.', 'error');
  const initial = targets[0];
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card modal-wide-v071" onsubmit="saveMergeInvitationV071(event,'${source.id}')">
    <div class="modal-heading"><div><p class="eyebrow">Duplicate cleanup</p><h2>Merge Invitations</h2></div><button type="button" onclick="closeModal()">×</button></div>
    <label class="field wide"><span>Keep this household</span><select name="target_id" required onchange="updateMergeInvitationPreviewV071('${source.id}',this.value)">
      ${targets.map(i => `<option value="${i.id}">${esc(i.household_name)} — ${esc(i.primary_first_name)} ${esc(i.primary_last_name)}</option>`).join('')}</select></label>
    <div id="merge-invitation-preview-v071">${mergeInvitationPreviewV071(source, initial)}</div>
    <fieldset class="merge-choice-v071"><legend>Contact details</legend>
      <label><input type="radio" name="contact_source" value="target" checked><span><strong>Keep the household I selected</strong><small>Any blank contact fields will be filled from the duplicate when possible.</small></span></label>
      <label><input type="radio" name="contact_source" value="source"><span><strong>Use contact details from the duplicate</strong><small>The selected household name/main person still stays the same.</small></span></label>
    </fieldset>
    <p class="merge-note-v071"><strong>This removes the duplicate invitation.</strong> Its RSVPs and job assignments will be moved to the household you keep.</p>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Merge Invitations</button></div>
  </form></div>`);
}

function updateMergeInvitationPreviewV071(sourceId, targetId) {
  const source = adminData.invitations.find(i => i.id === sourceId);
  const targetInv = adminData.invitations.find(i => i.id === targetId);
  const target = document.getElementById('merge-invitation-preview-v071');
  if (target && source) target.innerHTML = mergeInvitationPreviewV071(source, targetInv);
}

async function saveMergeInvitationV071(event, sourceId) {
  event.preventDefault();
  const f = new FormData(event.target);
  const targetId = String(f.get('target_id') || '');
  if (!targetId) return;
  if (!confirm('Merge these invitations? The duplicate household will be removed after its RSVPs and jobs are moved.')) return;
  const button = event.submitter;
  if (button) button.disabled = true;
  const { error } = await db.rpc('merge_invitations', {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_contact_source: String(f.get('contact_source') || 'target')
  });
  if (error) {
    if (button) button.disabled = false;
    return toast(error.message, 'error');
  }
  closeModal();
  toast('Duplicate invitations merged.');
  await loadAdmin();
}

/* ----- Claim-a-gift public registry ----- */

function currentRegistryClaimV071(itemId) {
  return (adminData.registryClaims || []).find(c => c.registry_item_id === itemId && !c.released_at) || null;
}

function renderPublicRegistryItemV071(item) {
  const imageUrl = safeUrl(item.image_url);
  const exampleUrl = safeUrl(item.item_url);
  const claimed = Boolean(item.claimed_at);
  return `<article class="public-registry-card registry-claim-card-v071 ${claimed ? 'claimed' : 'available'}">
    ${imageUrl ? `<div class="registry-image-wrap"><img src="${esc(imageUrl)}" alt="${esc(item.title)}" loading="lazy" onerror="this.parentElement.classList.add('image-failed');this.remove()"></div>` : `<div class="registry-image-wrap registry-image-placeholder">🎁</div>`}
    <div class="public-registry-copy">
      <div class="registry-card-status-v071">${claimed ? '<span class="gift-claimed-v071">Claimed</span>' : '<span class="gift-available-v071">Available</span>'}</div>
      ${item.store_name ? `<p class="registry-store">Suggested: ${esc(item.store_name)}</p>` : ''}
      <h3>${esc(item.title)}</h3>
      ${item.description ? `<p>${esc(item.description)}</p>` : ''}
      ${claimed
        ? `<div class="claimed-message-v071"><strong>Someone has this one covered.</strong><span>Thank you!</span></div>`
        : `<button class="primary" onclick="openGiftClaimV071('${item.id}')">I'll Take This Gift</button>`}
      ${exampleUrl ? `<a class="registry-example-link-v071" href="${esc(exampleUrl)}" target="_blank" rel="noopener">View example / idea ↗</a>` : ''}
    </div>
  </article>`;
}

renderRegistry = function() {
  if (!booleanSettingV070('registry_visible', true)) {
    return `<main class="content-page">${mainMenuButton()}<div class="empty-state"><div class="big-icon">🎁</div><h2>Gift Registry</h2><p>The registry is not currently being shown on our wedding website.</p></div></main>`;
  }
  const s = settingsV070();
  const amazonRaw = String(s.amazon_registry_url || '').trim();
  const otherRaw = String(s.other_registry_url || '').trim();
  const amazon = amazonRaw ? safeUrl(amazonRaw) : '';
  const other = otherRaw ? safeUrl(otherRaw) : '';

  let body = '';
  if (amazon || other) {
    body += `<div class="registry-link-row">
      ${amazon ? `<a class="primary" target="_blank" rel="noopener" href="${esc(amazon)}">View Our Amazon Registry</a>` : ''}
      ${other ? `<a class="secondary registry-external" target="_blank" rel="noopener" href="${esc(other)}">View Other Registry</a>` : ''}
    </div>`;
  }

  if (publicRegistryLoading) body += `<div class="loading-card">Loading our gift list…</div>`;
  else if (publicRegistryError) body += `<div class="error-card"><h3>We couldn't load the gift list.</h3><button class="primary" onclick="loadPublicRegistry()">Try Again</button></div>`;
  else if (publicRegistry.length) body += `<section class="gift-list-intro-v071"><h3>Gifts You Can Choose</h3><p>Choose an available gift, then buy it wherever you prefer. No account or password is needed.</p></section><div class="public-registry-grid">${publicRegistry.map(renderPublicRegistryItemV071).join('')}</div>`;
  else body += `<div class="empty-state"><div class="big-icon">🎁</div><h3>Gift list coming soon</h3><p>Gift ideas will appear here.</p></div>`;

  return `<main class="content-page">${mainMenuButton()}<div class="page-heading"><p class="eyebrow">With gratitude</p><h2>Gift Registry</h2><p>Your presence means so much to us. Gifts are optional.</p></div>${body}</main>`;
};

function openGiftClaimV071(itemId) {
  const item = publicRegistry.find(i => i.id === itemId);
  if (!item || item.claimed_at) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop guest-claim-modal-v071" id="modal"><form class="modal-card" onsubmit="saveGiftClaimV071(event,'${item.id}')">
    <div class="modal-heading"><div><p class="eyebrow">Claim a gift</p><h2>${esc(item.title)}</h2></div><button type="button" onclick="closeModal()">×</button></div>
    <p>We'll mark this gift as claimed so another guest doesn't choose the same one. You can buy it wherever you like.</p>
    <div class="form-grid">
      <label class="field wide"><span>Your name</span><input name="claimant_name" required maxlength="120" autocomplete="name" placeholder="Your name"></label>
      <label class="field wide"><span>Email (optional)</span><input type="email" name="claimant_email" maxlength="254" autocomplete="email" placeholder="For a confirmation and release link"></label>
    </div>
    <p class="muted">Your name and email are private and only visible to Jordan and Rochelle. Other guests will only see that the gift is claimed.</p>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">I'll Take It</button></div>
  </form></div>`);
}

async function saveGiftClaimV071(event, itemId) {
  event.preventDefault();
  const f = new FormData(event.target);
  const name = String(f.get('claimant_name') || '').trim();
  const email = String(f.get('claimant_email') || '').trim() || null;
  const button = event.submitter;
  if (!name) return;
  if (button) { button.disabled = true; button.textContent = 'Claiming…'; }

  const { data, error } = await db.rpc('claim_registry_item', {
    p_item_id: itemId,
    p_name: name,
    p_email: email
  });
  const result = Array.isArray(data) ? data[0] : data;
  if (error || !result?.success) {
    if (button) { button.disabled = false; button.textContent = "I'll Take It"; }
    const message = error?.message || result?.message || 'This gift could not be claimed.';
    if (/already/i.test(message)) {
      const item = publicRegistry.find(i => i.id === itemId);
      if (item) item.claimed_at = new Date().toISOString();
      closeModal(); render();
    }
    return toast(message, 'error');
  }

  const item = publicRegistry.find(i => i.id === itemId);
  if (item) item.claimed_at = new Date().toISOString();

  let emailMessage = '';
  if (email && result.claim_token) {
    try {
      const { error: emailError } = await db.functions.invoke('send-gift-claim-confirmation', {
        body: { claim_token: result.claim_token }
      });
      emailMessage = emailError
        ? '<p class="muted">The gift is claimed, but the confirmation email could not be sent. Contact Jordan or Rochelle if you need to release it.</p>'
        : `<p>We sent a confirmation to <strong>${esc(email)}</strong> with a private link you can use if you change your mind.</p>`;
    } catch {
      emailMessage = '<p class="muted">The gift is claimed, but the confirmation email could not be sent. Contact Jordan or Rochelle if you need to release it.</p>';
    }
  } else {
    emailMessage = '<p>If you change your mind, contact Jordan or Rochelle and they can make the gift available again.</p>';
  }

  const modal = document.getElementById('modal');
  if (modal) modal.innerHTML = `<div class="modal-card gift-claim-success-v071"><div class="big-icon">♥</div><h2>Thank you, ${esc(name)}!</h2>
    <p><strong>${esc(result.gift_title || item?.title || 'This gift')}</strong> is now marked as claimed.</p>${emailMessage}
    <button class="primary" onclick="closeModal();render()">Done</button></div>`;
}

/* ----- Registry manager claim status ----- */

function renderRegistryManagerV071() {
  const all = registryItemsSorted();
  const query = registrySearch.trim().toLowerCase();
  const filtered = query ? all.filter(item => [item.title,item.description,item.store_name,item.item_url,currentRegistryClaimV071(item.id)?.claimant_name,currentRegistryClaimV071(item.id)?.claimant_email]
    .some(value => String(value || '').toLowerCase().includes(query))) : all;
  const claimedCount = all.filter(item => item.claimed_at).length;
  const availableCount = all.filter(item => item.is_active && !item.claimed_at).length;
  let selected = filtered.find(item => item.id === selectedRegistryId) || null;
  if (!selected && filtered.length) { selected = filtered[0]; selectedRegistryId = selected.id; }

  return `<div class="admin-view">
    <div class="view-heading"><div><p class="eyebrow">Gift choices</p><h1>Registry Manager</h1><p>Guests can claim a gift here and buy it wherever they prefer.</p></div>
      <div class="heading-actions"><button class="secondary" onclick="document.getElementById('gift-import').click()">Import Gift List</button><input id="gift-import" hidden type="file" accept=".xlsx,.xls,.csv" onchange="importGiftListV062(event)"><button class="primary" onclick="openRegistryDialog()">Add Gift</button></div></div>
    <section class="registry-metric-grid">${metricCard('Gift ideas', all.length, 'Total')}${metricCard('Available', availableCount, 'Ready to claim')}${metricCard('Claimed', claimedCount, 'Guests have chosen')}</section>
    <div class="registry-toolbar"><input id="registry-search" type="search" value="${esc(registrySearch)}" placeholder="Search gifts or guest claims" oninput="setRegistrySearch(this.value)"><span>${filtered.length} item${filtered.length === 1 ? '' : 's'}</span></div>
    <div class="registry-split">
      <aside class="registry-list">${filtered.length ? filtered.map(item => renderRegistryListItemV071(item, selected?.id === item.id)).join('') : '<p class="muted registry-empty">No matching gifts.</p>'}</aside>
      <section class="registry-detail">${selected ? renderRegistryDetailV071(selected, all) : `<div class="empty-state admin-empty"><div class="big-icon">🎁</div><h2>No gifts yet</h2><p>Add or import your first gift idea.</p><button class="primary" onclick="openRegistryDialog()">Add Gift</button></div>`}</section>
    </div>
    ${all.length ? `<section class="admin-panel registry-preview-panel"><div class="panel-heading"><div><h2>Guest preview</h2><p class="muted">Claimed gifts stay visible but cannot be claimed again.</p></div></div>
      <div class="registry-preview-grid">${all.filter(i => i.is_active).map(renderRegistryPreviewV071).join('') || '<p class="muted">No gifts are visible to guests.</p>'}</div></section>` : ''}
  </div>`;
}

function renderRegistryListItemV071(item, active) {
  const claim = currentRegistryClaimV071(item.id);
  const status = !item.is_active ? 'Hidden' : (item.claimed_at ? 'Claimed' : 'Available');
  const cls = !item.is_active ? 'hidden' : (item.claimed_at ? 'claimed' : 'visible');
  return `<button class="registry-list-item ${active ? 'active' : ''}" onclick="selectRegistryItem('${item.id}')">
    <span class="registry-list-copy"><strong>${esc(item.title)}</strong><small>${claim ? `Claimed by ${esc(claim.claimant_name)}` : esc(item.store_name || 'Buy anywhere')}</small></span>
    <span class="registry-visibility ${cls}">${status}</span></button>`;
}

function renderRegistryPreviewV071(item) {
  const image = safeUrl(item.image_url);
  return `<article class="registry-preview-card ${item.claimed_at ? 'claimed' : ''}">
    ${image ? `<img src="${esc(image)}" alt="${esc(item.title)}" loading="lazy">` : '<div class="registry-preview-placeholder">🎁</div>'}
    <div><strong>${esc(item.title)}</strong><span>${item.claimed_at ? 'Claimed' : 'Available'}</span></div></article>`;
}

function renderRegistryDetailV071(item, all) {
  const index = all.findIndex(entry => entry.id === item.id);
  const itemUrl = safeUrl(item.item_url);
  const imageUrl = safeUrl(item.image_url);
  const claim = currentRegistryClaimV071(item.id);
  return `<article class="registry-detail-card">
    <div class="registry-detail-header"><div><p class="eyebrow">Gift item</p><h2>${esc(item.title)}</h2>
      <div class="profile-pills"><span class="registry-visibility ${!item.is_active ? 'hidden' : (item.claimed_at ? 'claimed' : 'visible')}">${!item.is_active ? 'Hidden' : (item.claimed_at ? 'Claimed' : 'Available')}</span></div></div>
      <div class="profile-actions"><button class="secondary" onclick="openRegistryDialog('${item.id}')">Edit</button><button class="danger-button" onclick="deleteRegistryItem('${item.id}')">Delete</button></div></div>
    <div class="registry-detail-body"><div class="registry-detail-image">${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(item.title)}">` : '<div class="registry-large-placeholder">🎁</div>'}</div>
      <div><div class="profile-info-grid registry-info-grid">
        <div class="profile-info"><span>Suggested store</span><strong>${esc(item.store_name || 'Buy anywhere')}</strong></div>
        <div class="profile-info"><span>Guest order</span><strong>${index + 1} of ${all.length}</strong></div>
        <div class="profile-info"><span>Visibility</span><strong>${item.is_active ? 'Shown to guests' : 'Hidden from guests'}</strong></div>
        <div class="profile-info"><span>Example link</span><strong>${itemUrl ? `<a href="${esc(itemUrl)}" target="_blank" rel="noopener">Open example ↗</a>` : '—'}</strong></div>
      </div>
      ${item.description ? `<section class="profile-section"><h3>Description</h3><p class="job-description">${esc(item.description)}</p></section>` : ''}
      ${claim ? `<section class="profile-section registry-claim-admin-v071"><div class="panel-heading"><div><h3>Claimed Gift</h3><p class="muted">This information is private.</p></div></div>
        <div class="profile-info-grid"><div class="profile-info"><span>Claimed by</span><strong>${esc(claim.claimant_name)}</strong></div>
        <div class="profile-info"><span>Email</span><strong>${esc(claim.claimant_email || 'Not provided')}</strong></div>
        <div class="profile-info"><span>Claimed</span><strong>${formatDate(claim.created_at)}</strong></div></div>
        <button class="secondary" onclick="releaseRegistryClaimAdminV071('${item.id}')">Release Claim</button></section>` : ''}
      <section class="profile-section"><div class="registry-action-grid"><button class="secondary" onclick="toggleRegistryVisibility('${item.id}')">${item.is_active ? 'Hide from Guests' : 'Show to Guests'}</button>
        <button class="secondary" onclick="moveRegistryItem('${item.id}',-1)" ${index <= 0 ? 'disabled' : ''}>Move Up</button>
        <button class="secondary" onclick="moveRegistryItem('${item.id}',1)" ${index >= all.length - 1 ? 'disabled' : ''}>Move Down</button></div></section>
      </div></div>
  </article>`;
}

async function releaseRegistryClaimAdminV071(itemId) {
  const item = adminData.registry.find(i => i.id === itemId);
  if (!confirm(`Make "${item?.title || 'this gift'}" available again?`)) return;
  const { error } = await db.rpc('admin_release_registry_item', { p_item_id: itemId });
  if (error) return toast(error.message, 'error');
  toast('Gift is available again.');
  await loadAdmin();
}

const baseLoadAdminV071 = loadAdmin;
loadAdmin = async function() {
  await baseLoadAdminV071();
  if (!db || !session) return;
  const { data, error } = await db.from('registry_claims').select('*').order('created_at', { ascending:false });
  if (!error) adminData.registryClaims = data || [];
  render();
};

const baseRenderAdminViewV071 = renderAdminView;
renderAdminView = function() {
  if (adminView === 'review') return renderReviewV071();
  if (adminView === 'registry') return renderRegistryManagerV071();
  return baseRenderAdminViewV071();
};


/* ===== v0.7.2 duplicate RSVP cleanup ===== */

const baseRenderReviewDetailV072 = renderReviewDetailV071;
renderReviewDetailV071 = function(rsvp) {
  let html = baseRenderReviewDetailV072(rsvp);

  if (reviewModeV071 === 'reviewed') {
    const invitation = rsvp.invitation_id
      ? adminData.invitations.find(i => i.id === rsvp.invitation_id)
      : null;

    const duplicatePanel = `<section class="duplicate-rsvp-panel-v072">
      <div>
        <strong>Duplicate RSVP?</strong>
        <p>Delete only this RSVP record. The invitation household will stay in place.</p>
      </div>
      <button class="danger-button" onclick="deleteDuplicateRsvpV072('${rsvp.id}')">Delete Duplicate RSVP</button>
    </section>`;

    html = html.replace('</article>', `${duplicatePanel}</article>`);
  }

  return html;
};

async function deleteDuplicateRsvpV072(rsvpId) {
  const rsvp = adminData.rsvps.find(r => r.id === rsvpId);
  if (!rsvp) return;

  const invitation = rsvp.invitation_id
    ? adminData.invitations.find(i => i.id === rsvp.invitation_id)
    : null;

  const people = rsvpPeopleV071(rsvp.id);
  const names = people.length
    ? people.map(p => p.person_name).join(', ')
    : `${rsvp.first_name} ${rsvp.last_name}`.trim();

  const householdText = invitation
    ? `\nHousehold: ${invitation.household_name}`
    : '';

  if (!confirm(
    `Delete this duplicate RSVP?\n\n${names}${householdText}\n\n` +
    `This removes the RSVP and its named adults/children, but it will NOT delete the invitation household.`
  )) return;

  const { data, error } = await db.rpc('admin_delete_duplicate_rsvp', {
    p_rsvp_id: rsvpId
  });

  if (error) {
    return toast(error.message, 'error');
  }

  const result = Array.isArray(data) ? data[0] : data;
  toast(result?.message || 'Duplicate RSVP deleted.');
  selectedReviewId = null;
  await loadAdmin();
}


/* ===== v0.8.0 Wedding Summary ===== */

function summaryMetricsV080() {
  const invitations = adminData.invitations || [];
  const activeInvitations = invitations.filter(i => i.status !== 'cancelled');
  const rsvps = (adminData.rsvps || []).filter(r => r.verification_status !== 'rejected');
  const verified = rsvps.filter(r => r.verification_status === 'verified');
  const attending = verified.filter(r => r.attendance === 'attending');
  const declined = verified.filter(r => r.attendance === 'declined');

  const attendingAdults = attending.reduce((sum, r) => sum + Number(r.adult_count || 0), 0);
  const attendingChildren = attending.reduce((sum, r) => sum + Number(r.child_count || 0), 0);
  const attendingTotal = attendingAdults + attendingChildren;

  const linkedRespondedHouseholds = new Set(
    verified.map(r => r.invitation_id).filter(Boolean)
  ).size;

  const invitedCapacity = activeInvitations.reduce(
    (sum, i) => sum + Number(i.max_guests || 0), 0
  );

  const jobs = adminData.jobs || [];
  const jobRows = jobs.map(job => {
    const stats = jobStats(job);
    return { job, ...stats };
  });
  const unfilledJobs = jobRows.filter(row => row.remaining > 0);
  const unfilledPositions = unfilledJobs.reduce((sum, row) => sum + row.remaining, 0);

  const assignments = adminData.assignments || [];
  const awaitingJobReplies = assignments.filter(
    a => String(a.status || '').toLowerCase() === 'awaiting_response'
  );
  const acceptedAssignments = assignments.filter(a =>
    ['accepted', 'confirmed'].includes(String(a.status || '').toLowerCase())
  );

  const registry = adminData.registry || [];
  const visibleGifts = registry.filter(g => g.is_active);
  const claimedGifts = visibleGifts.filter(g => Boolean(g.claimed_at));
  const availableGifts = visibleGifts.filter(g => !g.claimed_at);
  const hiddenGifts = registry.filter(g => !g.is_active);

  const photos = adminData.photos || [];
  const albumPhotos = photos.filter(p => p.show_in_guest_album);
  const favoritePhotos = photos.filter(p => p.is_favorite_engagement);

  const responsePercent = activeInvitations.length
    ? Math.round((linkedRespondedHouseholds / activeInvitations.length) * 100)
    : 0;

  return {
    invitations,
    activeInvitations,
    rsvps,
    verified,
    attending,
    declined,
    attendingAdults,
    attendingChildren,
    attendingTotal,
    linkedRespondedHouseholds,
    invitedCapacity,
    responsePercent,
    reviewCount: needsReview().length,
    jobs,
    jobRows,
    unfilledJobs,
    unfilledPositions,
    awaitingJobReplies,
    acceptedAssignments,
    assignments,
    registry,
    visibleGifts,
    claimedGifts,
    availableGifts,
    hiddenGifts,
    photos,
    albumPhotos,
    favoritePhotos
  };
}

function summaryStatusV080(ok, goodText, actionText) {
  return `<span class="summary-status-v080 ${ok ? 'good' : 'attention'}">${ok ? '✓' : '!'} ${esc(ok ? goodText : actionText)}</span>`;
}

function summaryEmptyV080(text) {
  return `<p class="summary-empty-v080">${esc(text)}</p>`;
}

function renderWeddingSummaryV080() {
  const m = summaryMetricsV080();
  const rsvpOpen = booleanSettingV070('rsvp_open', true);
  const registryVisible = booleanSettingV070('registry_visible', true);
  const albumVisible = booleanSettingV070('guest_album_visible', true);
  const settings = settingsV070();
  const amazonSet = Boolean(String(settings.amazon_registry_url || '').trim());
  const otherRegistrySet = Boolean(String(settings.other_registry_url || '').trim());

  const attentionItems = [];
  if (m.reviewCount > 0) attentionItems.push({
    view:'review',
    title:`${m.reviewCount} RSVP${m.reviewCount === 1 ? '' : 's'} need review`,
    detail:'Match, verify, or reject new submissions.'
  });
  if (m.unfilledPositions > 0) attentionItems.push({
    view:'jobs',
    title:`${m.unfilledPositions} wedding-job position${m.unfilledPositions === 1 ? '' : 's'} still unfilled`,
    detail:`Across ${m.unfilledJobs.length} job${m.unfilledJobs.length === 1 ? '' : 's'}.`
  });
  if (m.awaitingJobReplies.length > 0) attentionItems.push({
    view:'jobs',
    title:`${m.awaitingJobReplies.length} job request${m.awaitingJobReplies.length === 1 ? '' : 's'} awaiting a reply`,
    detail:'These people have not accepted or declined yet.'
  });
  if (registryVisible && m.visibleGifts.length === 0 && !amazonSet && !otherRegistrySet) attentionItems.push({
    view:'registry',
    title:'Registry is visible but has no guest-facing gifts',
    detail:'Add a gift or registry link, or hide the registry in Settings.'
  });
  if (albumVisible && m.albumPhotos.length === 0) attentionItems.push({
    view:'photos',
    title:'Guest Photo Album is visible but empty',
    detail:'Select at least one photo for the guest album or hide it in Settings.'
  });
  if (m.photos.length > 0 && m.favoritePhotos.length === 0) attentionItems.push({
    view:'photos',
    title:'No homepage favorite photo selected',
    detail:'Choose one engagement photo for the public homepage.'
  });

  const guestProgressWidth = Math.max(0, Math.min(100, m.responsePercent));

  return `<div class="admin-view summary-page-v080">
    <div class="view-heading">
      <div>
        <p class="eyebrow">Everything in one place</p>
        <h1>Wedding Summary</h1>
        <p>Live planning status for ${esc(coupleDisplayV070())}.</p>
      </div>
      <button class="secondary" onclick="loadAdmin()">Refresh Summary</button>
    </div>

    <section class="summary-hero-v080">
      <div>
        <span>Wedding day</span>
        <strong>${esc(weddingDateLongV070())}</strong>
        <small>${esc(ceremonyTimeTextV070())} · ${esc(settingV070('venue_name','4-H Building'))} · ${esc(venueLocationV070())}</small>
      </div>
      <div class="summary-countdown-v080">
        <strong>${Math.max(0, Math.ceil((weddingDateObjectV070().getTime() - Date.now()) / 86400000))}</strong>
        <span>days to go</span>
      </div>
    </section>

    <section class="summary-metric-grid-v080">
      ${metricCard('Invited households', m.activeInvitations.length, `${m.invitedCapacity} maximum invited people`)}
      ${metricCard('Attending', m.attendingTotal, `${m.attendingAdults} adults · ${m.attendingChildren} children`)}
      ${metricCard('Declined RSVPs', m.declined.length, 'Verified declined responses')}
      ${metricCard('Needs review', m.reviewCount, m.reviewCount ? 'Action required' : 'All caught up', m.reviewCount > 0)}
      ${metricCard('Unfilled job spots', m.unfilledPositions, m.unfilledPositions ? `${m.unfilledJobs.length} jobs need people` : 'All listed jobs filled', m.unfilledPositions > 0)}
      ${metricCard('Job replies waiting', m.awaitingJobReplies.length, m.awaitingJobReplies.length ? 'Email responses pending' : 'No outstanding requests', m.awaitingJobReplies.length > 0)}
      ${metricCard('Available gifts', m.availableGifts.length, `${m.claimedGifts.length} claimed`)}
      ${metricCard('Guest album photos', m.albumPhotos.length, `${m.photos.length} photos in private library`)}
    </section>

    <section class="summary-two-column-v080">
      <article class="admin-panel summary-attention-v080">
        <div class="panel-heading">
          <div><h2>What Still Needs Attention?</h2><p class="muted">The items most likely to need your next action.</p></div>
        </div>
        ${attentionItems.length
          ? `<div class="summary-attention-list-v080">${attentionItems.map(item => `<button onclick="setAdminView('${item.view}')">
              <span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span><b>Open →</b>
            </button>`).join('')}</div>`
          : `<div class="summary-all-clear-v080"><div>✓</div><strong>Nothing urgent right now</strong><p>Your RSVP review, jobs, registry, and photo setup have no obvious outstanding items.</p></div>`}
      </article>

      <article class="admin-panel">
        <div class="panel-heading"><div><h2>RSVP Progress</h2><p class="muted">Verified RSVPs linked to invitation households.</p></div></div>
        <div class="summary-progress-number-v080"><strong>${m.responsePercent}%</strong><span>${m.linkedRespondedHouseholds} of ${m.activeInvitations.length} households linked to a verified RSVP</span></div>
        <div class="summary-progress-track-v080"><span style="width:${guestProgressWidth}%"></span></div>
        <div class="summary-mini-grid-v080">
          <div><span>Attending adults</span><strong>${m.attendingAdults}</strong></div>
          <div><span>Attending children</span><strong>${m.attendingChildren}</strong></div>
          <div><span>Verified attending RSVPs</span><strong>${m.attending.length}</strong></div>
          <div><span>Reviewed RSVPs</span><strong>${reviewedRsvpsV071().length}</strong></div>
        </div>
        <button class="secondary summary-section-button-v080" onclick="setAdminView('review')">Open RSVP Review</button>
      </article>
    </section>

    <section class="summary-two-column-v080">
      <article class="admin-panel">
        <div class="panel-heading"><div><h2>Wedding Jobs</h2><p class="muted">Who is helping and where you still need people.</p></div><button onclick="setAdminView('jobs')">Open Jobs</button></div>
        <div class="summary-mini-grid-v080">
          <div><span>Jobs listed</span><strong>${m.jobs.length}</strong></div>
          <div><span>Accepted assignments</span><strong>${m.acceptedAssignments.length}</strong></div>
          <div><span>Awaiting response</span><strong>${m.awaitingJobReplies.length}</strong></div>
          <div><span>Unfilled positions</span><strong>${m.unfilledPositions}</strong></div>
        </div>
        <div class="summary-detail-list-v080">
          ${m.unfilledJobs.length
            ? m.unfilledJobs.map(row => `<button onclick="setAdminView('jobs')"><span><strong>${esc(row.job.title)}</strong><small>${row.filled} assigned · ${row.remaining} still needed</small></span>${summaryStatusV080(false,'','Needs help')}</button>`).join('')
            : summaryEmptyV080('All currently listed wedding-job positions are filled.')}
        </div>
        ${m.awaitingJobReplies.length ? `<div class="summary-subheading-v080">Awaiting replies</div><div class="summary-detail-list-v080">
          ${m.awaitingJobReplies.slice(0,6).map(a => {
            const job = m.jobs.find(j => j.id === a.job_id);
            return `<button onclick="setAdminView('jobs')"><span><strong>${esc(a.person_name || 'Assigned helper')}</strong><small>${esc(job?.title || 'Wedding job')}</small></span>${summaryStatusV080(false,'','Waiting')}</button>`;
          }).join('')}
          ${m.awaitingJobReplies.length > 6 ? `<p class="muted">+ ${m.awaitingJobReplies.length - 6} more awaiting replies</p>` : ''}
        </div>` : ''}
      </article>

      <article class="admin-panel">
        <div class="panel-heading"><div><h2>Gift Registry</h2><p class="muted">Guest-facing gift choices and claims.</p></div><button onclick="setAdminView('registry')">Open Registry</button></div>
        <div class="summary-mini-grid-v080">
          <div><span>Gift ideas</span><strong>${m.registry.length}</strong></div>
          <div><span>Available</span><strong>${m.availableGifts.length}</strong></div>
          <div><span>Claimed</span><strong>${m.claimedGifts.length}</strong></div>
          <div><span>Hidden</span><strong>${m.hiddenGifts.length}</strong></div>
        </div>
        <div class="summary-switch-list-v080">
          <div><span>Registry on guest site</span>${summaryStatusV080(registryVisible,'Shown','Hidden')}</div>
          <div><span>Amazon registry link</span>${summaryStatusV080(amazonSet,'Added','Not added')}</div>
          <div><span>Second registry link</span>${summaryStatusV080(otherRegistrySet,'Added','Not added')}</div>
        </div>
        ${m.claimedGifts.length ? `<div class="summary-subheading-v080">Recently claimed</div><div class="summary-detail-list-v080">
          ${m.claimedGifts.slice(0,5).map(g => {
            const claim = currentRegistryClaimV071(g.id);
            return `<button onclick="setAdminView('registry')"><span><strong>${esc(g.title)}</strong><small>${claim ? `Claimed by ${esc(claim.claimant_name)}` : 'Claimed by guest'}</small></span>${summaryStatusV080(true,'Claimed','')}</button>`;
          }).join('')}
        </div>` : ''}
      </article>
    </section>

    <section class="summary-two-column-v080">
      <article class="admin-panel">
        <div class="panel-heading"><div><h2>Photos</h2><p class="muted">Private library, guest album, and homepage favorite.</p></div><button onclick="setAdminView('photos')">Open Photos</button></div>
        <div class="summary-mini-grid-v080">
          <div><span>Private library</span><strong>${m.photos.length}</strong></div>
          <div><span>Guest album</span><strong>${m.albumPhotos.length}</strong></div>
          <div><span>Homepage favorite</span><strong>${m.favoritePhotos.length ? 'Yes' : 'No'}</strong></div>
          <div><span>Album visibility</span><strong>${albumVisible ? 'Shown' : 'Hidden'}</strong></div>
        </div>
        <div class="summary-switch-list-v080">
          <div><span>Guest album</span>${summaryStatusV080(albumVisible,'Shown to guests','Hidden')}</div>
          <div><span>Homepage favorite selected</span>${summaryStatusV080(m.favoritePhotos.length > 0,'Selected','Choose one')}</div>
          <div><span>At least one album photo</span>${summaryStatusV080(m.albumPhotos.length > 0,'Ready','Add photos')}</div>
        </div>
      </article>

      <article class="admin-panel">
        <div class="panel-heading"><div><h2>Guest Website</h2><p class="muted">Current public visibility settings.</p></div><button onclick="setAdminView('settings')">Open Settings</button></div>
        <div class="summary-switch-list-v080">
          <div><span>RSVP form</span>${summaryStatusV080(rsvpOpen,'Open','Closed')}</div>
          <div><span>Gift Registry</span>${summaryStatusV080(registryVisible,'Shown','Hidden')}</div>
          <div><span>Photo Album</span>${summaryStatusV080(albumVisible,'Shown','Hidden')}</div>
          <div><span>Wedding Details</span>${summaryStatusV080(Boolean(String(settings.details_text || '').trim()),'Details added','Add details')}</div>
          <div><span>Venue map</span>${summaryStatusV080(Boolean(String(settings.map_query || '').trim()),'Location set','Check location')}</div>
        </div>
        <div class="summary-public-copy-v080">
          <span>Homepage welcome</span>
          <strong>${esc(settingV070('welcome_heading','Celebrate with us'))}</strong>
          <p>${esc(settingV070('welcome_message','')).replace(/\n/g,'<br>')}</p>
        </div>
      </article>
    </section>
  </div>`;
}

renderSummary = function() {
  return renderWeddingSummaryV080();
};


/* ===== v0.9.0 Final Polish & Testing ===== */

let uiPolishInitializedV090 = false;

function polishUiV090() {
  // Improve mobile keyboards and browser autofill without changing stored data.
  const attrsByName = {
    first_name: { autocomplete: 'given-name' },
    last_name: { autocomplete: 'family-name' },
    street_address: { autocomplete: 'street-address' },
    city: { autocomplete: 'address-level2' },
    state: { autocomplete: 'address-level1' },
    zip_code: { autocomplete: 'postal-code', inputmode: 'numeric' },
    phone: { autocomplete: 'tel', inputmode: 'tel', type: 'tel' },
    email: { autocomplete: 'email', inputmode: 'email', type: 'email' },
    claimant_email: { autocomplete: 'email', inputmode: 'email', type: 'email' },
    claimant_name: { autocomplete: 'name' },
    adult_count: { inputmode: 'numeric' },
    child_count: { inputmode: 'numeric' }
  };

  Object.entries(attrsByName).forEach(([name, attrs]) => {
    document.querySelectorAll(`[name="${name}"]`).forEach(el => {
      Object.entries(attrs).forEach(([key, value]) => {
        try { el.setAttribute(key, value); } catch {}
      });
    });
  });

  ['rsvp-message', 'login-message'].forEach(id => {
    const region = document.getElementById(id);
    if (region) {
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
    }
  });

  document.querySelectorAll('.modal-backdrop .modal-card').forEach(modal => {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    if (!modal.getAttribute('aria-label') && !modal.getAttribute('aria-labelledby')) {
      const heading = modal.querySelector('h1,h2,h3');
      if (heading) {
        if (!heading.id) heading.id = `modal-title-${Math.random().toString(36).slice(2)}`;
        modal.setAttribute('aria-labelledby', heading.id);
      }
    }
    const close = modal.querySelector('.modal-heading button');
    if (close && !close.getAttribute('aria-label')) close.setAttribute('aria-label', 'Close dialog');

    if (!modal.dataset.focusedV090) {
      modal.dataset.focusedV090 = 'true';
      const focusTarget = modal.querySelector('input:not([type="hidden"]),select,textarea,button,a[href]');
      if (focusTarget) setTimeout(() => focusTarget.focus({ preventScroll: true }), 0);
    }
  });

  document.querySelectorAll('a[target="_blank"]').forEach(link => {
    const rel = new Set(String(link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    rel.add('noreferrer');
    link.setAttribute('rel', [...rel].join(' '));
  });

  if (!uiPolishInitializedV090) {
    uiPolishInitializedV090 = true;
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.getElementById('modal') && typeof closeModal === 'function') {
        closeModal();
      }
    });
  }
}

const renderBaseV090 = render;
render = function() {
  renderBaseV090();
  polishUiV090();
};

// Run once for the initial screen too.
polishUiV090();


/* ===== v0.9.1 Public RSVP RLS hotfix =====
   Public guests must submit through the existing security-definer RPC.
   Direct inserts into public.rsvps are intentionally blocked by RLS.
*/
submitRsvpV062 = async function(event) {
  event.preventDefault();

  const button = event.target.querySelector('button[type=submit]');
  const message = document.getElementById('rsvp-message');

  if (!configured) {
    message.innerHTML = '<p class="error">The RSVP system has not been connected yet.</p>';
    return;
  }

  button.disabled = true;
  button.textContent = 'Submitting…';

  const form = new FormData(event.target);
  const attendance = form.get('attendance');
  const adultCount = attendance === 'attending' ? Number(form.get('adult_count') || 0) : 0;
  const childCount = attendance === 'attending' ? Number(form.get('child_count') || 0) : 0;

  const people = [];
  if (attendance === 'attending') {
    for (let i = 0; i < adultCount; i++) {
      people.push({
        person_name: String(form.get(`adult_name_${i}`) || '').trim(),
        person_type: 'adult',
        sort_order: i
      });
    }
    for (let i = 0; i < childCount; i++) {
      people.push({
        person_name: String(form.get(`child_name_${i}`) || '').trim(),
        person_type: 'child',
        sort_order: adultCount + i
      });
    }

    if (people.some(person => !person.person_name)) {
      button.disabled = false;
      button.textContent = 'Submit RSVP';
      message.innerHTML = '<p class="error">Please enter a name for everyone attending.</p>';
      return;
    }
  }

  const email = String(form.get('email') || '').trim() || null;
  const additionalGuests = people.slice(1).map(person => person.person_name).join(', ') || null;
  const notes = String(form.get('notes') || '').trim() || null;

  const { data: rsvpId, error } = await db.rpc('submit_public_rsvp', {
    p_first_name: String(form.get('first_name') || '').trim(),
    p_last_name: String(form.get('last_name') || '').trim(),
    p_street_address: String(form.get('street_address') || '').trim(),
    p_city: String(form.get('city') || '').trim(),
    p_state: String(form.get('state') || '').trim(),
    p_zip_code: String(form.get('zip_code') || '').trim(),
    p_phone: String(form.get('phone') || '').trim(),
    p_email: email,
    p_attendance: attendance,
    p_adult_count: adultCount,
    p_child_count: childCount,
    p_additional_guests: additionalGuests,
    p_notes: notes
  });

  if (error) {
    console.error('Public RSVP submission failed:', error);
    button.disabled = false;
    button.textContent = 'Submit RSVP';

    const raw = String(error.message || '');
    const friendly = raw.includes('RSVPs are currently closed')
      ? 'RSVPs are currently closed. Please contact Jordan or Rochelle if you need to make or change an RSVP.'
      : raw.includes('Name and phone number are required')
        ? 'Please enter your first name, last name, and phone number.'
        : 'We could not save your RSVP. Please try again.';

    message.innerHTML = `<p class="error">${esc(friendly)}</p>`;
    return;
  }

  if (!rsvpId) {
    button.disabled = false;
    button.textContent = 'Submit RSVP';
    message.innerHTML = '<p class="error">We could not save your RSVP. Please try again.</p>';
    return;
  }

  if (people.length) {
    const { error: peopleError } = await db
      .from('rsvp_people')
      .insert(people.map(person => ({ ...person, rsvp_id: rsvpId })));

    if (peopleError) {
      console.error('RSVP saved but attendee names failed:', peopleError);
      button.disabled = false;
      button.textContent = 'Submit RSVP';
      message.innerHTML = '<p class="error">Your RSVP was saved, but the attendee names could not be saved. Please contact Jordan or Rochelle so we can correct it.</p>';
      return;
    }
  }

  if (email) sendRsvpConfirmationV063(rsvpId);

  event.target.outerHTML = `<div class="success-card"><div class="big-icon">♥</div><h2>Thank you!</h2><p>Your RSVP and guest names have been received.</p>${email ? '<p class="muted">We’ll also send an acknowledgement to the email address you provided.</p>' : ''}${mainMenuButton()}</div>`;
};


/* ===== v1.0.1 Invitation People ===== */

function parseInvitationPeopleV101(householdName, primaryFirst = '', primaryLast = '') {
  const household = String(householdName || '').trim().replace(/\s+/g, ' ');
  const primary = `${String(primaryFirst || '').trim()} ${String(primaryLast || '').trim()}`.trim();

  if (!household) return primary ? [primary] : [];
  if (/\s+(household|family)$/i.test(household)) return primary ? [primary] : [household];

  const normalized = household.replace(/\s*&\s*/g, ' and ');
  const parts = normalized.split(/\s+and\s+/i).map(value => value.trim()).filter(Boolean);

  if (parts.length === 2) {
    const [left, right] = parts;
    const leftTokens = left.split(/\s+/);
    const rightTokens = right.split(/\s+/);

    if (leftTokens.length === 1 && rightTokens.length >= 2) {
      const sharedLast = rightTokens[rightTokens.length - 1];
      return [`${left} ${sharedLast}`, right];
    }

    if (leftTokens.length === 1 && rightTokens.length === 1 && String(primaryLast || '').trim()) {
      const last = String(primaryLast).trim();
      return [`${left} ${last}`, `${right} ${last}`];
    }

    return [left, right];
  }

  return [household];
}

function splitPersonNameV101(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

const baseLoadAdminV101 = loadAdmin;
loadAdmin = async function() {
  await baseLoadAdminV101();
  if (!db || !session) return;
  const { data, error } = await db
    .from('invitation_people')
    .select('*')
    .order('sort_order', { ascending: true });
  if (!error) adminData.invitationPeople = data || [];
  render();
};

function invitationPeopleV101(invitationId) {
  return (adminData.invitationPeople || [])
    .filter(person => person.invitation_id === invitationId)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

assignmentPeopleV063 = function() {
  const rows = [];
  const rsvps = adminData.rsvps || [];
  const rsvpPeople = adminData.rsvpPeople || [];
  const invitationPeople = adminData.invitationPeople || [];
  const invitations = adminData.invitations || [];

  rsvps.forEach(rsvp => {
    const invitation = rsvp.invitation_id ? invitations.find(i => i.id === rsvp.invitation_id) : null;
    const household = invitation?.household_name || `${rsvp.first_name} ${rsvp.last_name}`.trim();
    const members = rsvpPeople.filter(p => p.rsvp_id === rsvp.id);

    if (members.length) {
      members.forEach(member => rows.push({
        key: `person:${member.id}`,
        person_id: member.id,
        rsvp_id: rsvp.id,
        invitation_id: rsvp.invitation_id || null,
        person_name: member.person_name,
        household,
        email: rsvp.email || invitation?.email || ''
      }));
    } else {
      rows.push({
        key: `rsvp:${rsvp.id}`,
        person_id: null,
        rsvp_id: rsvp.id,
        invitation_id: rsvp.invitation_id || null,
        person_name: `${rsvp.first_name} ${rsvp.last_name}`.trim(),
        household,
        email: rsvp.email || invitation?.email || ''
      });
    }
  });

  invitations.forEach(invitation => {
    if (rsvps.some(r => r.invitation_id === invitation.id)) return;

    const members = invitationPeople.filter(p => p.invitation_id === invitation.id);
    if (members.length) {
      members.forEach(member => rows.push({
        key: `invite-person:${member.id}`,
        person_id: null,
        rsvp_id: null,
        invitation_id: invitation.id,
        person_name: member.person_name,
        household: invitation.household_name,
        email: invitation.email || ''
      }));
    } else {
      rows.push({
        key: `invite:${invitation.id}`,
        person_id: null,
        rsvp_id: null,
        invitation_id: invitation.id,
        person_name: `${invitation.primary_first_name} ${invitation.primary_last_name}`.trim() || invitation.household_name,
        household: invitation.household_name,
        email: invitation.email || ''
      });
    }
  });

  return rows.sort((a, b) => a.person_name.localeCompare(b.person_name));
};

const baseRenderGuestProfileV101 = renderGuestProfile;
renderGuestProfile = function(record) {
  let html = baseRenderGuestProfileV101(record);
  if (!record.rsvp && record.invitation) {
    const people = invitationPeopleV101(record.invitation.id);
    if (people.length) {
      const block = `<section class="profile-section invitation-people-v101">
        <div class="profile-section-heading"><h3>People on this invitation</h3></div>
        <div class="named-attendee-list">
          ${people.map(person => `<div><strong>${esc(person.person_name)}</strong><span>Invited</span></div>`).join('')}
        </div>
      </section>`;
      html = html.replace('<section class="profile-section">', block + '<section class="profile-section">');
    }
  }
  return html;
};

saveInvitation = async function(event, id = '') {
  event.preventDefault();
  const submit = event.target.querySelector('[type=submit]');
  if (submit) submit.disabled = true;

  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());

  payload.household_name = String(payload.household_name || '').trim();
  payload.primary_first_name = String(payload.primary_first_name || '').trim();
  payload.primary_last_name = String(payload.primary_last_name || '').trim();
  payload.max_guests = Number(payload.max_guests || 1);

  for (const key of ['phone','email','street_address','city','state','zip_code','private_notes']) {
    payload[key] = String(payload[key] || '').trim() || null;
  }

  if (!payload.household_name) {
    if (submit) submit.disabled = false;
    return toast('Enter a household name.', 'error');
  }

  const result = id
    ? await db.from('invitations').update(payload).eq('id', id)
    : await db.from('invitations').insert(payload);

  if (result.error) {
    toast(result.error.message, 'error');
    if (submit) submit.disabled = false;
    return;
  }

  closeModal();
  toast(id ? 'Invitation and people updated.' : 'Invitation and people added.');
  await loadAdmin();
};

const baseOpenInvitationDialogV101 = openInvitationDialog;
openInvitationDialog = function(id = null) {
  baseOpenInvitationDialogV101(id);
  const householdInput = document.querySelector('#modal input[name="household_name"]');
  const field = householdInput?.closest('.field');
  if (field && !field.querySelector('.invitation-people-help-v101')) {
    field.insertAdjacentHTML(
      'beforeend',
      '<small class="invitation-people-help-v101">Example: “John and Joe Weaver” automatically creates John Weaver and Joe Weaver as separate invited people.</small>'
    );
  }
};

importInvitationsExcelV062 = async function(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const XLSX = await ensureXlsxV063();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (!rows.length) return toast('The spreadsheet has no invitation rows.', 'error');

    const norm = rows.map(row => {
      const get = (...keys) => {
        for (const key of keys) {
          const found = Object.keys(row).find(
            value => value.toLowerCase().replace(/[^a-z0-9]/g, '') === key
          );
          if (found) return row[found];
        }
        return '';
      };

      const rawFirst = String(get('primaryfirstname','firstname','first') || '').trim();
      const rawLast = String(get('primarylastname','lastname','last') || '').trim();
      const explicitHousehold = String(get('householdname','household','invitationname') || '').trim();
      const household = explicitHousehold || `${rawFirst} ${rawLast}`.trim();

      const parsedPeople = parseInvitationPeopleV101(household, rawFirst, rawLast);
      const primary = splitPersonNameV101(parsedPeople[0] || `${rawFirst} ${rawLast}`.trim());

      return {
        household_name: household,
        primary_first_name: primary.first || rawFirst,
        primary_last_name: primary.last || rawLast,
        street_address: String(get('streetaddress','address') || '').trim() || null,
        city: String(get('city') || '').trim() || null,
        state: String(get('state') || '').trim() || null,
        zip_code: String(get('zipcode','zip') || '').trim() || null,
        phone: String(get('phone','phonenumber') || '').trim() || null,
        email: String(get('email') || '').trim() || null,
        max_guests: Number(get('maxguests','guests') || Math.max(1, parsedPeople.length)) || Math.max(1, parsedPeople.length),
        status: 'invited'
      };
    }).filter(row => row.household_name && row.primary_first_name);

    if (!norm.length) return toast('Could not find invitation names in the spreadsheet.', 'error');
    if (!confirm(`Import ${norm.length} invitations? Individual people will be created automatically from household names such as “John and Joe Weaver”.`)) return;

    const { error } = await db.from('invitations').insert(norm);
    if (error) return toast(error.message, 'error');

    toast(`${norm.length} invitations imported and people created.`);
    await loadAdmin();
  } catch (error) {
    toast(`Could not read spreadsheet: ${error.message}`, 'error');
  }
};


/* ===== v1.0.1 revised: duplicate flags + editable RSVP people ===== */

function normalizeDuplicateTextV101(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9@]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizePhoneV101(value) {
  return String(value || '').replace(/\D+/g, '');
}

function duplicateKeysForInvitationV101(invitation) {
  const keys = [];
  const household = normalizeDuplicateTextV101(invitation.household_name);
  const person = normalizeDuplicateTextV101(`${invitation.primary_first_name || ''} ${invitation.primary_last_name || ''}`);
  const email = normalizeDuplicateTextV101(invitation.email);
  const phone = normalizePhoneV101(invitation.phone);
  if (household) keys.push(`household:${household}`);
  if (person) keys.push(`person:${person}`);
  if (email) keys.push(`email:${email}`);
  if (phone.length >= 7) keys.push(`phone:${phone}`);
  return keys;
}

function duplicateKeysForRsvpV101(rsvp) {
  const keys = [];
  const person = normalizeDuplicateTextV101(`${rsvp.first_name || ''} ${rsvp.last_name || ''}`);
  const email = normalizeDuplicateTextV101(rsvp.email);
  const phone = normalizePhoneV101(rsvp.phone);
  if (person) keys.push(`person:${person}`);
  if (email) keys.push(`email:${email}`);
  if (phone.length >= 7) keys.push(`phone:${phone}`);
  if (rsvp.invitation_id && rsvp.verification_status !== 'rejected') keys.push(`invitation:${rsvp.invitation_id}`);
  return keys;
}

function duplicateIndexV101(items, keyFn) {
  const index = new Map();
  items.forEach(item => {
    keyFn(item).forEach(key => {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(item.id);
    });
  });
  return index;
}

function duplicateReasonsForV101(item, items, keyFn, labels) {
  const index = duplicateIndexV101(items, keyFn);
  const reasons = [];
  keyFn(item).forEach(key => {
    const matches = index.get(key) || [];
    if (matches.length > 1) {
      const prefix = key.split(':', 1)[0];
      reasons.push(labels[prefix] || 'matching information');
    }
  });
  return [...new Set(reasons)];
}

function invitationDuplicateReasonsV101(invitation) {
  return duplicateReasonsForV101(
    invitation,
    (adminData.invitations || []).filter(item => item.status !== 'cancelled'),
    duplicateKeysForInvitationV101,
    { household: 'same household name', person: 'same primary name', email: 'same email', phone: 'same phone' }
  );
}

function rsvpDuplicateReasonsV101(rsvp) {
  return duplicateReasonsForV101(
    rsvp,
    (adminData.rsvps || []).filter(item => item.verification_status !== 'rejected'),
    duplicateKeysForRsvpV101,
    { person: 'same guest name', email: 'same email', phone: 'same phone', invitation: 'same linked invitation' }
  );
}

function duplicateBadgeV101(reasons) {
  if (!reasons?.length) return '';
  const title = `Possible duplicate: ${reasons.join(', ')}`;
  return `<span class="duplicate-flag-v101" title="${esc(title)}">⚠ Possible duplicate</span>`;
}

function recordDuplicateReasonsV101(record) {
  const reasons = [];
  if (record.rsvp) reasons.push(...rsvpDuplicateReasonsV101(record.rsvp));
  if (record.invitation) reasons.push(...invitationDuplicateReasonsV101(record.invitation));
  return [...new Set(reasons)];
}

// Invite List: flag duplicate-looking records directly in the table.
invitationTable = function(items) {
  if (!items.length) return '<p class="muted">No invitations found.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Household</th><th>Primary contact</th><th>Contact</th><th>Allowed</th><th>Status</th></tr></thead><tbody>
    ${items.map(item => {
      const reasons = invitationDuplicateReasonsV101(item);
      return `<tr class="${reasons.length ? 'possible-duplicate-row-v101' : ''}">
        <td><strong>${esc(item.household_name)}</strong>${duplicateBadgeV101(reasons)}</td>
        <td>${esc(item.primary_first_name)} ${esc(item.primary_last_name)}</td>
        <td>${esc(item.phone || item.email || '—')}</td>
        <td>${item.max_guests}</td>
        <td>${statusPill(item.status)}</td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
};

// Guest Profiles list: flag the same record anywhere it appears.
renderGuestListItem = function(record, active) {
  const sub = record.rsvp ? `${titleCase(record.rsvp.attendance)} · ${record.household}` : `No RSVP yet · ${record.household}`;
  const reasons = recordDuplicateReasonsV101(record);
  return `<button class="guest-list-item ${active ? 'active' : ''} ${reasons.length ? 'possible-duplicate-item-v101' : ''}" onclick="selectGuestRecord('${record.key}')">
    <span class="guest-avatar">${esc((record.name || '?').charAt(0).toUpperCase())}</span>
    <span class="guest-list-copy"><strong>${esc(record.name || record.household)}</strong><small>${esc(sub)}</small>${duplicateBadgeV101(reasons)}</span>
    ${record.rsvp ? statusPill(record.rsvp.verification_status) : statusPill(record.invitation.status)}
  </button>`;
};

const baseRenderGuestProfileDuplicatesV101 = renderGuestProfile;
renderGuestProfile = function(record) {
  let html = baseRenderGuestProfileDuplicatesV101(record);
  const reasons = recordDuplicateReasonsV101(record);
  if (reasons.length) {
    const warning = `<div class="duplicate-warning-v101"><strong>⚠ Possible duplicate</strong><span>${esc(reasons.join(' · '))}</span></div>`;
    html = html.replace('<div class="profile-info-grid">', warning + '<div class="profile-info-grid">');
  }
  return html;
};

// RSVP Review: duplicate flags are visible in both Needs Review and Reviewed RSVPs.
renderReviewV071 = function() {
  const pending = needsReview();
  const reviewed = reviewedRsvpsV071();
  const source = reviewModeV071 === 'reviewed' ? reviewed : pending;
  const query = reviewSearch.trim().toLowerCase();
  const filtered = query ? source.filter(item => reviewMatchesV071(item, query)) : source;

  if (!selectedReviewId || !filtered.some(item => item.id === selectedReviewId)) {
    selectedReviewId = filtered[0]?.id || null;
  }
  const selected = filtered.find(item => item.id === selectedReviewId);

  const tabs = `<div class="review-tabs-v071">
    <button class="${reviewModeV071 === 'pending' ? 'active' : ''}" onclick="setReviewModeV071('pending')">Needs Review <span>${pending.length}</span></button>
    <button class="${reviewModeV071 === 'reviewed' ? 'active' : ''}" onclick="setReviewModeV071('reviewed')">Reviewed RSVPs <span>${reviewed.length}</span></button>
  </div>`;

  let body = '';
  if (!source.length && reviewModeV071 === 'pending') {
    body = `<div class="empty-state admin-empty"><div class="big-icon">✓</div><h2>All caught up</h2>
      <p>There are no new RSVP submissions waiting for approval.</p>
      <button class="primary" onclick="setReviewModeV071('reviewed')">View Reviewed RSVPs</button></div>`;
  } else if (!source.length) {
    body = `<div class="empty-state admin-empty"><h2>No reviewed RSVPs yet</h2><button class="secondary" onclick="setReviewModeV071('pending')">Back to Needs Review</button></div>`;
  } else {
    body = `<div class="review-toolbar"><input type="search" value="${esc(reviewSearch)}" placeholder="Search ${reviewModeV071 === 'pending' ? 'new' : 'reviewed'} RSVPs" oninput="setReviewSearch(this.value)">
      <span>${filtered.length} of ${source.length}</span></div>
      <div class="review-split">
        <aside class="review-queue">${filtered.length ? filtered.map(item => {
          const invitation = item.invitation_id ? adminData.invitations.find(i => i.id === item.invitation_id) : null;
          const reasons = rsvpDuplicateReasonsV101(item);
          return `<button class="queue-item ${item.id === selectedReviewId ? 'active' : ''} ${reasons.length ? 'possible-duplicate-item-v101' : ''}" onclick="selectReview('${item.id}')">
            <strong>${esc(item.first_name)} ${esc(item.last_name)}</strong>
            <span>${titleCase(item.attendance)} · ${formatDate(item.created_at)}</span>
            ${reviewModeV071 === 'reviewed' ? `<small>${esc(invitation?.household_name || titleCase(item.verification_status))}</small>` : ''}
            ${duplicateBadgeV101(reasons)}
          </button>`;
        }).join('') : '<p class="muted queue-empty">No matching RSVPs.</p>'}</aside>
        <section class="review-detail">${selected ? renderReviewDetailV071(selected) : '<div class="empty-state admin-empty"><h2>No response selected</h2></div>'}</section>
      </div>`;
  }

  return `<div class="admin-view"><div class="view-heading"><div><p class="eyebrow">Guest responses</p><h1>RSVP Review</h1>
    <p>New submissions stay separate from RSVPs you have already reviewed.</p></div></div>${tabs}${body}</div>`;
};

const baseRenderReviewDetailDuplicatesV101 = renderReviewDetailV071;
renderReviewDetailV071 = function(rsvp) {
  let html = baseRenderReviewDetailDuplicatesV101(rsvp);
  const reasons = rsvpDuplicateReasonsV101(rsvp);
  if (reasons.length) {
    const warning = `<div class="duplicate-warning-v101"><strong>⚠ Possible duplicate</strong><span>${esc(reasons.join(' · '))}</span></div>`;
    html = html.replace('<div class="review-details">', warning + '<div class="review-details">');
  }
  return html;
};

function existingRsvpPeopleForEditV101(rsvp) {
  const existing = rsvpPeopleV071(rsvp.id);
  if (existing.length) return existing.map(person => ({ ...person }));

  if (rsvp.attendance !== 'attending') return [];

  const generated = [];
  const primaryName = `${rsvp.first_name || ''} ${rsvp.last_name || ''}`.trim();
  const extras = String(rsvp.additional_guests || '')
    .split(/[,;\n]+/)
    .map(value => value.trim())
    .filter(Boolean);

  const adults = Math.max(0, Number(rsvp.adult_count || 0));
  const children = Math.max(0, Number(rsvp.child_count || 0));

  for (let i = 0; i < adults; i++) {
    generated.push({
      id: '',
      person_name: i === 0 && primaryName ? primaryName : (extras.shift() || ''),
      person_type: 'adult',
      sort_order: i
    });
  }
  for (let i = 0; i < children; i++) {
    generated.push({
      id: '',
      person_name: extras.shift() || '',
      person_type: 'child',
      sort_order: adults + i
    });
  }
  return generated;
}

function collectCurrentPeopleEditorV101() {
  const people = [];
  document.querySelectorAll('#rsvp-people-editor-v101 .rsvp-person-input-v101').forEach(input => {
    people.push({
      id: input.dataset.personId || '',
      person_name: input.value,
      person_type: input.dataset.personType,
      sort_order: Number(input.dataset.sortOrder || 0)
    });
  });
  return people;
}

function personValueForSlotV101(people, type, index) {
  const sameType = people.filter(person => person.person_type === type);
  return sameType[index] || { id: '', person_name: '' };
}

function renderRsvpPeopleFieldsV101(people, adults, children) {
  const rows = [];

  for (let i = 0; i < adults; i++) {
    const person = personValueForSlotV101(people, 'adult', i);
    rows.push(`<label class="field wide"><span>Adult ${i + 1} name</span>
      <input class="rsvp-person-input-v101" name="adult_name_${i}" required
        data-person-id="${esc(person.id || '')}" data-person-type="adult" data-sort-order="${i}"
        value="${esc(person.person_name || '')}" placeholder="Full name">
    </label>`);
  }

  for (let i = 0; i < children; i++) {
    const person = personValueForSlotV101(people, 'child', i);
    rows.push(`<label class="field wide"><span>Child ${i + 1} name</span>
      <input class="rsvp-person-input-v101" name="child_name_${i}" required
        data-person-id="${esc(person.id || '')}" data-person-type="child" data-sort-order="${adults + i}"
        value="${esc(person.person_name || '')}" placeholder="Full name">
    </label>`);
  }

  return rows.length
    ? `<div class="rsvp-people-grid-v101">${rows.join('')}</div>`
    : '<p class="muted">No attending people are listed for this RSVP.</p>';
}

function refreshRsvpPeopleEditorV101() {
  const form = document.querySelector('#modal form');
  const editor = document.getElementById('rsvp-people-editor-v101');
  if (!form || !editor) return;

  const current = collectCurrentPeopleEditorV101();
  const attendance = form.querySelector('[name="attendance"]')?.value || 'attending';
  const adults = attendance === 'attending' ? Math.max(0, Number(form.querySelector('[name="adult_count"]')?.value || 0)) : 0;
  const children = attendance === 'attending' ? Math.max(0, Number(form.querySelector('[name="child_count"]')?.value || 0)) : 0;

  editor.innerHTML = renderRsvpPeopleFieldsV101(current, adults, children);
}

openRsvpDialog = function(id) {
  const item = adminData.rsvps.find(entry => entry.id === id);
  if (!item) return;

  const value = name => esc(item[name] ?? '');
  const people = existingRsvpPeopleForEditV101(item);
  const adults = item.attendance === 'attending' ? Math.max(0, Number(item.adult_count || 0)) : 0;
  const children = item.attendance === 'attending' ? Math.max(0, Number(item.child_count || 0)) : 0;

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><form class="modal-card rsvp-edit-modal-v101" onsubmit="saveRsvpEdit(event, '${id}')">
    <div class="modal-heading"><h2>Edit RSVP</h2><button type="button" onclick="closeModal()">×</button></div>
    <div class="form-grid">
      ${['first_name','last_name','street_address','city','state','zip_code','phone','email'].map(name => `<label class="field ${name === 'street_address' ? 'wide' : ''}"><span>${titleCase(name)}</span><input name="${name}" ${name !== 'email' ? 'required' : ''} value="${value(name)}"></label>`).join('')}
      <label class="field"><span>Attendance</span><select name="attendance" onchange="refreshRsvpPeopleEditorV101()"><option value="attending" ${item.attendance === 'attending' ? 'selected' : ''}>Attending</option><option value="declined" ${item.attendance === 'declined' ? 'selected' : ''}>Declined</option></select></label>
      <label class="field"><span>Adults</span><input type="number" min="0" max="30" name="adult_count" value="${item.adult_count}" oninput="refreshRsvpPeopleEditorV101()"></label>
      <label class="field"><span>Children</span><input type="number" min="0" max="30" name="child_count" value="${item.child_count}" oninput="refreshRsvpPeopleEditorV101()"></label>
      <label class="field wide"><span>Notes</span><textarea name="notes" rows="4">${value('notes')}</textarea></label>
    </div>

    <section class="rsvp-people-editor-section-v101">
      <div>
        <h3>People on this RSVP</h3>
        <p class="muted">Add or correct each person here. Once saved, each person can be selected individually for Wedding Jobs.</p>
      </div>
      <div id="rsvp-people-editor-v101">${renderRsvpPeopleFieldsV101(people, adults, children)}</div>
    </section>

    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save RSVP & People</button></div>
  </form></div>`);
};

saveRsvpEdit = async function(event, id) {
  event.preventDefault();
  const formElement = event.target;
  const submit = formElement.querySelector('[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Saving…';
  }

  const form = new FormData(formElement);
  const attendance = String(form.get('attendance') || 'attending');
  const adultCount = attendance === 'attending' ? Math.max(0, Number(form.get('adult_count') || 0)) : 0;
  const childCount = attendance === 'attending' ? Math.max(0, Number(form.get('child_count') || 0)) : 0;

  const newPeople = [];
  if (attendance === 'attending') {
    for (let i = 0; i < adultCount; i++) {
      const input = formElement.querySelector(`[name="adult_name_${i}"]`);
      newPeople.push({
        id: input?.dataset.personId || '',
        person_name: String(input?.value || '').trim(),
        person_type: 'adult',
        sort_order: i
      });
    }
    for (let i = 0; i < childCount; i++) {
      const input = formElement.querySelector(`[name="child_name_${i}"]`);
      newPeople.push({
        id: input?.dataset.personId || '',
        person_name: String(input?.value || '').trim(),
        person_type: 'child',
        sort_order: adultCount + i
      });
    }

    if (newPeople.some(person => !person.person_name)) {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Save RSVP & People';
      }
      return toast('Enter a name for every adult and child on this RSVP.', 'error');
    }
  }

  const payload = {
    first_name: String(form.get('first_name') || '').trim(),
    last_name: String(form.get('last_name') || '').trim(),
    street_address: String(form.get('street_address') || '').trim(),
    city: String(form.get('city') || '').trim(),
    state: String(form.get('state') || '').trim(),
    zip_code: String(form.get('zip_code') || '').trim(),
    phone: String(form.get('phone') || '').trim(),
    email: String(form.get('email') || '').trim() || null,
    attendance,
    adult_count: adultCount,
    child_count: childCount,
    additional_guests: newPeople.slice(1).map(person => person.person_name).join(', ') || null,
    notes: String(form.get('notes') || '').trim() || null
  };

  const { error: rsvpError } = await db.from('rsvps').update(payload).eq('id', id);
  if (rsvpError) {
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Save RSVP & People';
    }
    return toast(rsvpError.message, 'error');
  }

  const existing = rsvpPeopleV071(id);
  const existingById = new Map(existing.map(person => [person.id, person]));
  const keptIds = new Set();

  for (const person of newPeople) {
    if (person.id && existingById.has(person.id)) {
      keptIds.add(person.id);
      const { error } = await db.from('rsvp_people').update({
        person_name: person.person_name,
        person_type: person.person_type,
        sort_order: person.sort_order
      }).eq('id', person.id);
      if (error) {
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Save RSVP & People';
        }
        return toast(`RSVP saved, but a person could not be updated: ${error.message}`, 'error');
      }
    } else {
      const { error } = await db.from('rsvp_people').insert({
        rsvp_id: id,
        person_name: person.person_name,
        person_type: person.person_type,
        sort_order: person.sort_order
      });
      if (error) {
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Save RSVP & People';
        }
        return toast(`RSVP saved, but a person could not be added: ${error.message}`, 'error');
      }
    }
  }

  const removeIds = existing.filter(person => !keptIds.has(person.id) && !newPeople.some(newPerson => newPerson.id === person.id)).map(person => person.id);
  if (removeIds.length) {
    const { error } = await db.from('rsvp_people').delete().in('id', removeIds);
    if (error) {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Save RSVP & People';
      }
      return toast(`RSVP saved, but old person records could not be removed: ${error.message}`, 'error');
    }
  }

  selectedReviewId = id;
  closeModal();
  toast('RSVP and individual people updated.');
  await loadAdmin();
};


/* ===== v1.0.1 final: job/gift duplicate flags + gift quantities ===== */

function jobDuplicateReasonsV101(job) {
  const title = normalizeDuplicateTextV101(job.title);
  const location = normalizeDuplicateTextV101(job.location);
  if (!title) return [];

  const matches = (adminData.jobs || []).filter(other => {
    if (other.id === job.id) return false;
    const otherTitle = normalizeDuplicateTextV101(other.title);
    const otherLocation = normalizeDuplicateTextV101(other.location);
    return otherTitle === title && (location === otherLocation || (!location && !otherLocation));
  });

  return matches.length ? ['same job title and location'] : [];
}

function registryDuplicateReasonsV101(item) {
  const title = normalizeDuplicateTextV101(item.title);
  const url = String(item.item_url || '').trim().toLowerCase();
  const reasons = [];

  const sameTitle = (adminData.registry || []).some(other =>
    other.id !== item.id &&
    title &&
    normalizeDuplicateTextV101(other.title) === title
  );
  const sameUrl = (adminData.registry || []).some(other =>
    other.id !== item.id &&
    url &&
    String(other.item_url || '').trim().toLowerCase() === url
  );

  if (sameTitle) reasons.push('same gift name');
  if (sameUrl) reasons.push('same item link');
  return reasons;
}

const baseRenderJobListItemDuplicatesV101 = renderJobListItem;
renderJobListItem = function(job, active) {
  let html = baseRenderJobListItemDuplicatesV101(job, active);
  const reasons = jobDuplicateReasonsV101(job);
  if (reasons.length) {
    html = html.replace(
      '</span>\n    <span class="job-list-count',
      `${duplicateBadgeV101(reasons)}</span>\n    <span class="job-list-count`
    );
  }
  return html;
};

const baseRenderJobDetailDuplicatesV101 = renderJobDetail;
renderJobDetail = function(job) {
  let html = baseRenderJobDetailDuplicatesV101(job);
  const reasons = jobDuplicateReasonsV101(job);
  if (reasons.length) {
    html = html.replace(
      '<div class="job-info-grid">',
      `<div class="duplicate-warning-v101"><strong>⚠ Possible duplicate</strong><span>${esc(reasons.join(' · '))}</span></div><div class="job-info-grid">`
    );
  }
  return html;
};

function giftQuantityV101(item) {
  return Math.max(1, Number(item?.quantity_wanted || 1));
}

function giftClaimedQuantityV101(item) {
  const fallback = item?.claimed_at ? 1 : 0;
  return Math.max(0, Number(item?.claimed_quantity ?? fallback));
}

function giftRemainingV101(item) {
  return Math.max(0, giftQuantityV101(item) - giftClaimedQuantityV101(item));
}

function activeRegistryClaimsV101(itemId) {
  return (adminData.registryClaims || [])
    .filter(claim => claim.registry_item_id === itemId && !claim.released_at)
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

renderPublicRegistryItemV071 = function(item) {
  const imageUrl = safeUrl(item.image_url);
  const exampleUrl = safeUrl(item.item_url);
  const wanted = giftQuantityV101(item);
  const claimed = giftClaimedQuantityV101(item);
  const remaining = giftRemainingV101(item);
  const full = remaining <= 0;

  return `<article class="public-registry-card registry-claim-card-v071 ${full ? 'claimed' : 'available'}">
    ${imageUrl ? `<div class="registry-image-wrap"><img src="${esc(imageUrl)}" alt="${esc(item.title)}" loading="lazy" onerror="this.parentElement.classList.add('image-failed');this.remove()"></div>` : `<div class="registry-image-wrap registry-image-placeholder">🎁</div>`}
    <div class="public-registry-copy">
      <div class="registry-card-status-v071">
        ${full
          ? '<span class="gift-claimed-v071">Fully Claimed</span>'
          : `<span class="gift-available-v071">${remaining} of ${wanted} available</span>`}
      </div>
      ${item.store_name ? `<p class="registry-store">Suggested: ${esc(item.store_name)}</p>` : ''}
      <h3>${esc(item.title)}</h3>
      ${item.description ? `<p>${esc(item.description)}</p>` : ''}
      ${wanted > 1 ? `<p class="gift-quantity-note-v101"><strong>Quantity wanted:</strong> ${wanted} · <strong>Claimed:</strong> ${claimed}</p>` : ''}
      ${full
        ? `<div class="claimed-message-v071"><strong>All requested quantities are covered.</strong><span>Thank you!</span></div>`
        : `<button class="primary" onclick="openGiftClaimV071('${item.id}')">I'll Take One</button>`}
      ${exampleUrl ? `<a class="registry-example-link-v071" href="${esc(exampleUrl)}" target="_blank" rel="noopener">View example / idea ↗</a>` : ''}
    </div>
  </article>`;
};

openGiftClaimV071 = function(itemId) {
  const item = publicRegistry.find(i => i.id === itemId);
  if (!item || giftRemainingV101(item) <= 0) return;

  const remaining = giftRemainingV101(item);
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop guest-claim-modal-v071" id="modal"><form class="modal-card" onsubmit="saveGiftClaimV071(event,'${item.id}')">
    <div class="modal-heading"><div><p class="eyebrow">Claim a gift</p><h2>${esc(item.title)}</h2></div><button type="button" onclick="closeModal()">×</button></div>
    <p>You are claiming <strong>one</strong> of this gift. ${remaining} ${remaining === 1 ? 'is' : 'are'} currently available. You can buy it wherever you like.</p>
    <div class="form-grid">
      <label class="field wide"><span>Your name</span><input name="claimant_name" required maxlength="120" autocomplete="name" placeholder="Your name"></label>
      <label class="field wide"><span>Email (optional)</span><input type="email" name="claimant_email" maxlength="254" autocomplete="email" placeholder="For a confirmation and release link"></label>
    </div>
    <p class="muted">Your name and email are private and only visible to Jordan and Rochelle. Other guests only see how many are still available.</p>
    <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit">I'll Take One</button></div>
  </form></div>`);
};

saveGiftClaimV071 = async function(event, itemId) {
  event.preventDefault();
  const form = new FormData(event.target);
  const name = String(form.get('claimant_name') || '').trim();
  const email = String(form.get('claimant_email') || '').trim() || null;
  const button = event.submitter;
  if (!name) return;
  if (button) { button.disabled = true; button.textContent = 'Claiming…'; }

  const { data, error } = await db.rpc('claim_registry_item', {
    p_item_id: itemId,
    p_name: name,
    p_email: email
  });
  const result = Array.isArray(data) ? data[0] : data;

  if (error || !result?.success) {
    if (button) { button.disabled = false; button.textContent = "I'll Take One"; }
    const message = error?.message || result?.message || 'This gift could not be claimed.';
    await loadPublicRegistry();
    return toast(message, 'error');
  }

  const item = publicRegistry.find(i => i.id === itemId);
  if (item) {
    item.claimed_quantity = giftClaimedQuantityV101(item) + 1;
    item.claimed_at = giftRemainingV101(item) <= 0 ? new Date().toISOString() : null;
  }

  let emailMessage = '';
  if (email && result.claim_token) {
    try {
      const { error: emailError } = await db.functions.invoke('send-gift-claim-confirmation', {
        body: { claim_token: result.claim_token }
      });
      emailMessage = emailError
        ? '<p class="muted">Your gift is claimed, but the confirmation email could not be sent. Contact Jordan or Rochelle if you need to release it.</p>'
        : `<p>We sent a confirmation to <strong>${esc(email)}</strong> with a private release link.</p>`;
    } catch {
      emailMessage = '<p class="muted">Your gift is claimed, but the confirmation email could not be sent. Contact Jordan or Rochelle if you need to release it.</p>';
    }
  } else {
    emailMessage = '<p>If you change your mind, contact Jordan or Rochelle and they can release your claim.</p>';
  }

  const remaining = item ? giftRemainingV101(item) : null;
  const modal = document.getElementById('modal');
  if (modal) modal.innerHTML = `<div class="modal-card gift-claim-success-v071"><div class="big-icon">♥</div><h2>Thank you, ${esc(name)}!</h2>
    <p>You claimed one <strong>${esc(result.gift_title || item?.title || 'gift')}</strong>.</p>
    ${remaining !== null ? `<p>${remaining ? `${remaining} still available.` : 'All requested quantities are now covered.'}</p>` : ''}
    ${emailMessage}<button class="primary" onclick="closeModal();render()">Done</button></div>`;
};

const baseOpenRegistryDialogQuantityV101 = openRegistryDialog;
openRegistryDialog = function(id = '') {
  baseOpenRegistryDialogQuantityV101(id);
  const item = id ? adminData.registry.find(entry => entry.id === id) : null;
  const sortField = document.querySelector('#modal input[name="sort_order"]')?.closest('.field');
  if (sortField && !document.querySelector('#modal input[name="quantity_wanted"]')) {
    sortField.insertAdjacentHTML(
      'afterend',
      `<label class="field"><span>Quantity wanted</span><input type="number" name="quantity_wanted" min="1" max="100" step="1" required value="${giftQuantityV101(item)}"><small>Guests claim one at a time.</small></label>`
    );
  }
};

saveRegistryItem = async function(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const id = String(form.get('registry_id') || '');
  const itemUrl = String(form.get('item_url') || '').trim();
  const imageUrl = String(form.get('image_url') || '').trim();

  if (itemUrl && !safeUrl(itemUrl)) return toast('The store link must start with http:// or https://.', 'error');
  if (imageUrl && !safeUrl(imageUrl)) return toast('The image link must start with http:// or https://.', 'error');

  const quantityWanted = Math.max(1, Number(form.get('quantity_wanted') || 1));
  const existing = id ? adminData.registry.find(item => item.id === id) : null;
  const alreadyClaimed = giftClaimedQuantityV101(existing);

  if (quantityWanted < alreadyClaimed) {
    return toast(`Quantity wanted cannot be lower than the ${alreadyClaimed} already claimed. Release claims first.`, 'error');
  }

  const payload = {
    title: String(form.get('title') || '').trim(),
    description: String(form.get('description') || '').trim() || null,
    store_name: String(form.get('store_name') || '').trim() || null,
    item_url: itemUrl || null,
    image_url: imageUrl || null,
    is_active: form.get('is_active') === 'on',
    sort_order: Math.max(0, Number(form.get('sort_order') || 0)),
    quantity_wanted: quantityWanted
  };

  const result = id
    ? await db.from('registry_items').update(payload).eq('id', id)
    : await db.from('registry_items').insert(payload).select('id').single();

  if (result.error) return toast(result.error.message, 'error');
  if (!id && result.data?.id) selectedRegistryId = result.data.id;
  closeModal();
  toast(id ? 'Registry item updated.' : 'Registry item added.');
  await loadAdmin();
};

importGiftListV062 = async function(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const XLSX = await ensureXlsxV063();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const start = registryItemsSorted().length * 10 + 10;

    const items = rows.map((row, i) => {
      const keys = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), value])
      );
      return {
        title: String(keys.title || keys.gift || keys.item || '').trim(),
        description: String(keys.description || '').trim() || null,
        store_name: String(keys.store || keys.storename || '').trim() || null,
        item_url: String(keys.url || keys.link || keys.itemurl || '').trim() || null,
        image_url: String(keys.image || keys.imageurl || '').trim() || null,
        quantity_wanted: Math.max(1, Number(keys.quantity || keys.qty || keys.quantitywanted || 1) || 1),
        is_active: true,
        sort_order: start + i * 10
      };
    }).filter(item => item.title);

    if (!items.length) return toast('Your gift list needs a Title, Gift, or Item column.', 'error');
    if (!confirm(`Import ${items.length} gift items? A Quantity column is optional.`)) return;

    const { error } = await db.from('registry_items').insert(items);
    if (error) return toast(error.message, 'error');
    toast(`${items.length} gifts imported.`);
    await loadAdmin();
  } catch (error) {
    toast(`Could not read gift list: ${error.message}`, 'error');
  }
};

renderRegistryListItemV071 = function(item, active) {
  const claims = activeRegistryClaimsV101(item.id);
  const remaining = giftRemainingV101(item);
  const wanted = giftQuantityV101(item);
  const reasons = registryDuplicateReasonsV101(item);
  const status = !item.is_active ? 'Hidden' : (remaining <= 0 ? 'Fully Claimed' : `${remaining}/${wanted} Available`);
  const cls = !item.is_active ? 'hidden' : (remaining <= 0 ? 'claimed' : 'visible');

  return `<button class="registry-list-item ${active ? 'active' : ''} ${reasons.length ? 'possible-duplicate-item-v101' : ''}" onclick="selectRegistryItem('${item.id}')">
    <span class="registry-list-copy"><strong>${esc(item.title)}</strong><small>${claims.length ? `${claims.length} claimed · ${remaining} remaining` : esc(item.store_name || 'Buy anywhere')}</small>${duplicateBadgeV101(reasons)}</span>
    <span class="registry-visibility ${cls}">${status}</span></button>`;
};

renderRegistryPreviewV071 = function(item) {
  const image = safeUrl(item.image_url);
  const remaining = giftRemainingV101(item);
  return `<article class="registry-preview-card ${remaining <= 0 ? 'claimed' : ''}">
    ${image ? `<img src="${esc(image)}" alt="${esc(item.title)}" loading="lazy">` : '<div class="registry-preview-placeholder">🎁</div>'}
    <div><strong>${esc(item.title)}</strong><span>${remaining <= 0 ? 'Fully claimed' : `${remaining} of ${giftQuantityV101(item)} available`}</span></div></article>`;
};

renderRegistryDetailV071 = function(item, all) {
  const index = all.findIndex(entry => entry.id === item.id);
  const itemUrl = safeUrl(item.item_url);
  const imageUrl = safeUrl(item.image_url);
  const claims = activeRegistryClaimsV101(item.id);
  const wanted = giftQuantityV101(item);
  const claimed = giftClaimedQuantityV101(item);
  const remaining = giftRemainingV101(item);
  const reasons = registryDuplicateReasonsV101(item);

  return `<article class="registry-detail-card">
    <div class="registry-detail-header"><div><p class="eyebrow">Gift item</p><h2>${esc(item.title)}</h2>
      <div class="profile-pills"><span class="registry-visibility ${!item.is_active ? 'hidden' : (remaining <= 0 ? 'claimed' : 'visible')}">${!item.is_active ? 'Hidden' : (remaining <= 0 ? 'Fully Claimed' : `${remaining} Available`)}</span></div></div>
      <div class="profile-actions"><button class="secondary" onclick="openRegistryDialog('${item.id}')">Edit</button><button class="danger-button" onclick="deleteRegistryItem('${item.id}')">Delete</button></div></div>
    ${reasons.length ? `<div class="duplicate-warning-v101"><strong>⚠ Possible duplicate</strong><span>${esc(reasons.join(' · '))}</span></div>` : ''}
    <div class="registry-detail-body"><div class="registry-detail-image">${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(item.title)}">` : '<div class="registry-large-placeholder">🎁</div>'}</div>
      <div><div class="profile-info-grid registry-info-grid">
        <div class="profile-info"><span>Suggested store</span><strong>${esc(item.store_name || 'Buy anywhere')}</strong></div>
        <div class="profile-info"><span>Quantity wanted</span><strong>${wanted}</strong></div>
        <div class="profile-info"><span>Claimed</span><strong>${claimed}</strong></div>
        <div class="profile-info"><span>Still available</span><strong>${remaining}</strong></div>
        <div class="profile-info"><span>Guest order</span><strong>${index + 1} of ${all.length}</strong></div>
        <div class="profile-info"><span>Visibility</span><strong>${item.is_active ? 'Shown to guests' : 'Hidden from guests'}</strong></div>
        <div class="profile-info"><span>Example link</span><strong>${itemUrl ? `<a href="${esc(itemUrl)}" target="_blank" rel="noopener">Open example ↗</a>` : '—'}</strong></div>
      </div>
      ${item.description ? `<section class="profile-section"><h3>Description</h3><p class="job-description">${esc(item.description)}</p></section>` : ''}
      ${claims.length ? `<section class="profile-section registry-claim-admin-v071"><div class="panel-heading"><div><h3>Active Claims</h3><p class="muted">Claimant information is private.</p></div></div>
        <div class="gift-claim-list-v101">${claims.map((claim, claimIndex) => `<div class="gift-claim-row-v101">
          <div><strong>${esc(claim.claimant_name)}</strong><span>${esc(claim.claimant_email || 'No email')} · ${formatDate(claim.created_at)}</span></div>
          <button class="secondary" onclick="releaseRegistryClaimByIdV101('${claim.id}')">Release This Claim</button>
        </div>`).join('')}</div></section>` : ''}
      <section class="profile-section"><div class="registry-action-grid"><button class="secondary" onclick="toggleRegistryVisibility('${item.id}')">${item.is_active ? 'Hide from Guests' : 'Show to Guests'}</button>
        <button class="secondary" onclick="moveRegistryItem('${item.id}',-1)" ${index <= 0 ? 'disabled' : ''}>Move Up</button>
        <button class="secondary" onclick="moveRegistryItem('${item.id}',1)" ${index >= all.length - 1 ? 'disabled' : ''}>Move Down</button></div></section>
      </div></div>
  </article>`;
};

renderRegistryManagerV071 = function() {
  const all = registryItemsSorted();
  const query = registrySearch.trim().toLowerCase();
  const filtered = query ? all.filter(item => {
    const claims = activeRegistryClaimsV101(item.id);
    return [item.title, item.description, item.store_name, item.item_url, ...claims.flatMap(c => [c.claimant_name, c.claimant_email])]
      .some(value => String(value || '').toLowerCase().includes(query));
  }) : all;

  const totalUnits = all.filter(item => item.is_active).reduce((sum, item) => sum + giftQuantityV101(item), 0);
  const claimedUnits = all.filter(item => item.is_active).reduce((sum, item) => sum + giftClaimedQuantityV101(item), 0);
  const availableUnits = Math.max(0, totalUnits - claimedUnits);

  let selected = filtered.find(item => item.id === selectedRegistryId) || null;
  if (!selected && filtered.length) {
    selected = filtered[0];
    selectedRegistryId = selected.id;
  }

  return `<div class="admin-view">
    <div class="view-heading"><div><p class="eyebrow">Gift choices</p><h1>Registry Manager</h1><p>Guests claim one unit at a time and can buy it wherever they prefer.</p></div>
      <div class="heading-actions"><button class="secondary" onclick="document.getElementById('gift-import').click()">Import Gift List</button><input id="gift-import" hidden type="file" accept=".xlsx,.xls,.csv" onchange="importGiftListV062(event)"><button class="primary" onclick="openRegistryDialog()">Add Gift</button></div></div>
    <section class="registry-metric-grid">${metricCard('Gift ideas', all.length, 'Different items')}${metricCard('Wanted', totalUnits, 'Total gift units')}${metricCard('Claimed', claimedUnits, 'Units chosen')}${metricCard('Available', availableUnits, 'Units still open')}</section>
    <div class="registry-toolbar"><input id="registry-search" type="search" value="${esc(registrySearch)}" placeholder="Search gifts or guest claims" oninput="setRegistrySearch(this.value)"><span>${filtered.length} item${filtered.length === 1 ? '' : 's'}</span></div>
    <div class="registry-split">
      <aside class="registry-list">${filtered.length ? filtered.map(item => renderRegistryListItemV071(item, selected?.id === item.id)).join('') : '<p class="muted registry-empty">No matching gifts.</p>'}</aside>
      <section class="registry-detail">${selected ? renderRegistryDetailV071(selected, all) : `<div class="empty-state admin-empty"><div class="big-icon">🎁</div><h2>No gifts yet</h2><p>Add or import your first gift idea.</p><button class="primary" onclick="openRegistryDialog()">Add Gift</button></div>`}</section>
    </div>
    ${all.length ? `<section class="admin-panel registry-preview-panel"><div class="panel-heading"><div><h2>Guest preview</h2><p class="muted">Guests see how many of each gift are still available.</p></div></div>
      <div class="registry-preview-grid">${all.filter(i => i.is_active).map(renderRegistryPreviewV071).join('') || '<p class="muted">No gifts are visible to guests.</p>'}</div></section>` : ''}
  </div>`;
};

async function releaseRegistryClaimByIdV101(claimId) {
  const claim = (adminData.registryClaims || []).find(c => c.id === claimId);
  if (!claim) return;
  if (!confirm(`Release ${claim.claimant_name}'s claim? One unit will become available again.`)) return;

  const { error } = await db.rpc('admin_release_registry_claim', { p_claim_id: claimId });
  if (error) return toast(error.message, 'error');

  toast('Gift claim released.');
  await loadAdmin();
};

// Wedding Summary: quantity-aware registry availability.
const baseSummaryMetricsQuantitiesV101 = summaryMetricsV080;
summaryMetricsV080 = function() {
  const metrics = baseSummaryMetricsQuantitiesV101();
  const visible = (adminData.registry || []).filter(item => item.is_active);
  metrics.availableGifts = visible.filter(item => giftRemainingV101(item) > 0);
  metrics.claimedGifts = visible.filter(item => giftClaimedQuantityV101(item) > 0);
  return metrics;
};


/* ===== v1.0.2 Select People Inside a Household ===== */

let selectedGuestPersonKeyV102 = '';

function householdPeopleForRecordV102(record) {
  if (!record) return [];

  if (record.rsvp) {
    const people = rsvpPeopleV071(record.rsvp.id);
    if (people.length) {
      return people.map(person => ({
        key: `person:${person.id}`,
        id: person.id,
        name: person.person_name,
        type: person.person_type || 'adult',
        source: 'rsvp'
      }));
    }

    const fallbackName = `${record.rsvp.first_name || ''} ${record.rsvp.last_name || ''}`.trim();
    return fallbackName ? [{
      key: `rsvp:${record.rsvp.id}`,
      id: '',
      name: fallbackName,
      type: 'adult',
      source: 'rsvp'
    }] : [];
  }

  if (record.invitation) {
    const people = invitationPeopleV101(record.invitation.id);
    if (people.length) {
      return people.map(person => ({
        key: `invite-person:${person.id}`,
        id: person.id,
        name: person.person_name,
        type: 'invited',
        source: 'invitation'
      }));
    }

    const fallbackName = `${record.invitation.primary_first_name || ''} ${record.invitation.primary_last_name || ''}`.trim();
    return fallbackName ? [{
      key: `invite:${record.invitation.id}`,
      id: '',
      name: fallbackName,
      type: 'invited',
      source: 'invitation'
    }] : [];
  }

  return [];
}

function activePersonForRecordV102(record) {
  const people = householdPeopleForRecordV102(record);
  if (!people.length) return null;

  const selected = people.find(person => person.key === selectedGuestPersonKeyV102);
  return selected || people[0];
}

function chooseHouseholdPersonV102(recordKey, personKey) {
  const [type, id] = String(recordKey || '').split(':');
  selectedGuestId = type === 'rsvp' ? id : null;
  selectedInvitationProfileId = type === 'invitation' ? id : null;
  selectedGuestPersonKeyV102 = personKey || '';
  render();
}

const baseSelectGuestRecordV102 = selectGuestRecord;
selectGuestRecord = function(key) {
  selectedGuestPersonKeyV102 = '';
  baseSelectGuestRecordV102(key);
};

const baseOpenGuestByRsvpV102 = openGuestByRsvp;
openGuestByRsvp = function(id) {
  selectedGuestPersonKeyV102 = '';
  baseOpenGuestByRsvpV102(id);
};

const baseOpenGuestByInvitationV102 = openGuestByInvitation;
openGuestByInvitation = function(id) {
  selectedGuestPersonKeyV102 = '';
  baseOpenGuestByInvitationV102(id);
};

function renderHouseholdGuestListItemV102(record, active) {
  const people = householdPeopleForRecordV102(record);
  const reasons = recordDuplicateReasonsV101(record);
  const activePerson = active ? activePersonForRecordV102(record) : null;
  const sub = record.rsvp
    ? `${titleCase(record.rsvp.attendance)} · ${people.length} ${people.length === 1 ? 'person' : 'people'}`
    : `No RSVP yet · ${people.length} ${people.length === 1 ? 'person' : 'people'}`;

  return `<div class="guest-household-group-v102 ${active ? 'active' : ''} ${reasons.length ? 'possible-duplicate-item-v101' : ''}">
    <button class="guest-household-main-v102" onclick="chooseHouseholdPersonV102('${record.key}','${esc(people[0]?.key || '')}')">
      <span class="guest-avatar">${esc((record.household || record.name || '?').charAt(0).toUpperCase())}</span>
      <span class="guest-list-copy">
        <strong>${esc(record.household || record.name)}</strong>
        <small>${esc(sub)}</small>
        ${duplicateBadgeV101(reasons)}
      </span>
      ${record.rsvp ? statusPill(record.rsvp.verification_status) : statusPill(record.invitation.status)}
    </button>
    ${people.length ? `<div class="guest-household-people-v102">
      ${people.map(person => `<button
        class="guest-person-choice-v102 ${activePerson?.key === person.key ? 'active' : ''}"
        onclick="chooseHouseholdPersonV102('${record.key}','${esc(person.key)}')">
        <span>${esc(person.name)}</span>
        <small>${person.source === 'rsvp' ? esc(titleCase(person.type)) : 'Invited'}</small>
      </button>`).join('')}
    </div>` : ''}
  </div>`;
}

renderGuestProfiles = function() {
  const all = guestRecords();
  const query = guestSearch.trim().toLowerCase();

  const filtered = query ? all.filter(record => {
    const peopleText = householdPeopleForRecordV102(record).map(person => person.name).join(' ');
    return [
      record.name, record.household, record.phone, record.email, record.city, record.state,
      record.rsvp?.additional_guests, record.invitation?.private_notes, peopleText
    ].some(value => String(value || '').toLowerCase().includes(query));
  }) : all;

  let selected = null;
  if (selectedGuestId) {
    selected = filtered.find(record => record.type === 'rsvp' && record.id === selectedGuestId) || null;
  }
  if (!selected && selectedInvitationProfileId) {
    selected = filtered.find(record => record.type === 'invitation' && record.id === selectedInvitationProfileId) || null;
  }

  if (!selected && filtered.length) {
    selected = filtered[0];
    selectedGuestId = selected.type === 'rsvp' ? selected.id : null;
    selectedInvitationProfileId = selected.type === 'invitation' ? selected.id : null;
    selectedGuestPersonKeyV102 = householdPeopleForRecordV102(selected)[0]?.key || '';
  }

  if (selected && !selectedGuestPersonKeyV102) {
    selectedGuestPersonKeyV102 = householdPeopleForRecordV102(selected)[0]?.key || '';
  }

  return `<div class="admin-view">
    <div class="view-heading"><div><p class="eyebrow">People & households</p><h1>Guest Profiles</h1>
      <p>Select a household, then choose the individual person you want to work with.</p></div></div>
    <div class="guest-toolbar">
      <input id="guest-search" type="search" value="${esc(guestSearch)}" placeholder="Search household, person, phone, email, city, or notes" oninput="setGuestSearch(this.value)">
      <span>${filtered.length} household${filtered.length === 1 ? '' : 's'}</span>
    </div>
    <div class="guest-split">
      <aside class="guest-list guest-household-list-v102">
        ${filtered.length ? filtered.map(record => renderHouseholdGuestListItemV102(record, selected?.key === record.key)).join('') : '<p class="muted guest-empty">No matching guests.</p>'}
      </aside>
      <section class="guest-profile-detail">
        ${selected ? renderSelectedGuestPersonProfileV102(selected) : '<div class="empty-state admin-empty"><h2>No guest selected</h2></div>'}
      </section>
    </div>
  </div>`;
};

function renderSelectedGuestPersonProfileV102(record) {
  const people = householdPeopleForRecordV102(record);
  const person = activePersonForRecordV102(record);

  if (!person) return renderGuestProfile(record);

  const focusedRecord = {
    ...record,
    name: person.name
  };

  let html = renderGuestProfile(focusedRecord);

  const selector = `<section class="selected-household-members-v102">
    <div class="profile-section-heading"><div><h3>${esc(record.household)}</h3><p class="muted">Choose a person in this household</p></div></div>
    <div class="selected-member-buttons-v102">
      ${people.map(member => `<button class="${member.key === person.key ? 'active' : ''}"
        onclick="chooseHouseholdPersonV102('${record.key}','${esc(member.key)}')">${esc(member.name)}</button>`).join('')}
    </div>
  </section>`;

  html = html.replace('<div class="profile-info-grid">', selector + '<div class="profile-info-grid">');

  // Focus the wedding-job list on the selected person instead of showing every
  // household member's assignment together.
  const personAssignments = (adminData.assignments || []).filter(assignment => {
    if (person.key.startsWith('person:')) {
      return assignment.rsvp_person_id === person.id ||
        (!assignment.rsvp_person_id && assignment.rsvp_id === record.rsvp?.id && assignment.person_name === person.name);
    }
    return assignment.invitation_id === record.invitation?.id && assignment.person_name === person.name;
  });

  const jobsSectionPattern = /<section class="profile-section"><div class="profile-section-heading"><h3>Wedding jobs<\/h3>[\s\S]*?<\/section>/;
  const personJobSection = `<section class="profile-section">
    <div class="profile-section-heading"><h3>Wedding jobs for ${esc(person.name)}</h3>
      <button onclick="openAssignmentDialogForPersonV102('${record.rsvp?.id || ''}','${record.invitation?.id || ''}','${esc(person.key)}')">Assign job</button>
    </div>
    ${personAssignments.length ? `<div class="assignment-list">${personAssignments.map(renderAssignmentRow).join('')}</div>` : `<p class="muted">No wedding jobs assigned to ${esc(person.name)}.</p>`}
  </section>`;

  html = html.replace(jobsSectionPattern, personJobSection);
  return html;
}

function openAssignmentDialogForPersonV102(rsvpId = '', invitationId = '', personKey = '') {
  openAssignmentDialog(rsvpId, invitationId, '');

  requestAnimationFrame(() => {
    const select = document.querySelector('#modal select[name="guest_record"]');
    if (!select) return;

    const option = [...select.options].find(item => item.value === personKey);
    if (!option) return;

    select.value = personKey;
    fillProfileAssignmentEmailV063(personKey);
  });
}


/* ===== v1.0.3 Invitation duplicate-name fix + restore row actions ===== */

// Invitation duplicates now explicitly include an exact Primary First + Last match,
// regardless of household wording, phone, email, or address.
invitationDuplicateReasonsV101 = function(invitation) {
  const reasons = [];
  const invitations = (adminData.invitations || []).filter(item => item.status !== 'cancelled');

  const first = normalizeDuplicateTextV101(invitation.primary_first_name);
  const last = normalizeDuplicateTextV101(invitation.primary_last_name);
  const fullName = `${first} ${last}`.trim();
  const household = normalizeDuplicateTextV101(invitation.household_name);
  const email = normalizeDuplicateTextV101(invitation.email);
  const phone = normalizePhoneV101(invitation.phone);

  if (first && last) {
    const samePrimaryName = invitations.some(other =>
      other.id !== invitation.id &&
      normalizeDuplicateTextV101(other.primary_first_name) === first &&
      normalizeDuplicateTextV101(other.primary_last_name) === last
    );
    if (samePrimaryName) reasons.push('same first and last name');
  } else if (fullName) {
    const samePrimaryName = invitations.some(other =>
      other.id !== invitation.id &&
      normalizeDuplicateTextV101(`${other.primary_first_name || ''} ${other.primary_last_name || ''}`) === fullName
    );
    if (samePrimaryName) reasons.push('same primary name');
  }

  if (household) {
    const sameHousehold = invitations.some(other =>
      other.id !== invitation.id &&
      normalizeDuplicateTextV101(other.household_name) === household
    );
    if (sameHousehold) reasons.push('same household name');
  }

  if (email) {
    const sameEmail = invitations.some(other =>
      other.id !== invitation.id &&
      normalizeDuplicateTextV101(other.email) === email
    );
    if (sameEmail) reasons.push('same email');
  }

  if (phone.length >= 7) {
    const samePhone = invitations.some(other =>
      other.id !== invitation.id &&
      normalizePhoneV101(other.phone) === phone
    );
    if (samePhone) reasons.push('same phone');
  }

  return [...new Set(reasons)];
};

// Restore the Actions column that was lost when duplicate highlighting was added.
invitationTable = function(items) {
  if (!items.length) return '<p class="muted">No invitations found.</p>';

  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>Household</th>
      <th>Primary contact</th>
      <th>Contact</th>
      <th>Allowed</th>
      <th>Status</th>
      <th>Actions</th>
    </tr></thead>
    <tbody>
      ${items.map(item => {
        const reasons = invitationDuplicateReasonsV101(item);
        return `<tr class="${reasons.length ? 'possible-duplicate-row-v101' : ''}">
          <td>
            <strong>${esc(item.household_name)}</strong>
            ${duplicateBadgeV101(reasons)}
            <br><small>${esc([item.city, item.state].filter(Boolean).join(', '))}</small>
          </td>
          <td>${esc(item.primary_first_name)} ${esc(item.primary_last_name)}</td>
          <td>${esc(item.phone || item.email || '—')}</td>
          <td>${item.max_guests}</td>
          <td>${statusPill(item.status)}</td>
          <td>
            <div class="table-actions">
              <button onclick="openGuestByInvitation('${item.id}')">Profile</button>
              <button onclick="openInvitationDialog('${item.id}')">Edit</button>
              <button class="danger-text" onclick="deleteInvitation('${item.id}')">Delete</button>
            </div>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
};


/* ===== v1.0.4 Duplicate detection across every person in a household ===== */

function invitationPersonNamesForDuplicatesV104(invitation) {
  // Prefer the persisted individual people created by v1.0.1.
  const stored = invitationPeopleV101(invitation.id)
    .map(person => normalizeDuplicateTextV101(person.person_name))
    .filter(Boolean);

  if (stored.length) return [...new Set(stored)];

  // Fallback for any older/cached record where invitation_people is missing.
  return parseInvitationPeopleV101(
    invitation.household_name,
    invitation.primary_first_name,
    invitation.primary_last_name
  )
    .map(name => normalizeDuplicateTextV101(name))
    .filter(Boolean);
}

function matchingInvitationPeopleV104(invitation) {
  const names = invitationPersonNamesForDuplicatesV104(invitation);
  const matches = new Set();

  if (!names.length) return [];

  (adminData.invitations || [])
    .filter(other => other.id !== invitation.id && other.status !== 'cancelled')
    .forEach(other => {
      const otherNames = new Set(invitationPersonNamesForDuplicatesV104(other));
      names.forEach(name => {
        if (otherNames.has(name)) matches.add(name);
      });
    });

  return [...matches];
}

invitationDuplicateReasonsV101 = function(invitation) {
  const reasons = [];
  const invitations = (adminData.invitations || []).filter(item => item.status !== 'cancelled');

  const matchingPeople = matchingInvitationPeopleV104(invitation);
  if (matchingPeople.length) {
    reasons.push(`same person: ${matchingPeople.join(', ')}`);
  }

  const household = normalizeDuplicateTextV101(invitation.household_name);
  const email = normalizeDuplicateTextV101(invitation.email);
  const phone = normalizePhoneV101(invitation.phone);

  if (household) {
    const sameHousehold = invitations.some(other =>
      other.id !== invitation.id &&
      normalizeDuplicateTextV101(other.household_name) === household
    );
    if (sameHousehold) reasons.push('same household name');
  }

  if (email) {
    const sameEmail = invitations.some(other =>
      other.id !== invitation.id &&
      normalizeDuplicateTextV101(other.email) === email
    );
    if (sameEmail) reasons.push('same email');
  }

  if (phone.length >= 7) {
    const samePhone = invitations.some(other =>
      other.id !== invitation.id &&
      normalizePhoneV101(other.phone) === phone
    );
    if (samePhone) reasons.push('same phone');
  }

  return [...new Set(reasons)];
};


/* ===== v1.0.5 Household People Editor + Duplicate Review ===== */

function duplicatePairKeyV105(type, leftId, rightId) {
  const ids = [String(leftId || ''), String(rightId || '')].sort();
  return `${type}:${ids[0]}:${ids[1]}`;
}

function duplicatePairDismissedV105(type, leftId, rightId) {
  const key = duplicatePairKeyV105(type, leftId, rightId);
  return (adminData.duplicateDismissals || []).some(row =>
    duplicatePairKeyV105(row.entity_type, row.left_id, row.right_id) === key
  );
}

const baseLoadAdminV105 = loadAdmin;
loadAdmin = async function() {
  await baseLoadAdminV105();
  if (!db || !session) return;

  // duplicate_dismissals is now included in the base initial admin load.
  // This second read keeps subsequent in-app refreshes current.
  const { data, error } = await db
    .from('duplicate_dismissals')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error) {
    adminData.duplicateDismissals = data || [];
  } else if (!Array.isArray(adminData.duplicateDismissals)) {
    adminData.duplicateDismissals = [];
  }
  render();
};

function invitationDuplicateMatchesV105(invitation) {
  const matches = [];
  const myNames = new Set(invitationPersonNamesForDuplicatesV104(invitation));
  const household = normalizeDuplicateTextV101(invitation.household_name);
  const email = normalizeDuplicateTextV101(invitation.email);
  const phone = normalizePhoneV101(invitation.phone);

  (adminData.invitations || [])
    .filter(other => other.id !== invitation.id && other.status !== 'cancelled')
    .forEach(other => {
      if (duplicatePairDismissedV105('invitation', invitation.id, other.id)) return;

      const reasons = [];
      const otherNames = new Set(invitationPersonNamesForDuplicatesV104(other));
      const samePeople = [...myNames].filter(name => otherNames.has(name));

      if (samePeople.length) reasons.push(`same person: ${samePeople.join(', ')}`);
      if (household && normalizeDuplicateTextV101(other.household_name) === household) reasons.push('same household name');
      if (email && normalizeDuplicateTextV101(other.email) === email) reasons.push('same email');
      if (phone.length >= 7 && normalizePhoneV101(other.phone) === phone) reasons.push('same phone');

      if (reasons.length) {
        matches.push({
          id: other.id,
          label: other.household_name || `${other.primary_first_name || ''} ${other.primary_last_name || ''}`.trim(),
          reasons
        });
      }
    });

  return matches;
}

invitationDuplicateReasonsV101 = function(invitation) {
  return [...new Set(invitationDuplicateMatchesV105(invitation).flatMap(match => match.reasons))];
};

function openDuplicateReviewV105(invitationId) {
  const invitation = (adminData.invitations || []).find(item => item.id === invitationId);
  if (!invitation) return;

  const matches = invitationDuplicateMatchesV105(invitation);

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal">
    <div class="modal-card duplicate-review-modal-v105">
      <div class="modal-heading">
        <div><p class="eyebrow">Duplicate review</p><h2>${esc(invitation.household_name)}</h2></div>
        <button type="button" onclick="closeModal()">×</button>
      </div>

      ${matches.length ? `<p>These records look similar. If two records are actually different people or households, mark them <strong>Not a duplicate</strong>.</p>
        <div class="duplicate-review-list-v105">
          ${matches.map(match => `<article>
            <div>
              <strong>${esc(match.label)}</strong>
              <span>${esc(match.reasons.join(' · '))}</span>
            </div>
            <button class="secondary" onclick="dismissInvitationDuplicateV105('${invitation.id}','${match.id}')">Not a duplicate</button>
          </article>`).join('')}
        </div>`
        : '<div class="empty-state"><h3>No active duplicate warnings</h3><p>This invitation has no unresolved duplicate matches.</p></div>'}

      <div class="modal-actions"><button class="primary" type="button" onclick="closeModal()">Done</button></div>
    </div>
  </div>`);
}

async function dismissInvitationDuplicateV105(leftId, rightId) {
  if (!confirm('Confirm these are NOT duplicates? This warning will stay dismissed.')) return;

  const { error } = await db.rpc('dismiss_duplicate_pair', {
    p_entity_type: 'invitation',
    p_left_id: leftId,
    p_right_id: rightId
  });

  if (error) return toast(error.message, 'error');

  toast('Marked as not a duplicate.');
  closeModal();
  await loadAdmin();
}

function invitationDuplicateActionV105(item) {
  const matches = invitationDuplicateMatchesV105(item);
  if (!matches.length) return '';
  return `<button class="duplicate-review-button-v105" onclick="openDuplicateReviewV105('${item.id}')">Review duplicate</button>`;
}

invitationTable = function(items) {
  if (!items.length) return '<p class="muted">No invitations found.</p>';

  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>Household</th>
      <th>Primary contact</th>
      <th>Contact</th>
      <th>Allowed</th>
      <th>Status</th>
      <th>Actions</th>
    </tr></thead>
    <tbody>
      ${items.map(item => {
        const reasons = invitationDuplicateReasonsV101(item);
        return `<tr class="${reasons.length ? 'possible-duplicate-row-v101' : ''}">
          <td>
            <strong>${esc(item.household_name)}</strong>
            ${duplicateBadgeV101(reasons)}
            ${invitationDuplicateActionV105(item)}
            <br><small>${esc([item.city, item.state].filter(Boolean).join(', '))}</small>
          </td>
          <td>${esc(item.primary_first_name)} ${esc(item.primary_last_name)}</td>
          <td>${esc(item.phone || item.email || '—')}</td>
          <td>${item.max_guests}</td>
          <td>${statusPill(item.status)}</td>
          <td>
            <div class="table-actions">
              <button onclick="openGuestByInvitation('${item.id}')">Profile</button>
              <button onclick="openInvitationDialog('${item.id}')">Edit</button>
              <button class="danger-text" onclick="deleteInvitation('${item.id}')">Delete</button>
            </div>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
};

// ------------------------------------------------------------
// Invitation household people editor
// ------------------------------------------------------------

function invitationPeopleForEditV105(invitation) {
  if (!invitation) return [];

  const stored = invitationPeopleV101(invitation.id);
  if (stored.length) {
    return stored.map(person => ({
      id: person.id,
      person_name: person.person_name,
      person_type: person.person_type || 'adult',
      sort_order: Number(person.sort_order || 0)
    }));
  }

  return parseInvitationPeopleV101(
    invitation.household_name,
    invitation.primary_first_name,
    invitation.primary_last_name
  ).map((name, index) => ({
    id: '',
    person_name: name,
    person_type: 'adult',
    sort_order: index
  }));
}

function invitationPersonRowV105(person = {}, index = 0) {
  return `<div class="invitation-person-row-v105" data-person-id="${esc(person.id || '')}">
    <label class="field">
      <span>Person ${index + 1}</span>
      <input name="invite_person_name" required value="${esc(person.person_name || '')}" placeholder="Full name">
    </label>
    <label class="field invitation-person-type-v105">
      <span>Type</span>
      <select name="invite_person_type">
        <option value="adult" ${(person.person_type || 'adult') === 'adult' ? 'selected' : ''}>Adult</option>
        <option value="child" ${person.person_type === 'child' ? 'selected' : ''}>Child</option>
      </select>
    </label>
    <button class="danger-text invitation-person-remove-v105" type="button" onclick="removeInvitationPersonRowV105(this)">Remove</button>
  </div>`;
}

function renumberInvitationPeopleV105() {
  document.querySelectorAll('#invitation-people-editor-v105 .invitation-person-row-v105').forEach((row, index) => {
    const label = row.querySelector('.field span');
    if (label) label.textContent = `Person ${index + 1}`;
  });
}

function addInvitationPersonRowV105(type = 'adult') {
  const editor = document.getElementById('invitation-people-editor-v105');
  if (!editor) return;
  const index = editor.querySelectorAll('.invitation-person-row-v105').length;
  editor.insertAdjacentHTML('beforeend', invitationPersonRowV105({ person_type: type }, index));
}

function removeInvitationPersonRowV105(button) {
  const editor = document.getElementById('invitation-people-editor-v105');
  if (!editor) return;

  const rows = editor.querySelectorAll('.invitation-person-row-v105');
  if (rows.length <= 1) return toast('An invitation needs at least one named person.', 'error');

  button.closest('.invitation-person-row-v105')?.remove();
  renumberInvitationPeopleV105();
}

function collectInvitationPeopleV105(form) {
  return [...form.querySelectorAll('#invitation-people-editor-v105 .invitation-person-row-v105')].map((row, index) => ({
    id: row.dataset.personId || '',
    person_name: String(row.querySelector('[name="invite_person_name"]')?.value || '').trim(),
    person_type: String(row.querySelector('[name="invite_person_type"]')?.value || 'adult'),
    sort_order: index
  }));
}

function splitNameForPrimaryV105(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return {
    first: parts.slice(0, -1).join(' '),
    last: parts[parts.length - 1]
  };
}

openInvitationDialog = function(id = null) {
  const item = id ? adminData.invitations.find(entry => entry.id === id) : null;
  const value = name => esc(item?.[name] ?? '');
  let people = invitationPeopleForEditV105(item);

  if (!people.length) {
    const initial = item
      ? `${item.primary_first_name || ''} ${item.primary_last_name || ''}`.trim()
      : '';
    people = [{ id: '', person_name: initial, person_type: 'adult', sort_order: 0 }];
  }

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal">
    <form class="modal-card invitation-edit-modal-v105" onsubmit="saveInvitation(event, '${id || ''}')">
      <div class="modal-heading"><h2>${item ? 'Edit' : 'Add'} Invitation</h2><button type="button" onclick="closeModal()">×</button></div>

      <div class="form-grid">
        <label class="field wide">
          <span>Household name</span>
          <input name="household_name" required value="${value('household_name')}" placeholder="Example: John and Joe Weaver">
          <small>This is how the household is labeled. Individual people are managed below.</small>
        </label>

        <label class="field"><span>Maximum guests</span><input type="number" name="max_guests" min="1" max="50" required value="${item?.max_guests ?? Math.max(1, people.length)}"></label>
        <label class="field"><span>Status</span><select name="status">${['invited','responded','declined','cancelled'].map(status => `<option value="${status}" ${item?.status === status ? 'selected' : ''}>${titleCase(status)}</option>`).join('')}</select></label>

        ${['phone','email','street_address','city','state','zip_code'].map(name => `<label class="field ${name === 'street_address' ? 'wide' : ''}"><span>${titleCase(name)}</span><input name="${name}" value="${value(name)}"></label>`).join('')}

        <label class="field wide"><span>Private notes</span><textarea name="private_notes" rows="4">${value('private_notes')}</textarea></label>
      </div>

      <section class="invitation-people-editor-section-v105">
        <div class="profile-section-heading">
          <div>
            <h3>People in this household</h3>
            <p class="muted">The first adult is used as the primary contact name. Add everyone you want individually selectable in Guest Profiles and Wedding Jobs.</p>
          </div>
          <div class="invitation-person-add-actions-v105">
            <button class="secondary" type="button" onclick="addInvitationPersonRowV105('adult')">+ Adult</button>
            <button class="secondary" type="button" onclick="addInvitationPersonRowV105('child')">+ Child</button>
          </div>
        </div>

        <div id="invitation-people-editor-v105">
          ${people.map(invitationPersonRowV105).join('')}
        </div>
      </section>

      <div class="modal-actions">
        <button type="button" class="secondary" onclick="closeModal()">Cancel</button>
        <button class="primary" type="submit">Save Invitation & People</button>
      </div>
    </form>
  </div>`);
};

saveInvitation = async function(event, id = '') {
  event.preventDefault();

  const formElement = event.target;
  const submit = formElement.querySelector('[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Saving…';
  }

  const form = new FormData(formElement);
  const people = collectInvitationPeopleV105(formElement);

  if (!people.length || people.some(person => !person.person_name)) {
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Save Invitation & People';
    }
    return toast('Enter a name for every person in the household.', 'error');
  }

  const primaryPerson = people.find(person => person.person_type === 'adult') || people[0];
  const primary = splitNameForPrimaryV105(primaryPerson.person_name);

  const payload = {
    household_name: String(form.get('household_name') || '').trim(),
    primary_first_name: primary.first,
    primary_last_name: primary.last,
    max_guests: Math.max(1, Number(form.get('max_guests') || people.length)),
    status: String(form.get('status') || 'invited')
  };

  for (const key of ['phone','email','street_address','city','state','zip_code','private_notes']) {
    payload[key] = String(form.get(key) || '').trim() || null;
  }

  if (!payload.household_name) {
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Save Invitation & People';
    }
    return toast('Enter a household name.', 'error');
  }

  let invitationId = id;

  if (id) {
    const { error } = await db.from('invitations').update(payload).eq('id', id);
    if (error) {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Save Invitation & People';
      }
      return toast(error.message, 'error');
    }
  } else {
    const { data, error } = await db.from('invitations').insert(payload).select('id').single();
    if (error) {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Save Invitation & People';
      }
      return toast(error.message, 'error');
    }
    invitationId = data.id;
  }

  // Replace the household people with exactly what is shown in the editor.
  // Existing IDs are retained when possible so the records stay stable.
  const existing = id ? invitationPeopleV101(id) : [];
  const existingIds = new Set(existing.map(person => person.id));
  const keptIds = new Set();

  for (const person of people) {
    if (person.id && existingIds.has(person.id)) {
      keptIds.add(person.id);
      const { error } = await db.from('invitation_people').update({
        person_name: person.person_name,
        person_type: person.person_type,
        sort_order: person.sort_order
      }).eq('id', person.id);

      if (error) {
        return toast(`Invitation saved, but a person could not be updated: ${error.message}`, 'error');
      }
    } else {
      const { error } = await db.from('invitation_people').insert({
        invitation_id: invitationId,
        person_name: person.person_name,
        person_type: person.person_type,
        sort_order: person.sort_order
      });

      if (error) {
        // On brand-new invitations the insert trigger may already have created
        // one or more matching names. Update those rows after reloading instead
        // of failing on the unique invitation/name rule.
        if (!String(error.message || '').toLowerCase().includes('duplicate')) {
          return toast(`Invitation saved, but a person could not be added: ${error.message}`, 'error');
        }
      }
    }
  }

  if (id) {
    const removeIds = existing
      .filter(person => !keptIds.has(person.id) && !people.some(newPerson => newPerson.id === person.id))
      .map(person => person.id);

    if (removeIds.length) {
      const { error } = await db.from('invitation_people').delete().in('id', removeIds);
      if (error) return toast(`Invitation saved, but an old household member could not be removed: ${error.message}`, 'error');
    }
  } else {
    // The insert trigger generated parsed defaults. Make the final set exactly
    // match the editor, including adult/child types and ordering.
    const { data: generated, error: generatedError } = await db
      .from('invitation_people')
      .select('*')
      .eq('invitation_id', invitationId);

    if (!generatedError) {
      const wantedNames = new Set(people.map(person => normalizeDuplicateTextV101(person.person_name)));
      const extras = (generated || []).filter(row => !wantedNames.has(normalizeDuplicateTextV101(row.person_name)));
      if (extras.length) {
        await db.from('invitation_people').delete().in('id', extras.map(row => row.id));
      }

      for (const person of people) {
        const row = (generated || []).find(g => normalizeDuplicateTextV101(g.person_name) === normalizeDuplicateTextV101(person.person_name));
        if (row) {
          await db.from('invitation_people').update({
            person_type: person.person_type,
            sort_order: person.sort_order
          }).eq('id', row.id);
        }
      }
    }
  }

  closeModal();
  toast(id ? 'Invitation and household people updated.' : 'Invitation and household people added.');
  await loadAdmin();
};




/* ===== v1.0.7 Reliable People + Multi-Assign Jobs + Per-Person Email ===== */

function normalizedPersonNameV107(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function invitationPersonEmailForRsvpMemberV107(invitationId, personName) {
  if (!invitationId) return '';
  const wanted = normalizedPersonNameV107(personName);
  const match = (adminData.invitationPeople || []).find(person =>
    person.invitation_id === invitationId &&
    normalizedPersonNameV107(person.person_name) === wanted
  );
  return match?.email || '';
}

// Use each person's own invitation email whenever possible.
// For RSVP-linked people, match their RSVP name back to the person on the invitation.
assignmentPeopleV063 = function() {
  const rows = [];
  const rsvps = adminData.rsvps || [];
  const rsvpPeople = adminData.rsvpPeople || [];
  const invitationPeople = adminData.invitationPeople || [];
  const invitations = adminData.invitations || [];

  rsvps.forEach(rsvp => {
    const invitation = rsvp.invitation_id ? invitations.find(i => i.id === rsvp.invitation_id) : null;
    const household = invitation?.household_name || `${rsvp.first_name} ${rsvp.last_name}`.trim();
    const members = rsvpPeople.filter(p => p.rsvp_id === rsvp.id);

    if (members.length) {
      members.forEach(member => rows.push({
        key: `person:${member.id}`,
        person_id: member.id,
        rsvp_id: rsvp.id,
        invitation_id: rsvp.invitation_id || null,
        invitation_person_id: null,
        person_name: member.person_name,
        household,
        email: invitationPersonEmailForRsvpMemberV107(rsvp.invitation_id, member.person_name) ||
          rsvp.email || invitation?.email || '',
        attendance: rsvp.attendance || '',
        verification_status: rsvp.verification_status || ''
      }));
    } else {
      const primaryName = `${rsvp.first_name} ${rsvp.last_name}`.trim();
      rows.push({
        key: `rsvp:${rsvp.id}`,
        person_id: null,
        rsvp_id: rsvp.id,
        invitation_id: rsvp.invitation_id || null,
        invitation_person_id: null,
        person_name: primaryName,
        household,
        email: invitationPersonEmailForRsvpMemberV107(rsvp.invitation_id, primaryName) ||
          rsvp.email || invitation?.email || '',
        attendance: rsvp.attendance || '',
        verification_status: rsvp.verification_status || ''
      });
    }
  });

  invitations.forEach(invitation => {
    if (rsvps.some(r => r.invitation_id === invitation.id)) return;

    const members = invitationPeople.filter(p => p.invitation_id === invitation.id);
    if (members.length) {
      members.forEach(member => rows.push({
        key: `invite-person:${member.id}`,
        person_id: null,
        rsvp_id: null,
        invitation_id: invitation.id,
        invitation_person_id: member.id,
        person_name: member.person_name,
        household: invitation.household_name,
        email: member.email || invitation.email || '',
        attendance: '',
        verification_status: ''
      }));
    } else {
      rows.push({
        key: `invite:${invitation.id}`,
        person_id: null,
        rsvp_id: null,
        invitation_id: invitation.id,
        invitation_person_id: null,
        person_name: `${invitation.primary_first_name} ${invitation.primary_last_name}`.trim() || invitation.household_name,
        household: invitation.household_name,
        email: invitation.email || '',
        attendance: '',
        verification_status: ''
      });
    }
  });

  // One row per actual person.
  const seen = new Set();
  return rows.filter(person => {
    const key = person.person_id
      ? `rsvp-person:${person.person_id}`
      : `${person.invitation_id || person.rsvp_id || ''}:${normalizedPersonNameV107(person.person_name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.person_name.localeCompare(b.person_name));
};

// ------------------------------------------------------------
// Per-person email in Edit Invitation
// ------------------------------------------------------------

invitationPeopleForEditV105 = function(invitation) {
  if (!invitation) return [];

  const stored = invitationPeopleV101(invitation.id);
  if (stored.length) {
    return stored.map(person => ({
      id: person.id,
      person_name: person.person_name,
      person_type: person.person_type || 'adult',
      email: person.email || '',
      sort_order: Number(person.sort_order || 0)
    }));
  }

  return parseInvitationPeopleV101(
    invitation.household_name,
    invitation.primary_first_name,
    invitation.primary_last_name
  ).map((name, index) => ({
    id: '',
    person_name: name,
    person_type: 'adult',
    email: '',
    sort_order: index
  }));
};

invitationPersonRowV105 = function(person = {}, index = 0) {
  return `<div class="invitation-person-row-v107" data-person-id="${esc(person.id || '')}">
    <label class="field">
      <span>Person ${index + 1}</span>
      <input name="invite_person_name" required value="${esc(person.person_name || '')}" placeholder="Full name">
    </label>
    <label class="field invitation-person-type-v105">
      <span>Type</span>
      <select name="invite_person_type">
        <option value="adult" ${(person.person_type || 'adult') === 'adult' ? 'selected' : ''}>Adult</option>
        <option value="child" ${person.person_type === 'child' ? 'selected' : ''}>Child</option>
      </select>
    </label>
    <label class="field">
      <span>Email</span>
      <input type="email" name="invite_person_email" value="${esc(person.email || '')}" placeholder="Optional">
    </label>
    <button class="danger-text invitation-person-remove-v105" type="button" onclick="removeInvitationPersonRowV105(this)">Remove</button>
  </div>`;
};

renumberInvitationPeopleV105 = function() {
  document.querySelectorAll('#invitation-people-editor-v105 .invitation-person-row-v107').forEach((row, index) => {
    const label = row.querySelector('.field span');
    if (label) label.textContent = `Person ${index + 1}`;
  });
};

addInvitationPersonRowV105 = function(type = 'adult') {
  const editor = document.getElementById('invitation-people-editor-v105');
  if (!editor) return;
  const index = editor.querySelectorAll('.invitation-person-row-v107').length;
  editor.insertAdjacentHTML('beforeend', invitationPersonRowV105({ person_type: type, email: '' }, index));
};

removeInvitationPersonRowV105 = function(button) {
  const editor = document.getElementById('invitation-people-editor-v105');
  if (!editor) return;
  const rows = editor.querySelectorAll('.invitation-person-row-v107');
  if (rows.length <= 1) return toast('An invitation needs at least one named person.', 'error');
  button.closest('.invitation-person-row-v107')?.remove();
  renumberInvitationPeopleV105();
};

collectInvitationPeopleV105 = function(form) {
  return [...form.querySelectorAll('#invitation-people-editor-v105 .invitation-person-row-v107')].map((row, index) => ({
    id: row.dataset.personId || '',
    person_name: String(row.querySelector('[name="invite_person_name"]')?.value || '').trim(),
    person_type: String(row.querySelector('[name="invite_person_type"]')?.value || 'adult'),
    email: String(row.querySelector('[name="invite_person_email"]')?.value || '').trim() || null,
    sort_order: index
  }));
};

saveInvitation = async function(event, id = '') {
  event.preventDefault();

  const formElement = event.target;
  const submit = formElement.querySelector('[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Saving…';
  }

  const form = new FormData(formElement);
  const people = collectInvitationPeopleV105(formElement);

  if (!people.length || people.some(person => !person.person_name)) {
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Save Invitation & People';
    }
    return toast('Enter a name for every person in the household.', 'error');
  }

  const primaryPerson = people.find(person => person.person_type === 'adult') || people[0];
  const primary = splitNameForPrimaryV105(primaryPerson.person_name);

  const payload = {
    household_name: String(form.get('household_name') || '').trim(),
    primary_first_name: primary.first,
    primary_last_name: primary.last,
    max_guests: Math.max(1, Number(form.get('max_guests') || people.length)),
    status: String(form.get('status') || 'invited')
  };

  for (const key of ['phone','email','street_address','city','state','zip_code','private_notes']) {
    payload[key] = String(form.get(key) || '').trim() || null;
  }

  if (!payload.household_name) {
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Save Invitation & People';
    }
    return toast('Enter a household name.', 'error');
  }

  let invitationId = id;

  if (id) {
    const { error } = await db.from('invitations').update(payload).eq('id', id);
    if (error) {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Save Invitation & People';
      }
      return toast(error.message, 'error');
    }
  } else {
    const { data, error } = await db.from('invitations').insert(payload).select('id').single();
    if (error) {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Save Invitation & People';
      }
      return toast(error.message, 'error');
    }
    invitationId = data.id;
  }

  const existing = id ? invitationPeopleV101(id) : [];
  const existingIds = new Set(existing.map(person => person.id));
  const keptIds = new Set();

  for (const person of people) {
    if (person.id && existingIds.has(person.id)) {
      keptIds.add(person.id);
      const { error } = await db.from('invitation_people').update({
        person_name: person.person_name,
        person_type: person.person_type,
        email: person.email,
        sort_order: person.sort_order
      }).eq('id', person.id);

      if (error) return toast(`Invitation saved, but a person could not be updated: ${error.message}`, 'error');
    } else {
      const { error } = await db.from('invitation_people').insert({
        invitation_id: invitationId,
        person_name: person.person_name,
        person_type: person.person_type,
        email: person.email,
        sort_order: person.sort_order
      });

      if (error && !String(error.message || '').toLowerCase().includes('duplicate')) {
        return toast(`Invitation saved, but a person could not be added: ${error.message}`, 'error');
      }
    }
  }

  if (id) {
    const removeIds = existing
      .filter(person => !keptIds.has(person.id) && !people.some(newPerson => newPerson.id === person.id))
      .map(person => person.id);

    if (removeIds.length) {
      const { error } = await db.from('invitation_people').delete().in('id', removeIds);
      if (error) return toast(`Invitation saved, but an old household member could not be removed: ${error.message}`, 'error');
    }
  } else {
    // Update any people auto-created by the insert trigger.
    const { data: generated } = await db
      .from('invitation_people')
      .select('*')
      .eq('invitation_id', invitationId);

    for (const person of people) {
      const row = (generated || []).find(g =>
        normalizedPersonNameV107(g.person_name) === normalizedPersonNameV107(person.person_name)
      );
      if (row) {
        await db.from('invitation_people').update({
          person_type: person.person_type,
          email: person.email,
          sort_order: person.sort_order
        }).eq('id', row.id);
      }
    }

    const wantedNames = new Set(people.map(person => normalizedPersonNameV107(person.person_name)));
    const extras = (generated || []).filter(row => !wantedNames.has(normalizedPersonNameV107(row.person_name)));
    if (extras.length) await db.from('invitation_people').delete().in('id', extras.map(row => row.id));
  }

  closeModal();
  toast(id ? 'Invitation and household people updated.' : 'Invitation and household people added.');
  await loadAdmin();
};

// ------------------------------------------------------------
// Multi-person assignment directly from Wedding Jobs
// ------------------------------------------------------------

function personAttendanceLabelV107(person) {
  const attendance = String(person.attendance || '').toLowerCase();
  if (attendance === 'attending') return 'Attending';
  if (attendance === 'declined') return 'Not attending';
  return 'No RSVP yet';
}

function personAlreadyAssignedToJobV107(person, jobId) {
  return (adminData.assignments || []).some(assignment =>
    assignment.job_id === jobId &&
    (
      (person.person_id && assignment.rsvp_person_id === person.person_id) ||
      (!person.person_id &&
        assignment.invitation_id === person.invitation_id &&
        normalizedPersonNameV107(assignment.person_name) === normalizedPersonNameV107(person.person_name)) ||
      (!person.person_id && person.rsvp_id &&
        assignment.rsvp_id === person.rsvp_id &&
        normalizedPersonNameV107(assignment.person_name) === normalizedPersonNameV107(person.person_name))
    )
  );
}

function renderJobPeoplePickerRowsV107(jobId, search = '') {
  const query = String(search || '').trim().toLowerCase();
  const people = assignmentPeopleV063().filter(person =>
    !query ||
    [person.person_name, person.household, person.email]
      .some(value => String(value || '').toLowerCase().includes(query))
  );

  if (!people.length) return '<p class="muted job-people-empty-v107">No matching people.</p>';

  const groups = new Map();
  people.forEach(person => {
    const household = person.household || 'Other';
    if (!groups.has(household)) groups.set(household, []);
    groups.get(household).push(person);
  });

  return [...groups.entries()].map(([household, members]) => `
    <section class="job-household-group-v107">
      <h4>${esc(household)}</h4>
      ${members.map(person => {
        const assigned = personAlreadyAssignedToJobV107(person, jobId);
        const status = personAttendanceLabelV107(person);
        return `<label class="job-person-check-v107 ${assigned ? 'already-assigned' : ''}">
          <input type="checkbox" name="job_people_v107" value="${esc(person.key)}" ${assigned ? 'disabled' : ''} onchange="updateJobPeopleSelectedV107()">
          <span class="job-person-check-copy-v107">
            <strong>${esc(person.person_name)}</strong>
            <small>${esc(status)}${person.email ? ` · ${esc(person.email)}` : ' · no email'}${assigned ? ' · already assigned' : ''}</small>
          </span>
        </label>`;
      }).join('')}
    </section>
  `).join('');
}

function filterJobPeopleV107(value) {
  const jobId = document.getElementById('job-multi-assign-id-v107')?.value || '';
  const list = document.getElementById('job-people-list-v107');
  if (!list) return;
  const checked = new Set(
    [...document.querySelectorAll('input[name="job_people_v107"]:checked')].map(input => input.value)
  );
  list.innerHTML = renderJobPeoplePickerRowsV107(jobId, value);
  document.querySelectorAll('input[name="job_people_v107"]').forEach(input => {
    if (checked.has(input.value) && !input.disabled) input.checked = true;
  });
  updateJobPeopleSelectedV107();
}

function updateJobPeopleSelectedV107() {
  const count = document.querySelectorAll('input[name="job_people_v107"]:checked').length;
  const label = document.getElementById('job-people-selected-count-v107');
  if (label) label.textContent = `${count} selected`;
}

openJobAssignmentDialog = function(jobId) {
  const job = (adminData.jobs || []).find(item => item.id === jobId);
  if (!job) return;

  const people = assignmentPeopleV063();
  if (!people.length) return toast('Add an invitation or RSVP before assigning a job.', 'error');

  const stats = jobStats(job);

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal">
    <form class="modal-card job-multi-assign-modal-v107" onsubmit="saveJobMultiAssignmentV107(event)">
      <input type="hidden" id="job-multi-assign-id-v107" name="job_id" value="${esc(job.id)}">
      <div class="modal-heading">
        <div><p class="eyebrow">Wedding job</p><h2>Assign People — ${esc(job.title)}</h2></div>
        <button type="button" onclick="closeModal()">×</button>
      </div>

      <div class="job-multi-summary-v107">
        <strong>${stats.filled} of ${stats.needed} filled</strong>
        <span>${stats.remaining} still needed</span>
      </div>

      <label class="field wide">
        <span>Search people or households</span>
        <input type="search" placeholder="Type a first name, last name, household, or email" oninput="filterJobPeopleV107(this.value)">
      </label>

      <div class="job-picker-toolbar-v107">
        <strong id="job-people-selected-count-v107">0 selected</strong>
        <span>Choose as many people as you need.</span>
      </div>

      <div id="job-people-list-v107" class="job-people-list-v107">
        ${renderJobPeoplePickerRowsV107(job.id)}
      </div>

      <div class="form-grid job-multi-options-v107">
        <label class="field wide"><span>How should these assignments start?</span>
          <select name="status">
            <option value="assigned">Assign without sending email</option>
            <option value="awaiting_response">Send each person an email request</option>
            <option value="accepted">They already said yes</option>
          </select>
        </label>
        <label class="field wide"><span>Instructions for everyone selected (optional)</span>
          <textarea name="instructions" rows="4"></textarea>
        </label>
      </div>

      <p class="muted">For email requests, each person uses their own email first, then the RSVP or household email as a fallback.</p>

      <div class="modal-actions">
        <button type="button" class="secondary" onclick="closeModal()">Cancel</button>
        <button class="primary" type="submit">Assign Selected People</button>
      </div>
    </form>
  </div>`);
};

async function saveJobMultiAssignmentV107(event) {
  event.preventDefault();

  const formElement = event.target;
  const form = new FormData(formElement);
  const jobId = String(form.get('job_id') || '');
  const status = String(form.get('status') || 'assigned');
  const instructions = String(form.get('instructions') || '').trim() || null;
  const keys = [...formElement.querySelectorAll('input[name="job_people_v107"]:checked')]
    .map(input => input.value);

  if (!keys.length) return toast('Choose at least one person.', 'error');

  const allPeople = assignmentPeopleV063();
  const people = keys.map(key => allPeople.find(person => person.key === key)).filter(Boolean);
  if (!people.length) return toast('The selected people could not be found. Refresh and try again.', 'error');

  if (status === 'awaiting_response') {
    const withoutEmail = people.filter(person => !person.email);
    if (withoutEmail.length) {
      return toast(`Add an email for: ${withoutEmail.map(person => person.person_name).join(', ')}`, 'error');
    }
  }

  const button = formElement.querySelector('[type="submit"]');
  if (button) {
    button.disabled = true;
    button.textContent = `Assigning ${people.length}…`;
  }

  let saved = 0;
  let emailFailures = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const person of people) {
    if (personAlreadyAssignedToJobV107(person, jobId)) {
      skipped += 1;
      continue;
    }

    const payload = {
      job_id: jobId,
      rsvp_id: person.rsvp_id || null,
      invitation_id: person.invitation_id || null,
      rsvp_person_id: person.person_id || null,
      person_name: person.person_name,
      contact_email: person.email || null,
      status,
      instructions,
      responded_at: status === 'accepted' ? now : null,
      response_method: status === 'accepted' ? 'admin' : null
    };

    const { data, error } = await db
      .from('job_assignments')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.error('Could not assign', person.person_name, error);
      skipped += 1;
      continue;
    }

    saved += 1;

    if (status === 'awaiting_response') {
      const { error: emailError } = await db.functions.invoke('send-job-request', {
        body: { assignment_id: data.id }
      });
      if (emailError) {
        emailFailures += 1;
        await db.from('job_assignments').update({ status: 'assigned' }).eq('id', data.id);
      }
    }
  }

  closeModal();
  await loadAdmin();

  if (!saved) return toast('No new assignments were added.', 'error');

  if (emailFailures) {
    return toast(`${saved} assigned. ${emailFailures} email request${emailFailures === 1 ? '' : 's'} could not be sent and were saved as Assigned.`, 'error');
  }

  const skippedText = skipped ? ` ${skipped} already assigned or could not be added.` : '';
  toast(`${saved} ${saved === 1 ? 'person' : 'people'} assigned.${skippedText}`);
};

// Make the job-screen call-to-action explicitly multi-person.
const baseRenderJobDetailV107 = renderJobDetail;
renderJobDetail = function(job) {
  let html = baseRenderJobDetailV107(job);
  html = html.replace(
    `onclick="openJobAssignmentDialog('${job.id}')">Assign Guest</button>`,
    `onclick="openJobAssignmentDialog('${job.id}')">Assign People</button>`
  );
  return html;
};




/* ===== v1.0.8 Settings/Admin reliable loading ===== */

// Settings used to render once before wedding_settings/admin_users were available.
// They are now part of the initial admin load above. This helper also refreshes
// the admin email/details service without clearing a previously good result.
refreshAdminUsersV070 = async function() {
  if (!session || adminUsersLoadingV070) return;

  adminUsersLoadingV070 = true;
  render();

  try {
    const { data, error } = await db.functions.invoke('manage-admin-users', {
      body: { action: 'list' }
    });

    if (error) throw error;
    if (Array.isArray(data?.admins)) adminUserDetailsV070 = data.admins;
  } catch (error) {
    console.warn('Could not refresh administrator details.', error);
    // Keep the last successful administrator details instead of blanking the list.
  }

  adminUsersLoadingV070 = false;
  render();
};

// Opening Settings now refreshes the latest wedding settings and admin rows first,
// so the form cannot briefly replace saved values with empty/default fields.
setAdminView = async function(next) {
  adminView = next;

  if (next !== 'settings') {
    render();
    return;
  }

  if (!db || !session) {
    render();
    return;
  }

  loadingAdmin = true;
  render();

  const [settingsResult, adminsResult] = await Promise.all([
    db.from('wedding_settings').select('*').eq('id', 1).maybeSingle(),
    db.from('admin_users').select('*').order('created_at', { ascending: true })
  ]);

  if (!settingsResult.error) {
    adminData.settings = settingsResult.data || {};
    publicWeddingSettings = settingsResult.data || {};
  }

  if (!adminsResult.error) {
    adminData.adminUsers = adminsResult.data || [];
  }

  loadingAdmin = false;
  render();
  await refreshAdminUsersV070();
};

// After adding/removing an administrator, load the current rows and service
// details rather than relying on an older in-memory copy.
const baseInviteAdminV108 = inviteAdminV070;
inviteAdminV070 = async function(event) {
  event.preventDefault();
  const f = new FormData(event.target);
  const button = event.submitter;
  if (button) button.disabled = true;

  const { data, error } = await db.functions.invoke('manage-admin-users', {
    body: {
      action: 'invite',
      email: String(f.get('email')).trim(),
      display_name: String(f.get('display_name')).trim()
    }
  });

  if (button) button.disabled = false;
  if (error || data?.error) {
    return toast(data?.error || error?.message || 'Could not add administrator.', 'error');
  }

  closeModal();
  toast('Administrator added and password link sent.');

  const { data: rows } = await db.from('admin_users').select('*').order('created_at', { ascending: true });
  adminData.adminUsers = rows || [];
  await refreshAdminUsersV070();
};

