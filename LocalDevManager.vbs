' LocalDevManager - Silent Launcher
' يشغل البرنامج بدون نافذة أوامر

Dim shell
Set shell = CreateObject("WScript.Shell")

' المسار الحالي لهذا الملف (نفس مجلد البرنامج)
Dim scriptDir
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

' تشغيل npm start في الخلفية بدون نافذة
shell.Run "cmd /c cd /d """ & scriptDir & """ && npm start", 0, False

Set shell = Nothing
