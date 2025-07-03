#!/bin/bash

# Debug and Fix Baseball Scouting App Deployment
echo "🔍 Debugging Baseball Scouting App Deployment..."

# Check current directory
echo "📁 Current directory: $(pwd)"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose down

# Clean up old images to force rebuild
echo "🧹 Cleaning up old images..."
docker compose down --rmi all

# Check if package.json includes connect-sqlite3
echo "📦 Checking package.json for connect-sqlite3..."
if grep -q "connect-sqlite3" package.json; then
    echo "✅ connect-sqlite3 found in package.json"
else
    echo "❌ connect-sqlite3 NOT found in package.json"
    echo "Adding connect-sqlite3 to package.json..."
    
    # Backup original package.json
    cp package.json package.json.backup
    
    # Add connect-sqlite3 to dependencies
    sed -i 's/"multer": "^1.4.5-lts.1"/"multer": "^1.4.5-lts.1",\n    "connect-sqlite3": "^0.9.13"/' package.json
    
    echo "✅ Added connect-sqlite3 to package.json"
fi

# Show current package.json dependencies
echo "📦 Current dependencies:"
grep -A 10 '"dependencies"' package.json

# Check Docker volumes
echo "💾 Checking Docker volumes..."
docker volume ls | grep baseball

# Build with no cache to ensure clean build
echo "🔨 Building application with no cache..."
docker compose build --no-cache baseball-scouting-app

# Start services
echo "🚀 Starting services..."
docker compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Service status:"
docker compose ps

# Show recent logs
echo "📋 Recent application logs:"
docker compose logs --tail=50 baseball-scouting-app

# Test if the session store warning is gone
echo "🔍 Checking for session store warnings..."
if docker compose logs baseball-scouting-app 2>&1 | grep -q "MemoryStore is not designed for a production environment"; then
    echo "❌ Session store warning still present"
    echo "🔧 Attempting alternative fix..."
    
    # Try alternative session store configuration
    echo "📝 Creating alternative session store configuration..."
    
    # This will be shown as a manual fix option
    cat << 'EOF'
    
ALTERNATIVE MANUAL FIX:
If the automated fix doesn't work, manually update server.js with this session configuration:

// Alternative session store setup
const session = require('express-session');
let sessionStore;

// Try to use SQLite store, fallback to file store
try {
    const SQLiteStore = require('connect-sqlite3')(session);
    sessionStore = new SQLiteStore({
        db: 'sessions.db',
        dir: './data'
    });
} catch (err) {
    console.log('Using memory store - install connect-sqlite3 for production');
    sessionStore = new session.MemoryStore();
}

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

EOF

else
    echo "✅ No session store warnings found!"
fi

# Test data persistence
echo "🧪 Testing data persistence..."
echo "📁 Checking data directory contents:"
docker compose exec baseball-scouting-app ls -la /app/data/ || echo "❌ Cannot access data directory"

echo "📁 Checking uploads directory contents:"
docker compose exec baseball-scouting-app ls -la /app/uploads/ || echo "❌ Cannot access uploads directory"

# Check volume mounts
echo "💾 Checking volume mounts:"
docker inspect baseball-scouting-app | grep -A 5 -B 5 "Mounts"

# Final status
echo "🏁 Deployment check complete!"
echo "🌐 Application should be available at: http://localhost:3000"
echo "🔧 Nginx Proxy Manager admin: http://localhost:81"

# Show next steps
cat << 'EOF'

🔧 NEXT STEPS:
1. Check the logs above for any errors
2. Test registration with codes: SCOUT2025, BASEBALL123, MTOWN2025  
3. Create a test scouting report
4. Restart the container and verify data persists
5. If issues persist, check the alternative manual fix above

📝 TROUBLESHOOTING:
- If session warnings persist: run 'docker-compose build --no-cache'
- If data doesn't persist: check volume permissions
- If app won't start: check 'docker-compose logs baseball-scouting-app'

EOF