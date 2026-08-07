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
  </div><div class="hero-photo placeholder-photo">Your favorite engagement photo</div></section>
  <section class="quick-grid">
    ${card('👥', 'RSVP', 'Tell us whether you can celebrate with us.', 'rsvp')}
    ${card('📅', 'Wedding Details', 'Saturday, November 14, 2026 at 10:00 AM.', 'details')}
    ${card('🎁', 'Gift Registry', 'Registry information will be added here.', 'registry')}
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

render();
if (isAdminPortal) loadAdmin();
