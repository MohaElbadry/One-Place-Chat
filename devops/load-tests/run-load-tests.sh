#!/bin/bash

# One-Place-Chat Load Testing Script
# This script runs various load tests using k6

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL=${BASE_URL:-"http://localhost:3001"}
RESULTS_DIR="${SCRIPT_DIR}/results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

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

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v k6 >/dev/null 2>&1; then
        error "k6 is not installed. Please install k6 first:"
        echo "  Ubuntu/Debian: sudo apt-get install k6"
        echo "  macOS: brew install k6"
        echo "  Or download from: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    if ! curl -f -s "$BASE_URL/api/health" > /dev/null 2>&1; then
        error "API is not available at $BASE_URL"
        echo "Please make sure the One-Place-Chat backend is running"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Function to create results directory
create_results_dir() {
    log "Creating results directory..."
    mkdir -p "$RESULTS_DIR"
    success "Results directory created: $RESULTS_DIR"
}

# Function to run load test
run_load_test() {
    log "Running load test..."
    
    local test_file="$SCRIPT_DIR/k6-load-test.js"
    local result_file="$RESULTS_DIR/load_test_${TIMESTAMP}.json"
    
    if [ ! -f "$test_file" ]; then
        error "Load test file not found: $test_file"
        return 1
    fi
    
    k6 run \
        --out json="$result_file" \
        --env BASE_URL="$BASE_URL" \
        "$test_file"
    
    if [ $? -eq 0 ]; then
        success "Load test completed successfully"
        log "Results saved to: $result_file"
    else
        error "Load test failed"
        return 1
    fi
}

# Function to run stress test
run_stress_test() {
    log "Running stress test..."
    
    local test_file="$SCRIPT_DIR/stress-test.js"
    local result_file="$RESULTS_DIR/stress_test_${TIMESTAMP}.json"
    
    if [ ! -f "$test_file" ]; then
        error "Stress test file not found: $test_file"
        return 1
    fi
    
    k6 run \
        --out json="$result_file" \
        --env BASE_URL="$BASE_URL" \
        "$test_file"
    
    if [ $? -eq 0 ]; then
        success "Stress test completed successfully"
        log "Results saved to: $result_file"
    else
        error "Stress test failed"
        return 1
    fi
}

# Function to run smoke test
run_smoke_test() {
    log "Running smoke test..."
    
    local test_file="$SCRIPT_DIR/smoke-test.js"
    local result_file="$RESULTS_DIR/smoke_test_${TIMESTAMP}.json"
    
    if [ ! -f "$test_file" ]; then
        warning "Smoke test file not found, creating basic smoke test..."
        create_smoke_test
    fi
    
    k6 run \
        --out json="$result_file" \
        --env BASE_URL="$BASE_URL" \
        "$test_file"
    
    if [ $? -eq 0 ]; then
        success "Smoke test completed successfully"
        log "Results saved to: $result_file"
    else
        error "Smoke test failed"
        return 1
    fi
}

# Function to create basic smoke test
create_smoke_test() {
    cat > "$SCRIPT_DIR/smoke-test.js" << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  duration: '1m',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api`;

export default function() {
  // Test health endpoint
  const healthResponse = http.get(`${API_BASE}/health`);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  // Test tools endpoint
  const toolsResponse = http.get(`${API_BASE}/tools`);
  check(toolsResponse, {
    'tools endpoint status is 200': (r) => r.status === 200,
    'tools endpoint response time < 2s': (r) => r.timings.duration < 2000,
  });
}
EOF
}

# Function to generate test report
generate_report() {
    log "Generating test report..."
    
    local report_file="$RESULTS_DIR/test_report_${TIMESTAMP}.html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>One-Place-Chat Load Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .test-result { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { background-color: #d4edda; border-color: #c3e6cb; }
        .error { background-color: #f8d7da; border-color: #f5c6cb; }
        .warning { background-color: #fff3cd; border-color: #ffeaa7; }
        pre { background-color: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>One-Place-Chat Load Test Report</h1>
        <p>Generated on: $(date)</p>
        <p>Base URL: $BASE_URL</p>
    </div>
    
    <div class="test-result success">
        <h2>Test Summary</h2>
        <p>All load tests have been completed. Check the individual result files for detailed metrics.</p>
    </div>
    
    <div class="test-result">
        <h2>Available Result Files</h2>
        <ul>
EOF

    # Add result files to report
    for file in "$RESULTS_DIR"/*.json; do
        if [ -f "$file" ]; then
            local filename=$(basename "$file")
            echo "            <li><a href=\"$filename\">$filename</a></li>" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF
        </ul>
    </div>
    
    <div class="test-result">
        <h2>Test Commands</h2>
        <pre>
# Run load test
k6 run --out json=results/load_test.json k6-load-test.js

# Run stress test  
k6 run --out json=results/stress_test.json stress-test.js

# Run smoke test
k6 run --out json=results/smoke_test.json smoke-test.js
        </pre>
    </div>
</body>
</html>
EOF
    
    success "Test report generated: $report_file"
}

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS] [TEST_TYPE]"
    echo ""
    echo "TEST_TYPE:"
    echo "  load      Run load test (default)"
    echo "  stress    Run stress test"
    echo "  smoke     Run smoke test"
    echo "  all       Run all tests"
    echo ""
    echo "OPTIONS:"
    echo "  -u, --url URL     Base URL for testing (default: http://localhost:3001)"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 load"
    echo "  $0 stress"
    echo "  $0 all"
    echo "  $0 -u http://staging.yourapp.com load"
}

# Main function
main() {
    local test_type="load"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--url)
                BASE_URL="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            load|stress|smoke|all)
                test_type="$1"
                shift
                ;;
            *)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    log "Starting One-Place-Chat load testing..."
    log "Base URL: $BASE_URL"
    log "Test type: $test_type"
    
    check_prerequisites
    create_results_dir
    
    case $test_type in
        load)
            run_load_test
            ;;
        stress)
            run_stress_test
            ;;
        smoke)
            run_smoke_test
            ;;
        all)
            run_smoke_test
            run_load_test
            run_stress_test
            ;;
        *)
            error "Invalid test type: $test_type"
            usage
            exit 1
            ;;
    esac
    
    generate_report
    
    success "Load testing completed!"
    log "Results directory: $RESULTS_DIR"
    log "Open the HTML report to view results"
}

# Run main function
main "$@"
