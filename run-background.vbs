Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' Eski 7799 portdagi jarayonlarni tozalash
WshShell.Run "cmd /c ""for /f """"tokens=5"""" %a in ('netstat -aon ^| findstr :7799') do taskkill /F /PID %a""", 0, True

' Botni orqa fonda oynasiz (headless) ishga tushirish
WshShell.Run "node server.js", 0, False

