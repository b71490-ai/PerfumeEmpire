# مشروع عطور الإمبراطورية 🌟

مشروع Full Stack يتكون من Backend بـ .NET وFrontend بـ Next.js لإدارة متجر عطور.

## المتطلبات الأساسية

- Node.js (الإصدار 18 أو أحدث)
- .NET SDK (الإصدار 7 أو أحدث)

## Backend (.NET)

### التشغيل

```bash
cd backend
dotnet restore
# Apply EF Core migrations (creates/updates `backend/perfume.db`)
dotnet tool install --global dotnet-ef --version 8.0.0 || true
export PATH="$PATH:$HOME/.dotnet/tools"
dotnet ef database update
dotnet run
```

سيعمل السيرفر على: `http://localhost:5000`

### تشغيل HTTPS محلي (مستحسن للإعداد الآمن)

لتفعيل الكوكيز الآمنة (`Secure` + `SameSite=None`) في بيئة التطوير المحلية
ننصح بتشغيل الخادم عبر HTTPS.
أبسط طريقة هي إنشاء شهادة محلية موثوقة باستخدام `mkcert`
ثم تمريرها إلى Kestrel.

مثال سريع (macOS):

```bash
# تثبيت mkcert إن لم يكن مثبتًا
brew install mkcert nss || true
mkcert -install

# إنشاء شهادة لمجال محلي
mkcert localhost 127.0.0.1 ::1

# سينتج ملفين: localhost+2.pem (الشهادة) و localhost+2-key.pem (المفتاح)
# شغّل dotnet مع إعدادات Kestrel للإشارة إلى الشهادة:
ASPNETCORE_URLS="https://localhost:5001;http://localhost:5000" \
ASPNETCORE_Kestrel__Certificates__Default__Path="$(pwd)/localhost+2.pem" \
ASPNETCORE_Kestrel__Certificates__Default__Password="" \
dotnet run --project backend
```

بعد ذلك افتح الواجهة على `https://localhost:5001`،
ستُرسل الكوكيز مع `Secure` و`SameSite=None` بشكل صحيح.

### ميزات Backend

- ✅ API لإدارة العطور (GET, POST)
- ✅ قاعدة بيانات SQLite محلية: `backend/perfume.db` (مخزّن بشكل دائم)
- ✅ Seed Data جاهز
- ✅ CORS مُفعّل للـ Frontend
- ✅ Swagger UI على `/swagger`

## Frontend (Next.js)

### التثبيت والتشغيل

```bash
cd frontend
npm install
npm run dev
npm run lint
```

سيعمل التطبيق على: `http://localhost:3000`

### ميزات Frontend

- ✅ عرض قائمة العطور
- ✅ إضافة عطر جديد
- ✅ تصميم عربي جميل
- ✅ Responsive Design

### فحص الأداء التلقائي (Lighthouse CI)

للحفاظ على جودة عالمية في الأداء،
تم إضافة Lighthouse CI مع ميزانية أداء واضحة
(LCP/CLS/Performance score).

```bash
cd frontend
npm run perf:audit
```

الأمر أعلاه يقوم بـ:

- بناء المشروع إنتاجيًا
- تشغيل Lighthouse على الصفحات الأساسية
- التحقق من الحدود (budgets) وإظهار أي تراجع في الأداء

ستجد التقارير المحلية في:

`frontend/.lighthouseci/reports`

## الصفحات المتاحة

- `/` - الصفحة الرئيسية (عرض كل العطور)
- `/add` - إضافة عطر جديد

## ملاحظات

- قاعدة البيانات المحلية SQLite موجودة في: `backend/perfume.db`.
- لتشغيل الهجرات وتحديث قاعدة البيانات استخدم الأوامر أعلاه.
  خذ نسخة احتياطية قبل تطبيق أي هجرة على بيئة الإنتاج.
- المصادقة: الخادم يضع `refresh token` في `HttpOnly` cookie
  عند تسجيل الدخول. تأكد أن طلبات الـ frontend تستخدم
  `credentials: 'include'` عند استدعاء نقاط النهاية الخاصة بالمصادقة.
- في بيئة الإنتاج: فعّل HTTPS وتأكد أن الـ cookie
  يتم ضبطه كـ `Secure` وغيّر إعدادات `Jwt:Key`
  إلى قيمة سرية قوية في متغيرات البيئة.

## الاتصال

- Frontend يتصل بـ Backend افتراضياً على `http://localhost:5000`.
  إذا استخدمت منفذًا أو مضيفًا مختلفًا
  حدّث متغير `NEXT_PUBLIC_API_URL` في بيئة الـ frontend.
