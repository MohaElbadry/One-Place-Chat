#!/bin/bash

# One-Place-Chat Secrets Verification Script
# This script helps verify that all required secrets are properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to check if gh CLI is installed
check_gh_cli() {
    if ! command -v gh >/dev/null 2>&1; then
        error "GitHub CLI (gh) is not installed"
        echo "Please install it first:"
        echo "  Ubuntu/Debian: sudo apt install gh"
        echo "  macOS: brew install gh"
        echo "  Or download from: https://cli.github.com/"
        exit 1
    fi
    
    # Check if authenticated
    if ! gh auth status >/dev/null 2>&1; then
        error "GitHub CLI is not authenticated"
        echo "Please authenticate first:"
        echo "  gh auth login"
        exit 1
    fi
    
    success "GitHub CLI is installed and authenticated"
}

# Function to get repository name
get_repo_name() {
    local repo_name=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
    
    if [ -z "$repo_name" ]; then
        error "Could not determine repository name"
        echo "Please run this script from within your GitHub repository directory"
        exit 1
    fi
    
    echo "$repo_name"
}

# Function to check secret
check_secret() {
    local secret_name=$1
    local required=${2:-true}
    
    if gh secret list | grep -q "^$secret_name"; then
        success "✓ $secret_name is configured"
        return 0
    else
        if [ "$required" = "true" ]; then
            error "✗ $secret_name is missing (REQUIRED)"
            return 1
        else
            warning "✗ $secret_name is missing (optional)"
            return 0
        fi
    fi
}

# Function to display secret setup instructions
display_setup_instructions() {
    log "GitHub Repository Secrets Setup Instructions"
    echo ""
    echo "1. Go to your GitHub repository: https://github.com/$(get_repo_name)"
    echo "2. Click on 'Settings' tab"
    echo "3. In the left sidebar, click 'Secrets and variables'"
    echo "4. Click 'Actions'"
    echo "5. Click 'New repository secret' for each secret below:"
    echo ""
    
    echo "🔑 REQUIRED SECRETS:"
    echo "  OPENAI_API_KEY = your_openai_api_key"
    echo ""
    
    echo "📢 OPTIONAL SECRETS (Recommended):"
    echo "  SLACK_WEBHOOK = https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
    echo "  PAGERDUTY_ROUTING_KEY = your_pagerduty_routing_key"
    echo "  GRAFANA_ADMIN_PASSWORD = your_grafana_password"
    echo "  EMAIL_PASSWORD = your_email_smtp_password"
    echo ""
    
    echo "🌍 ENVIRONMENT-SPECIFIC SECRETS:"
    echo "  STAGING_OPENAI_API_KEY = your_staging_openai_key"
    echo "  PRODUCTION_OPENAI_API_KEY = your_production_openai_key"
    echo "  PRODUCTION_GRAFANA_ADMIN_PASSWORD = your_production_grafana_password"
    echo ""
}

# Function to test CI/CD workflow
test_workflow() {
    log "Testing CI/CD workflow..."
    
    # Check if we can trigger a workflow
    if gh workflow list | grep -q "CI/CD Pipeline"; then
        success "CI/CD Pipeline workflow found"
        
        echo "To test the workflow, you can:"
        echo "1. Push a commit to trigger the workflow"
        echo "2. Or manually trigger it: gh workflow run 'CI/CD Pipeline'"
    else
        warning "CI/CD Pipeline workflow not found"
        echo "Make sure the workflow file is committed to the repository"
    fi
}

# Function to display current secrets
display_current_secrets() {
    log "Current repository secrets:"
    echo ""
    
    if gh secret list | grep -q "."; then
        gh secret list
    else
        warning "No secrets configured"
    fi
    echo ""
}

# Main function
main() {
    log "One-Place-Chat Secrets Verification"
    echo ""
    
    # Check prerequisites
    check_gh_cli
    
    # Get repository name
    local repo_name=$(get_repo_name)
    log "Repository: $repo_name"
    echo ""
    
    # Display current secrets
    display_current_secrets
    
    # Check required secrets
    log "Checking required secrets..."
    local missing_required=0
    
    check_secret "OPENAI_API_KEY" true || missing_required=$((missing_required + 1))
    
    echo ""
    
    # Check optional secrets
    log "Checking optional secrets..."
    local missing_optional=0
    
    check_secret "SLACK_WEBHOOK" false || missing_optional=$((missing_optional + 1))
    check_secret "PAGERDUTY_ROUTING_KEY" false || missing_optional=$((missing_optional + 1))
    check_secret "GRAFANA_ADMIN_PASSWORD" false || missing_optional=$((missing_optional + 1))
    check_secret "EMAIL_PASSWORD" false || missing_optional=$((missing_optional + 1))
    
    echo ""
    
    # Check environment-specific secrets
    log "Checking environment-specific secrets..."
    check_secret "STAGING_OPENAI_API_KEY" false
    check_secret "PRODUCTION_OPENAI_API_KEY" false
    check_secret "PRODUCTION_GRAFANA_ADMIN_PASSWORD" false
    
    echo ""
    
    # Summary
    if [ $missing_required -eq 0 ]; then
        success "All required secrets are configured!"
        
        if [ $missing_optional -gt 0 ]; then
            warning "Some optional secrets are missing, but the CI/CD pipeline will work"
        fi
        
        # Test workflow
        test_workflow
        
    else
        error "Missing $missing_required required secrets"
        echo ""
        display_setup_instructions
        exit 1
    fi
    
    echo ""
    success "Secrets verification completed!"
}

# Run main function
main "$@"
