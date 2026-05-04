import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.scene.image.Image;
import javafx.scene.web.WebView;
import javafx.scene.web.WebEngine;
import javafx.scene.layout.StackPane;
import javafx.stage.Stage;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;

// =======================
// UNO Desktop Launcher
// =======================
// Starts the UnoServer in a background thread, then opens the
// game UI in a JavaFX window — no browser needed.
//
// HOW TO COMPILE:
//   Windows (JavaFX bundled with JDK 8, or add --module-path for JDK 11+):
//
//   JDK 8 (JavaFX built-in):
//     javac UnoApp.java UnoServer.java UnoLauncher.java
//     java UnoLauncher
//
//   JDK 11+ (download JavaFX SDK from https://openjfx.io first):
//     javac --module-path "C:\path\to\javafx-sdk\lib" --add-modules javafx.web UnoApp.java UnoServer.java UnoLauncher.java
//     java --module-path "C:\path\to\javafx-sdk\lib" --add-modules javafx.web UnoLauncher
//
// TIP: Adoptium JDK 21 does NOT include JavaFX. Either:
//   (a) Use the Liberica JDK Full build which includes JavaFX: https://bell-sw.com/pages/downloads/
//   (b) Download the JavaFX SDK separately from https://openjfx.io and use --module-path above.
// =======================

public class UnoLauncher extends Application {

    private static final int PORT = 8080;
    private static final String TITLE = "UNO";

    @Override
    public void start(Stage stage) throws Exception {

        // ── Start the HTTP server in a background thread ──────────────
        Thread serverThread = new Thread(() -> {
            try {
                UnoServer.main(new String[]{});
            } catch (Exception e) {
                System.err.println("Server failed to start: " + e.getMessage());
                Platform.runLater(() -> stage.setTitle("UNO — Server failed to start!"));
            }
        });
        serverThread.setDaemon(true); // Dies with the app window
        serverThread.start();

        // ── Short pause to let the server bind its port ───────────────
        Thread.sleep(400);

        // ── Build the JavaFX window ───────────────────────────────────
        WebView webView = new WebView();
        WebEngine engine = webView.getEngine();

        // Always load over HTTP so API calls aren't blocked by CORS
        engine.load("http://localhost:" + PORT + "/index.html");

        // Log page load state changes for debugging
        engine.getLoadWorker().stateProperty().addListener((obs, old, newState) -> {
            System.out.println("WebView state: " + newState);
            if (newState == javafx.concurrent.Worker.State.FAILED) {
                System.out.println("WebView load FAILED: " + engine.getLoadWorker().getException());
            }
        });

        // Log JS errors
        engine.setOnError(e -> System.out.println("WebView error: " + e.getMessage()));

        // Allow JS console.log to show in Java stdout (handy for debugging)
        engine.setOnAlert(event -> System.out.println("[JS] " + event.getData()));

        // ── Scene & stage ─────────────────────────────────────────────
        StackPane root = new StackPane(webView);
        Scene scene = new Scene(root, 1240, 780);

        stage.setTitle(TITLE);
        stage.setScene(scene);
        stage.setMinWidth(900);
        stage.setMinHeight(600);

        // Clean shutdown when window is closed
        stage.setOnCloseRequest(e -> {
            Platform.exit();
            System.exit(0);
        });

        stage.show();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
