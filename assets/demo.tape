# VHS script for the README demo GIF — record with: vhs assets/demo.tape
# https://github.com/charmbracelet/vhs

Output assets/demo.gif
Set FontSize 18
Set Width 1200
Set Height 640
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

Type "# Turn a course spec into a Canvas-ready package:"
Enter
Sleep 800ms
Type "npx courseforge-imscc build examples/intro-to-chemistry.json"
Enter
Sleep 3.5s
Type "npx courseforge-imscc inspect introduction-to-chemistry.imscc"
Enter
Sleep 4s
Type "# Upload in Canvas: Settings → Import Course Content. That's it."
Enter
Sleep 3s
