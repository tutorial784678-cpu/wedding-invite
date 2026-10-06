/**
 * Cinematic Wedding Invitation - Google Apps Script backend
 *
 * Deploy as Web App:
 * Execute as: Me
 * Who has access: Anyone
 *
 * Store the Google Sheet ID and admin password hash in Script Properties.
 * This script never sends the admin password to the frontend.
 */

const RSVP_SHEET = 'RSVP';
const CONFIG_KEY = 'WEDDING_CONFIG';
const PASSWORD_HASH_KEY = 'ADMIN_PASSWORD_HASH';
const SHEET_ID_KEY = 'SHEET_ID';
const SESSIONS_KEY = 'ADMIN_SESSIONS';
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

const DEFAULT_CONFIG = {
  groomName: 'Hatem',
  brideName: 'Nour',
  groomPhotoUrl: '',
  bridePhotoUrl: '',
  couplePhotoUrl: '',
  heroVideoUrl: 'assets/wedding-video.mp4',
  mobileVideoUrl: '',
  openingVideoUrl: 'assets/opening-animation.mp4',
  openingPosterUrl: 'assets/opening-poster.jpg',
  heroImageUrl: 'assets/opening-poster.jpg',
  locationImageUrl: 'assets/opening-poster.jpg',
  coupleSectionImageUrl: 'assets/opening-poster.jpg',
  weddingDate: '2026-09-26',
  weddingTime: '7:00 PM onwards',
  dateLabel: 'Saturday, 26 September 2026',
  venueName: 'The White Palace',
  fullAddress: 'A graceful setting for an unforgettable evening.',
  googleMapsUrl: 'https://maps.google.com/',
  invitationTitle: 'WITH JOY IN OUR HEARTS',
  invitationParagraph: 'Together with our families, we invite you to celebrate the beginning of our forever with an evening filled with love, laughter, and cherished memories.',
  arabicText: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ',
  romanticQuote: '“Two souls, one heart, one beautiful beginning.”',
  rsvpTitle: 'Will you join us?',
  rsvpDescription: 'Your presence would make our celebration complete. Please let us know if you can be there.',
  countdownTitle: 'COUNTING DOWN TO FOREVER',
  footerText: 'With love and gratitude, Hatem & Nour',
  womenDressCode: 'Elegant formal attire',
  menDressCode: 'Classic formal attire',
  transportInfo: 'Transportation details will be shared by the hosts.',
  theme: { primary: '#4c112a', gold: '#c6a25a', background: '#f7f0e4', text: '#351c27', font: 'Cormorant Garamond', decorative: 'botanical' },
  timeline: [
    { time: '19:00', title: "Guests' Arrival", description: 'Welcome, greetings, and a warm start to the evening.' },
    { time: '20:00', title: 'Entrance of the Bride & Groom', description: 'The evening begins with the couple’s grand entrance.' },
    { time: '21:00', title: 'Wedding Ceremony', description: 'A beautiful moment as two families become one.' },
    { time: '22:00', title: 'The Dinner', description: 'An elegant dinner and time to celebrate together.' },
    { time: '02:00', title: 'Farewell & Thanking the Guests', description: 'A heartfelt goodbye and gratitude for sharing our night.' }
  ],
  preWedding: [
    { title: 'Mehendi', date: 'TBA', time: '', place: '', description: 'A joyful pre-wedding celebration.' },
    { title: 'Haldi', date: 'TBA', time: '', place: '', description: 'Sunshine, smiles, and family traditions.' },
    { title: 'Sangeet', date: 'TBA', time: '', place: '', description: 'Music, dance, and unforgettable memories.' }
  ]
};

function doGet(e) {
  const action = String(e?.parameter?.action || 'config').toLowerCase();
  try {
    if (action === 'config') return json_({ ok: true, config: getConfig_() });
    if (action === 'list') {
      requireToken_(e.parameter.token || '');
      return json_({ ok: true, rsvps: listRsvps_() });
    }
    return json_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    return json_({ ok: false, error: safeError_(err) });
  }
}

function doPost(e) {
  try {
    const body = e?.postData?.contents || '{}';
    const payload = typeof body === 'string' ? JSON.parse(body) : body;
    const action = String(payload.action || '').toLowerCase();

    switch (action) {
      case 'login': return handleLogin_(payload);
      case 'save_settings': return handleSaveSettings_(payload);
      case 'rsvp': return handleRsvp_(payload);
      case 'change_password': return handleChangePassword_(payload);
      default: return json_({ ok: false, error: 'Unknown action.' });
    }
  } catch (err) {
    return json_({ ok: false, error: safeError_(err) });
  }
}

