# Local Dev Manager GitHub Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تجهيز Local Dev Manager كمستودع عام احترافي متعدد اللغات ونشر الإصدار الأول `v1.0.0` بأصول Windows القابلة للتحقق.

**Architecture:** يُجهز المصدر محليًا أولًا عبر قائمة نشر انتقائية واختبارات readiness تمنع تسرب الملفات المحلية أو انحراف الهوية والتوثيق. بعد نجاح الاختبارات والبناء، يُنشأ مستودع GitHub جديد فقط، ثم يُدفع الفرع الرئيسي ويُنتظر CI قبل إنشاء Release منفصل يحتوي المثبّت وبيانات التحديث وchecksum.

**Tech Stack:** Electron 33, Node.js, JavaScript, `node:test`, electron-builder/NSIS, Git, GitHub CLI, GitHub Actions, Markdown.

**Spec:** `docs/superpowers/specs/2026-09-28-github-publication-design.md`

## Global Constraints

- اسم المنتج المعروض هو `Local Dev Manager` واسم المستودع هو `local-dev-manager`.
- المالك العام الوحيد المستهدف هو `drk0ds-dotcom` وصاحب الحقوق هو `Burayk`.
- الترخيص MIT بسطر `Copyright (c) 2026 Burayk`.
- لا تعديل أو حذف أو أرشفة أو إعادة تسمية لأي مستودع GitHub سابق، عامًا كان أو خاصًا.
- إذا كان `drk0ds-dotcom/local-dev-manager` موجودًا قبل التنفيذ، يتوقف النشر بلا أي mutation.
- الإصدار الثنائي المعلن في `v1.0.0` هو Windows x64 فقط.
- واجهة التطبيق تدعم العربية والإنجليزية؛ الصينية لغة README وليست لغة واجهة في هذا الإصدار.
- لا تدخل `node_modules/`, أو `dist/`, أو `projects.json`, أو الأسرار، أو النسخ الاحتياطية للصور في تاريخ Git.
- لا يُحذف أي ملف محلي مستبعد؛ تستخدم قواعد ignore فقط.
- أوامر shell في هذه البيئة تبدأ بـ `rtk` وفق تعليمات المشروع.
- لا يُنشأ Release قبل نجاح الاختبارات المحلية والبناء وGitHub Actions.
- المتصفح المرئي يُستخدم لعرض حالة GitHub والتحقق منها، وليس لإدخال كلمات مرور أو رموز تحقق نيابة عن المستخدم.

## Review Focus

1. **تعارض اسم المستودع:** يجب أن تفشل خطوة النشر مغلقة إذا أعاد `gh repo view drk0ds-dotcom/local-dev-manager` مستودعًا موجودًا؛ يغطيه preflight في Task 8.
2. **تسرب ملف محلي:** يجب ألا يظهر `node_modules`, أو `dist`, أو `projects.json`, أو `.env`, أو مفاتيح/شهادات في `git ls-files`؛ يغطيه اختبار readiness في Task 1 وفحص staging في Task 8.
3. **انحراف صفحات اللغات:** يجب أن تعمل روابط اللغات الثلاث وأن تتطابق الأقسام الأساسية ولا تدعي واجهة صينية؛ يغطيه اختبار parity في Task 4.
4. **انحراف بيانات التحديث:** يجب أن يطابق `build.publish.owner/repo` وبيانات `repository/homepage/bugs` المستودع الجديد، وأن تتوفر `latest.yml` و`.blockmap` في Release؛ يغطيه Task 2 وTask 9.
5. **Checksum غير مطابق:** يجب حساب SHA-256 من المثبّت النهائي بعد آخر بناء والتحقق منه قبل الرفع وبعده؛ يغطيه Task 7 وTask 9.

---

### Task 1: تأسيس Git وحدود الملفات المنشورة

**Files:**
- Modify: `.gitignore`
- Create: `test/repository-readiness.test.js`
- Include in first commit: `docs/superpowers/specs/2026-09-28-github-publication-design.md`
- Include in first commit: `docs/superpowers/plans/2026-09-28-github-publication.md`

**Interfaces:**
- Consumes: قواعد النطاق في الـSpec والملفات المحلية الحالية.
- Produces: مستودع Git محلي بفرع `main`، وهوية Commit محلية باسم Burayk، واختبار `repository readiness` يمكن توسيعه في المهام التالية.

