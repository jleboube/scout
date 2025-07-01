// server.js - Main application server
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'baseball-scouting-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'spray-chart-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Initialize SQLite database
const db = new sqlite3.Database('./database.sqlite');

// Database initialization
db.serialize(() => {
    // Teams table
    db.run(`CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )`);

    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        team_id INTEGER,
        registration_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams (id)
    )`);

    // Scouting reports table
    db.run(`CREATE TABLE IF NOT EXISTS scouting_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        player_name TEXT NOT NULL,
        player_age INTEGER,
        player_position TEXT,
        date_scouted DATE,
        location TEXT,
        overall_grade TEXT,
        hitting_contact TEXT,
        hitting_power TEXT,
        hitting_speed TEXT,
        fielding_ability TEXT,
        arm_strength TEXT,
        running_speed TEXT,
        baseball_iq TEXT,
        leadership TEXT,
        attitude TEXT,
        physical_description TEXT,
        additional_notes TEXT,
        spray_chart_image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Insert default teams
    const teams = ["MTown Rampage 12U", "MTown Venom 11U"];
    teams.forEach(team => {
        db.run("INSERT OR IGNORE INTO teams (name) VALUES (?)", [team]);
    });

    // Insert admin registration codes (in production, generate these dynamically)
    const adminCodes = ["SCOUT2025", "BASEBALL123", "MTOWN2025"];
    // Note: In production, you'd want a separate admin_codes table
});

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
};

// Routes

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get teams for registration
app.get('/api/teams', (req, res) => {
    db.all("SELECT * FROM teams", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// User registration
app.post('/api/register', async (req, res) => {
    const { email, password, teamId, registrationCode } = req.body;
    
    // Validate registration code (simplified - in production, validate against admin codes)
    const validCodes = ["SCOUT2025", "BASEBALL123", "MTOWN2025"];
    if (!validCodes.includes(registrationCode)) {
        return res.status(400).json({ error: 'Invalid registration code' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            "INSERT INTO users (email, password, team_id, registration_code) VALUES (?, ?, ?, ?)",
            [email, hashedPassword, teamId, registrationCode],
            function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT') {
                        res.status(400).json({ error: 'Email already registered' });
                    } else {
                        res.status(500).json({ error: err.message });
                    }
                    return;
                }
                
                req.session.userId = this.lastID;
                res.json({ message: 'Registration successful', userId: this.lastID });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// User login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!user) {
            res.status(400).json({ error: 'Invalid credentials' });
            return;
        }
        
        try {
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                res.status(400).json({ error: 'Invalid credentials' });
                return;
            }
            
            req.session.userId = user.id;
            res.json({ message: 'Login successful', userId: user.id });
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// Get current user info
app.get('/api/user', requireAuth, (req, res) => {
    db.get(
        `SELECT u.id, u.email, t.name as team_name 
         FROM users u 
         LEFT JOIN teams t ON u.team_id = t.id 
         WHERE u.id = ?`,
        [req.session.userId],
        (err, user) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(user);
        }
    );
});

// Create new scouting report
app.post('/api/reports', requireAuth, upload.single('sprayChart'), (req, res) => {
    const {
        playerName, playerAge, playerPosition, dateScouted, location,
        overallGrade, hittingContact, hittingPower, hittingSpeed,
        fieldingAbility, armStrength, runningSpeed, baseballIq,
        leadership, attitude, physicalDescription, additionalNotes
    } = req.body;
    
    const sprayChartImage = req.file ? req.file.filename : null;
    
    db.run(`
        INSERT INTO scouting_reports (
            user_id, player_name, player_age, player_position, date_scouted,
            location, overall_grade, hitting_contact, hitting_power, hitting_speed,
            fielding_ability, arm_strength, running_speed, baseball_iq,
            leadership, attitude, physical_description, additional_notes, spray_chart_image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            req.session.userId, playerName, playerAge, playerPosition, dateScouted,
            location, overallGrade, hittingContact, hittingPower, hittingSpeed,
            fieldingAbility, armStrength, runningSpeed, baseballIq,
            leadership, attitude, physicalDescription, additionalNotes, sprayChartImage
        ],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Report created successfully', reportId: this.lastID });
        }
    );
});

// Get all reports for current user
app.get('/api/reports', requireAuth, (req, res) => {
    db.all(
        "SELECT * FROM scouting_reports WHERE user_id = ? ORDER BY created_at DESC",
        [req.session.userId],
        (err, reports) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(reports);
        }
    );
});

// Get specific report
app.get('/api/reports/:id', requireAuth, (req, res) => {
    db.get(
        "SELECT * FROM scouting_reports WHERE id = ? AND user_id = ?",
        [req.params.id, req.session.userId],
        (err, report) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (!report) {
                res.status(404).json({ error: 'Report not found' });
                return;
            }
            res.json(report);
        }
    );
});

// Update report
app.put('/api/reports/:id', requireAuth, upload.single('sprayChart'), (req, res) => {
    const reportId = req.params.id;
    const {
        playerName, playerAge, playerPosition, dateScouted, location,
        overallGrade, hittingContact, hittingPower, hittingSpeed,
        fieldingAbility, armStrength, runningSpeed, baseballIq,
        leadership, attitude, physicalDescription, additionalNotes
    } = req.body;
    
    let updateQuery = `
        UPDATE scouting_reports SET
            player_name = ?, player_age = ?, player_position = ?, date_scouted = ?,
            location = ?, overall_grade = ?, hitting_contact = ?, hitting_power = ?,
            hitting_speed = ?, fielding_ability = ?, arm_strength = ?, running_speed = ?,
            baseball_iq = ?, leadership = ?, attitude = ?, physical_description = ?,
            additional_notes = ?, updated_at = CURRENT_TIMESTAMP
    `;
    
    let params = [
        playerName, playerAge, playerPosition, dateScouted, location,
        overallGrade, hittingContact, hittingPower, hittingSpeed,
        fieldingAbility, armStrength, runningSpeed, baseballIq,
        leadership, attitude, physicalDescription, additionalNotes
    ];
    
    if (req.file) {
        updateQuery += ', spray_chart_image = ?';
        params.push(req.file.filename);
    }
    
    updateQuery += ' WHERE id = ? AND user_id = ?';
    params.push(reportId, req.session.userId);
    
    db.run(updateQuery, params, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Report not found' });
            return;
        }
        res.json({ message: 'Report updated successfully' });
    });
});

// Delete report
app.delete('/api/reports/:id', requireAuth, (req, res) => {
    db.run(
        "DELETE FROM scouting_reports WHERE id = ? AND user_id = ?",
        [req.params.id, req.session.userId],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Report not found' });
                return;
            }
            res.json({ message: 'Report deleted successfully' });
        }
    );
});

// Serve uploaded images
app.use('/uploads', express.static('uploads'));

// Start server
app.listen(port, () => {
    console.log(`Baseball Scouting Reports app listening at http://localhost:${port}`);
});

module.exports = app;