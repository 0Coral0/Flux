CREATE TABLE IF NOT EXISTS theme_codes (
  code TEXT PRIMARY KEY NOT NULL,
  owner_uid TEXT NOT NULL,
  theme_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_uid TEXT PRIMARY KEY NOT NULL,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_users (
  uid TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  profile_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_users_username_lower_unique ON chat_users(username_lower);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('dm', 'group')),
  name TEXT NOT NULL DEFAULT '',
  owner_uid TEXT NOT NULL,
  members_json TEXT NOT NULL,
  names_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  profile_json TEXT NOT NULL DEFAULT '{}',
  text TEXT NOT NULL,
  mentions_json TEXT NOT NULL DEFAULT '[]',
  reply_json TEXT,
  role TEXT NOT NULL DEFAULT '',
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_room_time ON chat_messages(room_id, timestamp);

CREATE TABLE IF NOT EXISTS chat_friends (
  id TEXT PRIMARY KEY NOT NULL,
  from_uid TEXT NOT NULL,
  to_uid TEXT NOT NULL,
  from_name TEXT NOT NULL,
  to_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'accepted')),
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_friends_from ON chat_friends(from_uid);
CREATE INDEX IF NOT EXISTS chat_friends_to ON chat_friends(to_uid);

CREATE TABLE IF NOT EXISTS chat_bans (
  uid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  reason TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issued_role TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS chat_staff (
  email TEXT PRIMARY KEY NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('mod', 'admin')),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_reports (
  id TEXT PRIMARY KEY NOT NULL,
  target_type TEXT NOT NULL,
  reporter_uid TEXT NOT NULL,
  target_uid TEXT NOT NULL DEFAULT '',
  target_name TEXT NOT NULL DEFAULT '',
  message_id TEXT NOT NULL DEFAULT '',
  room_id TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  resolved_by TEXT NOT NULL DEFAULT ''
);