- [ ] **Step 1: تحقق أن المجلد ليس مرتبطًا بمستودع Git موجود**

Run:

```powershell
rtk git rev-parse --is-inside-work-tree
```

Expected: non-zero مع رسالة أنه ليس Git repository. إذا نجح، توقف وافحص remote قبل أي عمل.

- [ ] **Step 2: أنشئ Git محليًا دون Remote**

Run:

```powershell
rtk git init -b main
rtk git config user.name Burayk
rtk proxy powershell -NoProfile -Command '$githubId=(& gh api user --jq .id).Trim(); if(-not $githubId){exit 1}; & git config user.email ($githubId + "+drk0ds-dotcom@users.noreply.github.com")'
```

Expected: فرع `main` ولا يوجد `remote`، والاسم المحلي `Burayk`، والبريد المحلي بصيغة GitHub noreply المرتبطة بمعرف الحساب المقروء آليًا.

- [ ] **Step 3: اكتب اختبار ignore يفشل أولًا**

أضف في `test/repository-readiness.test.js` اختبارًا باسم:

```js
test('repository ignores local dependencies, builds, user state, secrets, and backup artwork', () => {
  // يقرأ .gitignore ويؤكد وجود الأنماط الدقيقة المعتمدة في الخطوة التالية.
});
```

Assertions المطلوبة: وجود `node_modules/`, `dist/`, `projects.json`, `.env*`, `*.pem`, `*.key`, `*.pfx`, `vibe_images/`, `assets/icon-original-backup.png`, و`assets/icon-v1-cleaned.png`.

- [ ] **Step 4: شغّل الاختبار لإثبات الفشل**

Run:

```powershell
rtk node --test --test-name-pattern="repository ignores" test/repository-readiness.test.js
```

Expected: FAIL بسبب غياب أنماط الأسرار والنسخ الاحتياطية من `.gitignore` الحالي.

- [ ] **Step 5: وسّع `.gitignore` بأقل تغيير كافٍ**

أبقِ القواعد الحالية وأضف قواعد environment/secrets/certificates/temp/backup artwork. لا تضف ignore عامًا يحجب `docs/images/` أو `assets/icon.png`.

- [ ] **Step 6: تحقق من الاختبار ومن سلوك Git الفعلي**

Run:

```powershell
rtk node --test --test-name-pattern="repository ignores" test/repository-readiness.test.js
rtk git check-ignore node_modules dist projects.json vibe_images assets/icon-original-backup.png
```

Expected: PASS، وكل المسارات الخمسة تُطبع باعتبارها ignored.

- [ ] **Step 7: أنشئ Commit تأسيسيًا**

Run:

```powershell
rtk git add .gitignore test/repository-readiness.test.js docs/superpowers/specs/2026-09-28-github-publication-design.md docs/superpowers/plans/2026-09-28-github-publication.md
rtk git commit -m "chore: establish repository publication boundaries"
```

Expected: Commit محلي فقط ولا يوجد Remote.

---

### Task 2: تثبيت الهوية والترخيص وبيانات GitHub في الحزمة

**Files:**
- Modify: `package.json`
- Modify: `test/repository-readiness.test.js`
- Create: `LICENSE`

**Interfaces:**
- Consumes: `drk0ds-dotcom/local-dev-manager`, الإصدار `1.0.0`, وهوية `Burayk`.
- Produces: metadata واحدة تستخدمها README وelectron-builder وelectron-updater وGitHub Release.

- [ ] **Step 1: اكتب اختبارات metadata والترخيص التي تفشل**

أضف اختبارين:

```js
test('package metadata points only to the approved public repository', () => {
  // name/product/version/author/license/repository/homepage/bugs/publish owner+repo
});

test('MIT license names Burayk as the 2026 copyright holder', () => {
  // نص MIT القياسي والسطر المعتمد.
});
```

القيم الدقيقة:

- `name`: `local-dev-manager`
- `version`: `1.0.0`
- `author`: `Burayk`
- `license`: `MIT`
- `repository.url`: `https://github.com/drk0ds-dotcom/local-dev-manager.git`
- `homepage`: `https://github.com/drk0ds-dotcom/local-dev-manager#readme`
- `bugs.url`: `https://github.com/drk0ds-dotcom/local-dev-manager/issues`
- `build.publish[0]`: `{ provider: 'github', owner: 'drk0ds-dotcom', repo: 'local-dev-manager' }`

