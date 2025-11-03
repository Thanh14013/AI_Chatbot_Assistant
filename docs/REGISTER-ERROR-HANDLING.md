# Register Error Handling - Documentation

## Vấn đề trước đây

Trước đây, khi register có lỗi (email không hợp lệ, password ngắn, email đã tồn tại), client chỉ hiển thị message chung chung như:

- ❌ "Registration failed. Please try again."
- ❌ "An error occurred"

User không biết lỗi cụ thể là gì để sửa.

## Giải pháp mới

### 1. Server trả về error messages cụ thể

**File:** `server/src/controllers/auth.controller.ts`

```typescript
// Email không hợp lệ
if (!emailRegex.test(email)) {
  res.status(400).json({
    success: false,
    message: "Invalid email format", // ← Message cụ thể
  });
  return;
}

// Password quá ngắn
if (password.length < 6) {
  res.status(400).json({
    success: false,
    message: "Password must be at least 6 characters long", // ← Message cụ thể
  });
  return;
}

// Email đã tồn tại
if (errorMessage.includes("Email already registered")) {
  res.status(409).json({
    success: false,
    message: errorMessage, // ← "Email already registered"
  });
  return;
}
```

### 2. Client hiển thị đúng error từ server

**File:** `client/src/pages/RegisterPage.tsx`

**Trước đây:**

```typescript
catch (err) {
  const axiosError = err as AxiosError<{ message: string }>;
  const errorMessage = axiosError.response?.data?.message ||
    "Registration failed. Please try again.";  // ← Generic message

  message.error(errorMessage);
}
```

**Bây giờ:**

```typescript
catch (err) {
  const axiosError = err as AxiosError<{ message: string; success: boolean }>;

  // Extract specific error message từ server response
  let errorMessage = "Registration failed. Please try again.";

  if (axiosError.response?.data?.message) {
    // Use exact error message từ server
    errorMessage = axiosError.response.data.message;  // ← Lấy message cụ thể
  } else if (axiosError.message) {
    // Fallback to axios error message
    errorMessage = axiosError.message;
  }

  setError(errorMessage);
  message.error(errorMessage);  // ← Toast hiển thị message cụ thể
}
```

## Flow hoạt động

```
User nhập form
    ↓
Client validation (cơ bản)
    ↓
POST /api/auth/register
    ↓
Server validation (chi tiết)
    ↓
    ├─ Valid → Success response
    │   └─> Client: "User registered successfully"
    │
    └─ Invalid → Error response với message cụ thể
        ├─ Email format → "Invalid email format"
        ├─ Password short → "Password must be at least 6 characters long"
        ├─ Email exists → "Email already registered"
        └─ Other errors → Message từ server
            ↓
        Client nhận error
            ↓
        Display toast với message cụ thể
            ↓
        User biết chính xác lỗi gì để fix
```

## Các loại errors và messages

### 1. Missing fields

```json
{
  "success": false,
  "message": "Name, email, and password are required"
}
```

**User thấy:** Toast "Name, email, and password are required"

### 2. Invalid email format

```json
{
  "success": false,
  "message": "Invalid email format"
}
```

**User thấy:** Toast "Invalid email format"

### 3. Password too short

```json
{
  "success": false,
  "message": "Password must be at least 6 characters long"
}
```

**User thấy:** Toast "Password must be at least 6 characters long"

### 4. Passwords don't match (client-side)

```typescript
if (password !== confirmPassword) {
  const msg = "Passwords do not match.";
  message.error(msg); // ← Client validation
  return;
}
```

**User thấy:** Toast "Passwords do not match."

### 5. Email already registered

```json
{
  "success": false,
  "message": "Email already registered"
}
```

**User thấy:** Toast "Email already registered"

### 6. Server error

```json
{
  "success": false,
  "message": "Internal server error"
}
```

**User thấy:** Toast "Internal server error"

## Ví dụ thực tế

