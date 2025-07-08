# 🔧 Supabase Setup Guide for DJEI Backend

## 📋 **Step 1: Get Your New Supabase Credentials**

### **From Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard
2. Select your **new project**
3. Navigate to: **Settings** → **API**
4. Copy these values:

```bash
Project URL: https://your-project-ref.supabase.co
anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔄 **Step 2: Update Your .env File**

**Replace your current `.env` with:**

```bash
# SUPABASE CONFIGURATION
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_service_role_key_here

# TEST USER CONFIGURATION  
TEST_USER_EMAIL=_@fatech369.com
TEST_USER_PASSWORD=_

# APPLICATION CONFIGURATION
NODE_ENV=development
PORT=3001
```

## 👤 **Step 3: Create Test User**

### **Option A: Via Supabase Dashboard (Recommended)**
1. Go to: **Authentication** → **Users**
2. Click **Add user**
3. Email: `_@fatech369.com`
4. Password: `_`
5. ✅ **Auto Confirm User** (check this box)

### **Option B: Via Sign-up API** 
```bash
curl -X POST 'https://your-project-ref.supabase.co/auth/v1/signup' \
-H "apikey: YOUR_ANON_KEY" \
-H "Content-Type: application/json" \
-d '{
  "email": "_@fatech369.com",
  "password": "_"
}'
```

## 🧪 **Step 4: Test Your Setup**

### **Test Authentication:**
```bash
node scripts/get-test-token.js _@fatech369.com SecureTestPassword123!
```

**Expected Output:**
```
✅ Authentication successful!
📋 User Info:
  ID: 12345678-1234-1234-1234-123456789abc
  Email: _@fatech369.com
  Role: authenticated

🔑 JWT Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...

📝 cURL Examples:
# Get token balance:
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     http://localhost:3001/api/payments/tokens/balance
```

### **Test Token API:**
```bash
# Get the token from previous step and test
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
./test-api.sh "$TOKEN"
```

## 📋 **Step 5: Configure Postman**

### **Import Collection:**
1. Open Postman
2. **Import** → **File** → Select `DJEI-Token-API.postman_collection.json`

### **Set Variables:**
1. Click on **DJEI Token API** collection
2. Go to **Variables** tab
3. Update values:

| Variable | Current Value | New Value |
|----------|---------------|-----------|
| `baseUrl` | `http://localhost:3001` | `http://localhost:3001` |
| `jwt_token` | `YOUR_JWT_TOKEN_HERE` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### **Get Fresh JWT Token for Postman:**
```bash
# Run this command and copy the token
node scripts/get-test-token.js _@fatech369.com SecureTestPassword123! | grep -A1 "🔑 JWT Token:"
```

### **Test in Postman:**
1. Select **Get Token Balance** request
2. Click **Send**
3. Should return: `{ "balance": 0 }`

## 🔒 **Step 6: Set Up User Tokens Table**

Your backend expects a `user_tokens` table. Create it:

### **SQL to run in Supabase SQL Editor:**
```sql
-- Create user_tokens table
CREATE TABLE user_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create unique index on profile_id
CREATE UNIQUE INDEX user_tokens_profile_id_idx ON user_tokens(profile_id);

-- Create token_transactions table
CREATE TABLE token_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'bid', 'admin_adjustment', 'reward')),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for faster queries
CREATE INDEX token_transactions_profile_id_idx ON token_transactions(profile_id);
CREATE INDEX token_transactions_created_at_idx ON token_transactions(created_at DESC);

-- Insert initial balance for test user (optional)
INSERT INTO user_tokens (profile_id, balance) 
SELECT id, 100 FROM auth.users WHERE email = '_@fatech369.com';
```

## ✅ **Step 7: Verify Everything Works**

### **Quick Test Sequence:**
```bash
# 1. Test auth
node scripts/get-test-token.js _@fatech369.com SecureTestPassword123!

# 2. Get token and test API
TOKEN=$(node scripts/get-test-token.js _@fatech369.com SecureTestPassword123! | grep -o 'eyJ[^"]*')
./test-api.sh "$TOKEN"

# 3. Test with HTTPie (if installed)
./httpie-examples.sh "$TOKEN"
```

## 🚨 **Troubleshooting**

### **Error: "Invalid URL"**
- Check `SUPABASE_URL` in `.env` starts with `https://`
- Ensure no trailing slashes

### **Error: "Invalid API key"** 
- Verify `SUPABASE_ANON_KEY` in `.env` is correct
- Check key starts with `eyJhbGciOiJIUzI1NiI...`

### **Error: "Authentication failed"**
- Ensure test user exists in Supabase Auth
- Check email/password in `.env` match Supabase user
- Verify user is **confirmed** (not pending)

### **Error: "User tokens table doesn't exist"**
- Run the SQL from Step 6 in Supabase SQL Editor
- Check table was created successfully

## 🎯 **Final Checklist**

- [ ] Supabase credentials updated in `.env`
- [ ] Test user created and confirmed  
- [ ] Database tables created
- [ ] JWT token generation works
- [ ] Token API responds with 200
- [ ] Postman collection configured
- [ ] All tests pass

Your secure token API is now ready for testing! 🚀 