- [ ] **Step 2: أثبت فشل الاختبارات على metadata الحالية**

Run:

```powershell
rtk node --test --test-name-pattern="package metadata|MIT license" test/repository-readiness.test.js
```

Expected: FAIL بسبب `YOUR_GITHUB_USERNAME` وغياب `LICENSE` والحقول العامة.

- [ ] **Step 3: حدّث `package.json` وأنشئ `LICENSE`**

استخدم وصفًا إنجليزيًا موجزًا في `description` متوافقًا مع وصف GitHub، وأضف الحقول المذكورة دون تغيير scripts أو dependencies الحالية باستثناء ما تنص عليه مهمة لاحقة صراحة.

- [ ] **Step 4: تحقق من metadata والترخيص وبقية الاختبارات**

Run:

```powershell
rtk npm test
```

Expected: جميع الاختبارات الحالية واختبارات readiness ناجحة.

- [ ] **Step 5: Commit**

```powershell
rtk git add package.json package-lock.json LICENSE test/repository-readiness.test.js
rtk git commit -m "docs: define project identity and MIT license"
```

---

### Task 3: بناء README الإنجليزية وملفات المجتمع

**Files:**
- Replace: `README.md`
- Create: `docs/DEVELOPMENT_HISTORY.ar.md`
- Create: `CHANGELOG.md`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `docs/releases/v1.0.0.md`
- Modify: `test/repository-readiness.test.js`

**Interfaces:**
- Consumes: الحقائق الموجودة في source والاختبارات وبيانات Task 2.
- Produces: صفحة GitHub الإنجليزية الافتراضية وملفات مساهمة وأمان لا تدعي ميزات أو منصات غير مثبتة.

- [ ] **Step 1: احفظ README الحالية كسجل تاريخي قبل استبدالها**

انسخ المحتوى العربي الحالي كاملًا إلى `docs/DEVELOPMENT_HISTORY.ar.md` مع مقدمة قصيرة توضح أنه سجل تطوير داخلي محفوظ، وليس وثائق الاستخدام الحالية.

- [ ] **Step 2: اكتب اختبار وثائق يفشل**

أضف اختبارًا باسم:

```js
test('English README and community files describe the verified Windows release', () => {
  // الملفات موجودة، الأقسام الأساسية موجودة، ولا يوجد ادعاء official macOS/Linux.
});
```

Assertions: وجود شريط اللغات، Quick Start، Features، SmartScreen، Data & Privacy، Architecture، Development، Known Limitations، وMIT؛ وجود ملفات المجتمع والقوالب؛ وعدم وجود `C:\\Users\\Gamer`.

- [ ] **Step 3: أثبت الفشل**

Run:

```powershell
rtk node --test --test-name-pattern="English README" test/repository-readiness.test.js
```

Expected: FAIL لأن البنية والملفات الجديدة غير موجودة.

- [ ] **Step 4: اكتب README الإنجليزية والملفات المساندة**

اكتب محتوى موجزًا قائمًا على الكود. اجعل تنزيل Release هو المسار الأول للمستخدم و`npm ci && npm start` مسار المطور. قل بوضوح إن Windows x64 هو الإصدار الثنائي المختبر، وإن واجهة التطبيق عربية/إنجليزية، وإن الصينية تخص التوثيق.

في `SECURITY.md` وجّه الثغرات غير المنشورة إلى GitHub Private Vulnerability Reporting، ولا تطلب نشر سر في Issue عامة. في `docs/releases/v1.0.0.md` جهز Release Notes بالأقسام الإنجليزية والعربية والصينية لاستخدامها لاحقًا.

- [ ] **Step 5: تحقق من التوثيق والاختبارات**

Run:

```powershell
rtk npm test
```

Expected: PASS مع عدم وجود ادعاء منصة غير مثبت أو مسار شخصي في الملفات النصية العامة.

- [ ] **Step 6: Commit**

```powershell
rtk git add README.md docs CHANGELOG.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md .github/ISSUE_TEMPLATE test/repository-readiness.test.js
rtk git commit -m "docs: add professional English project documentation"
```

---

