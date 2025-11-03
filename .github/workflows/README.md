# GitHub Actions Workflows Documentation

This directory contains comprehensive CI/CD workflows for the AI Chatbot Assistant project.

## 📋 Overview

| Workflow              | File                | Trigger                  | Purpose                                                |
| --------------------- | ------------------- | ------------------------ | ------------------------------------------------------ |
| CI/CD Pipeline        | `ci.yaml`           | Push, PR                 | Automated testing, building, and Docker image creation |
| Continuous Deployment | `cd.yaml`           | CI success, Manual       | Deploy to staging/production environments              |
| Database Migration    | `db-migration.yaml` | Manual                   | Manage database schema changes                         |
| Rollback              | `rollback.yaml`     | Manual                   | Revert to previous version                             |
| Monitoring            | `monitoring.yaml`   | Schedule (15min), Manual | Health checks and system monitoring                    |

## 🚀 Workflows

### 1. CI/CD Pipeline (`ci.yaml`)

**Triggers:**

- Push to `master` or `develop` branches
- Pull requests to `master` or `develop`
- Manual dispatch

**Jobs:**

- **Server Jobs:**
  - Lint: ESLint code quality checks
  - Build: TypeScript compilation
  - Test: Unit tests with PostgreSQL and Redis
- **Client Jobs:**

  - Lint: ESLint code quality checks
  - Build: Vite production build
  - Test: Frontend unit tests

- **Docker Build:**

  - Builds and pushes Docker images to Docker Hub
  - Only on push to master branch
  - Uses BuildKit with layer caching

- **Security Scan:**

  - Trivy vulnerability scanner
  - Runs on pull requests
  - Reports to GitHub Security

- **Integration Test:**
  - Full stack Docker Compose test
  - Runs on pull requests
  - Validates service health

**Usage:**

```bash
# Automatically runs on git push
git push origin master

# Or trigger manually from GitHub Actions tab
```

---

### 2. Continuous Deployment (`cd.yaml`)

**Triggers:**

- Successful CI workflow completion
- Manual dispatch with environment selection

**Environments:**

- **Staging:** Automatic deployment from master
- **Production:** Manual approval required

**Features:**

- Pre-deployment validation
- Zero-downtime rolling updates
- Automatic smoke tests
- Database migration execution
- Backup creation before production deployment
- Post-deployment verification

**Usage:**

```bash
# Manual deployment
# Go to Actions → CD - Continuous Deployment → Run workflow
# Select environment: staging or production
# Optional: specify version tag
```

**Deployment Flow:**

1. ✅ Validate Docker images exist
2. 📦 Create backup (production only)
3. 🚀 Deploy new version
4. 🧪 Run smoke tests
5. ✅ Verify deployment
6. 📊 Generate report

---

### 3. Database Migration (`db-migration.yaml`)

**Triggers:** Manual dispatch only

**Environments:**

- Development (local test)
- Staging
- Production

**Actions:**

- `migrate`: Run pending migrations
- `rollback`: Undo N migrations
- `status`: Check migration status
- `seed`: Run database seeders (dev only)

**Usage:**

```bash
# Go to Actions → Database Migration → Run workflow
# Select:
#   - Environment (development/staging/production)
#   - Action (migrate/rollback/status/seed)
#   - Steps (for rollback, default: 1)
```

**Safety Features:**

- Automatic database backup before migration
- Pre-migration validation
- Post-migration verification
- Maintenance mode for production
- Comprehensive logging

**Example Scenarios:**

**Running migrations on staging:**

1. Go to GitHub Actions
2. Select "Database Migration"
3. Environment: `staging`
4. Action: `migrate`
5. Run workflow

**Rolling back production (emergency):**

1. Environment: `production`
2. Action: `rollback`
3. Steps: `1` (or number of migrations to rollback)
4. Run workflow

---

### 4. Rollback Deployment (`rollback.yaml`)

**Triggers:** Manual dispatch only

**Purpose:** Quickly revert to a previous working version

**Features:**

- Pre-rollback validation
- Automatic backup creation
- Zero-downtime rollback
- Post-rollback verification
- Incident report generation

**Usage:**

```bash
# Go to Actions → Rollback Deployment → Run workflow
# Required inputs:
#   - Environment: staging or production
#   - Version: Docker image tag to rollback to
#   - Reason: Why rollback is needed
#   - Skip backup: (optional) default: false
```

**Example:**

```
Environment: production
Version: v2024.11.02-abc1234
Reason: Critical bug in authentication causing user login failures
Skip backup: false
```

**Rollback Process:**

1. 🔍 Validate target version exists
2. 📦 Create pre-rollback backup
3. 🔄 Deploy previous version
4. 🧪 Run verification tests
5. 📢 Notify team
6. 📋 Generate incident report

---

### 5. Monitoring & Health Checks (`monitoring.yaml`)

**Triggers:**

- Scheduled: Every 15 minutes
- Manual dispatch

**Checks:**

- API health endpoint
- Frontend availability
- Database connectivity
- SSL certificate expiration
- WebSocket connectivity
- Response time monitoring
- Docker image availability

**Alerts:**

- 🚨 **Critical:** Service unavailability
- ⚠️ **Warning:** Performance degradation, SSL expiration

**Health Report Includes:**

- HTTP status codes
- Response times
- Service availability
- SSL certificate days remaining
- Overall system status

---

## 🔐 Required Secrets

Configure these secrets in **Settings → Secrets and variables → Actions**:

### Docker Hub

