import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

// =======================
// UNO REST API SERVER
// =======================
// Wraps UnoApp.java game logic and exposes HTTP endpoints for the p5.js UI.
//
// ENDPOINTS:
//   POST /new-game          — Start a new game, returns full state
//   GET  /state             — Get current game state
//   POST /play-card         — Play a card  { "cardIndex": 0 }
//   POST /draw-card         — Draw a card (player chose to draw)
//   POST /end-turn          — End turn after drawing (skip)
//   POST /choose-color      — Choose color after Wild { "color": "RED" }
//
// HOW TO RUN:
//   1. Place this file in the same directory as UnoApp.java
//   2. Compile: javac UnoApp.java UnoServer.java
//   3. Run:     java UnoServer
//   4. Server runs on http://localhost:8080
// =======================

public class UnoServer {

    static UnoGame game;
    static boolean awaitingColorChoice = false;
    static Card pendingBlackCard = null;
    static Card pendingOpponentCard = null; // card opponent is about to play (for animation)
    static boolean opponentWillDraw = false; // true if opponent has no playable card

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

        server.createContext("/new-game",        new NewGameHandler());
        server.createContext("/state",           new StateHandler());
        server.createContext("/play-card",       new PlayCardHandler());
        server.createContext("/draw-card",       new DrawCardHandler());
        server.createContext("/end-turn",        new EndTurnHandler());
        server.createContext("/choose-color",    new ChooseColorHandler());
        server.createContext("/peek-opponent",   new PeekOpponentHandler());
        server.createContext("/commit-opponent", new CommitOpponentHandler());