### Task 4: إضافة README العربية والصينية مع اختبار التكافؤ

**Files:**
- Create: `README.ar.md`
- Create: `README.zh-CN.md`
- Modify: `README.md`
- Modify: `test/repository-readiness.test.js`

**Interfaces:**
- Consumes: بنية وعناوين README الإنجليزية من Task 3.
- Produces: ثلاث صفحات متكافئة وروابط لغة نسبية تعمل من أي صفحة.

- [ ] **Step 1: اكتب اختبار parity يفشل**

أضف:

```js
test('localized READMEs expose working language links and equivalent core sections', () => {
  // وجود الملفات، الروابط الثلاثة، والعناوين الدلالية الأساسية.
});

test('Chinese documentation does not claim a Chinese application UI', () => {
  // يؤكد نصًا صريحًا بأن واجهة التطبيق الحالية English/Arabic only.
});
```

- [ ] **Step 2: أثبت الفشل**

Run:

```powershell
rtk node --test --test-name-pattern="localized READMEs|Chinese documentation" test/repository-readiness.test.js
```

Expected: FAIL بسبب غياب الملفين.

- [ ] **Step 3: اكتب الترجمات الطبيعية**

استخدم ترتيب الأقسام نفسه، واجعل اللغة الحالية bold. احتفظ بالأوامر وأسماء الملفات والتقنيات كما هي. لا تضف ميزة في ترجمة دون وجودها في الإنجليزية والكود.

- [ ] **Step 4: تحقق من parity وعدم وجود روابط محلية مطلقة**

Run:

```powershell
rtk npm test
rtk rg -n "C:\\Users\\|file://" README.md README.ar.md README.zh-CN.md
```

Expected: الاختبارات PASS، و`rg` لا يعثر على نتائج.

- [ ] **Step 5: Commit**

```powershell
rtk git add README.md README.ar.md README.zh-CN.md test/repository-readiness.test.js
rtk git commit -m "docs: add Arabic and Simplified Chinese guides"
```

---

### Task 5: تجهيز صور GitHub المنقحة

**Files:**
- Create: `docs/images/project-running.png`
- Create: `docs/images/automatic-dependency-install.png`
- Create: `docs/images/arabic-interface.png`
- Modify: `README.md`
- Modify: `README.ar.md`
- Modify: `README.zh-CN.md`
- Modify: `test/repository-readiness.test.js`

**Interfaces:**
- Consumes: الصور الثلاث التي قدمها المستخدم ومساراتها المحلية.
- Produces: صور مشتركة بلا مسار شخصي ظاهر، مستخدمة في الصفحات الثلاث مع alt text مناسب.

- [ ] **Step 1: اكتب اختبار أصول الصور يفشل**

أضف اختبارًا باسم:

```js
test('documentation references exactly the three curated PNG screenshots', () => {
  // الملفات الثلاثة موجودة، PNG غير فارغة، وكل README تشير إليها بمسارات نسبية.
});
```

- [ ] **Step 2: أثبت الفشل**

Run:

```powershell
rtk node --test --test-name-pattern="three curated PNG" test/repository-readiness.test.js
```

Expected: FAIL بسبب غياب الصور.

- [ ] **Step 3: أنشئ النسخ المنقحة دون تغيير حقيقة الواجهة**

استخدم أداة تحرير الصور المعتمدة لإخفاء `C:\Users\Gamer` وقص الأجزاء المربكة من تحذير مشروع Next.js التجريبي. لا تضف أزرارًا أو حالات أو نصوصًا غير موجودة. احتفظ بالنسخ الأصلية خارج Git ولا تحذفها.

- [ ] **Step 4: نفّذ فحصًا بصريًا لكل صورة**

افتح الصور الثلاث وتحقق يدويًا من: عدم ظهور اسم المستخدم، بقاء الحالة/الأزرار قابلة للقراءة، صحة RTL في الصورة العربية، وعدم تقديم التحذير التجريبي كخطأ في التطبيق.

- [ ] **Step 5: أضف الصور والـalt text إلى الصفحات الثلاث وشغّل الاختبار**

Run:

```powershell
rtk npm test
```

Expected: PASS والصور الثلاث فقط tracked داخل `docs/images/`.

- [ ] **Step 6: Commit**

