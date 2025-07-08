# 🧪 DJEI Token API Testing Guide

This guide covers multiple ways to test your secure DJEI token API endpoints during development and in CI/CD.

## 🚀 Quick Start

### 1. Start Your Backend Server
```bash
cd djei-backend
npm install
npm run dev  # Server runs on http://localhost:3001
```

### 2. Get a JWT Token
```bash
node scripts/get-test-token.js max@fatech369.com your-password
```

Copy the JWT token from the output.

### 3. Test Your APIs
Choose your preferred testing method below.

---

## 🛠️ Testing Methods

### 📋 **Method 1: Postman (GUI - Recommended for Development)**

**Setup:**
1. Import `DJEI-Token-API.postman_collection.json` into Postman
2. Set collection variable `jwt_token` to your JWT token
3. Set `baseUrl` to `http://localhost:3001`

**Benefits:**
- ✅ Visual interface
- ✅ Request history
- ✅ Easy sharing with team
- ✅ Built-in test scripting

**Test Cases Included:**
- Get token balance
- Purchase tokens (valid/invalid)
- Place song bids
- Get transaction history
- Authentication edge cases

---

### 🔧 **Method 2: cURL (CLI - Great for Scripting)**

**Run All Tests:**
```bash
chmod +x test-api.sh
./test-api.sh YOUR_JWT_TOKEN_HERE
```

**Individual Examples:**
```bash
# Get balance
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/payments/tokens/balance

# Purchase tokens
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"amount": 100, "packageType": "100", "paymentIntentId": "pi_test_123"}' \
     http://localhost:3001/api/payments/tokens/purchase

# Place bid
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"songId": "song_123", "bidAmount": 25, "eventId": "event_456"}' \
     http://localhost:3001/api/payments/tokens/bid
```

---

### 🎨 **Method 3: HTTPie (CLI - User-Friendly)**

**Install HTTPie:**
```bash
pip install httpie
```

**Run All Tests:**
```bash
chmod +x httpie-examples.sh
./httpie-examples.sh YOUR_JWT_TOKEN_HERE
```

**Individual Examples:**
```bash
# Get balance (much simpler than cURL!)
http GET localhost:3001/api/payments/tokens/balance \
    Authorization:"Bearer YOUR_TOKEN"

# Purchase tokens
http POST localhost:3001/api/payments/tokens/purchase \
    Authorization:"Bearer YOUR_TOKEN" \
    amount:=100 \
    packageType="100" \
    paymentIntentId="pi_test_123"

# Place bid
http POST localhost:3001/api/payments/tokens/bid \
    Authorization:"Bearer YOUR_TOKEN" \
    songId="song_123" \
    bidAmount:=25 \
    eventId="event_456"
```

---

### 🤖 **Method 4: Automated Testing (CI/CD)**

**Jest + Supertest Setup:**
```bash
npm install --save-dev jest supertest
```

**Run Tests:**
```bash
npm test
```

**GitHub Actions:**
- Copy `api-tests.yml` to `.github/workflows/`
- Add these secrets to your GitHub repo:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `TEST_USER_EMAIL`
  - `TEST_USER_PASSWORD`
  - `TEST_JWT_TOKEN`

---

## 🧪 Test Scenarios

### ✅ **Positive Test Cases**

| Test | Endpoint | Expected |
|------|----------|----------|
| Get balance | `GET /balance` | `200` + balance number |
| Valid purchase | `POST /purchase` | `200` + new balance |
| Valid bid | `POST /bid` | `200` + updated balance |
| Transaction history | `GET /transactions` | `200` + transaction array |

### ❌ **Negative Test Cases**

| Test | Scenario | Expected |
|------|----------|----------|
| No auth token | Any endpoint | `401 Unauthorized` |
| Invalid token | Any endpoint | `401 Unauthorized` |
| Negative amount | Purchase/Bid | `400 Bad Request` |
| Missing fields | Purchase/Bid | `400 Bad Request` |
| Insufficient tokens | Bid | `400 Bad Request` |

### 🔒 **Security Test Cases**

| Test | Scenario | Expected |
|------|----------|----------|
| Expired token | Any endpoint | `401 Unauthorized` |
| Malformed token | Any endpoint | `401 Unauthorized` |
| Token manipulation | Purchase large amounts | `401/403` |
| Rate limiting | Many rapid requests | `429 Too Many Requests` |

---

## 📊 Understanding HTTP Status Codes

| Code | Meaning | When You'll See It |
|------|---------|-------------------|
| `200` | Success | Valid authenticated requests |
| `400` | Bad Request | Invalid data (negative amounts, missing fields) |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Valid token but insufficient permissions |
| `429` | Too Many Requests | Rate limiting triggered |
| `500` | Server Error | Backend issues (check logs) |

---

## 🚨 Troubleshooting

### **Issue: "Authorization token required"**
**Solution:** Make sure you're sending the token in the header:
```bash
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

### **Issue: "Invalid token"**
**Solutions:**
1. Token might be expired - get a new one
2. Check for extra spaces or newlines in token
3. Ensure token starts with `eyJ`

### **Issue: "Server not responding"**
**Solutions:**
1. Make sure backend is running: `npm run dev`
2. Check if port 3001 is available
3. Verify SUPABASE_URL in .env file

### **Issue: "Insufficient tokens"**
**Solution:** Purchase tokens first:
```bash
http POST localhost:3001/api/payments/tokens/purchase \
    Authorization:"Bearer YOUR_TOKEN" \
    amount:=100 packageType="100" paymentIntentId="pi_test_123"
```

---

## 🔧 Environment Setup

### **Development (.env)**
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
NODE_ENV=development
```

### **Testing (.env.test)**
```bash
SUPABASE_URL=your_test_supabase_url
SUPABASE_ANON_KEY=your_test_anon_key
TEST_USER_EMAIL=max@fatech369.com
TEST_USER_PASSWORD=testpassword123
NODE_ENV=test
```

---

## 🎯 Testing Best Practices

### **For Development:**
1. Use Postman for interactive testing
2. Save common requests in collections
3. Test both happy path and edge cases
4. Verify error messages are helpful

### **For CI/CD:**
1. Run tests on every pull request
2. Use separate test database
3. Clean up test data after tests
4. Set up proper test user accounts
5. Monitor test performance over time

### **For Production:**
1. Run smoke tests after deployments
2. Monitor API response times
3. Set up alerting for error rates
4. Use production-like test data

---

## 📝 API Endpoints Summary

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `GET` | `/api/payments/tokens/balance` | Get user's token balance | ✅ |
| `POST` | `/api/payments/tokens/purchase` | Purchase token package | ✅ |
| `POST` | `/api/payments/tokens/bid` | Place song bid | ✅ |
| `GET` | `/api/payments/tokens/transactions` | Get transaction history | ✅ |
| `GET` | `/health` | Server health check | ❌ |

---

## 🎉 Next Steps

1. **Set up CI/CD:** Configure GitHub Actions with the provided workflow
2. **Monitor in Production:** Add logging and metrics
3. **Load Testing:** Use tools like Artillery or k6 for performance testing
4. **Security Testing:** Run OWASP ZAP or similar security scans

Happy testing! 🚀 