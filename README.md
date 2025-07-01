# deployment-guide.md
# Baseball Scouting Reports - Docker Deployment Guide

## Prerequisites
- Docker and Docker Compose installed on your server
- Domain name (baseballscoutingreports.com) pointed to your server's IP
- Server with at least 2GB RAM and 20GB storage

## Step-by-Step Deployment

### 1. Prepare the Server
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose (if not included)
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group and apply
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Create Application Directory Structure
```bash
# Create main application directory
mkdir -p /opt/baseball-scouting
cd /opt/baseball-scouting

# Create required subdirectories
mkdir -p public
```

### 3. Create Application Files

Create these files in `/opt/baseball-scouting/`:

**server.js** (Node.js server code)
**public/index.html** (Frontend HTML/CSS/JS)
**package.json** 
**Dockerfile** 
**docker-compose.yml** 
**.dockerignore** 

### 4. Create Environment Configuration
```bash
# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
SESSION_SECRET=change-this-to-a-strong-random-string-in-production
DOMAIN=baseballscoutingreports.com
EOF

# Generate a strong session secret
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env
```

### 5. Build and Deploy
```bash
# Ensure you're in the application directory
cd /opt/baseball-scouting

# Build and start the services
docker compose up -d --build

# Check if services are running
dockern compose ps

# View logs to verify startup
docker compose logs -f
```

### 6. Configure Nginx Proxy Manager
1. Wait for services to fully start (check with `docker-compose logs`)
2. Access Nginx Proxy Manager admin at: `http://your-server-ip:81`
3. Default login credentials:
   - Email: `admin@example.com`
   - Password: `changeme`
4. **IMMEDIATELY** change the default password after first login
5. Add a new Proxy Host:
   - **Domain Names**: `baseballscoutingreports.com`
   - **Scheme**: `http`
   - **Forward Hostname/IP**: `baseball-scouting-app`
   - **Forward Port**: `3000`
   - **Block Common Exploits**: ✅ Enable
   - **SSL Tab**: Request new SSL Certificate with Let's Encrypt
   - **Force SSL**: ✅ Enable

### 7. Test the Deployment
```bash
# Test local connection
curl -f http://localhost:3000/ && echo "Local app OK"

# Test through proxy (after DNS propagation)
curl -f https://baseballscoutingreports.com && echo "Domain OK"
```

## File Structure After Setup
```
/opt/baseball-scouting/
├── server.js                 # Main Node.js application
├── package.json              # Node.js dependencies
├── Dockerfile                # Container build instructions
├── docker-compose.yml        # Multi-container setup
├── .dockerignore             # Files to exclude from Docker build
├── .env                      # Environment variables
└── public/
    └── index.html            # Frontend application
```

## Testing the Application

### 1. Access the Application
- Visit: `https://baseballscoutingreports.com`
- You should see the login/registration page

### 2. Test User Registration
Use one of these registration codes:
- `SCOUT2025`
- `BASEBALL123` 
- `MTOWN2025`

### 3. Test Scouting Report Creation
1. Register/login with a valid code
2. Select team: "MTown Rampage 12U" or "MTown Venom 11U"
3. Click "+ New Report"
4. Fill out player information
5. Upload a spray chart image
6. Save the report

## Management Commands

### View Application Status
```bash
# Check container status
docker-compose ps

# View real-time logs
docker-compose logs -f baseball-scouting-app

# Check container resource usage
docker stats
```

### Restart Services
```bash
# Restart all services
docker-compose restart

# Restart only the app
docker-compose restart baseball-scouting-app

# Restart with rebuild
docker-compose up -d --build
```

### Update Application
```bash
# Pull latest changes and rebuild
docker-compose down
docker-compose up -d --build

# View startup logs
docker-compose logs -f
```

### Data Management
```bash
# Backup application data
docker run --rm -v baseball-scouting_app-data:/data -v $(pwd):/backup alpine tar czf /backup/app-data-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .

# Backup uploaded files
docker run --rm -v baseball-scouting_app-uploads:/uploads -v $(pwd):/backup alpine tar czf /backup/uploads-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /uploads .

# List Docker volumes
docker volume ls
```

## Troubleshooting

### Common Build Issues

**1. npm ci Error (already fixed)**
- The Dockerfile now uses `npm install --omit=dev` instead of `npm ci`
- This works without requiring package-lock.json

**2. Permission Errors**
```bash
# Fix Docker permissions
sudo chown -R $USER:$USER /opt/baseball-scouting
chmod -R 755 /opt/baseball-scouting
```

**3. Port Already in Use**
```bash
# Check what's using port 80/443
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop apache2 nginx
```

### Runtime Issues

**1. App Won't Start**
```bash
# Check detailed logs
docker-compose logs baseball-scouting-app

# Check if database directory is writable
docker-compose exec baseball-scouting-app ls -la /app/data
```

**2. Database Connection Issues**
```bash
# Restart with fresh database
docker-compose down
docker volume rm baseball-scouting_app-data
docker-compose up -d --build
```

**3. File Upload Problems**
```bash
# Check uploads volume
docker-compose exec baseball-scouting-app ls -la /app/uploads

# Check volume permissions
docker volume inspect baseball-scouting_app-uploads
```

### Monitoring

**Check Application Health**
```bash
# Application health check
curl -f http://localhost:3000/ || echo "App is down"

# Check Docker container health
docker-compose ps

# Monitor resource usage
docker stats --no-stream
```

**Check Disk Space**
```bash
# Overall disk usage
df -h

# Docker disk usage
docker system df

# Clean up unused Docker resources
docker system prune -f
```

## Security Best Practices

### 1. Firewall Configuration
```bash
# Install and configure UFW
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow from YOUR_IP_ADDRESS to any port 81 comment 'NPM Admin'
sudo ufw --force enable
```

### 2. Regular Updates
```bash
# Update system packages monthly
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d --build

# Clean up old images
docker image prune -f
```

### 3. SSL Configuration
- Use Let's Encrypt through Nginx Proxy Manager
- Enable HTTP to HTTPS redirect
- Consider adding HSTS headers for enhanced security

## Production Scaling

### For Higher Traffic
```bash
# Scale app instances
docker-compose up -d --scale baseball-scouting-app=3

# Add load balancer configuration in Nginx Proxy Manager
```

### For Data Growth
- Monitor SQLite database size
- Consider migrating to PostgreSQL for large datasets
- Implement log rotation for container logs

## Backup Strategy
```bash
# Create automated backup script
cat > /opt/backup-baseball-app.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup application data
docker run --rm -v baseball-scouting_app-data:/data -v $BACKUP_DIR:/backup alpine \
  tar czf /backup/data-$DATE.tar.gz -C /data .

# Backup uploads
docker run --rm -v baseball-scouting_app-uploads:/uploads -v $BACKUP_DIR:/backup alpine \
  tar czf /backup/uploads-$DATE.tar.gz -C /uploads .

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/backup-baseball-app.sh

# Add to crontab for daily backups
echo "0 2 * * * /opt/backup-baseball-app.sh" | crontab -
```