```powershell
rtk git add docs/images README.md README.ar.md README.zh-CN.md test/repository-readiness.test.js
rtk git commit -m "docs: add curated application screenshots"
```

---

### Task 6: إضافة CI آمن وقابل للاختبار

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `test/repository-readiness.test.js`

**Interfaces:**
- Consumes: أوامر `npm ci`, و`npm test`, وقائمة JavaScript الحالية.
- Produces: Workflow read-only على `windows-latest` يتحقق من كل Push وPull Request دون نشر أو أسرار.

- [ ] **Step 1: اكتب اختبار Workflow يفشل**

أضف:

```js
test('CI uses read-only permissions and runs install, tests, and syntax checks on Windows', () => {
  // permissions contents: read، windows-latest، npm ci، npm test، node --check لكل الملفات المحددة.
});
```

- [ ] **Step 2: أثبت الفشل**

Run:

```powershell
rtk node --test --test-name-pattern="CI uses read-only" test/repository-readiness.test.js
```

Expected: FAIL بسبب غياب Workflow.

- [ ] **Step 3: أنشئ `.github/workflows/ci.yml`**

Triggers: `push` و`pull_request`. استخدم `actions/checkout` و`actions/setup-node` بإصدارات major الحالية، Node 22 LTS، cache npm، `npm ci`, `npm test`, ثم `node --check` للملفات التسعة المعتمدة. اضبط `permissions: contents: read` ولا تضف publish step.

- [ ] **Step 4: تحقق محليًا من الأوامر نفسها**

Run:

```powershell
rtk npm ci
rtk npm test
rtk proxy powershell -NoProfile -Command '$files=@("main.js","projectStarter.js","processManager.js","restartPolicy.js","preload.js","renderer.js","test/processManager.test.js","test/projectStarter.test.js","test/restartPolicy.test.js","test/repository-readiness.test.js"); foreach($file in $files){ node --check $file; if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}}'
```

Expected: install ناجح، كل الاختبارات PASS، وكل ملفات JavaScript syntax-clean.

- [ ] **Step 5: Commit**

```powershell
rtk git add .github/workflows/ci.yml test/repository-readiness.test.js package-lock.json
rtk git commit -m "ci: verify Windows builds and repository readiness"
```

---

### Task 7: التحقق النهائي وبناء أصول الإصدار

**Files:**
- Generated, ignored: `dist/Local Dev Manager Setup 1.0.0.exe`
- Generated, ignored: `dist/Local Dev Manager Setup 1.0.0.exe.blockmap`
- Generated, ignored: `dist/latest.yml`
- Generated, ignored: `dist/SHA256SUMS.txt`

**Interfaces:**
- Consumes: source والوثائق والاعتمادات بعد Tasks 1–6.
- Produces: أدلة تحقق حديثة وأربعة أصول release جاهزة دون إدخالها في Git.

- [ ] **Step 1: شغّل الاختبارات والفحص النحوي من جديد**

Run:

```powershell
rtk npm test
rtk proxy powershell -NoProfile -Command '$files=@("main.js","projectStarter.js","processManager.js","restartPolicy.js","preload.js","renderer.js","test/processManager.test.js","test/projectStarter.test.js","test/restartPolicy.test.js","test/repository-readiness.test.js"); foreach($file in $files){ node --check $file; if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}}'
```

Expected: صفر failures وصفر syntax errors.

- [ ] **Step 2: افحص الأسرار والمعلومات المحلية**

Run:

```powershell
rtk rg -n -i "(api[_-]?key|secret|password|token|private[_-]?key|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|mongodb(\\+srv)?://|postgres(ql)?://|mysql://|redis://|C:\\Users\\Gamer)" -g "!node_modules/**" -g "!dist/**" -g "!package-lock.json" .
rtk rg --files -g ".env*" -g "*.pem" -g "*.key" -g "*.pfx" -g "!node_modules/**" -g "!dist/**"
```

Expected: لا أسرار أو مسارات شخصية حقيقية. أي نتيجة توثيقية مثل أسماء متغيرات البيئة تُراجع يدويًا وتبقى بلا قيمة حقيقية.

- [ ] **Step 3: ابنِ Windows installer من الحالة النهائية**

Run:

```powershell
rtk npm run dist
```

Expected: exit 0 وتوليد `.exe`, `.blockmap`, و`latest.yml`.

