#!/bin/bash

# One-Place-Chat Restore Script
# Usage: ./restore.sh <backup-file> [restore-type]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_FILE=$1
RESTORE_TYPE=${2:-"full"}
TEMP_DIR="/tmp/opc_restore_$(date +%s)"

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

# Function to check if backup file exists
check_backup_file() {
    if [ -z "$BACKUP_FILE" ]; then
        error "Backup file not specified"
        echo "Usage: $0 <backup-file> [restore-type]"
        echo "Valid restore types: full, chromadb, application, volumes"
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log "Backup file: $BACKUP_FILE"
}

# Function to extract backup
extract_backup() {
    log "Extracting backup to temporary directory: $TEMP_DIR"
    
    mkdir -p "$TEMP_DIR"
    
    if ! tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"; then
        error "Failed to extract backup file"
        exit 1
    fi
    
    # Find the backup directory name
    BACKUP_DIR_NAME=$(ls "$TEMP_DIR" | head -n 1)
    EXTRACTED_BACKUP_DIR="$TEMP_DIR/$BACKUP_DIR_NAME"
    
    if [ ! -d "$EXTRACTED_BACKUP_DIR" ]; then
        error "Invalid backup structure"
        exit 1
    fi
    
    log "Backup extracted to: $EXTRACTED_BACKUP_DIR"
    
    # Verify manifest
    if [ -f "$EXTRACTED_BACKUP_DIR/manifest.json" ]; then
        log "Backup manifest found:"
        cat "$EXTRACTED_BACKUP_DIR/manifest.json" | jq '.' 2>/dev/null || cat "$EXTRACTED_BACKUP_DIR/manifest.json"
    else
        warning "Backup manifest not found"
    fi
}

# Function to confirm restore
confirm_restore() {
    warning "This will restore data from backup and may overwrite existing data!"
    echo "Backup file: $BACKUP_FILE"
    echo "Restore type: $RESTORE_TYPE"
    echo "Environment: $ENVIRONMENT"
    echo ""
    
    if [ "$ENVIRONMENT" = "production" ]; then
        warning "You are about to restore to PRODUCTION environment!"
        echo "This action cannot be undone!"
        echo ""
    fi
    
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
}

# Function to stop services
stop_services() {
    log "Stopping services for restore..."
    
    # Stop containers that might be using the data
    docker-compose -f devops/docker/docker-compose.yml down || true
    
    success "Services stopped"
}

# Function to restore ChromaDB
restore_chromadb() {
    log "Starting ChromaDB restore..."
    
    if [ ! -d "$EXTRACTED_BACKUP_DIR/chromadb" ]; then
        warning "ChromaDB backup not found in backup file"
        return 0
    fi
    
    # Start ChromaDB container
    log "Starting ChromaDB container..."
    docker-compose -f devops/docker/docker-compose.yml up -d chromadb
    
    # Wait for ChromaDB to be ready
    log "Waiting for ChromaDB to be ready..."
    timeout 60 bash -c 'until curl -f http://localhost:8000/api/v1/heartbeat; do sleep 2; done'
    
    # Check if we have JSON backup or file system backup
    if [ -f "$EXTRACTED_BACKUP_DIR/chromadb/chromadb_backup.json" ]; then
        log "Restoring ChromaDB from JSON backup..."
        
        # Copy backup file to container
        docker cp "$EXTRACTED_BACKUP_DIR/chromadb/chromadb_backup.json" "$CHROMADB_CONTAINER:/tmp/"
        
        # Restore collections
        docker exec $CHROMADB_CONTAINER python -c "
import chromadb
import json
import os

client = chromadb.Client()

with open('/tmp/chromadb_backup.json', 'r') as f:
    backup_data = json.load(f)

for collection_name, collection_data in backup_data['collections'].items():
    print(f'Restoring collection: {collection_name}')
    
    # Create or get collection
    try:
        collection = client.get_collection(collection_name)
    except:
        collection = client.create_collection(collection_name)
    
    # Add data to collection
    if collection_data['ids']:
        collection.add(
            ids=collection_data['ids'],
            embeddings=collection_data['embeddings'],
            metadatas=collection_data['metadatas'],
            documents=collection_data.get('documents', [])
        )

print('ChromaDB restore completed')
" 2>/dev/null || {
            warning "ChromaDB Python restore failed, trying file system restore..."
            restore_chromadb_filesystem
        }
        
        # Clean up
        docker exec $CHROMADB_CONTAINER rm -f /tmp/chromadb_backup.json
        
    else
        log "Restoring ChromaDB from file system backup..."
        restore_chromadb_filesystem
    fi
    
    success "ChromaDB restore completed"
}

