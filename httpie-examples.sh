#!/bin/bash

# HTTPie Examples for DJEI Token API
# HTTPie is more user-friendly than cURL for API testing
# Install: pip install httpie

# Configuration
BASE_URL="http://localhost:3001"
TOKEN=${1:-""}

if [ -z "$TOKEN" ]; then
    echo "❌ Usage: $0 <JWT_TOKEN>"
    echo "Get token with: node scripts/get-test-token.js <email> <password>"
    exit 1
fi

echo "🚀 Testing DJEI Token API with HTTPie"
echo "Base URL: $BASE_URL"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Test 1: Health check (no auth required)
echo "1️⃣ Health Check (No Auth)"
http GET $BASE_URL/health
echo ""

# Test 2: Get token balance
echo "2️⃣ Get Token Balance"
http GET $BASE_URL/api/payments/tokens/balance \
    Authorization:"Bearer $TOKEN"
echo ""

# Test 3: Purchase tokens (valid)
echo "3️⃣ Purchase Tokens (Valid Request)"
http POST $BASE_URL/api/payments/tokens/purchase \
    Authorization:"Bearer $TOKEN" \
    amount:=100 \
    packageType="100" \
    paymentIntentId="pi_test_httpie_$(date +%s)"
echo ""

# Test 4: Purchase tokens (invalid amount)
echo "4️⃣ Purchase Tokens (Invalid Amount - Should Fail)"
http POST $BASE_URL/api/payments/tokens/purchase \
    Authorization:"Bearer $TOKEN" \
    amount:=-50 \
    packageType="50" \
    paymentIntentId="pi_test_invalid_$(date +%s)"
echo ""

# Test 5: Purchase tokens (missing fields)
echo "5️⃣ Purchase Tokens (Missing Fields - Should Fail)"
http POST $BASE_URL/api/payments/tokens/purchase \
    Authorization:"Bearer $TOKEN" \
    amount:=100
echo ""

# Test 6: Place song bid (valid)
echo "6️⃣ Place Song Bid (Valid)"
http POST $BASE_URL/api/payments/tokens/bid \
    Authorization:"Bearer $TOKEN" \
    songId="song_httpie_test_$(date +%s)" \
    bidAmount:=25 \
    eventId="event_test_123"
echo ""

# Test 7: Place song bid (insufficient tokens)
echo "7️⃣ Place Song Bid (Insufficient Tokens - Should Fail)"
http POST $BASE_URL/api/payments/tokens/bid \
    Authorization:"Bearer $TOKEN" \
    songId="song_insufficient_$(date +%s)" \
    bidAmount:=99999 \
    eventId="event_test_123"
echo ""

# Test 8: Get transaction history
echo "8️⃣ Get Transaction History"
http GET $BASE_URL/api/payments/tokens/transactions \
    Authorization:"Bearer $TOKEN" \
    page==1 \
    limit==10
echo ""

# Test 9: Unauthorized request
echo "9️⃣ Unauthorized Request (Should Fail)"
http GET $BASE_URL/api/payments/tokens/balance
echo ""

# Test 10: Invalid token
echo "🔒 Invalid Token Test (Should Fail)"
http GET $BASE_URL/api/payments/tokens/balance \
    Authorization:"Bearer invalid_token_123"
echo ""

echo "✅ HTTPie testing completed!"
echo ""
echo "📊 Expected HTTP Status Codes:"
echo "  200 = Success"
echo "  400 = Bad Request (validation error)"
echo "  401 = Unauthorized (auth error)"
echo "  403 = Forbidden (permission error)"
echo "  500 = Server Error"

# HTTPie Advantages over cURL:
# ✅ Simpler syntax
# ✅ Automatic JSON handling
# ✅ Pretty-printed output
# ✅ Built-in session management
# ✅ Better error messages
# ✅ Syntax highlighting 