- [ ] **Step 4: افحص الحزمة نفسها**

استخدم `@electron/asar` للتأكد من وجود `processManager.js` و`node_modules/cross-spawn/index.js` داخل `app.asar`، وأن النص المعبأ لا يحتوي `shell: true` في مسار spawn الذي أُصلح.

- [ ] **Step 5: أنشئ `SHA256SUMS.txt` من الأصول النهائية**

Run:

```powershell
rtk proxy powershell -NoProfile -Command '$names=@("Local Dev Manager Setup 1.0.0.exe","Local Dev Manager Setup 1.0.0.exe.blockmap","latest.yml"); $lines=foreach($name in $names){$item=Get-Item -LiteralPath (Join-Path "dist" $name); $hash=(Get-FileHash -Algorithm SHA256 -LiteralPath $item.FullName).Hash.ToLowerInvariant(); "$hash  $name"}; [IO.File]::WriteAllLines((Join-Path (Resolve-Path dist) "SHA256SUMS.txt"),$lines,[Text.UTF8Encoding]::new($false))'
```

Expected: ثلاثة أسطر بصيغة `<hash>  <filename>` داخل `dist/SHA256SUMS.txt`، ثم يصبح الملف رابع أصل مرفوع في Release.

- [ ] **Step 6: تحقق من checksums**

أعد حساب hashes وقارنها سطرًا بسطر. Expected: تطابق كامل وأربعة أصول release موجودة، مع بقاء `dist/` ignored.

- [ ] **Step 7: تأكد من نظافة Git**

Run:

```powershell
rtk git status --short
rtk git ls-files
```

Expected: لا تغييرات غير مقصودة، ولا ملف من `dist/`, `node_modules/`, `projects.json`, أو backup artwork ضمن tracked files.

---

### Task 8: إنشاء المستودع العام الجديد ودفع `main`

**Files:**
- External create only: `drk0ds-dotcom/local-dev-manager`
- Local modify: Git remote `origin`

**Interfaces:**
- Consumes: تاريخ Git المحلي المتحقق منه ومصادقة GitHub للحساب `drk0ds-dotcom`.
- Produces: مستودع عام جديد فقط، وفرع `main` مع CI قيد التشغيل.

- [ ] **Step 1: نفّذ preflight غير قابل للتجاوز**

Run:

```powershell
rtk gh auth status
rtk gh repo view drk0ds-dotcom/local-dev-manager --json name,visibility,url
```

Expected: المصادقة صالحة، و`repo view` يعيد Not Found. إذا أعاد مستودعًا، توقف ولا تستخدم `repo edit`, `delete`, `archive`, أو push.

- [ ] **Step 2: راجع ما سيُنشر للمرة الأخيرة**

Run:

```powershell
rtk git status --short
rtk git log --oneline --decorate -10
rtk git ls-files
rtk git remote -v
```

Expected: commits المحلية المقصودة فقط، لا Remote، ولا ملفات مستبعدة.

- [ ] **Step 3: أنشئ المستودع العام وادفعه مرة واحدة**

Run:

```powershell
rtk gh repo create drk0ds-dotcom/local-dev-manager --public --source . --remote origin --description "A desktop workspace for running, monitoring, and organizing local Node.js development projects from one interface." --push
```

Expected: URL الجديد فقط ونجاح Push لـ`main`.

- [ ] **Step 4: أضف Topics إلى المستودع الجديد فقط**

Run:

```powershell
rtk gh repo edit drk0ds-dotcom/local-dev-manager --add-topic electron --add-topic nodejs --add-topic developer-tools --add-topic process-manager --add-topic local-development --add-topic windows --add-topic productivity --add-topic devtools
```

Expected: Topics الثمانية على المستودع الجديد.

- [ ] **Step 5: تحقق من GitHub وافتحه في المتصفح المرئي**

تحقق عبر `gh repo view` أن `visibility` هي `PUBLIC` وdefault branch هي `main`. وجّه المتصفح المدمج إلى صفحة المستودع، حدّث الحالة، وتحقق بصريًا من README وشريط اللغات والصورة الرئيسية دون إجراء edits عبر الويب.

- [ ] **Step 6: انتظر CI ولا تتجاوزه**

