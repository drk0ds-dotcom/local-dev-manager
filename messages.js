const APP_MESSAGES = {
  en: {
    invalidProjectConfig: 'Invalid project settings. Choose the folder again if necessary.',
    invalidProjectFolder: 'The selected project folder is no longer available.',
    invalidProjectPort: 'Enter a valid port from 1 to 65535, or leave it empty for a custom command.',
    invalidCustomCommand: 'Enter a trusted command between 1 and 2048 characters.',
    customCommandChanged: 'Custom command saved — it will be used on the next start.',
    portRemoved: 'Port removed — this project will run without a port on the next start.',
    projectPortClash: (port) => `Port ${port} is already assigned to another project.`,
    alreadyExists: (name) => `⚠️ Project "${name}" already exists`,
    notNodeProject: '❌ This folder is not a Node project (no package.json)',
    invalidPackageJson: '❌ package.json is corrupted or invalid',
    noDevStart: (name) => `❌ No dev or start script in package.json of project "${name}"`,
    addedProject: (name, script, port) => `✅ Project "${name}" added (script: ${script}, port: ${port})`,
    portClash: (port, name) => `⚠️ Port ${port} is assigned to project "${name}"`,
    portChanged: (port) => `🔧 Port changed to ${port} — will be used on next start`,
    packageManagerUnavailable: (name) => `❌ ${name} is unavailable — install it and try again`,
    openInCodeFailed: '⚠️ Could not open VS Code — make sure it is installed and the code command is in PATH',
    logsExported: (location) => `💾 Logs exported to: ${location}`,
    logsExportFailed: (error) => `❌ Failed to export logs: ${error}`,
    portBusy: (port) => `❌ Port ${port} is in use by another process — change the port or free it first`,
    stdinNotRunning: '⚠️ Project is not running — input was not sent',
    chooseFolder: 'Choose project folder',
    exportLogsTitle: 'Export logs',
    trayShow: 'Show window',
    trayStopAll: 'Stop all projects',
    trayQuit: 'Quit',
    updateAvailableTitle: 'Update available',
    updateAvailableMsg: (version) =>
      `Version ${version} is available from GitHub Releases. This installer is not code-signed. Download it now?`,
    downloadUpdate: 'Download update',
    updateDownloadedTitle: 'Update ready',
    updateDownloadedMsg: 'A new version was downloaded. Restart now to install it?',
    restartNow: 'Restart now',
    later: 'Later',
    trayCloseNoticeTitle: 'Still running in the system tray',
    trayCloseNoticeMessage:
      'Closing the window keeps Local Dev Manager running beside the Windows clock. Click its tray icon to reopen it, or choose Quit from the tray menu to exit completely.',
    ok: 'OK',
    projectsReadOnly: 'Project changes are disabled until projects.json is recovered or moved to your profile.',
    projectsSaveTitle: 'Project list could not be saved',
    projectsSaveFailed: (error) =>
      `Your previous project list is unchanged. Check disk access and try again.\n\n${error}`,
    projectsLoadTitle: 'Project storage needs attention',
    projectsLoadFailed: (backup, original) =>
      `The project list could not be read or moved to your profile. Changes are disabled to protect the original file at:\n${original}\n\n${backup ? `A copy was saved at:\n${backup}` : 'No backup was created; copy the original file manually before repairing it.'}`
  },
  ar: {
    invalidProjectConfig: 'إعدادات المشروع غير صالحة. اختر المجلد مجددًا عند الحاجة.',
    invalidProjectFolder: 'مجلد المشروع المحدد لم يعد متاحًا.',
    invalidProjectPort: 'أدخل منفذًا صالحًا بين 1 و65535 أو اتركه فارغًا للأمر المخصص.',
    invalidCustomCommand: 'أدخل أمرًا موثوقًا يتكون من 1 إلى 2048 حرفًا.',
    customCommandChanged: 'حُفظ الأمر المخصص وسيُستخدم عند التشغيل التالي.',
    portRemoved: 'أُزيل المنفذ؛ سيعمل المشروع بلا منفذ عند التشغيل التالي.',
    projectPortClash: (port) => `المنفذ ${port} مخصص بالفعل لمشروع آخر.`,
    alreadyExists: (name) => `⚠️ المشروع "${name}" موجود بالفعل`,
    notNodeProject: '❌ هذا المجلد ليس مشروع Node.js (لا يوجد ملف package.json)',
    invalidPackageJson: '❌ ملف package.json تالف أو غير صالح',
    noDevStart: (name) => `❌ لا يوجد أمر dev أو start في ملف package.json للمشروع "${name}"`,
    addedProject: (name, script, port) => `✅ أُضيف المشروع "${name}" (الأمر: ${script}، المنفذ: ${port})`,
    portClash: (port, name) => `⚠️ المنفذ ${port} مخصص للمشروع "${name}"`,
    portChanged: (port) => `🔧 تغيّر المنفذ إلى ${port} — سيُستخدم عند التشغيل القادم`,
    packageManagerUnavailable: (name) => `❌ مدير الحزم ${name} غير متاح — ثبّته ثم أعد المحاولة`,
    openInCodeFailed: '⚠️ تعذر فتح VS Code — تأكد من تثبيته وتوفر الأمر code في PATH',
    logsExported: (location) => `💾 صُدّرت السجلات إلى: ${location}`,
    logsExportFailed: (error) => `❌ تعذر تصدير السجلات: ${error}`,
    portBusy: (port) => `❌ المنفذ ${port} مشغول بعملية أخرى — غيّره أو حرّره أولًا`,
    stdinNotRunning: '⚠️ المشروع ليس قيد التشغيل — لم يُرسل الإدخال',
    chooseFolder: 'اختر مجلد المشروع',
    exportLogsTitle: 'تصدير السجلات',
    trayShow: 'إظهار النافذة',
    trayStopAll: 'إيقاف كل المشاريع',
    trayQuit: 'إنهاء',
    updateAvailableTitle: 'تحديث متاح',
    updateAvailableMsg: (version) =>
      `الإصدار ${version} متاح من GitHub Releases. هذا المثبّت غير موقّع رقميًا. هل تريد تنزيله الآن؟`,
    downloadUpdate: 'تنزيل التحديث',
    updateDownloadedTitle: 'التحديث جاهز',
    updateDownloadedMsg: 'تم تنزيل إصدار جديد. هل تريد إعادة التشغيل الآن لتثبيته؟',
    restartNow: 'إعادة التشغيل الآن',
    later: 'لاحقًا',
    trayCloseNoticeTitle: 'التطبيق مستمر في منطقة الإشعارات',
    trayCloseNoticeMessage:
      'إغلاق النافذة يُبقي Local Dev Manager قيد التشغيل بجوار ساعة Windows. اضغط أيقونته لإعادة فتحه، أو اختر «إنهاء» من قائمة الأيقونة لإغلاقه بالكامل.',
    ok: 'حسنًا',
    projectsReadOnly: 'تغييرات المشاريع معطلة إلى أن يُستعاد ملف projects.json أو يُنقل إلى ملف المستخدم.',
    projectsSaveTitle: 'تعذر حفظ قائمة المشاريع',
    projectsSaveFailed: (error) => `قائمة المشاريع السابقة لم تتغير. تحقق من القرص ثم أعد المحاولة.\n\n${error}`,
    projectsLoadTitle: 'تحتاج ملفات المشاريع إلى مراجعة',
    projectsLoadFailed: (backup, original) =>
      `تعذرت قراءة قائمة المشاريع أو نقلها إلى ملف المستخدم. عُطلت التغييرات لحماية الملف الأصلي في:\n${original}\n\n${backup ? `حُفظت نسخة في:\n${backup}` : 'لم تُنشأ نسخة احتياطية؛ انسخ الملف الأصلي يدويًا قبل إصلاحه.'}`
  }
};

