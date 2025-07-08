#!/bin/bash

# API Testing Script for DJEI Backend
# Usage: ./test-api.sh [JWT_TOKEN]

set -e

# Configuration
BASE_URL="http://localhost:3001"
TOKEN=${1:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to make authenticated requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    print_status "Testing: $description"
    echo "Endpoint: $method $endpoint"
    
    if [ -z "$TOKEN" ]; then
        print_error "No JWT token provided. Run: node scripts/get-test-token.js <email> <password>"
        exit 1
    fi
    
    local curl_cmd="curl -s -w '\nHTTP Status: %{http_code}\nResponse Time: %{time_total}s\n' \
        -H 'Authorization: Bearer $TOKEN' \
        -H 'Content-Type: application/json'"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    curl_cmd="$curl_cmd -X $method '$BASE_URL$endpoint'"
    
    echo "Command: $curl_cmd"
    echo "Response:"
    
    # Execute the curl command
    response=$(eval $curl_cmd)
    echo "$response"
    echo "----------------------------------------"
}

# Test 1: Health check (unauthenticated)
print_status "🏥 Testing server health..."
curl -s "$BASE_URL/health" || echo "Server might not be running on $BASE_URL"
echo ""

# Test 2: Get token balance
make_request "GET" "/api/payments/tokens/balance" "" "Get Token Balance"

# Test 3: Purchase tokens (valid)
make_request "POST" "/api/payments/tokens/purchase" \
    '{"amount": 100, "packageType": "100", "paymentIntentId": "pi_test_valid_123"}' \
    "Purchase 100 Tokens (Valid)"

# Test 4: Purchase tokens (invalid amount)
make_request "POST" "/api/payments/tokens/purchase" \
    '{"amount": -50, "packageType": "50", "paymentIntentId": "pi_test_invalid_123"}' \
    "Purchase Tokens (Invalid Amount - Should Fail)"

# Test 5: Purchase tokens (missing fields)
make_request "POST" "/api/payments/tokens/purchase" \
    '{"amount": 100}' \
    "Purchase Tokens (Missing Fields - Should Fail)"

# Test 6: Place bid (valid)
make_request "POST" "/api/payments/tokens/bid" \
    '{"songId": "song_test_123", "bidAmount": 25, "eventId": "event_test_456"}' \
    "Place Song Bid (Valid)"

# Test 7: Place bid (insufficient tokens)
make_request "POST" "/api/payments/tokens/bid" \
    '{"songId": "song_test_999", "bidAmount": 99999, "eventId": "event_test_456"}' \
    "Place Song Bid (Insufficient Tokens - Should Fail)"

# Test 8: Get transaction history
make_request "GET" "/api/payments/tokens/transactions?page=1&limit=10" "" \
    "Get Transaction History"

# Test 9: Invalid token test
print_status "🔒 Testing with invalid token..."
ORIGINAL_TOKEN=$TOKEN
TOKEN="invalid_token_123"
make_request "GET" "/api/payments/tokens/balance" "" "Invalid Token Test (Should Fail)"
TOKEN=$ORIGINAL_TOKEN

echo ""
print_success "API testing completed!"
print_warning "Review the HTTP status codes and responses above."
print_status "Expected statuses:"
print_status "  200 = Success"
print_status "  400 = Bad Request (validation errors)"
print_status "  401 = Unauthorized (auth errors)"
print_status "  500 = Server Error" 