Run `gh run list` للحصول على أحدث Run ثم `gh run watch <run-id> --exit-status`. Expected: conclusion `success`. عند failure، أصلح المصدر محليًا وفق TDD وادفع Commit تصحيحيًا؛ لا تنشئ Release قبل النجاح.

---

### Task 9: إنشاء Tag وGitHub Release `v1.0.0`

**Files:**
- External create: Git tag `v1.0.0`
- External create: GitHub Release `v1.0.0`
- Upload: `dist/Local Dev Manager Setup 1.0.0.exe`
- Upload: `dist/Local Dev Manager Setup 1.0.0.exe.blockmap`
- Upload: `dist/latest.yml`
- Upload: `dist/SHA256SUMS.txt`

**Interfaces:**
- Consumes: CI ناجح وأصول Task 7 وRelease Notes من `docs/releases/v1.0.0.md`.
- Produces: إصدار عام قابل للتنزيل والتحديث والتحقق.

- [ ] **Step 1: تحقق من عدم وجود Tag أو Release سابق**

Run:

```powershell
rtk git tag --list v1.0.0
rtk gh release view v1.0.0 --repo drk0ds-dotcom/local-dev-manager
```

Expected: لا tag محلي ولا release بعيد. إذا وُجد أي منهما، توقف دون حذف.

- [ ] **Step 2: تحقق من الأصول وchecksum مرة أخيرة**

Expected: الملفات الأربعة موجودة، hashes المعاد حسابها تطابق `SHA256SUMS.txt`، واسم المثبّت يطابق `latest.yml`.

- [ ] **Step 3: أنشئ وادفع Tag من HEAD المتحقق منه**

Run:

```powershell
rtk git tag -a v1.0.0 -m "Local Dev Manager v1.0.0"
rtk git push origin v1.0.0
```

Expected: tag يشير إلى HEAD الذي اجتاز CI.

- [ ] **Step 4: أنشئ Release بالأصول الأربعة**

Run:

```powershell
rtk gh release create v1.0.0 "dist/Local Dev Manager Setup 1.0.0.exe" "dist/Local Dev Manager Setup 1.0.0.exe.blockmap" "dist/latest.yml" "dist/SHA256SUMS.txt" --repo drk0ds-dotcom/local-dev-manager --title "Local Dev Manager v1.0.0" --notes-file docs/releases/v1.0.0.md
```

Expected: Release منشور بأربعة assets بالضبط.

- [ ] **Step 5: تحقق من الإصدار عبر API والمتصفح المرئي**

استخدم `gh release view v1.0.0 --json url,assets,isDraft,isPrerelease` وتأكد من `isDraft=false`, و`isPrerelease=false`, وأسماء الأصول الأربعة. افتح رابط Release في المتصفح المدمج وتحقق بصريًا من العنوان والملاحظات وروابط التنزيل.

- [ ] **Step 6: تحقق من رابط updater دون تنزيل أو تشغيل جديد**

قارن `latest.yml` المنشور محليًا بأسماء assets في GitHub. لا تشغّل المثبّت عبر المتصفح؛ الاختبار اليدوي للمثبّت تم محليًا مسبقًا.

---

### Task 10: إغلاق النشر بدليل قابل للمراجعة

**Files:**
- No new product files required.

**Interfaces:**
- Consumes: المستودع العام، CI الناجح، Release المنشور، وأدلة الاختبارات المحلية.
- Produces: تقرير تسليم نهائي بروابط قابلة للنقر وقيود معلنة بوضوح.

- [ ] **Step 1: نفّذ verification-before-completion**

أعد تشغيل `npm test`, وفحص syntax، و`git status --short`, و`gh repo view`, و`gh run view`, و`gh release view` في نفس مرحلة التسليم. لا تعتمد على مخرجات سابقة.

- [ ] **Step 2: تحقق أن المستودع المحلي نظيف**

Expected: لا تغييرات tracked غير committed، مع بقاء `dist/` والملفات المحلية ignored.

- [ ] **Step 3: سلّم الروابط والنتائج**

أبلغ المستخدم برابط المستودع، رابط Release، نتيجة CI، عدد الاختبارات، SHA-256 للمثبّت، تنبيه SmartScreen، وأنه لم يُعدّل أي مستودع سابق. اذكر بوضوح أن Windows x64 هو الإصدار الثنائي الموثق وأن الصينية لغة توثيق فقط.
