# 📖 Hướng Dẫn Sử Dụng - AI Chatbot Assistant

> **Tài liệu chi tiết về các chức năng và giao diện của ứng dụng AI Chatbot Assistant**

## 📑 Mục Lục

1. [Tổng Quan](#-tổng-quan)
2. [Đăng Ký & Đăng Nhập](#-đăng-ký--đăng-nhập)
3. [Giao Diện Chính](#-giao-diện-chính)
4. [Quản Lý Hội Thoại](#-quản-lý-hội-thoại)
5. [Gửi & Nhận Tin Nhắn](#-gửi--nhận-tin-nhắn)
6. [Tìm Kiếm Thông Minh](#-tìm-kiếm-thông-minh)
7. [Quản Lý File & Tài Liệu](#-quản-lý-file--tài-liệu)
8. [Quản Lý Project](#-quản-lý-project)
9. [Cài Đặt AI](#-cài-đặt-ai)
10. [Quản Lý Hồ Sơ](#-quản-lý-hồ-sơ)
11. [Tính Năng Nâng Cao](#-tính-năng-nâng-cao)
12. [Mẹo & Thủ Thuật](#-mẹo--thủ-thuật)

---

## 🌟 Tổng Quan

**AI Chatbot Assistant** là ứng dụng trò chuyện thông minh sử dụng công nghệ AI (GPT) để cung cấp câu trả lời chính xác, hỗ trợ đa ngôn ngữ, tìm kiếm ngữ nghĩa và quản lý tài liệu hiệu quả.

### ✨ Điểm Nổi Bật

- 🤖 **AI Thông Minh**: Sử dụng GPT-4, GPT-3.5 và các mô hình AI tiên tiến
- 💬 **Trò Chuyện Real-time**: Phản hồi tức thì qua WebSocket
- 🔍 **Tìm Kiếm Ngữ Nghĩa**: Tìm kiếm thông minh dựa trên ý nghĩa, không chỉ từ khóa
- 📁 **Quản Lý File**: Upload và xử lý hình ảnh, PDF, video
- 📂 **Tổ Chức Project**: Quản lý hội thoại theo dự án
- 🎨 **Giao Diện Đẹp**: Thiết kế hiện đại với Ant Design
- 🌐 **Đa Ngôn Ngữ**: Hỗ trợ nhiều ngôn ngữ bao gồm Tiếng Việt, English
- ⚡ **Offline Support**: Gửi tin nhắn khi offline, tự động gửi lại khi online

---

## 🔐 Đăng Ký & Đăng Nhập

### 📝 Đăng Ký Tài Khoản Mới

#### Cách Thực Hiện:

1. Truy cập trang đăng ký tại `/register`
2. Điền thông tin cần thiết:
   - **Tên** (Name): Họ và tên của bạn
   - **Email**: Địa chỉ email hợp lệ (dùng để đăng nhập)
   - **Mật khẩu** (Password): Tối thiểu 6 ký tự
   - **Xác nhận mật khẩu** (Confirm Password): Nhập lại mật khẩu
3. Nhấn nút **"Register"**

#### Giao Diện:

```
┌─────────────────────────────────────┐
│   🤖 AI Chatbot Assistant          │
│                                     │
│   📝 Create Your Account            │
│                                     │
│   Name:     [________________]     │
│   Email:    [________________]     │
│   Password: [________________]     │
│   Confirm:  [________________]     │
│                                     │
│   [     Register     ]              │
│                                     │
│   Already have account? Login       │
└─────────────────────────────────────┘
```

#### Lưu Ý:

- Email phải là duy nhất trong hệ thống
- Mật khẩu nên kết hợp chữ hoa, chữ thường, số để bảo mật tốt hơn

---

### 🔑 Đăng Nhập

#### Cách Thực Hiện:

1. Truy cập trang đăng nhập tại `/login`
2. Nhập thông tin:
   - **Email**: Email đã đăng ký
   - **Mật khẩu**: Mật khẩu của bạn
3. Nhấn nút **"Login"**

#### Giao Diện:

```
┌─────────────────────────────────────┐
│   🤖 AI Chatbot Assistant          │
│                                     │
│   🔑 Login to Your Account          │
│                                     │
│   Email:    [________________]     │
│   Password: [________________]     │
│                                     │
│   [       Login       ]             │
│                                     │
│   Don't have account? Register      │
└─────────────────────────────────────┘
```

#### Tính Năng Bảo Mật:

- **JWT Token**: Access token (15 phút) + Refresh token (7 ngày)
- **Multi-device Support**: Đăng nhập đồng thời nhiều thiết bị
- **Auto Token Refresh**: Tự động làm mới token khi hết hạn

---

## 🖥️ Giao Diện Chính

### Layout Tổng Quan

Sau khi đăng nhập, bạn sẽ thấy giao diện chính với 3 phần:

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR (Trái)    │    CHAT AREA (Giữa)    │  INFO (Phải) │
├────────────────────┼─────────────────────────┼──────────────┤
│                    │                         │              │
│  [🔍 Search]       │   📌 Conversation Title │  📌 Pinned   │
│  [➕ New Chat]     │   ─────────────────────│   Messages   │
│                    │                         │              │
│  📂 Projects       │   💬 Message List       │  [Show More] │
│  ├─ Work           │   ┌─────────────────┐  │              │
│  ├─ Personal       │   │ User: Hello...  │  │              │
│  └─ Learning       │   └─────────────────┘  │              │
│                    │   ┌─────────────────┐  │              │
│  💬 Conversations  │   │ AI: I can help..│  │              │
│  ├─ 📝 Chat 1      │   └─────────────────┘  │              │
│  ├─ 🎯 Task 2      │                         │              │
│  ├─ 💡 Idea 3      │   ─────────────────────│              │
│  └─ ...            │   [Type message here..] │              │
│                    │   [📎] [💡] [Send]     │              │
│  [👤 Profile]      │                         │              │
│  [⚙️ Settings]     │                         │              │
└────────────────────┴─────────────────────────┴──────────────┘
```

### 🎨 Các Thành Phần Giao Diện

#### 1. **Sidebar (Thanh Bên Trái)**

- **Header**:
  - 🔍 Ô tìm kiếm hội thoại
  - ➕ Nút tạo hội thoại mới
  - 🌐 Nút tìm kiếm toàn cục
- **Projects Section**:
  - Danh sách các project với icon và màu sắc
  - Số lượng hội thoại trong mỗi project
  - Kéo thả để sắp xếp
- **Conversations List**:
  - Danh sách hội thoại với scroll vô hạn
  - Hiển thị: tiêu đề, thời gian, số tin nhắn
  - Badge đỏ cho hội thoại chưa đọc
- **User Section** (Footer):
  - Avatar người dùng
  - Tên và email
  - Menu: Profile, Settings, Logout

#### 2. **Chat Area (Khu Vực Chat Chính)**

- **Header**:
  - 📌 Tiêu đề hội thoại
  - 📊 Thông tin: model AI, số tokens đã dùng
  - 📌 Nút xem tin nhắn đã ghim
- **Message List**:
  - Cuộn vô hạn (load thêm tin nhắn cũ khi cuộn lên)
  - Tin nhắn người dùng: bên phải, màu xanh
  - Tin nhắn AI: bên trái, màu xám
  - Hiển thị avatar, thời gian, trạng thái
- **Input Area**:
  - 📎 Nút đính kèm file
  - 💡 Nút gợi ý câu hỏi tiếp theo
  - ✏️ Ô nhập tin nhắn (hỗ trợ nhiều dòng)
  - 📤 Nút gửi

#### 3. **Info Panel (Bảng Thông Tin Bên Phải)**

- Danh sách tin nhắn đã ghim (tối đa 10)
- Click để cuộn đến tin nhắn gốc
- Nút "Show More" để xem tất cả

---

## 💬 Quản Lý Hội Thoại

### ➕ Tạo Hội Thoại Mới

#### Cách 1: Draft Mode (Khuyến Nghị)

1. Nhấn nút **"➕ New Conversation"** ở sidebar
2. Gõ tin nhắn đầu tiên vào ô chat
3. Nhấn **Send** → Hệ thống tự động tạo hội thoại với tiêu đề thông minh:
   - Nếu tin nhắn ≤ 4 từ: Dùng tin nhắn làm tiêu đề
   - Nếu tin nhắn > 4 từ: Tiêu đề là "New Chat"

#### Cách 2: Manual Create (Không khả dụng trong phiên bản hiện tại)

- Trước đây có modal tạo hội thoại với các tùy chọn
- Đã được thay thế bằng Draft Mode để trải nghiệm mượt mà hơn

---

### 🔍 Tìm Kiếm Hội Thoại

#### Tìm Kiếm Trong Sidebar

1. Gõ từ khóa vào ô search ở đầu sidebar
2. Hệ thống tự động lọc danh sách hội thoại theo:
   - Tiêu đề hội thoại
   - Nội dung tin nhắn
   - Tags
3. Kết quả hiển thị ngay lập tức (realtime)

#### Tìm Kiếm Toàn Cục

1. Nhấn nút **🌐 Global Search** ở header sidebar
2. Nhập câu hỏi hoặc từ khóa cần tìm
3. Hệ thống tìm kiếm trong **tất cả hội thoại** của bạn
4. Kết quả hiển thị:
   - Hội thoại chứa nội dung liên quan
   - Đoạn tin nhắn khớp nhất (highlighted)
   - Ngữ cảnh xung quanh (2 tin nhắn trước/sau)
5. Click vào kết quả → Tự động mở hội thoại và cuộn đến tin nhắn

#### Công Nghệ:

- **Semantic Search**: Tìm kiếm theo ý nghĩa, không chỉ từ khóa
- **Vector Embeddings**: Sử dụng OpenAI text-embedding-3-small
- **PostgreSQL pgvector**: Lưu trữ và tìm kiếm vector hiệu quả

---

### ✏️ Đổi Tên Hội Thoại

1. Click vào biểu tượng **✏️ Edit** bên cạnh tên hội thoại
2. Nhập tên mới
3. Nhấn **Enter** hoặc click ra ngoài để lưu

---

### 🗑️ Xóa Hội Thoại

1. Hover chuột vào hội thoại trong sidebar
2. Click nút **🗑️ Delete**
3. Xác nhận xóa trong popup
4. **Lưu ý**: Đây là soft delete, dữ liệu vẫn còn trong DB

---

### 📊 Cập Nhật Cài Đặt Hội Thoại

Mỗi hội thoại có thể tùy chỉnh:

#### Model AI

- `gpt-4` - Thông minh nhất, chất lượng cao nhất
- `gpt-3.5-turbo` - Nhanh, tiết kiệm
- `gpt-5-nano` - Model mặc định

#### Context Window

- Số lượng tin nhắn gần nhất được gửi cho AI (1-50)
- Mặc định: 10 tin nhắn
- Context lớn hơn = AI nhớ nhiều hơn nhưng tốn tokens

---

## 📤 Gửi & Nhận Tin Nhắn

### ✍️ Gửi Tin Nhắn

#### Gửi Tin Nhắn Text

1. Gõ nội dung vào ô input
2. Nhấn **Enter** hoặc click nút **📤 Send**
3. Tin nhắn hiển thị ngay lập tức (optimistic UI)
4. AI bắt đầu phản hồi (hiển thị typing indicator)
5. Phản hồi hiển thị theo thời gian thực (streaming)

#### Gửi Tin Nhắn Với File

1. Click nút **📎 Attach**
2. Chọn file từ máy tính:
   - **Hình ảnh**: JPG, PNG, GIF, WebP (max 10MB)
   - **Video**: MP4, WebM, MOV (max 50MB)
   - **Tài liệu**: PDF, DOC, DOCX, TXT (max 20MB)
3. Xem trước file đã chọn
4. Gõ tin nhắn (tùy chọn)
5. Nhấn **Send**

#### Tính Năng Đặc Biệt:

- **Streaming Response**: Xem AI gõ từng chữ real-time
- **Typing Indicator**: Biết khi nào AI đang suy nghĩ
- **Multi-tab Sync**: Tin nhắn đồng bộ trên tất cả tab/thiết bị
- **Offline Queue**: Tin nhắn được lưu và gửi lại khi online

---

### 🔄 Trạng Thái Tin Nhắn

Mỗi tin nhắn có các trạng thái:

```
📝 Pending    → Đang gửi
✅ Sent       → Đã gửi thành công
📬 Delivered  → Đã đến server
👁️ Read       → Đã xem
❌ Failed     → Gửi thất bại (có nút Retry)
```

#### Retry Message (Gửi Lại)

Khi tin nhắn thất bại:

1. Click nút **🔄 Retry** trên tin nhắn lỗi
2. Hệ thống tự động thử lại với exponential backoff:
   - Lần 1: Ngay lập tức
   - Lần 2: Sau 2 giây
   - Lần 3: Sau 4 giây
3. Tối đa 3 lần thử

---

### 📌 Ghim Tin Nhắn (Pin Messages)

#### Ghim Tin Nhắn

1. Hover chuột vào tin nhắn quan trọng
2. Click biểu tượng **📌 Pin**
3. Tin nhắn được thêm vào danh sách Pinned Messages

#### Giới Hạn:

- Tối đa **10 tin nhắn ghim** mỗi hội thoại
- Khi đạt giới hạn, phải bỏ ghim tin cũ trước

#### Xem Tin Nhắn Đã Ghim:

1. Click nút **📌 Pinned Messages** ở header
2. Dropdown hiển thị tất cả tin nhắn đã ghim
3. Click vào tin nhắn → Tự động cuộn đến vị trí gốc

#### Bỏ Ghim:

- Click **📍 Unpin** trên tin nhắn đã ghim

---

### ✏️ Chỉnh Sửa & Gửi Lại Tin Nhắn

#### Resend Message (Gửi Lại)

1. Hover vào tin nhắn của bạn (user message)
2. Click **🔄 Resend**
3. AI sẽ trả lời lại với cùng nội dung, nhưng có thể khác câu trả lời trước

#### Edit & Resend

1. Hover vào tin nhắn của bạn
2. Click **✏️ Edit**
3. Sửa nội dung
4. Nhấn **Save** → AI trả lời với nội dung mới

**Lưu ý**: Tính năng này giữ nguyên context của hội thoại trước đó

---

### 💡 Gợi Ý Câu Hỏi Tiếp Theo (Follow-up Suggestions)

#### Gợi Ý Từ Tin Nhắn

1. Sau mỗi câu trả lời của AI, hover vào tin nhắn
2. Click **💡 Get Suggestions**
3. Hệ thống tạo 3 câu hỏi gợi ý dựa trên:
   - Câu hỏi trước của bạn
   - Câu trả lời của AI
4. Click vào gợi ý → Tự động gửi câu hỏi đó

#### Gợi Ý Từ Input

1. Click nút **💡 Lightbulb** ở ô input
2. AI phân tích 10 tin nhắn gần nhất
3. Tạo ra 3-5 câu hỏi có liên quan
4. Click để gửi ngay

#### Công Nghệ:

- Sử dụng GPT để phân tích ngữ cảnh
- Realtime qua WebSocket
- Multi-tab sync (tránh gợi ý trùng lặp)

---

### 🎯 Hỏi Về Đoạn Text Được Chọn

Tính năng đặc biệt cho tin nhắn AI:

1. Bôi đen (highlight) đoạn text trong câu trả lời AI
2. Menu ngữ cảnh hiện ra với tùy chọn:
   - **💬 Ask About This**: Hỏi AI giải thích rõ hơn về đoạn text đã chọn
3. Click → Tự động gửi câu hỏi:
   ```
   Tôi chưa rõ đoạn này, giải thích lại cho tôi: "[đoạn text bạn chọn]"
   ```

---

## 🔍 Tìm Kiếm Thông Minh

### 🌐 Tìm Kiếm Toàn Cục (Global Search)

#### Cách Sử Dụng:

1. Nhấn **🌐 Search All Conversations** ở sidebar header
2. Nhập truy vấn (có thể là câu hỏi, từ khóa, hoặc mô tả)
3. Chờ kết quả (thường < 1 giây)

#### Giao Diện Kết Quả:

```
┌──────────────────────────────────────────────┐
│  🔍 Search Results for: "machine learning"  │
├──────────────────────────────────────────────┤
│  📝 Conversation: ML Tutorial                │
│  📅 2 days ago                               │
│  ─────────────────────────────────────────  │
│  User: What is machine learning?            │
│  AI: Machine learning is a subset of AI...  │
│  👉 Similarity: 95%                          │
│  [View Conversation]                         │
├──────────────────────────────────────────────┤
│  📝 Conversation: Python Guide               │
│  📅 1 week ago                               │
│  ─────────────────────────────────────────  │
│  User: How to implement ML in Python?       │
│  AI: You can use scikit-learn...            │
│  👉 Similarity: 87%                          │
│  [View Conversation]                         │
└──────────────────────────────────────────────┘
```

#### Tính Năng:

- **Semantic Search**: Tìm theo ý nghĩa, không chỉ từ khóa chính xác
- **Best Match Highlighting**: Đoạn khớp nhất được highlight
- **Context Messages**: Hiển thị 2 tin nhắn trước/sau để hiểu ngữ cảnh
- **Similarity Score**: Điểm tương đồng (0-100%)
- **Quick Navigation**: Click để mở hội thoại và cuộn đến tin nhắn

---

### 🔎 Tìm Kiếm Trong Hội Thoại

#### Cách Sử Dụng:

1. Mở một hội thoại
2. Sử dụng chức năng search trong conversation (nếu có trong UI)
3. Hoặc dùng Global Search rồi filter theo conversation

#### API Endpoint:

```
POST /api/conversations/:id/search
Body: {
  query: "từ khóa",
  limit: 10,
  similarity_threshold: 0.7,
  contextMessages: 2
}
```

#### Tham Số:

- **query**: Câu hỏi hoặc từ khóa
- **limit**: Số kết quả tối đa (mặc định: 10)
- **similarity_threshold**: Ngưỡng tương đồng tối thiểu (0.0 - 1.0)
- **contextMessages**: Số tin nhắn ngữ cảnh xung quanh

---

### 🧠 Công Nghệ Đằng Sau

#### Vector Embeddings

- Mỗi tin nhắn được chuyển thành vector 1536 chiều
- Model: `text-embedding-3-small` của OpenAI
- Độ chính xác cao, nhanh chóng

#### PostgreSQL pgvector

- Extension cho phép lưu trữ và tìm kiếm vector
- Sử dụng cosine similarity để so sánh
- Index HNSW để tăng tốc độ

#### Quy Trình:

```
User Query
  → OpenAI Embedding API
  → Vector 1536D
  → PostgreSQL pgvector Search
  → Top K Results
  → Return to User
```

---

## 📁 Quản Lý File & Tài Liệu

### 📤 Upload File

#### Các Loại File Hỗ Trợ:

1. **Hình Ảnh**:

   - Định dạng: JPG, JPEG, PNG, GIF, WebP
   - Kích thước tối đa: 10MB
   - Tự động tạo thumbnail

2. **Video**:

   - Định dạng: MP4, WebM, MOV, AVI
   - Kích thước tối đa: 50MB
   - Tự động tạo thumbnail từ frame đầu

3. **Tài Liệu**:
   - Định dạng: PDF, DOC, DOCX, TXT
   - Kích thước tối đa: 20MB
   - PDF tự động extract text để AI đọc

#### Quy Trình Upload:

1. **Chọn File**:

   - Click nút **📎 Attach** trong chat input
   - Hoặc drag & drop file vào khu vực chat

2. **Upload to Cloudinary**:

   - File được upload trực tiếp lên Cloudinary CDN
   - Bảo mật với signed URL
   - Tối ưu hóa tự động (compression, format conversion)

3. **Lưu Metadata**:

   - Thông tin file lưu vào database
   - Liên kết với conversation và message

4. **AI Processing** (Tùy chọn):
   - PDF: Extract text để AI đọc và trả lời
   - Hình ảnh: Upload lên OpenAI File API để AI nhìn thấy

---

### 🖼️ Xem File Đã Upload

#### Trong Tin Nhắn:

- File hiển thị trực tiếp trong bubble tin nhắn
- Hình ảnh: Hiển thị full size, click để zoom
- Video: Player với controls
- PDF: Hiển thị icon + tên file, click để tải

#### Danh Sách File:

```
GET /api/files/conversation/:conversationId
```

Trả về tất cả file trong hội thoại

---

### 🗑️ Xóa File

#### Cách Xóa:

1. Hover vào file trong tin nhắn
2. Click **🗑️ Delete**
3. Xác nhận xóa

#### Hệ Quả:

- File bị xóa khỏi Cloudinary
- Metadata xóa khỏi database
- Tin nhắn vẫn giữ nguyên (chỉ mất file đính kèm)

---

### 📊 Thống Kê Upload

Xem thống kê file của bạn:

```
GET /api/files/stats
```

**Trả về**:

- Tổng số file đã upload
- Tổng dung lượng đã dùng
- Phân loại theo loại file (image, video, document)
- File upload gần nhất

---

### 🤖 AI Xử Lý File

#### PDF Processing:

1. Upload PDF vào tin nhắn
2. Server tự động extract text bằng `pdf-parse`
3. Text được lưu trong `extracted_text`
4. Khi gửi cho AI, text được kèm theo:
   ```
   User: Tóm tắt tài liệu này
   [Attachment: document.pdf]
   Extracted Text: [nội dung PDF...]
   ```

#### Image Analysis (Tương Lai):

- Tích hợp OpenAI Vision API
- AI có thể "nhìn" và mô tả hình ảnh
- Trả lời câu hỏi về nội dung hình

---

## 📂 Quản Lý Project

### ➕ Tạo Project Mới

#### Cách Thực Hiện:

1. Click **"+ Create Project"** trong sidebar
2. Điền thông tin:
   - **Tên Project**: Ví dụ "Work", "Personal", "Learning"
   - **Mô tả**: Tùy chọn, mô tả ngắn về project
   - **Màu sắc**: Chọn màu đại diện (blue, green, red, purple, orange, ...)
   - **Icon**: Chọn emoji hoặc icon (📁, 💼, 🎯, 💡, ...)
3. Nhấn **Create**

#### Giao Diện Form:

```
┌─────────────────────────────────┐
│  ➕ Create New Project          │
├─────────────────────────────────┤
│  Name:        [____________]    │
│  Description: [____________]    │
│               [____________]    │
│  Color: 🔵🟢🔴🟣🟠🟡         │
│  Icon:  📁💼🎯💡📚🏠         │
│                                  │
│  [Cancel]  [Create]             │
└─────────────────────────────────┘
```

---

### 📝 Sửa Project

1. Click **⋮** menu trên project card
2. Chọn **Edit**
3. Sửa thông tin (tên, mô tả, màu, icon, thứ tự)
4. Nhấn **Save**

---

### 🗑️ Xóa Project

1. Click **⋮** menu trên project card
2. Chọn **Delete**
3. Xác nhận xóa

**Lưu ý**:

- Hội thoại trong project không bị xóa
- Hội thoại tự động chuyển về "No Project"

---

### 🔀 Di Chuyển Hội Thoại Vào Project

#### Cách 1: Drag & Drop

1. Kéo hội thoại từ danh sách
2. Thả vào project mong muốn
3. Thả vào "No Project" để xóa khỏi project

#### Cách 2: Menu

1. Hover vào hội thoại
2. Click **⋮** menu
3. Chọn **Move to Project**
4. Chọn project đích

---

### 📊 Xem Hội Thoại Trong Project

1. Click vào project card
2. Danh sách hội thoại tự động filter theo project
3. Hiển thị số lượng hội thoại ở badge

#### API:

```
GET /api/projects/:id/conversations
```

---

### 🎨 Tùy Chỉnh Hiển Thị

Mỗi project có:

- **Màu sắc riêng**: Dễ phân biệt visual
- **Icon riêng**: Biểu tượng đại diện
- **Số thứ tự**: Kéo thả để sắp xếp lại

#### Project Card:

```
┌────────────────────────┐
│  💼 Work Project       │
│  🔵 Blue               │
│  ───────────────────  │
│  12 conversations      │
│  Last active: 2h ago   │
│  [Open] [⋮]            │
└────────────────────────┘
```

---

## ⚙️ Cài Đặt AI

### 🛠️ Mở Cài Đặt

Có 2 cách:

1. Click **⚙️ Settings** trong user menu (sidebar footer)
2. Click **Settings** trong dropdown profile

---

### 🌐 Ngôn Ngữ (Language Preference)

#### Các Ngôn Ngữ Hỗ Trợ:

- 🇬🇧 **English** - Tiếng Anh
- 🇻🇳 **Vietnamese** - Tiếng Việt
- 🇫🇷 **French** - Tiếng Pháp
- 🇩🇪 **German** - Tiếng Đức
- 🇪🇸 **Spanish** - Tiếng Tây Ban Nha
- 🇯🇵 **Japanese** - Tiếng Nhật
- 🇨🇳 **Chinese** - Tiếng Trung
- 🇰🇷 **Korean** - Tiếng Hàn

#### Cách Chọn:

1. Mở **Settings Modal**
2. Phần **Language Preference**
3. Chọn ngôn ngữ từ dropdown
4. Nhấn **Save**

**Ảnh Hưởng**:

- AI sẽ trả lời bằng ngôn ngữ bạn chọn
- Áp dụng cho TẤT CẢ hội thoại mới
- Không ảnh hưởng hội thoại cũ

---

### 📝 Phong Cách Trả Lời (Response Style)

#### Các Style Có Sẵn:

1. **Concise** (Ngắn gọn):

   - Câu trả lời ngắn, đi thẳng vào vấn đề
   - Phù hợp: Câu hỏi nhanh, tra cứu thông tin

2. **Balanced** (Cân bằng) - **Mặc định**:

   - Vừa đủ chi tiết, dễ hiểu
   - Phù hợp: Hầu hết mục đích sử dụng

3. **Detailed** (Chi tiết):

   - Giải thích sâu, nhiều ví dụ
   - Phù hợp: Học tập, nghiên cứu

4. **Technical** (Chuyên môn):

   - Dùng thuật ngữ kỹ thuật, chính xác
   - Phù hợp: Lập trình, khoa học

5. **Creative** (Sáng tạo):

   - Câu trả lời sinh động, có cảm xúc
   - Phù hợp: Viết lách, brainstorming

6. **Professional** (Chuyên nghiệp):
   - Lịch sự, trang trọng
   - Phù hợp: Email công việc, tài liệu chính thức

#### Giao Diện:

```
┌──────────────────────────────────────┐
│  📝 Response Style                   │
├──────────────────────────────────────┤
│  ⭕ Concise       - Brief answers    │
│  ⚫ Balanced      - Recommended      │
│  ⭕ Detailed      - In-depth         │
│  ⭕ Technical     - For developers   │
│  ⭕ Creative      - Engaging         │
│  ⭕ Professional  - Formal tone      │
└──────────────────────────────────────┘
```

---

### ✏️ Hướng Dẫn Tùy Chỉnh (Custom Instructions)

Đây là tính năng MẠNH NHẤT để cá nhân hóa AI!

#### Cách Sử Dụng:

1. Mở **Settings Modal**
2. Phần **Custom Instructions**
3. Nhập hướng dẫn cho AI (tối đa 2000 ký tự)
4. Nhấn **Save**

#### Ví Dụ Custom Instructions:

**Cho Lập Trình Viên**:

```
- Always include code examples when explaining programming concepts
- Use TypeScript instead of JavaScript
- Follow clean code principles
- Explain trade-offs of different approaches
```

**Cho Sinh Viên**:

```
- Explain like I'm a beginner
- Use simple language and analogies
- Provide step-by-step instructions
- Include practice questions at the end
```

**Cho Người Dùng Tiếng Việt**:

```
- Always respond in Vietnamese
- Use emojis to make responses more engaging
- Be friendly and enthusiastic
- Explain technical terms in Vietnamese
```

**Cho Người Bận Rộn**:

```
- Keep responses under 100 words unless asked for details
- Use bullet points for clarity
- Highlight key takeaways with bold text
```

#### Lưu Ý:

- Instructions được thêm vào **MỌI** cuộc trò chuyện
- Nên viết rõ ràng, cụ thể
- Tránh mâu thuẫn với nhau
- Có thể update bất cứ lúc nào

---

### 💾 Lưu Cài Đặt

Sau khi thay đổi:

1. Nhấn **Save Preferences**
2. Hệ thống lưu vào database
3. Cache trong Redis để load nhanh
4. Áp dụng ngay lập tức cho hội thoại mới

**Lưu ý**:

- Nếu đóng modal mà chưa lưu → Hiện cảnh báo "Unsaved Changes"
- Có thể Cancel để bỏ thay đổi

---

## 👤 Quản Lý Hồ Sơ

### 🖼️ Avatar (Ảnh Đại Diện)

#### Upload Avatar:

1. Mở **Profile Modal**
2. Click vào vùng avatar
3. Chọn ảnh từ máy tính (JPG, PNG, max 5MB)
4. Xem preview
5. Nhấn **Save Changes** để áp dụng

#### Remove Avatar:

1. Hover vào avatar
2. Click **🗑️ Remove**
3. Nhấn **Save Changes**

**Tính Năng**:

- Tự động resize và optimize
- Upload lên Cloudinary
- Hiển thị toàn bộ app (sidebar, message bubble, ...)

---

### 📝 Thông Tin Cá Nhân

#### Username (Tên Người Dùng):

- Độ dài: 3-50 ký tự
- Hiển thị trong chat và profile
- Có thể thay đổi bất cứ lúc nào

#### Bio (Tiểu Sử):

- Tối đa 200 ký tự
- Mô tả ngắn về bản thân
- Tùy chọn (có thể để trống)

#### Email:

- **Không thể thay đổi**
- Dùng để đăng nhập
- Hiển thị read-only

#### Member Since:

- Ngày tạo tài khoản
- Chỉ xem, không sửa được

---

### 🔐 Đổi Mật Khẩu

#### Cách Thực Hiện:

1. Mở **Profile Modal**
2. Phần **Security**, click **Change Password**
3. Nhập:
   - **Current Password**: Mật khẩu hiện tại
   - **New Password**: Mật khẩu mới (tối thiểu 6 ký tự)
   - **Confirm Password**: Nhập lại mật khẩu mới
4. Nhấn **Change Password**

#### Giao Diện:

```
┌──────────────────────────────────────┐
│  🔐 Change Password                  │
├──────────────────────────────────────┤
│  Current Password:                   │
│  [••••••••••••••]                   │
│                                      │
│  New Password:                       │
│  [••••••••••••••]                   │
│                                      │
│  Confirm New Password:               │
│  [••••••••••••••]                   │
│                                      │
│  [Cancel]  [Change Password]         │
└──────────────────────────────────────┘
```

#### Bảo Mật:

- Mật khẩu được hash bằng bcrypt
- Mật khẩu cũ phải đúng mới đổi được
- Tự động logout khỏi các thiết bị khác (tùy chọn)

---

### 💾 Lưu Thông Tin Profile

Sau khi chỉnh sửa:

1. Nhấn **Save Changes**
2. System cập nhật:
   - Database (PostgreSQL)
   - Avatar (Cloudinary nếu có)
   - Global user state (React Context)
3. Hiển thị thông báo thành công
4. Modal tự động đóng sau 0.5s

---

## 🚀 Tính Năng Nâng Cao

### 🔌 Real-time Synchronization

#### WebSocket Connection:

- Kết nối tự động khi login
- Reconnect tự động khi mất kết nối
- Ping/Pong để kiểm tra connection health

#### Multi-tab Sync:

Mở nhiều tab cùng lúc, mọi thao tác đồng bộ:

- ✅ Gửi tin nhắn tab A → Hiện ngay tab B
- ✅ Tạo hội thoại mới → Hiện tất cả tab
- ✅ Đổi tên hội thoại → Sync tất cả
- ✅ Xóa hội thoại → Ẩn khỏi tất cả tab
- ✅ Typing indicator → Hiện trên tab khác

#### Multi-device Sync:

- Đăng nhập trên điện thoại + máy tính
- Mọi thay đổi sync tức thì
- Unread status tracking chính xác

---

### 📡 Offline Support

#### Khi Mất Kết Nối:

1. Hệ thống phát hiện `navigator.onLine = false`
2. Hiển thị banner: **"Connection lost. Messages will be queued."**
3. Tin nhắn được lưu local với status `failed`
4. Hiển thị nút **Retry** trên mỗi tin nhắn

#### Khi Kết Nối Lại:

1. Phát hiện `navigator.onLine = true`
2. Hiển thị: **"Connection restored!"**
3. Tự động reconnect WebSocket
4. User có thể click **Retry** để gửi lại tin nhắn

---

### 📊 Token Usage Tracking

Mỗi hội thoại theo dõi:

- **Total Tokens Used**: Tổng tokens đã dùng
- **Message Count**: Số lượng tin nhắn
- **Model**: Model AI đang dùng

Hiển thị ở:

- Header của chat area
- Conversation details
- Có thể dùng để tính chi phí

---

### 🔔 Unread Status Tracking

#### Cơ Chế:

1. Khi user mở hội thoại → Emit `conversation:view`
2. Server đánh dấu hội thoại đã đọc
3. Khi có tin nhắn mới ở tab/thiết bị khác → Server emit `unread_status`
4. Client hiển thị badge đỏ trên hội thoại chưa đọc

#### Badge Hiển Thị:

```
💬 Important Conversation  🔴 (3)
📝 Old Chat
🎯 Task Discussion        🔴 (1)
```

---

### 🎯 Context Window Management

#### Context Window Là Gì?

- Số lượng tin nhắn gần nhất được gửi cho AI
- Giúp AI "nhớ" cuộc trò chuyện trước

#### Tùy Chỉnh:

1. Mỗi hội thoại có context window riêng (1-50)
2. Mặc định: 10 tin nhắn
3. Có thể update trong conversation settings

#### Ví Dụ:

- Context = 5: AI chỉ nhớ 5 tin nhắn gần nhất
- Context = 50: AI nhớ 50 tin nhắn → Nhiều ngữ cảnh hơn, nhưng tốn tokens

---

### 🎨 Custom Styling

#### Project Colors:

- Mỗi project có màu riêng
- Hội thoại kế thừa màu của project
- Dễ phân biệt visual

#### Message Bubbles:

- User messages: Bên phải, màu xanh (#1890ff)
- AI messages: Bên trái, màu xám (#f0f0f0)
- Pending: Màu mờ hơn
- Failed: Viền đỏ với icon warning

---

### 🔄 Infinite Scroll

#### Conversations List:

- Load 20 hội thoại đầu tiên
- Cuộn xuống cuối → Tự động load 20 hội thoại tiếp theo
- Hiển thị loading spinner
- Dừng khi hết hội thoại

#### Messages List:

- Load 20 tin nhắn gần nhất
- Cuộn lên đầu → Load 20 tin nhắn cũ hơn
- Giữ vị trí scroll sau khi load
- Dừng khi hết tin nhắn

---

## 💡 Mẹo & Thủ Thuật

### 🎯 Tối Ưu Hóa Trải Nghiệm

#### 1. Sử Dụng Custom Instructions

- Đặt một lần, áp dụng mọi hội thoại
- Tiết kiệm thời gian không phải nhắc lại

#### 2. Tổ Chức Theo Project

- Tạo project cho từng chủ đề (Work, Study, Personal)
- Dễ tìm hội thoại liên quan
- Visual phân biệt rõ ràng

#### 3. Ghim Tin Nhắn Quan Trọng

- Ghim code snippet hay dùng
- Ghim câu trả lời quan trọng
- Truy cập nhanh không cần scroll

#### 4. Sử Dụng Follow-up Suggestions

- Không biết hỏi gì tiếp → Click lightbulb
- AI gợi ý câu hỏi hay dựa trên context

#### 5. Tận Dụng Semantic Search

- Không nhớ hội thoại cũ → Dùng Global Search
- Tìm theo ý nghĩa, không cần từ khóa chính xác

---

### ⚡ Tăng Tốc Độ

#### 1. Tận Dụng WebSocket

- Tin nhắn gửi nhanh hơn HTTP
- Streaming response mượt mà

#### 2. Redis Cache

- Preferences được cache
- Load nhanh hơn từ lần 2 trở đi

#### 3. CDN cho Files

- Files upload lên Cloudinary
- Download nhanh từ edge server gần nhất

#### 4. Optimistic UI

- Tin nhắn hiện ngay, không đợi server
- UX mượt mà hơn

---

### 🔒 Bảo Mật

#### 1. Đổi Mật Khẩu Định Kỳ

- Nên đổi mật khẩu 3-6 tháng/lần
- Dùng mật khẩu mạnh

#### 2. Logout Khi Không Dùng

- Đặc biệt trên máy public
- Click **Logout** trong user menu

#### 3. Kiểm Tra Sessions

- Access token tự hết hạn sau 15 phút
- Refresh token hết hạn sau 7 ngày

---

### 📱 Responsive Design

#### Desktop (> 1200px):

- Full sidebar + chat + info panel
- Tối ưu cho màn hình lớn

#### Tablet (768px - 1200px):

- Sidebar có thể collapse
- Info panel ẩn, có thể toggle

#### Mobile (< 768px):

- Sidebar chuyển thành drawer
- Full screen chat area
- Touch-friendly controls

---

### 🐛 Xử Lý Lỗi

#### Tin Nhắn Gửi Thất Bại:

1. Check network connection
2. Click **Retry** (tối đa 3 lần)
3. Nếu vẫn lỗi → Logout và login lại

#### File Upload Lỗi:

1. Check kích thước file (không vượt giới hạn)
2. Check định dạng file (phải hỗ trợ)
3. Thử upload lại

#### Search Không Ra Kết Quả:

1. Thử từ khóa khác
2. Dùng câu hỏi thay vì từ khóa ngắn
3. Check ngưỡng similarity (có thể quá cao)

---

## 📞 Hỗ Trợ & Liên Hệ

### 👨‍💻 Thông Tin Tác Giả

- **Tên**: Nguyen Vu Thanh
- **Email**: Thanh14704@gmail.com
- **Điện thoại**: 0961515419
- **GitHub**: [@Thanh14013](https://github.com/Thanh14013)

### 🐞 Báo Lỗi

Nếu gặp bug hoặc có đề xuất:

1. Tạo Issue trên GitHub: [AI_Chatbot_Assistant/issues](https://github.com/Thanh14013/AI_Chatbot_Assistant/issues)
2. Hoặc email trực tiếp: Thanh14704@gmail.com

---

## 📚 Tài Liệu Kỹ Thuật

### API Documentation

Swagger UI: `http://localhost:3000/api-docs`

### Tech Stack

**Frontend**:

- React 18.3 + TypeScript
- Ant Design 5.27
- Socket.IO Client
- Vite

**Backend**:

- Node.js 20+ + Express 5
- PostgreSQL 16 + pgvector
- Redis
- Socket.IO
- OpenAI API
- Cloudinary

---

## 🎓 Học Thêm

### Semantic Search:

- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [pgvector Extension](https://github.com/pgvector/pgvector)

### WebSocket:

- [Socket.IO Documentation](https://socket.io/docs/v4/)

### AI Prompting:

- [OpenAI Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)

---

## 📝 Changelog

### Version 1.0.0 (Current)

- ✅ Authentication & JWT
- ✅ Real-time Chat với WebSocket
- ✅ Semantic Search
- ✅ File Upload & Management
- ✅ Project Organization
- ✅ User Preferences & Profile
- ✅ Pin Messages
- ✅ Follow-up Suggestions
- ✅ Offline Support
- ✅ Multi-tab Sync

### Upcoming Features:

- 🔜 Voice Input/Output
- 🔜 Image Generation với DALL-E
- 🔜 Team Collaboration
- 🔜 Export Conversations
- 🔜 Advanced Analytics
- 🔜 Mobile App

---

## ⭐ Kết Luận

**AI Chatbot Assistant** là một ứng dụng mạnh mẽ, linh hoạt và dễ sử dụng. Với các tính năng:

- 🤖 AI thông minh với GPT-4
- 💬 Real-time chat mượt mà
- 🔍 Tìm kiếm semantic thông minh
- 📁 Quản lý file hiệu quả
- 📂 Tổ chức project rõ ràng
- ⚙️ Tùy chỉnh AI theo ý muốn
- 👤 Quản lý profile đầy đủ

Hy vọng tài liệu này giúp bạn sử dụng ứng dụng hiệu quả nhất!

**Happy Chatting! 🚀**

---

_Tài liệu được cập nhật: 27/10/2025_
