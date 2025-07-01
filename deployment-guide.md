

# Baseball Scouting Reports - Deployment Guide

## Prerequisites
- Docker and Docker Compose installed on your server
- Domain name (baseballscoutingreports.com) pointed to your server's IP
- Server with at least 1GB RAM and 10GB storage

## Quick Deployment Steps

### 1. Prepare the Server
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

### 2. Set Up Application Files
```bash
# Create application directory
mkdir -p /opt/baseball-scouting
cd /opt/baseball-scouting

# Create directory structure
mkdir -p data uploads nginx-data nginx-letsencrypt public

# Create the server.js file (copy from the first artifact)
# Create the public/index.html file (copy from the second artifact)
# Create package.json, Dockerfile, and docker-compose.yml (from this artifact)
```

### 3. Configure Environment
```bash
# Copy and edit environment file
cp .env.example .env
nano .env

# Update SESSION_SECRET with a strong random string
# Set DOMAIN to your actual domain
```

### 4. Deploy the Application
```bash
# Build and start services
docker-compose up -d

# Check if services are running
docker-compose ps

# View logs if needed
docker-compose logs -f baseball-scouting-app
```

### 5. Configure Nginx Proxy Manager
1. Access the admin interface at http://your-server-ip:81
2. Default login: admin@example.com / changeme
3. Change the default admin password immediately
4. Add a new Proxy Host:
   - Domain Names: baseballscoutingreports.com
   - Scheme: http
   - Forward Hostname/IP: baseball-scouting-app
   - Forward Port: 3000
   - Enable SSL and request Let's Encrypt certificate

### 6. Verify Deployment
- Visit https://baseballscoutingreports.com
- Test user registration with codes: SCOUT2025, BASEBALL123, or MTOWN2025
- Create a test scouting report
- Upload a spray chart image

## File Structure
```
/opt/baseball-scouting/
├── server.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env
├── public/
│   └── index.html
├── data/              (SQLite database)
├── uploads/           (Uploaded spray charts)
├── nginx-data/        (Nginx Proxy Manager data)
└── nginx-letsencrypt/ (SSL certificates)
```

## Management Commands

### View Logs
```bash
# Application logs
docker-compose logs -f baseball-scouting-app

# All services logs
docker-compose logs -f
```

### Restart Services
```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart baseball-scouting-app
```

### Update Application
```bash
# Stop services
docker-compose down

# Rebuild and start
docker-compose up -d --build
```

### Backup Data
```bash
# Backup database and uploads
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz data/ uploads/
```

### Scale for High Traffic (Optional)
```bash
# Run multiple app instances behind load balancer
docker-compose up -d --scale baseball-scouting-app=3
```

## Security Considerations

### 1. Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 81/tcp   # Nginx Proxy Manager (restrict to your IP)
sudo ufw enable
```

### 2. SSL/TLS Setup
- Use Let's Encrypt through Nginx Proxy Manager for free SSL certificates
- Enable HTTP to HTTPS redirect
- Consider using HSTS headers for enhanced security

### 3. Database Security
- SQLite database is stored in ./data directory
- Ensure proper file permissions (600)
- Consider regular encrypted backups

### 4. Application Security
- Change default SESSION_SECRET
- Use strong registration codes
- Regularly update Docker images
- Monitor logs for suspicious activity

## Monitoring and Maintenance

### Health Checks
```bash
# Check application health
curl -f http://localhost:3000/ || echo "App is down"

# Check disk usage
df -h

# Check memory usage
free -h
```

### Log Rotation
```bash
# Set up log rotation to prevent disk space issues
echo '
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size 50M
    missingok
    delaycompress
    copytruncate
}' | sudo tee /etc/logrotate.d/docker-logs
```

### Regular Maintenance
- Update Docker images monthly: `docker-compose pull && docker-compose up -d`
- Monitor disk usage for uploads and database growth
- Review application logs for errors
- Test backup and restore procedures

## Troubleshooting

### Common Issues

1. **Application won't start**
   - Check logs: `docker-compose logs baseball-scouting-app`
   - Verify environment variables in .env file
   - Ensure port 3000 isn't in use

2. **Can't access through domain**
   - Verify DNS settings point to your server
   - Check Nginx Proxy Manager configuration
   - Confirm SSL certificate is valid

3. **File uploads failing**
   - Check uploads directory permissions
   - Verify disk space availability
   - Review multer configuration limits

4. **Database errors**
   - Ensure data directory has proper permissions
   - Check SQLite file isn't corrupted
   - Verify sufficient disk space

### Support
For issues with deployment, check the application logs and ensure all dependencies are properly installed. The application includes comprehensive error handling and logging to help diagnose problems.