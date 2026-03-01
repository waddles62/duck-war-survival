const fs = require('fs');
const path = require('path');

const FILES = {
  members: path.join(__dirname, 'data', 'members.json'),
  announcements: path.join(__dirname, 'data', 'announcements.json'),
};

function load(key) {
  try {
    if (!fs.existsSync(FILES[key])) return {};
    return JSON.parse(fs.readFileSync(FILES[key], 'utf8'));
  } catch {
    return {};
  }
}

function save(key, data) {
  fs.writeFileSync(FILES[key], JSON.stringify(data, null, 2));
}

// ── MEMBERS ──────────────────────────────────────────────────────────────────

function getMembers() {
  return load('members');
}

function getMember(userId) {
  return getMembers()[userId] || null;
}

function setMember(userId, data) {
  const members = getMembers();
  members[userId] = { ...members[userId], ...data, userId };
  save('members', members);
  return members[userId];
}

function removeMember(userId) {
  const members = getMembers();
  delete members[userId];
  save('members', members);
}

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────

function getAnnouncements() {
  const raw = load('announcements');
  return Array.isArray(raw) ? raw : [];
}

function addAnnouncement(ann) {
  const list = getAnnouncements();
  const entry = { ...ann, id: Date.now().toString(), createdAt: Date.now() };
  list.push(entry);
  save('announcements', list);
  return entry;
}

function removeAnnouncement(id) {
  const list = getAnnouncements().filter(a => a.id !== id);
  save('announcements', list);
}

function getPendingAnnouncements() {
  const now = Date.now();
  return getAnnouncements().filter(a => a.scheduled && a.scheduledAt <= now && !a.sent);
}

function markSent(id) {
  const list = getAnnouncements().map(a => a.id === id ? { ...a, sent: true } : a);
  save('announcements', list);
}

module.exports = {
  getMembers, getMember, setMember, removeMember,
  getAnnouncements, addAnnouncement, removeAnnouncement,
  getPendingAnnouncements, markSent,
};