function handleLogin_(payload) {
  const storedHash = PropertiesService.getScriptProperties().getProperty(PASSWORD_HASH_KEY);
  if (!storedHash) return json_({ ok: false, error: 'Admin password is not configured. Run setAdminPassword() once in Apps Script.' });
  const password = String(payload.password || '');
  if (!password || sha256_(password) !== storedHash) return json_({ ok: false, error: 'Invalid admin password.' });

  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  const sessions = getSessions_();
  sessions[token] = { createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS };
  cleanupSessions_(sessions);
  PropertiesService.getScriptProperties().setProperty(SESSIONS_KEY, JSON.stringify(sessions));
  return json_({ ok: true, token, expiresAt: sessions[token].expiresAt });
}

function handleSaveSettings_(payload) {
  requireToken_(payload.token || '');
  if (!payload.config || typeof payload.config !== 'object') throw new Error('Invalid configuration payload.');
  const config = sanitizeConfig_(payload.config);
  PropertiesService.getScriptProperties().setProperty(CONFIG_KEY, JSON.stringify(config));
  return json_({ ok: true, message: 'Settings saved.', config });
}

function handleRsvp_(payload) {
  const guestName = clean_(payload.guestName, 120);
  const status = String(payload.status || '').trim();
  const attendees = Number(payload.attendees);
  const notes = clean_(payload.notes, 500);

  if (!guestName) throw new Error('Guest name is required.');
  if (!['Confirmed', 'Declined'].includes(status)) throw new Error('Invalid RSVP status.');
  if (!Number.isFinite(attendees) || attendees < 0 || attendees > 20 || Math.floor(attendees) !== attendees) throw new Error('Number of guests must be a whole number from 0 to 20.');

  const sheet = getRsvpSheet_();
  sheet.appendRow([new Date(), guestName, status, attendees, notes]);
  return json_({ ok: true, message: 'RSVP received successfully.' });
}

function handleChangePassword_(payload) {
  requireToken_(payload.token || '');
  const props = PropertiesService.getScriptProperties();
  const storedHash = props.getProperty(PASSWORD_HASH_KEY);
  const currentPassword = String(payload.currentPassword || '');
  const newPassword = String(payload.newPassword || '');
  if (!storedHash || sha256_(currentPassword) !== storedHash) throw new Error('Current password is incorrect.');
  if (newPassword.length < 10) throw new Error('New password must be at least 10 characters.');
  props.setProperty(PASSWORD_HASH_KEY, sha256_(newPassword));
  invalidateAllSessions_();
  return json_({ ok: true, message: 'Password changed. Please sign in again.' });
}

function getConfig_() {
  const raw = PropertiesService.getScriptProperties().getProperty(CONFIG_KEY);
  if (!raw) return DEFAULT_CONFIG;
  try { return sanitizeConfig_(JSON.parse(raw)); } catch (_) { return DEFAULT_CONFIG; }
}

function sanitizeConfig_(input) {
  const base = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  const out = Object.assign(base, input || {});
  const scalarFields = [
    'groomName','brideName','groomPhotoUrl','bridePhotoUrl','couplePhotoUrl','heroVideoUrl','mobileVideoUrl','openingVideoUrl','openingPosterUrl','heroImageUrl','locationImageUrl','coupleSectionImageUrl','weddingDate','weddingTime','dateLabel','venueName','fullAddress','googleMapsUrl','invitationTitle','invitationParagraph','arabicText','romanticQuote','rsvpTitle','rsvpDescription','countdownTitle','footerText','womenDressCode','menDressCode','transportInfo'
  ];
  scalarFields.forEach(k => { out[k] = clean_(out[k], 2500); });
  out.groomName = clean_(out.groomName, 120) || DEFAULT_CONFIG.groomName;
  out.brideName = clean_(out.brideName, 120) || DEFAULT_CONFIG.brideName;
  out.weddingDate = /^\d{4}-\d{2}-\d{2}$/.test(out.weddingDate) ? out.weddingDate : DEFAULT_CONFIG.weddingDate;
  out.theme = sanitizeTheme_(out.theme || {});
  out.timeline = sanitizeEvents_(out.timeline, ['time','title','description'], 30, 1000);
  out.preWedding = sanitizeEvents_(out.preWedding, ['title','date','time','place','description'], 20, 1000);
  return out;
}