# Function to restore ChromaDB from file system
restore_chromadb_filesystem() {
    log "Restoring ChromaDB file system..."
    
    # Stop ChromaDB container
    docker stop $CHROMADB_CONTAINER || true
    
    # Remove existing data volume
    docker volume rm opc_chromadb_data || true
    
    # Create new volume and restore data
    docker volume create opc_chromadb_data
    docker run --rm -v opc_chromadb_data:/data -v "$EXTRACTED_BACKUP_DIR/chromadb:/backup" \
        alpine sh -c "cp -r /backup/* /data/"
    
    # Start ChromaDB container
    docker-compose -f devops/docker/docker-compose.yml up -d chromadb
}

# Function to restore application data
restore_application_data() {
    log "Starting application data restore..."
    
    # Restore conversations
    if [ -d "$EXTRACTED_BACKUP_DIR/conversations" ]; then
        log "Restoring conversations..."
        rm -rf conversations
        cp -r "$EXTRACTED_BACKUP_DIR/conversations" .
    fi
    
    # Restore generated tools
    if [ -d "$EXTRACTED_BACKUP_DIR/generated-tools" ]; then
        log "Restoring generated tools..."
        rm -rf backend/generated-tools
        cp -r "$EXTRACTED_BACKUP_DIR/generated-tools" backend/
    fi
    
    # Restore configuration files
    if [ -d "$EXTRACTED_BACKUP_DIR/config" ]; then
        log "Restoring configuration files..."
        cp -r "$EXTRACTED_BACKUP_DIR/config/configs" devops/
    fi
    
    success "Application data restore completed"
}

# Function to restore Docker volumes
restore_docker_volumes() {
    log "Starting Docker volumes restore..."
    
    if [ ! -d "$EXTRACTED_BACKUP_DIR/volumes" ]; then
        warning "Docker volumes backup not found in backup file"
        return 0
    fi
    
    # List of volumes to restore
    volumes=("opc_chromadb_data" "opc_prometheus_data" "opc_grafana_data" "opc_alertmanager_data")
    
    for volume in "${volumes[@]}"; do
        local backup_file="$EXTRACTED_BACKUP_DIR/volumes/${volume}.tar.gz"
        
        if [ -f "$backup_file" ]; then
            log "Restoring volume: $volume"
            
            # Remove existing volume
            docker volume rm "$volume" || true
            
            # Create new volume
            docker volume create "$volume"
            
            # Restore volume data
            docker run --rm -v "$volume:/data" -v "$EXTRACTED_BACKUP_DIR/volumes:/backup" \
                alpine sh -c "cd /data && tar xzf /backup/${volume}.tar.gz"
        else
            warning "Volume backup not found: $volume"
        fi
    done
    
    success "Docker volumes restore completed"
}

# Function to start services
start_services() {
    log "Starting services..."
    
    # Start all services
    docker-compose -f devops/docker/docker-compose.yml up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    log "Checking service health..."
    
    services=("chromadb:8000" "backend:3001" "frontend:3000")
    
    for service in "${services[@]}"; do
        name=$(echo $service | cut -d: -f1)
        port=$(echo $service | cut -d: -f2)
        
        echo -n "Checking $name... "
        if curl -f -s "http://localhost:$port" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ UP${NC}"
        else
            echo -e "${RED}❌ DOWN${NC}"
        fi
    done
    
    success "Services started"
}

# Function to cleanup
cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
    success "Cleanup completed"
}

# Function to send restore notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔄 Restore ${status}: ${message}\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# Main restore function
main() {
    log "Starting One-Place-Chat restore process..."
    log "Backup file: $BACKUP_FILE"
    log "Restore type: $RESTORE_TYPE"
    
    # Check backup file
    check_backup_file
    
    # Extract backup
    extract_backup
    
    # Confirm restore
    confirm_restore
    
    # Stop services
    stop_services
    
    # Perform restore based on type
    case $RESTORE_TYPE in
        "full")
            restore_chromadb
            restore_application_data
            restore_docker_volumes
            ;;
        "chromadb")
            restore_chromadb
            ;;
        "application")
            restore_application_data
            ;;
        "volumes")
            restore_docker_volumes
            ;;
        *)
            error "Invalid restore type: $RESTORE_TYPE"
            error "Valid types: full, chromadb, application, volumes"
            exit 1
            ;;
    esac
    
    # Start services
    start_services
    
    # Cleanup
    cleanup
    
    # Send notification
    send_notification "SUCCESS" "Restore from $BACKUP_FILE completed successfully"
    
    success "Restore process completed successfully!"
}

# Error handling
trap 'error "Restore failed at line $LINENO"; cleanup; send_notification "FAILED" "Restore from $BACKUP_FILE failed"; exit 1' ERR

# Run main function
main "$@"
