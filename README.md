Group 3 Project - UNO

For a live demo:
First make sure that you have the Full JDK 21 downloaded on your device so that you can access JavaFX. 
If you do not have that downloaded on your device, follow this link: https://download.bell-sw.com/java/21.0.7+9/bellsoft-jdk21.0.7+9-windows-amd64-full.msi

this link will automatically download Full JDK 21 on your device. Make sure when you download JDK 21 you know where it is. Make sure that you have all the following files downloaded from the repo:
1. UnoApp.java
2. UnoServer.java
3. UnoLauncher.java
4. index.html
5. uno_ui_p5_sketch.js
6. p5.min.js


make sure all of those files are in the same folder before heading over to the Terminal. Once you open the terminal, write the following in the command line:

1. Navigate to the same folder as all your files.
2. your JDK 21 file should be here "C:\Program Files\BellSoft\LibericaJDK-21-Full\bin\javac.exe". double check to make sure its there. 
3. Enter command "C:\Program Files\BellSoft\LibericaJDK-21-Full\bin\javac.exe" UnoApp.java UnoServer.java UnoLauncher.java (it important to do it this way instead of just "javac" because you specifically want to use the JDK 21 that has JavaFX)
4. Then run UnoLauncher.java. That should automatically launch the application on your device! Good luck and play well!! <3

If you want a better rendered application, then follow the instructions above, when the JavaFX window opens up, dont play on that window, but also dont close that window. Move the window off screen, open a new tab on google and then copy paste the HTML local server link in the serch bar.

the HTML link should be: http://localhost:8080/index.html
