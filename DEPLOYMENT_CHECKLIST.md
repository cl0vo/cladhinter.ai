# ✅ Deployment Checklist

Используйте этот чеклист перед деплоем в продакшен.

## 📋 Pre-Deployment

### Backend Setup
- [ ] Создан аккаунт в [Neon](https://neon.tech)
- [ ] Создан проект в Neon
- [ ] Получен Connection String
- [ ] Создан файл `server/.env` с правильными переменными
- [ ] Запущены миграции: `npm run migrate`
- [ ] Проверено подключение к БД: `npm run test`
- [ ] Сервер запускается локально: `npm run dev`
- [ ] Health endpoint работает: `curl http://localhost:3001/health`

### Frontend Setup
- [ ] Создан файл `.env` в корне проекта
- [ ] `VITE_API_URL` указывает на правильный URL (localhost для dev)
- [ ] `VITE_TON_MERCHANT_ADDRESS` заполнен
- [ ] Зависимости установлены: `npm install`
- [ ] Приложение билдится без ошибок: `npm run build`
- [ ] Приложение запускается локально: `npm run dev`

### TON Integration
- [ ] TON Merchant кошелек создан
- [ ] Адрес добавлен в `.env` файлы
- [ ] TON Connect манифест настроен в `tonconnect-manifest.json`
- [ ] Манифест доступен по URL (для продакшена)

## 🧪 Testing

### Backend API Tests
- [ ] `/health` - returns 200 OK
- [ ] `POST /user/init` - creates user
- [ ] `GET /user/balance` - returns balance
- [ ] `POST /ads/complete` - adds energy
- [ ] `POST /orders/create` - creates order
- [ ] `GET /stats` - returns statistics
- [ ] `POST /rewards/claim` - claims reward

### Frontend Tests
- [ ] App loads without errors
- [ ] Mining button works
- [ ] Ad modal opens and closes
- [ ] Energy updates after ad
- [ ] Stats screen shows data
- [ ] Wallet screen displays balance
- [ ] TON Connect button appears
- [ ] Mobile viewport looks correct
- [ ] No console errors

### Database Tests
```sql
-- Run in Neon SQL Editor
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM ad_watches;
SELECT COUNT(*) FROM sessions;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM reward_claims;
```

All tables should exist and be queryable.

## 🚀 Deployment

### Choose Your Platform

#### Option 1: Vercel (Frontend) + Railway (Backend)

**Frontend on Vercel:**
- [ ] GitHub repo connected
- [ ] Environment variables added:
  - `VITE_API_URL` (Railway URL)
  - `VITE_TON_MERCHANT_ADDRESS`
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Deployed successfully
- [ ] Custom domain configured (optional)

**Backend on Railway:**
- [ ] Railway account created
- [ ] New project created
- [ ] GitHub repo connected
- [ ] Root directory: `server`
- [ ] Build command: `npm install`
- [ ] Start command: `npm start`
- [ ] Environment variables added:
  - `DATABASE_URL` (Neon connection string)
  - `TON_MERCHANT_ADDRESS`
  - `ALLOWED_ORIGINS` (Vercel URL)
  - `NODE_ENV=production`
- [ ] Service deployed
- [ ] URL copied to Vercel `VITE_API_URL`

#### Option 2: All on Vercel (Serverless)

- [ ] Frontend deployment configured
- [ ] `api/` folder created for serverless functions
- [ ] Backend code adapted to serverless
- [ ] Environment variables configured
- [ ] Tested serverless endpoints

#### Option 3: Render (Monorepo)

**Web Service (Frontend):**
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm run preview`
- [ ] Environment variables added

**Web Service (Backend):**
- [ ] Build command: `cd server && npm install`
- [ ] Start command: `cd server && npm start`
- [ ] Environment variables added

## 🔒 Security

### Environment Variables
- [ ] No `.env` files in Git
- [ ] All secrets in deployment platform
- [ ] `DATABASE_URL` kept secret
- [ ] No hardcoded credentials in code

### Database
- [ ] Connection pooling enabled
- [ ] SSL mode required
- [ ] Backups configured in Neon
- [ ] IP whitelist configured (if needed)

### API
- [ ] CORS origins restricted
- [ ] Rate limiting in place
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (prepared statements)

## 📊 Monitoring

### Setup Monitoring
- [ ] Error tracking (Sentry, LogRocket, etc.)
- [ ] Analytics (Google Analytics, Plausible, etc.)
- [ ] Uptime monitoring (UptimeRobot, etc.)
- [ ] Database metrics in Neon Console

### Health Checks
- [ ] `/health` endpoint monitored
- [ ] Database connection monitored
- [ ] API response times tracked

## 📝 Documentation

### Update Docs
- [ ] README.md updated with production URLs
- [ ] API documentation current
- [ ] Environment variables documented
- [ ] Troubleshooting guide updated

### Repository
- [ ] Code pushed to GitHub
- [ ] Tags created for release
- [ ] Changelog updated
- [ ] GitHub Actions configured (if using)

## 🎯 Post-Deployment

### Verify Production
- [ ] Frontend loads at production URL
- [ ] API responds at production URL
- [ ] Database queries work
- [ ] Users can mine
- [ ] Stats display correctly
- [ ] TON Connect works
- [ ] Mobile experience tested

### Performance
- [ ] Lighthouse score > 90
- [ ] Page load time < 3s
- [ ] API response time < 500ms
- [ ] Database queries optimized

### SEO (if applicable)
- [ ] Meta tags configured
- [ ] Open Graph tags added
- [ ] Sitemap created
- [ ] robots.txt configured

## 🐛 Rollback Plan

### If Something Goes Wrong
- [ ] Previous version tagged in Git
- [ ] Database backup available
- [ ] Rollback steps documented
- [ ] Contact information for support

### Emergency Contacts
- Database: support@neon.tech
- Hosting: (your platform support)
- Team: (your team contacts)

## 📈 Launch

### Soft Launch
- [ ] Tested with small user group
- [ ] Monitoring shows no errors
- [ ] Performance acceptable
- [ ] User feedback collected

### Full Launch
- [ ] Announcement prepared
- [ ] Social media posts ready
- [ ] Support channels ready
- [ ] Monitoring actively watched

## ✅ Final Checks

- [ ] All items above completed
- [ ] Team notified of deployment
- [ ] Documentation updated
- [ ] Users can access the app
- [ ] No critical errors in logs
- [ ] Celebrate! 🎉

---

## 📞 Support

If issues arise during deployment:
1. Check logs in deployment platform
2. Verify environment variables
3. Test database connection
4. Review [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
5. Open [GitHub Issue](https://github.com/cl0vo/cladhunter.ai/issues)

**Good luck with your deployment!** 🚀
