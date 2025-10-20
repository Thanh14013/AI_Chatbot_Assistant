# 🧪 Testing Redis Cache - Hướng dẫn kiểm tra

## 📋 Mục đích

Tài liệu này hướng dẫn cách test và chứng minh Redis cache đang hoạt động thay vì truy vấn trực tiếp từ database.

---

## 🎯 Các log cần quan sát

### 1. **Cache Service Logs** (`cache.service.ts`)

#### Cache Hit (Dữ liệu có trong Redis)

```
✅ [CACHE HIT] Key: user:email:test@example.com
⚡ [CACHE-ASIDE HIT] Served from Redis in 3ms
```

👉 **Ý nghĩa**: Dữ liệu được lấy từ Redis, **KHÔNG** query database!

#### Cache Miss (Dữ liệu chưa có trong Redis)

```
❌ [CACHE MISS] Key: user:email:test@example.com
🔍 [CACHE-ASIDE MISS] Fetching from DB...
📊 [DB QUERY] Completed in 45ms
💾 [CACHE SET] Key: user:email:test@example.com (TTL: 3600s)
⏱️  [CACHE-ASIDE] Total time: 47ms (DB: 45ms)
```

👉 **Ý nghĩa**: Dữ liệu không có trong Redis → Query database → Lưu vào cache cho lần sau

#### Cache Invalidation (Xóa cache)

```
🗑️  [CACHE DELETE] Key: user:email:test@example.com
🗑️  [CACHE INVALIDATE] Pattern: conversation:list:* (3 keys deleted)
```

👉 **Ý nghĩa**: Cache bị xóa khi có thay đổi dữ liệu

---

### 2. **Auth Service Logs** (`auth.service.ts`)

#### Login (User Cache)

```
🔐 [AUTH] Login attempt for: test@example.com
🔑 [AUTH] Cache key: user:email:test@example.com
✅ [CACHE HIT] Key: user:email:test@example.com
⚡ [CACHE-ASIDE HIT] Served from Redis in 2ms
✅ [AUTH] Login successful for: test@example.com
```

👉 **Chứng minh**: User data được lấy từ Redis (2ms) thay vì DB (50ms)!

#### Change Password (Cache Invalidation)

```
🗑️  [AUTH] Invalidating cache for user: test@example.com
🗑️  [CACHE DELETE] Key: user:email:test@example.com
🗑️  [CACHE DELETE] Key: user:id:123e4567-e89b-12d3-a456-426614174000
```

👉 **Chứng minh**: Cache bị xóa sau khi đổi password

---

### 3. **Conversation Service Logs** (`conversation.service.ts`)

#### Get Conversations (First time - DB Query)

```
💬 [CONVERSATION] Fetching conversations for user: 123... (page: 1, limit: 20)
🔑 [CONVERSATION] Cache key: conversation:list:123...:1:20
❌ [CACHE MISS] Key: conversation:list:123...:1:20
🔍 [CACHE-ASIDE MISS] Fetching from DB...
📊 [DB QUERY] Completed in 82ms
💾 [CACHE SET] Key: conversation:list:123...:1:20 (TTL: 300s)
```

#### Get Conversations (Second time - Redis Cache)

```
💬 [CONVERSATION] Fetching conversations for user: 123... (page: 1, limit: 20)
🔑 [CONVERSATION] Cache key: conversation:list:123...:1:20
✅ [CACHE HIT] Key: conversation:list:123...:1:20
⚡ [CACHE-ASIDE HIT] Served from Redis in 1ms
```

👉 **Chứng minh**: Lần 1: DB 82ms → Lần 2: Redis 1ms = **82x nhanh hơn**!

#### Create/Update/Delete Conversation (Cache Invalidation)

```
📝 [CONVERSATION] Creating new conversation for user: 123...
🗑️  [CONVERSATION] Invalidating cache for user: 123...
🗑️  [CACHE INVALIDATE] Pattern: conversation:list:123...* (2 keys deleted)
```

---

### 4. **Message Service Logs** (`message.service.ts`)

#### Get Messages (First time - DB Query)

```
📨 [MESSAGE] Fetching messages for conversation: abc... (page: 1, limit: 30)
🔑 [MESSAGE] Cache key: message:history:abc...:1:30
❌ [CACHE MISS] Key: message:history:abc...:1:30
🔍 [CACHE-ASIDE MISS] Fetching from DB...
📊 [DB QUERY] Completed in 95ms
💾 [CACHE SET] Key: message:history:abc...:1:30 (TTL: 600s)
```

#### Get Messages (Second time - Redis Cache)

```
📨 [MESSAGE] Fetching messages for conversation: abc... (page: 1, limit: 30)
🔑 [MESSAGE] Cache key: message:history:abc...:1:30
✅ [CACHE HIT] Key: message:history:abc...:1:30
⚡ [CACHE-ASIDE HIT] Served from Redis in 2ms
```