function sanitizeTheme_(theme) {
  const allowFonts = ['Cormorant Garamond', 'Playfair Display', 'Georgia'];
  const allowDecor = ['botanical', 'minimal'];
  const color = (value, fallback) => /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? value : fallback;
  return {
    primary: color(theme.primary, DEFAULT_CONFIG.theme.primary),
    gold: color(theme.gold, DEFAULT_CONFIG.theme.gold),
    background: color(theme.background, DEFAULT_CONFIG.theme.background),
    text: color(theme.text, DEFAULT_CONFIG.theme.text),
    font: allowFonts.includes(theme.font) ? theme.font : DEFAULT_CONFIG.theme.font,
    decorative: allowDecor.includes(theme.decorative) ? theme.decorative : DEFAULT_CONFIG.theme.decorative
  };
}

function sanitizeEvents_(events, fields, max, fieldMax) {
  if (!Array.isArray(events)) return [];
  return events.slice(0, max).map(event => {
    const cleanEvent = {};
    fields.forEach(field => cleanEvent[field] = clean_(event?.[field], fieldMax));
    return cleanEvent;
  });
}

function getRsvpSheet_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty(SHEET_ID_KEY);
  if (!sheetId) throw new Error('Google Sheet ID is not configured. Run setSheetIdFromActiveSpreadsheet().');
  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName(RSVP_SHEET);
  if (!sheet) sheet = ss.insertSheet(RSVP_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(['Timestamp', 'Guest Name', 'Status', 'Number of Attendees', 'Notes']);
  return sheet;
}

function listRsvps_() {
  const sheet = getRsvpSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  return values.map(row => ({
    timestamp: row[0] instanceof Date ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(row[0] || ''),
    guestName: String(row[1] || ''),
    status: String(row[2] || ''),
    attendees: Number(row[3] || 0),
    notes: String(row[4] || '')
  })).reverse();
}

function requireToken_(token) {
  const normalized = String(token || '');
  if (!normalized) throw new Error('Admin session token is required.');
  const sessions = getSessions_();
  const session = sessions[normalized];
  if (!session || Number(session.expiresAt) < Date.now()) {
    delete sessions[normalized];
    PropertiesService.getScriptProperties().setProperty(SESSIONS_KEY, JSON.stringify(sessions));
    throw new Error('Admin session expired. Please sign in again.');
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  sessions[normalized] = session;
  PropertiesService.getScriptProperties().setProperty(SESSIONS_KEY, JSON.stringify(sessions));
}

function getSessions_() {
  const raw = PropertiesService.getScriptProperties().getProperty(SESSIONS_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (_) { return {}; }
}
function cleanupSessions_(sessions) { Object.keys(sessions).forEach(token => { if (Number(sessions[token]?.expiresAt) < Date.now()) delete sessions[token]; }); }
function invalidateAllSessions_() { PropertiesService.getScriptProperties().deleteProperty(SESSIONS_KEY); }

function setAdminPassword() {
  const ui = SpreadsheetApp.getUi();
  const first = ui.prompt('Set admin password', 'Enter a strong password (minimum 10 characters):', ui.ButtonSet.OK_CANCEL);
  if (first.getSelectedButton() !== ui.Button.OK) return;
  const password = first.getResponseText();
  if (password.length < 10) { ui.alert('Password must be at least 10 characters.'); return; }
  PropertiesService.getScriptProperties().setProperty(PASSWORD_HASH_KEY, sha256_(password));
  ui.alert('Admin password hash saved server-side.');
}

function setSheetIdFromActiveSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open the Google Sheet and run this function from its Apps Script project.');
  PropertiesService.getScriptProperties().setProperty(SHEET_ID_KEY, ss.getId());
  getRsvpSheet_();
  SpreadsheetApp.getUi().alert('Sheet ID saved and RSVP sheet prepared.');
}

function initializeDefaultConfig() {
  PropertiesService.getScriptProperties().setProperty(CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
  SpreadsheetApp.getUi().alert('Default wedding configuration saved server-side.');
}

function sha256_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function clean_(value, maxLen) {
  let s = value == null ? '' : String(value);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s.slice(0, maxLen || 1000);
}
function safeError_(err) { return err?.message ? String(err.message) : 'Unexpected server error.'; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