### Test Case 1: Email không hợp lệ

**Input:**

- Email: `invalid-email`
- Password: `123456`

**Response từ server:**

```json
{
  "success": false,
  "message": "Invalid email format"
}
```

**UI hiển thị:**

- ❌ Alert box màu đỏ: "Invalid email format"
- 🔔 Toast notification: "Invalid email format"

### Test Case 2: Password quá ngắn

**Input:**

- Email: `test@example.com`
- Password: `123`

**Response từ server:**

```json
{
  "success": false,
  "message": "Password must be at least 6 characters long"
}
```

**UI hiển thị:**

- ❌ Alert: "Password must be at least 6 characters long"
- 🔔 Toast: "Password must be at least 6 characters long"

### Test Case 3: Email đã tồn tại

**Input:**

- Email: `existing@example.com` (đã có trong DB)
- Password: `123456`

**Response từ server:**

```json
{
  "success": false,
  "message": "Email already registered"
}
```

**UI hiển thị:**

- ❌ Alert: "Email already registered"
- 🔔 Toast: "Email already registered"

### Test Case 4: Thành công

**Input:**

- Email: `newuser@example.com`
- Password: `123456`

**Response từ server:**

```json
{
  "success": true,
  "message": "User registered successfully"
}
```

**UI hiển thị:**

- ✅ Toast: "User registered successfully"
- → Redirect to `/login`

## Code Changes Summary

### 1. Server không đổi (đã có validation tốt)

- ✅ Đã trả về error messages cụ thể
- ✅ Đã có status codes phù hợp (400, 409, 500)

### 2. Client - RegisterPage.tsx

**Changed:**

```typescript
// Old: Generic error handling
const errorMessage =
  axiosError.response?.data?.message ||
  "Registration failed. Please try again.";

// New: Specific error extraction
let errorMessage = "Registration failed. Please try again.";

if (axiosError.response?.data?.message) {
  errorMessage = axiosError.response.data.message; // Use server message
} else if (axiosError.message) {
  errorMessage = axiosError.message; // Fallback to axios message
}
```

## Testing

### Manual Test

1. **Test invalid email:**

   ```
   Email: invalid
   Password: 123456
   Expected: "Invalid email format"
   ```

2. **Test short password:**

   ```
   Email: test@test.com
   Password: 12
   Expected: "Password must be at least 6 characters long"
   ```

3. **Test duplicate email:**
   ```
   Email: existing@test.com
   Password: 123456
   Expected: "Email already registered"
   ```

### Automated Test (cURL)

```bash
# Test 1: Invalid email
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"invalid","password":"123456"}'
# Expected: {"success":false,"message":"Invalid email format"}

# Test 2: Short password
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"123"}'
# Expected: {"success":false,"message":"Password must be at least 6 characters long"}

# Test 3: Valid registration
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"123456"}'
# Expected: {"success":true,"message":"User registered successfully"}

# Test 4: Duplicate email
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"123456"}'
# Expected: {"success":false,"message":"Email already registered"}
```

## Benefits

### User Experience

- ✅ User biết chính xác lỗi gì
- ✅ User biết cần sửa gì
- ✅ Giảm frustration
- ✅ Tăng success rate trong registration

### Developer Experience

- ✅ Dễ debug (message rõ ràng)
- ✅ Consistent error handling
- ✅ Type-safe với TypeScript
- ✅ Dễ maintain và extend

### Code Quality

- ✅ Clear separation of concerns
- ✅ Server validation is authoritative
- ✅ Client displays server messages faithfully
- ✅ No hardcoded error messages in client

## Future Enhancements

1. **Internationalization (i18n)**

   - Server trả về error codes
   - Client translate theo language

2. **Field-level errors**

   - Highlight specific input field
   - Show error under the field

3. **Real-time validation**

   - Check email availability while typing
   - Password strength indicator

4. **Better UX**
   - Shake animation for errors
   - Success animation
   - Progress indicator
