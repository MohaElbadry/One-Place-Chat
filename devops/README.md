# 🚀 One-Place-Chat DevOps

This directory contains all DevOps-related configurations, scripts, and tools for the One-Place-Chat application.

## 📁 Directory Structure

```
devops/
├── docker/           # Docker configurations
├── scripts/          # Automation scripts
├── configs/          # Configuration files
└── monitoring/       # Monitoring and logging
```

## 🐳 Docker Services

### Quick Start

```bash
# Start all services
./scripts/start-services.sh

# Stop all services
./scripts/stop-services.sh

# View logs
cd docker && docker-compose logs -f
```

### Services

| Service | Port | Purpose |
|---------|------|---------|
| **ChromaDB** | 8000 | Vector database for tool matching |
| **Redis** | 6379 | Caching and session storage |
| **PostgreSQL** | 5432 | Persistent data storage |

### Manual Docker Commands

```bash
# Start services
cd docker
docker-compose up -d

# Stop services
docker-compose down

# Rebuild services
docker-compose up -d --build

# Remove volumes (⚠️ Data loss)
docker-compose down -v
```

## ⚙️ Configuration

### Environment Variables

Copy the example environment file and configure:

```bash
cp configs/env.example configs/.env
# Edit .env with your settings
```

### Key Configuration Options

- **Database URLs**: Configure connection strings
- **API Keys**: Set OpenAI and other service keys
- **Ports**: Customize service ports if needed
- **Logging**: Adjust log levels and formats

## 🔧 Scripts

### Available Scripts

- **`start-services.sh`** - Start all DevOps services
- **`stop-services.sh`** - Stop all DevOps services
- **ChromaDB scripts** - Database management utilities

### Custom Scripts

Add your own scripts to the `scripts/` directory:

```bash
# Example: Database backup script
devops/scripts/backup-db.sh

# Example: Health check script
devops/scripts/health-check.sh
```

## 📊 Monitoring

### Service Health Checks

```bash
# Check ChromaDB
curl http://localhost:8000/api/v1/heartbeat

# Check Redis
redis-cli ping

# Check PostgreSQL
pg_isready -h localhost -p 5432
```

### Logs

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f chromadb
docker-compose logs -f redis
docker-compose logs -f postgres
```

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in `docker-compose.yml`
2. **Permission errors**: Ensure scripts are executable
3. **Service not starting**: Check logs with `docker-compose logs`

### Reset Everything

```bash
# Stop and remove everything
cd docker
docker-compose down -v
docker system prune -f

# Start fresh
./scripts/start-services.sh
```

## 🔄 Updates

### Update Services

```bash
cd docker
docker-compose pull
docker-compose up -d
```

### Backup Data

```bash
# Backup ChromaDB data
docker run --rm -v chromadb_data:/data -v $(pwd):/backup alpine tar czf /backup/chromadb-backup.tar.gz -C /data .

# Backup PostgreSQL data
docker exec postgres pg_dump -U admin oneplacechat > backup.sql
```

## 📚 Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Redis Documentation](https://redis.io/documentation)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Happy DevOps! 🎉**
