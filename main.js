const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const { GoogleGenAI } = require('@google/genai');
const http = require('http');
const express = require('express');

let mainWindow;
let db;
let oauth2Client;
let ai;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

function initDatabase() {
  db = new Database(path.join(app.getPath('userData'), 'studylingo.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY,
      school_start TEXT,
      school_end TEXT,
      streak INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      start_time TEXT,
      end_time TEXT
    );

    CREATE TABLE IF NOT EXISTS excuse_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      excuse_text TEXT,
      verdict TEXT,
      reason TEXT
    );
  `);
  
  const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
  if (!profile) {
    db.prepare('INSERT INTO user_profile (id, school_start, school_end, streak, xp) VALUES (?, ?, ?, ?, ?)')
      .run(1, '08:00', '15:00', 0, 0);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('admin.html');
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  initOAuthServer();
  initMobileBridgeServer();

  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- WINDOW CONTROLS ---
ipcMain.handle('close-app', () => {
  if (mainWindow) mainWindow.close();
});

// --- FLUX DATA HANDLERS (Directly editing workspace .js files) ---
ipcMain.handle('flux:load-data', async () => {
  const parseJsFile = (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const jsonString = content.substring(
        content.indexOf('['),
        content.lastIndexOf(']') + 1
      );
      return JSON.parse(jsonString);
    } catch (e) {
      console.error(`Failed to parse ${filePath}:`, e);
      return [];
    }
  };

  return {
    games: parseJsFile(path.join(__dirname, 'data.js')),
    records: parseJsFile(path.join(__dirname, 'recordsData.js')),
    changelog: parseJsFile(path.join(__dirname, 'changelogData.js'))
  };
});

ipcMain.handle('flux:save-data', async (event, { type, data }) => {
  let filePath, variableName;

  if (type === 'games') {
    filePath = path.join(__dirname, 'data.js');
    variableName = 'gameList';
  } else if (type === 'records') {
    filePath = path.join(__dirname, 'recordsData.js');
    variableName = 'records';
  } else if (type === 'changelog') {
    filePath = path.join(__dirname, 'changelogData.js');
    variableName = 'changelogData';
  } else {
    return { success: false, message: 'Unknown data type' };
  }

  try {
    let output = `const ${variableName} = ${JSON.stringify(data, null, 4)};\n`;
    output += `\nif (typeof module !== 'undefined') {\n    module.exports = { ${variableName} };\n}\n`;
    
    fs.writeFileSync(filePath, output, 'utf8');
    console.log(`Successfully updated workspace file: ${filePath}`);
    return { success: true };
  } catch (err) {
    console.error(`Failed to save ${filePath}:`, err);
    return { success: false, message: err.message };
  }
});

// --- GOOGLE OAUTH & APIS ---
oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

function initOAuthServer() {
  const expressApp = express();
  expressApp.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;
    if (code) {
      try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        res.send('<h1>Authentication successful! You can close this tab and return to StudyLingo.</h1>');
        if (mainWindow) mainWindow.webContents.send('oauth-success');
      } catch (err) {
        res.status(500).send('Authentication failed.');
      }
    }
  });
  expressApp.listen(3000);
}

ipcMain.handle('start-google-auth', async () => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
      'https://www.googleapis.com/auth/calendar.readonly'
    ]
  });
  shell.openExternal(authUrl);
});

ipcMain.handle('fetch-classroom-tasks', async () => {
  if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) return [];
  try {
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
    const coursesRes = await classroom.courses.list({ courseStates: ['ACTIVE'] });
    const courses = coursesRes.data.courses || [];

    let allTasks = [];
    for (const course of courses) {
      const workRes = await classroom.courses.courseWork.list({ courseId: course.id });
      const works = workRes.data.courseWork || [];
      works.forEach(w => {
        allTasks.push({
          id: w.id,
          title: w.title,
          courseName: course.name,
          dueDate: w.dueDate ? `${w.dueDate.year}-${w.dueDate.month}-${w.dueDate.day}` : 'No Due Date'
        });
      });
    }
    return allTasks;
  } catch (err) {
    return [];
  }
});

ipcMain.handle('fetch-calendar-events', async () => {
  if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) return [];
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const eventsRes = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    return eventsRes.data.items || [];
  } catch (err) {
    return [];
  }
});

// --- AI EVALUATION ENGINES (GEMINI API) ---
ipcMain.handle('evaluate-excuse', async (event, { excuse, calendarEvents }) => {
  const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
  const activities = db.prepare('SELECT * FROM activities').all();
  const excuseHistory = db.prepare('SELECT excuse_text, verdict FROM excuse_history ORDER BY id DESC LIMIT 5').all();

  if (!ai) {
    return {
      accepted: false,
      reason: 'GEMINI_API_KEY is not configured in environment.'
    };
  }

  const prompt = `
  You are an AI homework accountability officer. A student is asking to skip their daily homework goal.
  
  Student Excuse: "${excuse}"
  School Bell Schedule: Starts ${profile.school_start}, Ends ${profile.school_end}
  Configured Extra Activities: ${JSON.stringify(activities)}
  Today's Google Calendar Events: ${JSON.stringify(calendarEvents)}
  Recent Excuse History: ${JSON.stringify(excuseHistory)}

  Task:
  Evaluate if the excuse is valid given their exact free windows outside school and practice.
  If they claim they have practice at 5:00 PM, but it is currently 3:30 PM (and school ended at 3:00 PM), REJECT it because they have a free 1.5 hour window.
  If they are repeatedly making up excuses (pattern detected), REJECT it.

  Return JSON ONLY with exact keys "accepted" (boolean) and "reason" (string).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const result = JSON.parse(response.text);

    db.prepare('INSERT INTO excuse_history (excuse_text, verdict, reason) VALUES (?, ?, ?)')
      .run(excuse, result.accepted ? 'ACCEPTED' : 'REJECTED', result.reason);

    return result;
  } catch (err) {
    return { accepted: false, reason: 'Failed to process AI request.' };
  }
});

