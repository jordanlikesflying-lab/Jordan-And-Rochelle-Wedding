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

  const [invitations, rsvps, jobs, assignments, registry, photos] = await Promise.all([
    db.from('invitations').select('*').order('household_name', { ascending: true }),
    db.from('rsvps').select('*').order('created_at', { ascending: false }),
    db.from('wedding_jobs').select('*').order('starts_at', { ascending: true, nullsFirst: false }),
    db.from('job_assignments').select('*').order('created_at', { ascending: false }),
    db.from('registry_items').select('*').order('sort_order', { ascending: true }),
    db.from('photos').select('*').order('sort_order', { ascending: true })
  ]);

  const firstError = [invitations, rsvps, jobs, assignments, registry, photos].find((result) => result.error)?.error;
  if (firstError) {
    adminError = `${firstError.message} Make sure this account exists in admin_users.`;
  } else {
    adminData = {
      invitations: invitations.data || [], rsvps: rsvps.data || [], jobs: jobs.data || [],
      assignments: assignments.data || [], registry: registry.data || [], photos: photos.data || []
    };
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