        server.setExecutor(null);
        server.start();
        System.out.println("UNO API Server running on http://localhost:8080");
    }

    // ── Shared helpers ──────────────────────────────────────────────────────

    static void send(HttpExchange ex, int code, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json");
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        ex.sendResponseHeaders(code, bytes.length);
        ex.getResponseBody().write(bytes);
        ex.getResponseBody().close();
    }

    static String readBody(HttpExchange ex) throws IOException {
        return new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    // Parse a single key from a simple JSON string, e.g. {"cardIndex":2}
    static String getJsonValue(String json, String key) {
        String search = "\"" + key + "\"";
        int idx = json.indexOf(search);
        if (idx == -1) return null;
        int colon = json.indexOf(":", idx);
        // Value starts after colon; trim whitespace and quotes
        String rest = json.substring(colon + 1).trim();
        if (rest.startsWith("\"")) {
            int end = rest.indexOf("\"", 1);
            return rest.substring(1, end);
        } else {
            int end = rest.indexOf(",");
            if (end == -1) end = rest.indexOf("}");
            if (end == -1) end = rest.length();
            return rest.substring(0, end).trim();
        }
    }

    // Serialize a single Card to JSON
    static String cardToJson(Card c) {
        return String.format(
            "{\"color\":\"%s\",\"type\":\"%s\",\"value\":%d,\"label\":\"%s\"}",
            c.getColor(), c.getType(), c.getValue(), cardLabel(c)
        );
    }

    static String cardLabel(Card c) {
        switch (c.getType()) {
            case NUMBER:        return String.valueOf(c.getValue());
            case SKIP:          return "⊘";
            case REVERSE:       return "↻";
            case DRAW_TWO:      return "+2";
            case WILD:          return "W";
            case WILD_DRAW_FOUR: return "+4";
            default:            return "?";
        }
    }

    // Build the full game state JSON
    static String buildState() {
        Player curr = game.getCurrentPlayer();
        Player next = game.getNextPlayer();
        Card top    = game.getTopCard();

        // Determine which player is "Player" (human) vs "Opponent"
        boolean isPlayerTurn = !(curr instanceof Opponent);

        // Build player hand array
        StringBuilder playerCards = new StringBuilder("[");
        List<Card> hand = curr instanceof Opponent
            ? game.getNextPlayer().getHand().getList()   // show human hand
            : curr.getHand().getList();

        // Always show the human (non-Opponent) hand
        Player human   = (curr instanceof Opponent) ? next : curr;
        Player opponent = (curr instanceof Opponent) ? curr : next;

        playerCards = new StringBuilder("[");
        for (int i = 0; i < human.getHand().getList().size(); i++) {
            Card c = human.getHand().getList().get(i);
            boolean playable = !awaitingColorChoice && isPlayerTurn
                && c.isMatching(top) && !human.isSkipped();
            playerCards.append(String.format(
                "{\"index\":%d,\"card\":%s,\"playable\":%b}",
                i, cardToJson(c), playable
            ));
            if (i < human.getHand().getList().size() - 1) playerCards.append(",");
        }
        playerCards.append("]");

        String status;
        if (!game.isOngoing())            status = "GAME_OVER";
        else if (awaitingColorChoice)     status = "AWAITING_COLOR";
        else if (!isPlayerTurn)           status = "OPPONENT_TURN";
        else if (human.isSkipped())       status = "SKIPPED";
        else if (human.hasDrawn())        status = "HAS_DRAWN";
        else                              status = "YOUR_TURN";

        return String.format(
            "{" +
            "\"ongoing\":%b," +
            "\"status\":\"%s\"," +
            "\"isPlayerTurn\":%b," +
            "\"turnNumber\":%d," +
            "\"topCard\":%s," +
            "\"playerHandSize\":%d," +
            "\"opponentHandSize\":%d," +
            "\"playerCards\":%s," +
            "\"playerHasUno\":%b," +
            "\"opponentHasUno\":%b," +
            "\"awaitingColorChoice\":%b" +
            "}",
            game.isOngoing(),
            status,
            isPlayerTurn,
            game.getTurnNumber(),
            cardToJson(top),
            human.getHand().size(),
            opponent.getHand().size(),
            playerCards.toString(),
            human.hasUno(),
            opponent.hasUno(),
            awaitingColorChoice
        );
    }

    // Run the opponent turn immediately (used at game start when opponent goes first)
    static void runOpponentNow() {
        if (!game.isOngoing()) return;
        if (!(game.getCurrentPlayer() instanceof Opponent opp)) return;
        opp.takeTurn(game);
        if (game.isOngoing()) game.nextTurn();
    }

    // Stage the opponent's intended move without applying it yet.
    // Returns true if there is a move to preview, false if opponent is skipped or draws.
    static boolean stageOpponentMove() {
        if (!game.isOngoing()) return false;
        if (!(game.getCurrentPlayer() instanceof Opponent opp)) return false;

        // If opponent is skipped, just advance the turn immediately — nothing to preview
        if (opp.isSkipped()) {
            opp.resumePlayer();
            opp.resetDraw();
            if (game.isOngoing()) game.nextTurn();
            return false;
        }

        List<Card> playable = opp.getPlayable(game.getTopCard());
        if (playable.isEmpty()) {
            // Opponent has nothing to play — no card to highlight, just commit immediately
            pendingOpponentCard = null;
            opponentWillDraw = true;
            return false;
        }

        pendingOpponentCard = opp.findBestCard(playable, game.getTopCard());
        opponentWillDraw = false;
        return true;
    }

    // ── Handlers ────────────────────────────────────────────────────────────

    static class NewGameHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 200, "{}"); return; }
            game = new UnoGame(UnoServer::onColorChangeNeeded);
            awaitingColorChoice = false;
            pendingBlackCard = null;
            pendingOpponentCard = null;
            opponentWillDraw = false;
            // If opponent goes first, run their turn immediately (no preview at game start)
            runOpponentNow();
            send(ex, 200, buildState());
        }
    }

    static class StateHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 200, "{}"); return; }
            if (game == null) { send(ex, 400, "{\"error\":\"No game in progress\"}"); return; }
            send(ex, 200, buildState());
        }
    }

    static class PlayCardHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 200, "{}"); return; }
            if (game == null) { send(ex, 400, "{\"error\":\"No game in progress\"}"); return; }

            String body = readBody(ex);
            String idxStr = getJsonValue(body, "cardIndex");
            if (idxStr == null) { send(ex, 400, "{\"error\":\"Missing cardIndex\"}"); return; }

            int idx = Integer.parseInt(idxStr.trim());

            Player curr = game.getCurrentPlayer();
            if (curr instanceof Opponent) { send(ex, 400, "{\"error\":\"Not your turn\"}"); return; }
            if (curr.isSkipped())         { send(ex, 400, "{\"error\":\"You are skipped\"}"); return; }

            Card chosen = curr.getHand().getCard(idx);
            if (!chosen.isMatching(game.getTopCard())) {
                send(ex, 400, "{\"error\":\"Card does not match\"}");
                return;
            }

            game.discardCard(curr.playCard(idx));
            game.applyCardEffects(chosen);

            if (!game.isOngoing()) { send(ex, 200, buildState()); return; }
            if (awaitingColorChoice) { send(ex, 200, buildState()); return; }

            // Advance past the player's turn
            game.nextTurn();

            // Stage the opponent's move — client will animate then call /commit-opponent
            if (game.isOngoing() && game.getCurrentPlayer() instanceof Opponent) {
                boolean hasCard = stageOpponentMove();
                if (!hasCard) {
                    // Opponent draws — no preview needed, commit immediately
                    runOpponentNow();
                }
            }

            send(ex, 200, buildState());
        }
    }

    static class DrawCardHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 200, "{}"); return; }
            if (game == null) { send(ex, 400, "{\"error\":\"No game in progress\"}"); return; }

            Player curr = game.getCurrentPlayer();
            if (curr instanceof Opponent) { send(ex, 400, "{\"error\":\"Not your turn\"}"); return; }
            if (curr.hasDrawn())          { send(ex, 400, "{\"error\":\"Already drew\"}"); return; }
            if (curr.isSkipped())         { send(ex, 400, "{\"error\":\"You are skipped\"}"); return; }

            curr.choseDraw();
            Card drawn = game.takeCard();
            curr.drawCard(drawn);

            // If drawn card isn't playable, auto-advance and stage opponent move
            if (!drawn.isMatching(game.getTopCard())) {
                game.nextTurn();
                if (game.isOngoing() && game.getCurrentPlayer() instanceof Opponent) {
                    boolean hasCard = stageOpponentMove();
                    if (!hasCard) runOpponentNow();
                }
            }
            send(ex, 200, buildState());
        }
    }

    static class EndTurnHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 200, "{}"); return; }
            if (game == null) { send(ex, 400, "{\"error\":\"No game in progress\"}"); return; }

            game.nextTurn();

            if (game.isOngoing() && game.getCurrentPlayer() instanceof Opponent) {
                boolean hasCard = stageOpponentMove();
                if (!hasCard) runOpponentNow();
            }

            send(ex, 200, buildState());
        }
    }

    // Client calls this to get the card the opponent is about to play (for the highlight animation)
    static class PeekOpponentHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 200, "{}"); return; }
            if (pendingOpponentCard == null) {
                send(ex, 200, "{\"pending\":false}"); return;
            }
            send(ex, 200, String.format(
                "{\"pending\":true,\"card\":%s}",
                cardToJson(pendingOpponentCard)
            ));
        }
    }

    // Client calls this after the highlight animation to actually apply the opponent's move
    static class CommitOpponentHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 200, "{}"); return; }
            if (game == null) { send(ex, 400, "{\"error\":\"No game\"}"); return; }
            if (pendingOpponentCard == null) {
                send(ex, 400, "{\"error\":\"No pending opponent move\"}"); return;
            }

            Opponent opp = (Opponent) game.getCurrentPlayer();

            // Find and play the staged card
            int cardIdx = opp.getHand().getList().indexOf(pendingOpponentCard);
            if (cardIdx == -1) {
                // Fallback: card not found, just run normally
                pendingOpponentCard = null;
                runOpponentNow();
                send(ex, 200, buildState()); return;
            }

            game.discardCard(opp.playCard(cardIdx));
            game.applyCardEffects(pendingOpponentCard);
            pendingOpponentCard = null;
            opponentWillDraw = false;

            if (game.isOngoing()) game.nextTurn();

            send(ex, 200, buildState());
        }
    }

    static class ChooseColorHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 200, "{}"); return; }
            if (game == null || !awaitingColorChoice || pendingBlackCard == null) {
                send(ex, 400, "{\"error\":\"Not awaiting color choice\"}"); return;
            }

            String body  = readBody(ex);
            String color = getJsonValue(body, "color");
            if (color == null) { send(ex, 400, "{\"error\":\"Missing color\"}"); return; }

            switch (color.toUpperCase()) {
                case "RED"    -> pendingBlackCard.changeColor(Card.Color.RED);
                case "BLUE"   -> pendingBlackCard.changeColor(Card.Color.BLUE);
                case "YELLOW" -> pendingBlackCard.changeColor(Card.Color.YELLOW);
                case "GREEN"  -> pendingBlackCard.changeColor(Card.Color.GREEN);
                default -> { send(ex, 400, "{\"error\":\"Invalid color\"}"); return; }
            }

            awaitingColorChoice = false;
            pendingBlackCard = null;

            // Advance past the player's turn now that color is chosen
            game.nextTurn();

            // Stage or run opponent
            if (game.isOngoing() && game.getCurrentPlayer() instanceof Opponent) {
                boolean hasCard = stageOpponentMove();
                if (!hasCard) runOpponentNow();
            }

            send(ex, 200, buildState());
        }
    }

    // Called by UnoGame when a black card is played by the human and needs a color chosen
    static void onColorChangeNeeded(Card blackCard) {
        awaitingColorChoice = true;
        pendingBlackCard = blackCard;
    }
}