ipcMain.handle('ask-socratic-tutor', async (event, { userQuery, chatHistory }) => {
  if (!ai) return "Please set your GEMINI_API_KEY in the .env file to talk to the Socratic Tutor.";

  const formattedHistory = (chatHistory || []).map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const contents = [
    ...formattedHistory,
    { role: 'user', parts: [{ text: userQuery }] }
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: "You are a Socratic AI Tutor named Archie. Your absolute rule is NEVER give the user direct solutions, answers, or complete code/math steps. Ask guiding questions, point out general principles, or ask them to identify their next step."
      }
    });

    return response.text;
  } catch (err) {
    return "I ran into an issue reflecting on that question. Could you rephrase it?";
  }
});

// --- LOCAL MOBILE COMPANION SERVER ---
function initMobileBridgeServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/upload' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const { imageBase64 } = JSON.parse(body);
          const verified = await verifyPaperHomeworkWithVision(imageBase64);
          if (mainWindow) mainWindow.webContents.send('paper-verified', verified);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', verified }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: 'Invalid payload' }));
        }
      });
    }
  });

  server.listen(8080);
}

async function verifyPaperHomeworkWithVision(imageBase64) {
  if (!ai) return true;

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64
          }
        },
        'Does this image contain genuine completed handwritten student homework or notes? Answer JSON ONLY: {"valid": true or false}'
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text);
    return parsed.valid;
  } catch (err) {
    return false;
  }
}

// --- DATABASE HANDLERS ---
ipcMain.handle('get-profile', () => db.prepare('SELECT * FROM user_profile WHERE id = 1').get());
ipcMain.handle('save-profile', (e, { schoolStart, schoolEnd }) => {
  db.prepare('UPDATE user_profile SET school_start = ?, school_end = ? WHERE id = 1').run(schoolStart, schoolEnd);
});
ipcMain.handle('get-activities', () => db.prepare('SELECT * FROM activities').all());
ipcMain.handle('add-activity', (e, { name, start, end }) => {
  db.prepare('INSERT INTO activities (name, start_time, end_time) VALUES (?, ?, ?)').run(name, start, end);
  return db.prepare('SELECT * FROM activities').all();
});
ipcMain.handle('delete-activity', (e, id) => {
  db.prepare('DELETE FROM activities WHERE id = ?').run(id);
  return db.prepare('SELECT * FROM activities').all();
});