👉 **Chứng minh**: Lần 1: DB 95ms → Lần 2: Redis 2ms = **47x nhanh hơn**!

#### Send Message (Cache Invalidation)

```
💬 [MESSAGE] Creating new message in conversation: abc...
🗑️  [MESSAGE] Invalidating message & conversation cache
🗑️  [CACHE INVALIDATE] Pattern: message:history:abc...* (3 keys deleted)
```

---

### 5. **Semantic Search Logs** (`semantic-search.service.ts`)

#### Semantic Search (First time - DB Query)

```
🔍 [SEMANTIC SEARCH] Query: "authentication error" in conversation: abc...
🔑 [SEMANTIC SEARCH] Cache key: semantic:abc...:auth:5:0.37
❌ [CACHE MISS] Key: semantic:abc...:auth:5:0.37
🔍 [CACHE-ASIDE MISS] Fetching from DB...
🧮 [SEMANTIC SEARCH] Generating embedding for query...
📊 [SEMANTIC SEARCH] Performing vector similarity search in DB...
✅ [SEMANTIC SEARCH] Found 3 results in 512ms
📊 [DB QUERY] Completed in 512ms
💾 [CACHE SET] Key: semantic:abc...:auth:5:0.37 (TTL: 1800s)
```

#### Semantic Search (Second time - Redis Cache)

```
🔍 [SEMANTIC SEARCH] Query: "authentication error" in conversation: abc...
🔑 [SEMANTIC SEARCH] Cache key: semantic:abc...:auth:5:0.37
✅ [CACHE HIT] Key: semantic:abc...:auth:5:0.37
⚡ [CACHE-ASIDE HIT] Served from Redis in 4ms
```

👉 **Chứng minh**: Lần 1: DB 512ms → Lần 2: Redis 4ms = **128x nhanh hơn**!

---

## 🧪 Kịch bản test chi tiết

### Test 1: User Login (Auth Cache)

**Bước 1**: Login lần đầu

```bash
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Kết quả mong đợi**:

```
🔐 [AUTH] Login attempt for: test@example.com
🔑 [AUTH] Cache key: user:email:test@example.com
❌ [CACHE MISS] Key: user:email:test@example.com
🔍 [CACHE-ASIDE MISS] Fetching from DB...
📊 [DB QUERY] Completed in 45ms
💾 [CACHE SET] Key: user:email:test@example.com (TTL: 3600s)
```

**Bước 2**: Login lần 2 (trong vòng 1 giờ)

```bash
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Kết quả mong đợi**:

```
🔐 [AUTH] Login attempt for: test@example.com
🔑 [AUTH] Cache key: user:email:test@example.com
✅ [CACHE HIT] Key: user:email:test@example.com
⚡ [CACHE-ASIDE HIT] Served from Redis in 2ms
✅ [AUTH] Login successful for: test@example.com
```

✅ **Chứng minh**: Lần 2 KHÔNG query database, lấy từ Redis!

---

### Test 2: Conversation List (Conversation Cache)

**Bước 1**: Lấy danh sách conversations lần đầu

```bash
GET /api/conversations?page=1&limit=20
Authorization: Bearer <token>
```

**Kết quả mong đợi**:

```
💬 [CONVERSATION] Fetching conversations for user: 123... (page: 1, limit: 20)
🔑 [CONVERSATION] Cache key: conversation:list:123...:1:20
❌ [CACHE MISS] Key: conversation:list:123...:1:20
🔍 [CACHE-ASIDE MISS] Fetching from DB...
📊 [DB QUERY] Completed in 75ms
💾 [CACHE SET] Key: conversation:list:123...:1:20 (TTL: 300s)
```

**Bước 2**: Lấy danh sách conversations lần 2 (trong vòng 5 phút)

```bash
GET /api/conversations?page=1&limit=20
Authorization: Bearer <token>
```

**Kết quả mong đợi**:

```
💬 [CONVERSATION] Fetching conversations for user: 123... (page: 1, limit: 20)
🔑 [CONVERSATION] Cache key: conversation:list:123...:1:20
✅ [CACHE HIT] Key: conversation:list:123...:1:20
⚡ [CACHE-ASIDE HIT] Served from Redis in 1ms
```

✅ **Chứng minh**: Lần 2 KHÔNG query database, lấy từ Redis!

**Bước 3**: Tạo conversation mới

```bash
POST /api/conversations
{
  "title": "Test Conversation"
}
```

**Kết quả mong đợi**:

```
📝 [CONVERSATION] Creating new conversation for user: 123...
🗑️  [CONVERSATION] Invalidating cache for user: 123...
🗑️  [CACHE INVALIDATE] Pattern: conversation:list:123...* (1 keys deleted)
```

**Bước 4**: Lấy danh sách lại (cache đã bị xóa)

```bash
GET /api/conversations?page=1&limit=20
```

**Kết quả mong đợi**: Cache miss → Query DB lại → Set cache mới

✅ **Chứng minh**: Cache được invalidate khi có thay đổi!

---