```
DOCKER_USERNAME=your-dockerhub-username
DOCKER_PASSWORD=your-dockerhub-token-or-password
```

### Staging Environment

```
STAGING_SSH_KEY=your-staging-ssh-private-key
STAGING_HOST=staging.example.com
STAGING_USER=deploy
STAGING_DEPLOY_PATH=/var/www/ai-chatbot
STAGING_URL=https://staging.example.com
```

### Production Environment

```
PRODUCTION_SSH_KEY=your-production-ssh-private-key
PRODUCTION_HOST=production.example.com
PRODUCTION_USER=deploy
PRODUCTION_DEPLOY_PATH=/var/www/ai-chatbot
PRODUCTION_URL=https://yourdomain.com
```

### API Keys

```
OPENAI_API_KEY=sk-...
```

---

## 📝 Environment Setup

### Prerequisites on Target Servers

**All Environments:**

1. Docker and Docker Compose installed
2. Git configured
3. SSH access configured
4. Network configured for Docker

**Directory Structure:**

```
/var/www/ai-chatbot/
├── .env
├── docker-compose.yml
├── server/
├── client/
└── backups/
```

**Environment Variables (.env):**

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_HOST=redis-host
REDIS_PORT=6379
JWT_SECRET=your-secret
REFRESH_TOKEN_SECRET=your-refresh-secret
OPENAI_API_KEY=sk-...
CORS_ORIGINS=https://yourdomain.com
```

---

## 🔄 Workflow Dependencies

```
CI Pipeline (ci.yaml)
    ↓ (on success)
CD Pipeline (cd.yaml)
    ↓
Monitoring (monitoring.yaml)
    ↓ (if issues detected)
Rollback (rollback.yaml)
```

---

## 📊 Best Practices

### 1. **Development Workflow**

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push and create PR
git push origin feature/new-feature

# 4. CI runs automatically
# 5. Review and merge to develop
# 6. Merge develop to master for deployment
```

### 2. **Deployment Workflow**

```bash
# 1. Merge to master (triggers CI)
# 2. CI completes (builds Docker images)
# 3. CD runs automatically for staging
# 4. Test on staging
# 5. Manual approval for production
# 6. Monitor production after deployment
```

### 3. **Emergency Rollback**

```bash
# 1. Identify issue in production
# 2. Find last known good version (from CI/CD history)
# 3. Run rollback workflow
# 4. Verify rollback success
# 5. Investigate root cause
# 6. Fix and redeploy
```

### 4. **Database Changes**

```bash
# 1. Create migration locally
npm run migration:create -- add-new-column

# 2. Test migration on development
npm run migrate

# 3. Commit and push
git add src/migrations/
git commit -m "feat: add new column migration"

# 4. After deployment, run migration workflow
# - First on staging
# - Then on production (with approval)
```

---

## 🔧 Troubleshooting

### CI Pipeline Fails

**Build Errors:**

```bash
# Check build logs in GitHub Actions
# Fix locally:
cd client && npm run build
cd server && npm run build
```

**Test Failures:**

```bash
# Run tests locally
cd server && npm test
cd client && npm test
```

**Docker Build Issues:**

```bash
# Test Docker build locally
docker build -t test-server ./server
docker build -t test-client ./client
```

### Deployment Fails

**SSH Connection Issues:**

- Verify SSH key is correct
- Check server is accessible
- Verify user has proper permissions

**Docker Pull Issues:**

- Verify Docker Hub credentials
- Check image tags exist
- Verify network connectivity

**Health Check Failures:**

- Check application logs
- Verify environment variables
- Check database connectivity

### Rollback Issues

**Version Not Found:**

- Verify version tag exists in Docker Hub
- Check git tags
- Review previous deployment history

**Service Won't Start:**

- Check Docker logs: `docker compose logs`
- Verify environment variables
- Check port conflicts

---

## 📈 Monitoring Dashboard

### Key Metrics to Monitor:

1. **Availability:** API uptime percentage
2. **Performance:** Response time trends
3. **Errors:** Error rate and types
4. **Deployments:** Frequency and success rate
5. **Rollbacks:** Frequency and reasons

### Recommended Tools:

- **Application Monitoring:** New Relic, Datadog, or Grafana
- **Log Aggregation:** ELK Stack or CloudWatch
- **Alerting:** PagerDuty, Opsgenie
- **Status Page:** Statuspage.io

---

## 🛡️ Security Considerations

1. **Secrets Management:**

   - Never commit secrets to repository
   - Rotate secrets regularly
   - Use GitHub encrypted secrets

2. **Access Control:**

   - Limit who can approve production deployments
   - Use environment protection rules
   - Enable branch protection

3. **Dependency Security:**

   - Trivy scans run automatically
   - Review security alerts
   - Update dependencies regularly

4. **Audit Logging:**
   - All deployments are logged
   - Review deployment history
   - Track who deployed what and when

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [PostgreSQL Backup Guide](https://www.postgresql.org/docs/current/backup.html)
- [Sequelize Migrations](https://sequelize.org/docs/v6/other-topics/migrations/)

---

## 🤝 Contributing

When adding or modifying workflows:

1. Test workflows on a feature branch first
2. Document changes in this README
3. Update required secrets section if needed
4. Consider backward compatibility
5. Add appropriate error handling

---

## 📞 Support

For issues with workflows:

1. Check workflow run logs in GitHub Actions
2. Review this documentation
3. Check server logs on deployment targets
4. Create an issue in the repository

---

**Last Updated:** November 2025
**Maintained by:** DevOps Team
