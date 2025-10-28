# Docker Deployment Guide - AI Chatbot Assistant

## 📋 Tổng quan

Dự án được containerize với Docker và triển khai trên LAN với kiến trúc:

- **Client (Public)**: Nginx serving React app - Exposed trên port 80
- **Server (Private)**: Node.js Express API + Socket.IO - Chỉ truy cập qua Docker network
- **PostgreSQL (Private)**: Database - Chỉ truy cập qua Docker network
- **Redis (Private)**: Cache - Chỉ truy cập qua Docker network

## 🏗️ Kiến trúc

```
┌─────────────────────────────────────────┐
│          LAN Network                    │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   Client (Nginx) :80             │  │ ← Public (Exposed)
│  └──────────────┬───────────────────┘  │
│                 │                       │
│  ┌──────────────┴───────────────────┐  │
│  │   Docker Network (chatbot)       │  │
│  │                                  │  │
│  │  ┌──────────────────────────┐   │  │
│  │  │  Server (Node.js) :3000  │   │  │ ← Private
│  │  └──────────┬───────────────┘   │  │
│  │             │                    │  │
│  │      ┌──────┴────────┐          │  │
│  │      │                │          │  │
│  │  ┌───▼────┐     ┌────▼─────┐   │  │
│  │  │ Redis  │     │ Postgres │   │  │ ← Private
│  │  │  :6379 │     │   :5432  │   │  │
│  │  └────────┘     └──────────┘   │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

## 🚀 Hướng dẫn triển khai

### 1. Yêu cầu hệ thống

- Docker Engine 20.10+
- Docker Compose 2.0+
- RAM tối thiểu: 2GB
- Disk space: 5GB

### 2. Cấu hình môi trường

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

Chỉnh sửa file `.env` với các giá trị của bạn:

```env
# PostgreSQL
POSTGRES_DB=chatbot_db
POSTGRES_USER=chatbot_user
POSTGRES_PASSWORD=your_secure_password_123

# Redis
REDIS_PASSWORD=your_redis_password_123

# JWT
JWT_SECRET=your_jwt_secret_min_32_characters_long

# OpenAI (nếu cần)
OPENAI_API_KEY=sk-...

# Cloudinary (nếu cần)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Client Port
CLIENT_PORT=80
```

### 3. Build và chạy containers

#### Chạy tất cả services:

```bash
docker-compose up -d
```

#### Chỉ build lại:

```bash
docker-compose build
```

#### Xem logs:

```bash
# Tất cả services
docker-compose logs -f

# Chỉ xem log của một service
docker-compose logs -f client
docker-compose logs -f server
docker-compose logs -f postgres
docker-compose logs -f redis
```

### 4. Kiểm tra trạng thái

```bash
# Xem trạng thái containers
docker-compose ps

# Xem health check
docker ps
```

### 5. Database Migration

Chạy migrations khi lần đầu khởi động:

```bash
docker-compose exec server npm run migrate
```

### 6. Truy cập ứng dụng

Sau khi containers đã chạy:

- **Web App**: `http://localhost` hoặc `http://<your-lan-ip>`
- **API Docs**: `http://localhost/api/docs`
- **Health Check**: `http://localhost/api/health`

## 🔧 Quản lý

### Dừng containers

```bash
docker-compose down
```

### Dừng và xóa volumes (Cẩn thận - sẽ mất dữ liệu!)

```bash
docker-compose down -v
```

### Restart một service cụ thể

```bash
docker-compose restart server
docker-compose restart client
```

### Rebuild và restart

```bash
docker-compose up -d --build
```

### Xem resource usage

```bash
docker stats
```

### Truy cập vào container

```bash
# Server
docker-compose exec server sh

# Database
docker-compose exec postgres psql -U chatbot_user -d chatbot_db

# Redis
docker-compose exec redis redis-cli
```

## 🔍 Troubleshooting

### 1. Port đã được sử dụng

Nếu port 80 đã được sử dụng, thay đổi trong `.env`:

```env
CLIENT_PORT=8080
```

### 2. Database connection error

Kiểm tra logs:

```bash
docker-compose logs postgres
docker-compose logs server
```

Đảm bảo PostgreSQL đã healthy:

```bash
docker-compose ps
```

### 3. Redis connection error

Kiểm tra Redis:

```bash
docker-compose exec redis redis-cli
# Trong redis-cli:
AUTH your_redis_password_123
PING
```

### 4. Client không kết nối được server

Kiểm tra network:

```bash
docker network inspect chatbot-network
```

### 5. Rebuild toàn bộ

```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## 📦 Backup và Restore

### Backup Database

```bash
docker-compose exec postgres pg_dump -U chatbot_user chatbot_db > backup.sql
```

### Restore Database

```bash
docker-compose exec -T postgres psql -U chatbot_user chatbot_db < backup.sql
```

### Backup Redis

```bash
docker-compose exec redis redis-cli SAVE
docker cp chatbot-redis:/data/dump.rdb ./redis-backup.rdb
```

## 🔒 Security Best Practices

1. ✅ Thay đổi tất cả passwords mặc định trong `.env`
2. ✅ JWT_SECRET phải tối thiểu 32 ký tự
3. ✅ Không commit file `.env` lên git
4. ✅ Chỉ expose client port, giữ các services khác private
5. ✅ Cập nhật images thường xuyên
6. ✅ Sử dụng HTTPS với reverse proxy (nginx, traefik) cho production
7. ✅ Enable firewall và chỉ cho phép trusted IPs

## 📊 Monitoring

### Health Checks

Tất cả services có health checks:

```bash
docker-compose ps
```

### Resource Usage

```bash
docker stats --no-stream
```

### Logs

```bash
# Real-time logs
docker-compose logs -f --tail=100

# Logs với timestamp
docker-compose logs -t
```

## 🚀 Production Deployment

Cho môi trường production, nên:

1. Sử dụng reverse proxy (Nginx/Traefik) với SSL/TLS
2. Setup monitoring (Prometheus, Grafana)
3. Configure log aggregation (ELK stack)
4. Implement backup automation
5. Setup alerts cho health checks
6. Sử dụng Docker Swarm hoặc Kubernetes cho high availability

## 📝 Notes

- Dữ liệu được lưu trong Docker volumes: `chatbot_postgres_data`, `chatbot_redis_data`
- Client được build với nginx multi-stage để tối ưu kích thước image
- Server được build với Node.js multi-stage để tối ưu kích thước image
- Tất cả services nằm trong cùng một network `chatbot-network`
- Chỉ có client được expose ra ngoài qua port 80 (hoặc custom port)

## 🆘 Support

Nếu gặp vấn đề, kiểm tra:

1. Logs của từng service
2. Network connectivity
3. Health check status
4. Environment variables
5. File permissions

---

**Happy Deploying! 🎉**
