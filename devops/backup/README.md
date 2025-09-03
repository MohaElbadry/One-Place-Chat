# One-Place-Chat Backup & Recovery System

This directory contains the backup and recovery system for One-Place-Chat, providing automated data protection and disaster recovery capabilities.

## 📁 Directory Structure

```
devops/backup/
├── README.md                 # This documentation
├── backup-config.yml         # Backup configuration
└── scripts/
    ├── backup.sh             # Main backup script
    ├── restore.sh            # Restore script
    ├── scheduled-backup.sh   # Automated backup script
    └── setup-backup-cron.sh  # Cron setup script
```

## 🚀 Quick Start

### 1. Manual Backup

```bash
# Full backup (all components)
./devops/scripts/backup.sh full 7

# ChromaDB only
./devops/scripts/backup.sh chromadb 3

# Application data only
./devops/scripts/backup.sh application 14

# Docker volumes only
./devops/scripts/backup.sh volumes 30
```

### 2. Manual Restore

```bash
# Restore from backup file
./devops/scripts/restore.sh /opt/backups/one-place-chat/opc_backup_full_20241201_020000.tar.gz

# Restore specific components
./devops/scripts/restore.sh backup_file.tar.gz chromadb
./devops/scripts/restore.sh backup_file.tar.gz application
./devops/scripts/restore.sh backup_file.tar.gz volumes
```

### 3. Automated Backups

```bash
# Setup automated backups (requires root)
sudo ./devops/scripts/setup-backup-cron.sh
```

## 📋 Backup Types

### Full Backup
- **Components**: ChromaDB, Application Data, Docker Volumes
- **Schedule**: Daily at 2:00 AM
- **Retention**: 7 days
- **Size**: ~500MB - 2GB (depending on data)

### ChromaDB Backup
- **Components**: Vector database, embeddings, collections
- **Schedule**: Every 6 hours
- **Retention**: 3 days
- **Size**: ~100MB - 500MB

### Application Data Backup
- **Components**: Conversations, generated tools, configurations
- **Schedule**: Daily at 3:00 AM
- **Retention**: 14 days
- **Size**: ~50MB - 200MB

### Docker Volumes Backup
- **Components**: Persistent volumes (ChromaDB, Prometheus, Grafana)
- **Schedule**: Weekly on Sunday at 1:00 AM
- **Retention**: 30 days
- **Size**: ~200MB - 1GB

## 🔧 Configuration

### Environment Variables

```bash
# Required
ENVIRONMENT=production
SLACK_WEBHOOK=your_slack_webhook_url

# Optional
BACKUP_TYPE=full
RETENTION_DAYS=7
GRAFANA_ADMIN_PASSWORD=admin123
```

### Backup Configuration

Edit `devops/backup/backup-config.yml` to customize:

- Backup schedules
- Retention policies
- Storage locations
- Notification settings
- Security options

## 📊 Monitoring

### Backup Status

```bash
# View backup logs
tail -f /var/log/opc-backup.log

# Check cron jobs
crontab -u backup -l

# Check systemd timers
systemctl list-timers opc-backup.timer

# Monitor backup directory
ls -la /opt/backups/one-place-chat/
```

### Health Checks

```bash
# Test backup system
sudo -u backup ./devops/scripts/scheduled-backup.sh application 1

# Check disk space
df -h /opt/backups/

# Verify backup integrity
tar -tzf /opt/backups/one-place-chat/opc_backup_*.tar.gz
```

## 🚨 Alerts & Notifications

### Slack Notifications

The system sends notifications to Slack channels:

- **Success**: `#backups` channel
- **Failure**: `#alerts` channel

### Email Notifications

Configure email alerts in `backup-config.yml`:

```yaml
notifications:
  email:
    enabled: true
    smtp_host: "smtp.gmail.com"
    smtp_port: 587
    username: "backups@yourapp.com"
    password: "${EMAIL_PASSWORD}"
    recipients:
      - "admin@yourapp.com"
```

## 🔒 Security

### Data Protection

- **Encryption**: Optional AES-256-GCM encryption
- **Access Control**: Dedicated backup user with limited permissions
- **Sanitization**: Automatic removal of secrets from backups
- **File Permissions**: Restricted access (600) to backup files

### Security Best Practices

1. **Rotate backup keys regularly**
2. **Use secure storage locations**
3. **Monitor backup access logs**
4. **Test restore procedures regularly**
5. **Keep backup systems updated**

## 🛠️ Troubleshooting

### Common Issues

#### Backup Fails

```bash
# Check service status
docker ps | grep opc-

# Check disk space
df -h

# Check logs
tail -f /var/log/opc-backup.log

# Test manual backup
./devops/scripts/backup.sh application 1
```

#### Restore Fails

```bash
# Verify backup file
tar -tzf backup_file.tar.gz

# Check manifest
tar -xzf backup_file.tar.gz backup_name/manifest.json -O | jq '.'

# Check services
docker-compose -f devops/docker/docker-compose.yml ps
```

#### Cron Jobs Not Running

```bash
# Check cron service
systemctl status cron

# Check backup user crontab
crontab -u backup -l

# Check cron logs
grep CRON /var/log/syslog
```

### Recovery Procedures

#### Complete System Recovery

1. **Stop all services**
2. **Restore from latest full backup**
3. **Verify data integrity**
4. **Start services**
5. **Run health checks**

#### Partial Recovery

1. **Identify affected components**
2. **Stop related services**
3. **Restore specific components**
4. **Restart services**
5. **Verify functionality**

## 📈 Performance

### Backup Performance

- **Full Backup**: 5-15 minutes
- **ChromaDB Backup**: 2-5 minutes
- **Application Backup**: 1-3 minutes
- **Volume Backup**: 3-10 minutes

### Storage Requirements

- **Daily Backups**: ~1-2GB
- **Weekly Retention**: ~10-15GB
- **Monthly Retention**: ~50-100GB

### Optimization Tips

1. **Use compression** (enabled by default)
2. **Schedule backups during low-traffic hours**
3. **Monitor disk space regularly**
4. **Clean up old backups automatically**
5. **Use incremental backups for large datasets**

## 🔄 Maintenance

### Regular Tasks

#### Daily
- Monitor backup logs
- Check disk space
- Verify backup completion

#### Weekly
- Test restore procedures
- Review backup sizes
- Update backup configurations

#### Monthly
- Rotate backup keys
- Review retention policies
- Update documentation
- Test disaster recovery

### Maintenance Commands

```bash
# Clean up old backups
find /opt/backups/one-place-chat -name "*.tar.gz" -mtime +30 -delete

# Rotate logs
logrotate /etc/logrotate.d/opc-backup

# Update backup scripts
git pull && chmod +x devops/scripts/*.sh

# Test backup system
sudo -u backup ./devops/scripts/scheduled-backup.sh full 1
```

## 📚 Additional Resources

- [Docker Backup Best Practices](https://docs.docker.com/storage/volumes/#backup-restore-or-migrate-data-volumes)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Cron Job Management](https://crontab.guru/)
- [Systemd Timer Documentation](https://www.freedesktop.org/software/systemd/man/systemd.timer.html)

## 🆘 Support

For backup and recovery issues:

1. **Check logs**: `/var/log/opc-backup.log`
2. **Review configuration**: `devops/backup/backup-config.yml`
3. **Test manually**: Run backup scripts manually
4. **Contact support**: Include logs and error messages

---

**Last Updated**: December 2024  
**Version**: 1.0.0
