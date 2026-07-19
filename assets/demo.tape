# VHS script for the README demo GIF — record with: vhs assets/demo.tape
# https://github.com/charmbracelet/vhs

Output assets/demo.gif

Set Shell bash
Set FontSize 16
Set Width 1100
Set Height 650
Set Padding 24
Set Framerate 30
Set TypingSpeed 55ms
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful

Hide
Type 'courseforge-imscc() { node packages/imscc/dist/cli.js $1 $2 $3; }; export PS1="➜ "; clear'
Enter
Show

Type "# Turn a course spec (title, modules, quizzes...) into a real Canvas course package:"
Enter
Sleep 1.5s

Type "courseforge-imscc build examples/intro-to-chemistry.json"
Enter
Sleep 2.5s

Type "courseforge-imscc inspect introduction-to-chemistry.imscc | head -26"
Enter
Sleep 4.5s

Type "# Valid Canvas cartridge — upload via Settings → Import Course Content. Done 🎉"
Enter
Sleep 3s