const PROCESS_MESSAGES = {
  en: {
    alreadyRunning: (name) => `⚠️ Project "${name}" is already running`,
    installing: (manager) => `📦 node_modules missing — running ${manager} install automatically...`,
    installFailed: (manager, code) => `❌ ${manager} install failed (exit code: ${code})`,
    installDone: (manager) => `✅ ${manager} install completed — starting the project...`,
    installError: (manager, error) => `❌ ${manager} install error: ${error}`,
    notRunning: (name) => `⚠️ Project "${name}" is not running`,
    restarting: (name) => `🔄 Restarting "${name}"...`,
    stoppedByUser: (name) => `🔴 Project "${name}" stopped`,
    stoppedUnexpectedly: (code) => `🔴 Project stopped (exit code: ${code})`,
    launchError: (error) => `❌ Failed to start the project: ${error}`,
    autoRestarting: (name) => `🔄 Project "${name}" crashed — auto-restarting...`,
    autoRestartGaveUp: (name) => `❌ Project "${name}" keeps crashing — auto-restart disabled`,
    stdinError: (error) => `❌ Project input failed: ${error}`
  },
  ar: {
    alreadyRunning: (name) => `⚠️ المشروع "${name}" يعمل بالفعل`,
    installing: (manager) =>
      `📦 مجلد node_modules غير موجود — يُثبّت البرنامج الاعتمادات تلقائيًا باستخدام ${manager}...`,
    installFailed: (manager, code) => `❌ فشل تثبيت الاعتمادات باستخدام ${manager} (رمز الخروج: ${code})`,
    installDone: (manager) => `✅ اكتمل تثبيت الاعتمادات باستخدام ${manager} — جارٍ تشغيل المشروع...`,
    installError: (manager, error) => `❌ خطأ أثناء تثبيت الاعتمادات باستخدام ${manager}: ${error}`,
    notRunning: (name) => `⚠️ المشروع "${name}" ليس قيد التشغيل`,
    restarting: (name) => `🔄 جارٍ إعادة تشغيل "${name}"...`,
    stoppedByUser: (name) => `🔴 أُوقف المشروع "${name}"`,
    stoppedUnexpectedly: (code) => `🔴 توقف المشروع (رمز الخروج: ${code})`,
    launchError: (error) => `❌ تعذر تشغيل المشروع: ${error}`,
    autoRestarting: (name) => `🔄 انهار المشروع "${name}" — جارٍ إعادة تشغيله تلقائيًا...`,
    autoRestartGaveUp: (name) => `❌ المشروع "${name}" ينهار باستمرار — عُطلت إعادة التشغيل التلقائية`,
    stdinError: (error) => `❌ تعذر إرسال الإدخال إلى المشروع: ${error}`
  }
};

function formatMessage(catalog, language, key, args) {
  const value = (catalog[language] || catalog.en)[key];
  return typeof value === 'function' ? value(...args) : (value ?? key);
}

function formatAppMessage(language, key, ...args) {
  return formatMessage(APP_MESSAGES, language, key, args);
}

function formatProcessMessage(language, key, ...args) {
  return formatMessage(PROCESS_MESSAGES, language, key, args);
}

module.exports = { APP_MESSAGES, PROCESS_MESSAGES, formatAppMessage, formatProcessMessage };
