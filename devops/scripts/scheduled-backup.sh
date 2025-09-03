#!/bin/bash

# One-Place-Chat Scheduled Backup Script
# This script is designed to be run by cron for automated backups

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
LOG_FILE="/var/log/opc-backup.log"

# Environment variables
ENVIRONMENT=${ENVIRONMENT:-production}
BACKUP_TYPE=${BACKUP_TYPE:-full}
RETENTION_DAYS=${RETENTION_DAYS:-7}

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[ERROR] $1" | tee -a "$LOG_FILE" >&2
}

success() {
    echo "[SUCCESS] $1" | tee -a "$LOG_FILE"
}

# Function to check if backup script exists
check_backup_script() {
    if [ ! -f "$BACKUP_SCRIPT" ]; then
        error "Backup script not found: $BACKUP_SCRIPT"
        exit 1
    fi
    
    if [ ! -x "$BACKUP_SCRIPT" ]; then
        error "Backup script is not executable: $BACKUP_SCRIPT"
        exit 1
    fi
}

# Function to check disk space
check_disk_space() {
    local backup_dir="/opt/backups/one-place-chat"
    local required_space_gb=5  # Minimum 5GB free space required
    
    if [ -d "$backup_dir" ]; then
        local available_space=$(df "$backup_dir" | awk 'NR==2 {print $4}')
        local available_gb=$((available_space / 1024 / 1024))
        
        if [ $available_gb -lt $required_space_gb ]; then
            error "Insufficient disk space: ${available_gb}GB available, ${required_space_gb}GB required"
            return 1
        fi
        
        log "Disk space check passed: ${available_gb}GB available"
    fi
}

# Function to check if services are running
check_services() {
    local services=("opc-chromadb" "opc-backend" "opc-frontend")
    local all_running=true
    
    for service in "${services[@]}"; do
        if ! docker ps --format "table {{.Names}}" | grep -q "^${service}$"; then
            error "Service $service is not running"
            all_running=false
        fi
    done
    
    if [ "$all_running" = false ]; then
        error "Not all services are running, skipping backup"
        return 1
    fi
    
    log "All services are running"
}

# Function to run backup
run_backup() {
    log "Starting scheduled backup..."
    log "Environment: $ENVIRONMENT"
    log "Backup type: $BACKUP_TYPE"
    log "Retention: $RETENTION_DAYS days"
    
    cd "$PROJECT_ROOT"
    
    if "$BACKUP_SCRIPT" "$BACKUP_TYPE" "$RETENTION_DAYS"; then
        success "Scheduled backup completed successfully"
        return 0
    else
        error "Scheduled backup failed"
        return 1
    fi
}

# Function to cleanup old logs
cleanup_logs() {
    local max_log_size_mb=100
    local log_size_mb=0
    
    if [ -f "$LOG_FILE" ]; then
        log_size_mb=$(du -m "$LOG_FILE" | cut -f1)
        
        if [ $log_size_mb -gt $max_log_size_mb ]; then
            log "Log file is too large (${log_size_mb}MB), rotating..."
            mv "$LOG_FILE" "${LOG_FILE}.old"
            touch "$LOG_FILE"
        fi
    fi
}

# Function to send backup status notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔄 Scheduled Backup ${status}: ${message}\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# Main function
main() {
    log "=== One-Place-Chat Scheduled Backup Started ==="
    
    # Check prerequisites
    check_backup_script
    check_disk_space
    check_services
    
    # Run backup
    if run_backup; then
        success "Scheduled backup completed successfully"
        send_notification "SUCCESS" "Scheduled backup completed successfully"
    else
        error "Scheduled backup failed"
        send_notification "FAILED" "Scheduled backup failed"
        exit 1
    fi
    
    # Cleanup logs
    cleanup_logs
    
    log "=== One-Place-Chat Scheduled Backup Completed ==="
}

# Error handling
trap 'error "Scheduled backup failed at line $LINENO"; send_notification "FAILED" "Scheduled backup failed at line $LINENO"; exit 1' ERR

# Run main function
main "$@"