### Test 3: Message History (Message Cache)

**Bước 1**: Lấy messages lần đầu

```bash
GET /api/conversations/:id/messages?page=1&limit=30
Authorization: Bearer <token>
```

**Kết quả mong đợi**:

```
📨 [MESSAGE] Fetching messages for conversation: abc... (page: 1, limit: 30)
🔑 [MESSAGE] Cache key: message:history:abc...:1:30
❌ [CACHE MISS] Key: message:history:abc...:1:30
🔍 [CACHE-ASIDE MISS] Fetching from DB...
📊 [DB QUERY] Completed in 88ms
💾 [CACHE SET] Key: message:history:abc...:1:30 (TTL: 600s)
```

**Bước 2**: Lấy messages lần 2 (trong vòng 10 phút)

```bash
GET /api/conversations/:id/messages?page=1&limit=30
```

**Kết quả mong đợi**:

```
📨 [MESSAGE] Fetching messages for conversation: abc... (page: 1, limit: 30)
🔑 [MESSAGE] Cache key: message:history:abc...:1:30
✅ [CACHE HIT] Key: message:history:abc...:1:30
⚡ [CACHE-ASIDE HIT] Served from Redis in 2ms
```

✅ **Chứng minh**: Lần 2 KHÔNG query database, lấy từ Redis!

---

### Test 4: Semantic Search (Expensive Operation)

**Bước 1**: Search lần đầu

```bash
POST /api/semantic-search/:conversationId
{
  "query": "authentication error",
  "limit": 5,
  "similarity_threshold": 0.37
}
```

**Kết quả mong đợi**:

```
🔍 [SEMANTIC SEARCH] Query: "authentication error" in conversation: abc...
🔑 [SEMANTIC SEARCH] Cache key: semantic:abc...:auth:5:0.37
❌ [CACHE MISS] Key: semantic:abc...:auth:5:0.37
🔍 [CACHE-ASIDE MISS] Fetching from DB...
🧮 [SEMANTIC SEARCH] Generating embedding for query...
📊 [SEMANTIC SEARCH] Performing vector similarity search in DB...
✅ [SEMANTIC SEARCH] Found 3 results in 456ms
💾 [CACHE SET] Key: semantic:abc...:auth:5:0.37 (TTL: 1800s)
```

**Bước 2**: Search lại với cùng query (trong vòng 30 phút)

```bash
POST /api/semantic-search/:conversationId
{
  "query": "authentication error",
  "limit": 5,
  "similarity_threshold": 0.37
}
```

**Kết quả mong đợi**:

```
🔍 [SEMANTIC SEARCH] Query: "authentication error" in conversation: abc...
🔑 [SEMANTIC SEARCH] Cache key: semantic:abc...:auth:5:0.37
✅ [CACHE HIT] Key: semantic:abc...:auth:5:0.37
⚡ [CACHE-ASIDE HIT] Served from Redis in 3ms
```

✅ **Chứng minh**: Vector search rất tốn thời gian → Redis giúp tăng tốc 100x+!

---

## 📊 Bảng so sánh Performance

| Operation         | First Time (DB) | Second Time (Redis) | Speedup  |
| ----------------- | --------------- | ------------------- | -------- |
| User Login        | ~50ms           | ~2ms                | **25x**  |
| Get Conversations | ~80ms           | ~1ms                | **80x**  |
| Get Messages      | ~90ms           | ~2ms                | **45x**  |
| Semantic Search   | ~500ms          | ~3ms                | **166x** |

---

## ✅ Checklist để xác nhận Redis hoạt động

- [ ] Log `✅ [CACHE HIT]` xuất hiện khi request lần 2
- [ ] Log `⚡ [CACHE-ASIDE HIT] Served from Redis in Xms` (X < 5ms)
- [ ] Log `🔍 [CACHE-ASIDE MISS] Fetching from DB...` chỉ xuất hiện lần đầu
- [ ] Log `💾 [CACHE SET]` xuất hiện sau khi query DB
- [ ] Log `🗑️  [CACHE INVALIDATE]` xuất hiện khi create/update/delete
- [ ] Response time giảm đáng kể ở lần request thứ 2

---

## 🔧 Debug Commands

### Kiểm tra Redis đang chạy

```bash
docker ps | grep redis
```

### Kiểm tra keys trong Redis

```bash
docker exec -it server-redis-1 redis-cli
> KEYS *
> GET "user:email:test@example.com"
> TTL "user:email:test@example.com"
```

### Xóa toàn bộ cache (để test lại)

```bash
docker exec -it server-redis-1 redis-cli
> FLUSHDB
```

---

## 🎉 Kết luận

Nếu bạn thấy:

- ✅ `[CACHE HIT]` ở lần request thứ 2
- ⚡ Response time < 5ms với cache hit
- 🗑️ Cache invalidation khi có thay đổi

👉 **Redis cache đang hoạt động hoàn hảo!** 🚀

Bạn đã tối ưu database access thành công! 🎊
