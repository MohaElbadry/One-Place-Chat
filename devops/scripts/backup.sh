#!/bin/bash

# One-Place-Chat Backup Script
# Usage: ./backup.sh [backup-type] [retention-days]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_TYPE=${1:-"full"}
RETENTION_DAYS=${2:-7}
BACKUP_DIR="/opt/backups/one-place-chat"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="opc_backup_${BACKUP_TYPE}_${TIMESTAMP}"

# Environment variables
ENVIRONMENT=${ENVIRONMENT:-production}
CHROMADB_CONTAINER="opc-chromadb"
BACKEND_CONTAINER="opc-backend"

# Function to log messages
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if container is running
check_container() {
    local container_name=$1
    if ! docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        error "Container ${container_name} is not running"
        return 1
    fi
    return 0
}

# Function to create backup directory
create_backup_dir() {
    log "Creating backup directory: ${BACKUP_DIR}/${BACKUP_NAME}"
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"
}

# Function to backup ChromaDB
backup_chromadb() {
    log "Starting ChromaDB backup..."
    
    if ! check_container $CHROMADB_CONTAINER; then
        error "Cannot backup ChromaDB - container not running"
        return 1
    fi
    
    # Create ChromaDB backup directory
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}/chromadb"
    
    # Export ChromaDB collections
    log "Exporting ChromaDB collections..."
    docker exec $CHROMADB_CONTAINER python -c "
import chromadb
import json
import os
from datetime import datetime

client = chromadb.Client()
collections = client.list_collections()

backup_data = {
    'timestamp': datetime.now().isoformat(),
    'collections': {}
}

for collection in collections:
    log.info(f'Backing up collection: {collection.name}')
    data = collection.get()
    backup_data['collections'][collection.name] = {
        'ids': data['ids'],
        'embeddings': data['embeddings'],
        'metadatas': data['metadatas'],
        'documents': data.get('documents', [])
    }

with open('/tmp/chromadb_backup.json', 'w') as f:
    json.dump(backup_data, f, indent=2)

print('ChromaDB backup completed')
" 2>/dev/null || {
        warning "ChromaDB Python backup failed, trying file system backup..."
        
        # Fallback: Copy ChromaDB data directory
        docker cp "${CHROMADB_CONTAINER}:/chroma/chroma" "${BACKUP_DIR}/${BACKUP_NAME}/chromadb/"
    }
    
    # Copy backup file from container
    if docker exec $CHROMADB_CONTAINER test -f /tmp/chromadb_backup.json; then
        docker cp "${CHROMADB_CONTAINER}:/tmp/chromadb_backup.json" "${BACKUP_DIR}/${BACKUP_NAME}/chromadb/"
        docker exec $CHROMADB_CONTAINER rm -f /tmp/chromadb_backup.json
    fi
    
    success "ChromaDB backup completed"
}

# Function to backup application data
backup_application_data() {
    log "Starting application data backup..."
    
    # Backup conversations directory
    if [ -d "conversations" ]; then
        log "Backing up conversations..."
        cp -r conversations "${BACKUP_DIR}/${BACKUP_NAME}/"
    fi
    
    # Backup generated tools
    if [ -d "backend/generated-tools" ]; then
        log "Backing up generated tools..."
        cp -r backend/generated-tools "${BACKUP_DIR}/${BACKUP_NAME}/"
    fi
    
    # Backup configuration files
    log "Backing up configuration files..."
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}/config"
    cp -r devops/configs "${BACKUP_DIR}/${BACKUP_NAME}/config/"
    
    # Backup environment files (without secrets)
    if [ -f ".env" ]; then
        log "Backing up environment file (sanitized)..."
        sed 's/=.*/=***REDACTED***/g' .env > "${BACKUP_DIR}/${BACKUP_NAME}/config/.env.sanitized"
    fi
    
    success "Application data backup completed"
}

# Function to backup Docker volumes
backup_docker_volumes() {
    log "Starting Docker volumes backup..."
    
    # List of volumes to backup
    volumes=("opc_chromadb_data" "opc_prometheus_data" "opc_grafana_data" "opc_alertmanager_data")
    
    for volume in "${volumes[@]}"; do
        if docker volume ls --format "{{.Name}}" | grep -q "^${volume}$"; then
            log "Backing up volume: ${volume}"
            docker run --rm -v "${volume}:/data" -v "${BACKUP_DIR}/${BACKUP_NAME}/volumes:/backup" \
                alpine tar czf "/backup/${volume}.tar.gz" -C /data .
        else
            warning "Volume ${volume} not found, skipping..."
        fi
    done
    
    success "Docker volumes backup completed"
}

# Function to create backup manifest
create_backup_manifest() {
    log "Creating backup manifest..."
    
    cat > "${BACKUP_DIR}/${BACKUP_NAME}/manifest.json" << EOF
{
  "backup_name": "${BACKUP_NAME}",
  "backup_type": "${BACKUP_TYPE}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "${ENVIRONMENT}",
  "version": "1.0.0",
  "components": {
    "chromadb": $(test -d "${BACKUP_DIR}/${BACKUP_NAME}/chromadb" && echo "true" || echo "false"),
    "application_data": $(test -d "${BACKUP_DIR}/${BACKUP_NAME}/conversations" && echo "true" || echo "false"),
    "docker_volumes": $(test -d "${BACKUP_DIR}/${BACKUP_NAME}/volumes" && echo "true" || echo "false"),
    "config": $(test -d "${BACKUP_DIR}/${BACKUP_NAME}/config" && echo "true" || echo "false")
  },
  "size_bytes": $(du -sb "${BACKUP_DIR}/${BACKUP_NAME}" | cut -f1),
  "retention_days": ${RETENTION_DAYS}
}
EOF
    
    success "Backup manifest created"
}

# Function to compress backup
compress_backup() {
    log "Compressing backup..."
    
    cd "${BACKUP_DIR}"
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/"
    rm -rf "${BACKUP_NAME}/"
    
    local backup_size=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
    success "Backup compressed: ${BACKUP_NAME}.tar.gz (${backup_size})"
}

# Function to cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    find "${BACKUP_DIR}" -name "opc_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
    
    local deleted_count=$(find "${BACKUP_DIR}" -name "opc_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} | wc -l)
    if [ $deleted_count -gt 0 ]; then
        success "Cleaned up ${deleted_count} old backup(s)"
    else
        log "No old backups to clean up"
    fi
}

# Function to verify backup
verify_backup() {
    log "Verifying backup integrity..."
    
    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    # Test tar file integrity
    if tar -tzf "$backup_file" > /dev/null 2>&1; then
        success "Backup integrity verified"
    else
        error "Backup integrity check failed"
        return 1
    fi
    
    # Check manifest
    if tar -xzf "$backup_file" "${BACKUP_NAME}/manifest.json" -O > /dev/null 2>&1; then
        success "Backup manifest verified"
    else
        warning "Backup manifest not found or corrupted"
    fi
}

# Function to send backup notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔄 Backup ${status}: ${message}\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# Main backup function
main() {
    log "Starting One-Place-Chat backup process..."
    log "Backup type: ${BACKUP_TYPE}"
    log "Retention: ${RETENTION_DAYS} days"
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups based on type
    case $BACKUP_TYPE in
        "full")
            backup_chromadb
            backup_application_data
            backup_docker_volumes
            ;;
        "chromadb")
            backup_chromadb
            ;;
        "application")
            backup_application_data
            ;;
        "volumes")
            backup_docker_volumes
            ;;
        *)
            error "Invalid backup type: ${BACKUP_TYPE}"
            error "Valid types: full, chromadb, application, volumes"
            exit 1
            ;;
    esac
    
    # Create manifest
    create_backup_manifest
    
    # Compress backup
    compress_backup
    
    # Verify backup
    verify_backup
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Send notification
    send_notification "SUCCESS" "Backup ${BACKUP_NAME} completed successfully"
    
    success "Backup process completed successfully!"
    log "Backup location: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
}

# Error handling
trap 'error "Backup failed at line $LINENO"; send_notification "FAILED" "Backup ${BACKUP_NAME} failed"; exit 1' ERR

# Run main function
main "$@"
