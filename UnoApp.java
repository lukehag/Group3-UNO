import java.util.*;

// =======================
// Card Class
// =======================
class Card {
    public enum Color { RED, YELLOW, GREEN, BLUE, BLACK }
    public enum Type { NUMBER, SKIP, REVERSE, DRAW_TWO, WILD, WILD_DRAW_FOUR }

    private Color color;
    private Type type;
    private int value;

    public Card(Color color, Type type, int value) {
        this.color = color;
        this.type = type;
        this.value = value;
    }

    public Color getColor() { return color; }
    public Type getType() { return type; }
    public int getValue() { return value; }

    public boolean changeColor(Card.Color newColor) {
        // If this card isn't black or the requested color is black there is an error
        if (this.color != Card.Color.BLACK || newColor == Card.Color.BLACK) { return false; }

        this.color = newColor;
        return true;
    }

    // Checks if this card is compatible with the other card
    public boolean isMatching(Card otherCard) {
        // If the card is a black card it is playable
        if (this.getColor() == Card.Color.BLACK || otherCard.getColor() == Card.Color.BLACK) { return true; }

        // If the cards have the same color it is playable
        if (this.getColor() == otherCard.getColor()) { return true; }

        // If the cards have the same value it is playable
        if (this.getValue() == otherCard.getValue() && this.getValue() != -1) { return true; }

        // If the cards have the same type and isn't a number it is playable
        if (this.getType() == otherCard.getType() && this.getType() != Card.Type.NUMBER) { return true; }

        return false;
    }

    @Override
    public String toString() {
        if (type == Type.NUMBER) return color + " " + value;
        return color + " " + type;
    }
}

// =======================
// Deck Class
// =======================
class Deck {
    private List<Card> deckList = new ArrayList<>();

    // Populates the draw pile according to the UNO rules
    public Deck() {
        for (Card.Color c : Card.Color.values()) {
            if (c == Card.Color.BLACK) continue;

            // 19 number cards (1 zero and 2 of each number up to 9)
            deckList.add(new Card(c, Card.Type.NUMBER, 0));
            for (int v = 1; v <= 9; v++) {
                for (int i = 0; i < 2; i++) {
                    deckList.add(new Card(c, Card.Type.NUMBER, v));
                }
            }

            // 2 of each type per color
            for (int i = 0; i < 2; i++) {
                deckList.add(new Card(c, Card.Type.SKIP, -1));
                deckList.add(new Card(c, Card.Type.REVERSE, -1));
                deckList.add(new Card(c, Card.Type.DRAW_TWO, -1));
            }
        }

        // 4 of each black card type
        for (int i = 0; i < 4; i++) {
            deckList.add(new Card(Card.Color.BLACK, Card.Type.WILD, -1));
            deckList.add(new Card(Card.Color.BLACK, Card.Type.WILD_DRAW_FOUR, -1));
        }

        shuffle();
    }

    public void shuffle() {
        Collections.shuffle(deckList);
    }

    public Card drawCard() {
        return deckList.remove(deckList.size() - 1);
    }

    // Take card, add it back to the pile, reshuffle then draw another card
    public void replaceCard(Card oldCard) {
        deckList.add(oldCard);
        shuffle();
    }

    public boolean isEmpty() { return deckList.size() == 0; }

    public void repopulateDeck(List<Card> DiscardPile) {
        deckList = DiscardPile;
        DiscardPile.clear();
        shuffle();
    }
}

// =======================
// Hand Class
// =======================
class Hand {
    private List<Card> cardList = new ArrayList<>();

    public List<Card> getList() { return cardList; }

    public Card getCard(int index) { return cardList.get(index); }

    public void addCard(Card newCard) {
        cardList.add(newCard);
    }

    public Card removeCard(int cardIndex) {
        return cardList.remove(cardIndex);
    }

    public int size() {
        return cardList.size();
    }

    // Iterates through the hand to find a playable card
    public boolean hasPlayable(Card topCard) {
        for (int i = 0; i < cardList.size(); i++) {
            Card currCard = cardList.get(i);
            if (currCard.isMatching(topCard)) { return true; }
        }
        return false;
    }
}

// =======================
// Generic Player Interface
// =======================
interface PlayerInterface {
    String name = "Default";

    Hand playerHand = new Hand();

    Card playCard(int cardIndex);

    void drawCard(Card newCard);

    void skipPlayer();

    void changeCardColor(Card blackCard);
}

// =======================
// Player Class
// =======================
class Player implements PlayerInterface {
    private String name = "Player";
    private Hand playerHand = new Hand();
    private boolean isSkipped = false; // True if an opponent's card skipped the player this turn
    private boolean hasDrawn = false; // True if the player has drawn a card this turn

    public void skipPlayer() { isSkipped = true; }

    public void resumePlayer() { isSkipped = false; }

    public boolean isSkipped() { return isSkipped; }

    public void choseDraw() { hasDrawn = true; }

    public void resetDraw() { hasDrawn = false; }

    public boolean hasDrawn() { return hasDrawn; }

    public Hand getHand() { return playerHand; }

    public boolean hasUno() { return playerHand.size() == 1; }

    public boolean isOutOfCards() { return playerHand.size() == 0; } // Win condition

    
    public Card playCard(int cardIndex) {
        return playerHand.removeCard(cardIndex);
    }

    public void drawCard(Card newCard) {
        playerHand.addCard(newCard);
    }

    // Prompt user to change color
    public void changeCardColor(Card blackCard) {
        UnoApp.promptColorChange(blackCard);
    }

    @Override
    public String toString() {
        return this.name;
    }
}

// =======================
// Opponent Class
// =======================
class Opponent extends Player {
    private String name = "Opponent";

    public void takeTurn(UnoGame Game) {
        if (isSkipped()) { return; }
        
        List<Card> playable = getPlayable(Game.getTopCard());

        // If there are no playable cards, draw it. If it matches the top card, play it. Otherwise add to hand.
        if (playable.isEmpty()) {
            Card c = Game.takeCard();
            
            if (c.isMatching(Game.getTopCard())) {
                Game.discardCard(c);
                Game.applyCardEffects(c);
            } else {
                drawCard(c);
            }
            return;
        }

        Card chosenCard = findBestCard(playable, Game.getTopCard());

        int index = getHand().getList().indexOf(chosenCard);

        Game.discardCard(playCard(index));
        Game.applyCardEffects(chosenCard);
    }

    public List<Card> getPlayable(Card topCard) {
        List<Card> playable = new ArrayList<>();

        for (Card c : getHand().getList()) {
            if (c.isMatching(topCard)) {
                playable.add(c);
            }
        }
        return playable;
    }

    public Card findBestCard(List<Card> playableList, Card topCard) {
        Card best = playableList.get(0);

        for (Card c : playableList) {
            if (isBetter(c, best, topCard)) {
                best = c;
            }
        }
        return best;
    }

    public boolean isBetter(Card a, Card b, Card topCard) {
        // 1. Prefer Non-numbers
        // 2. Colors match
        // 3. Numbers match
        // 4. Avoid Wild/DrawFour

        boolean aNumber = a.getType() == Card.Type.NUMBER;
        boolean bNumber = b.getType() == Card.Type.NUMBER;

        if (!aNumber && bNumber) { return true; }
        if (aNumber && !bNumber) { return false; }

        boolean aColor = a.getColor() == topCard.getColor();
        boolean bColor = b.getColor() == topCard.getColor();

        if (aColor && !bColor) { return true; }
        if (!aColor && bColor) { return false; }

        boolean aValue = a.getValue() == topCard.getValue();
        boolean bValue = b.getValue() == topCard.getValue();

        if (aValue && !bValue) { return true; }
        if (!aValue && bValue) { return false; }

        boolean aWild = a.getColor() == Card.Color.BLACK;
        boolean bWild = b.getColor() == Card.Color.BLACK;

        if (!aWild && bWild) { return true; }
        if (aWild && !bWild) { return false; }

        return false;
    }

    @Override
    public void changeCardColor(Card blackCard) {
        Card.Color chosenColor = mostCommonColor(getHand().getList());
        blackCard.changeColor(chosenColor);
    }

    public Card.Color mostCommonColor(List<Card> cardList) {
        HashMap<Card.Color, Integer> count = new HashMap<>();

        for (Card c : cardList) {
            if (c.getColor() == Card.Color.BLACK) { continue; }
            count.put(c.getColor(), count.getOrDefault(c.getColor(), 0) + 1);
        }

        Card.Color mostCommon = Card.Color.RED;
        int max = 0;

        for (HashMap.Entry<Card.Color, Integer> entry : count.entrySet()) {
            if (entry.getValue() > max) {
                mostCommon = entry.getKey();
                max = entry.getValue();
            }
        }
        return mostCommon;
    }

    @Override
    public String toString() {
        return this.name;
    }
}

// =======================
// Color Change Callback
// (used by UnoServer API)
// =======================
interface ColorChangeCallback {
    void onColorChangeNeeded(Card blackCard);
}

// =======================
// UNO Game Class
// =======================
class UnoGame {
    private Deck DrawPile = new Deck();
    private List<Card> DiscardPile = new ArrayList<>(); // The top card is at the end of the array
    private List<Player> playerList = new ArrayList<>();
    private int turnNumber = 0; // Player at index 1 starts first
    private boolean ongoing = true;
    private ColorChangeCallback colorChangeCallback = null; // Set by UnoServer

    public int getTurnNumber() { return turnNumber; }

    // Constructor for UnoServer API — accepts a callback for color changes
    public UnoGame(ColorChangeCallback cb) {
        this.colorChangeCallback = cb;
        init();
    }

    // Initializes the playerList, deals cards to each player and adds a single card to the discard pile
    public UnoGame() {
        init();
    }

    private void init() {
        playerList.clear();
        // Initialize players
        Player player = new Player();
        Opponent opponent = new Opponent();

        // Decide who goes first
        Random r = new Random();
        boolean playerFirst = (1 == r.nextInt(2));

        if (playerFirst) { playerList.addAll(Arrays.asList(opponent, player)); }
        else { playerList.addAll(Arrays.asList(player, opponent)); }

        // Deal 7 cards to each player
        for (Player p : playerList) {
            for (int i = 0; i < 7; i++) {
                Card c = DrawPile.drawCard();

                p.getHand().addCard(c);
            }
        }

        // Add card to the discard pile as top card
        DiscardPile.add(DrawPile.drawCard());

        // If top card is a wild draw four, replace until it draws any other card
        while (getTopCard().getType() == Card.Type.WILD_DRAW_FOUR) {
            DrawPile.replaceCard(getTopCard());
            DiscardPile.clear();
            DiscardPile.add(DrawPile.drawCard());
        } 

        // If top card is a wild card, let the first player choose the color
        if (getTopCard().getType() == Card.Type.WILD) { getNextPlayer().changeCardColor(getTopCard()); }

        // If top is a skip card, skip the first player
        if (getTopCard().getType() == Card.Type.SKIP || getTopCard().getType() == Card.Type.REVERSE) { getNextPlayer().skipPlayer(); }

        // If top card is a draw two, the first player draws two cards
        if (getTopCard().getType() == Card.Type.DRAW_TWO) {
            for (int i = 0; i < 2; i++) {
                getNextPlayer().getHand().addCard(DrawPile.drawCard());
            }
        }
    }

    public Player getCurrentPlayer() { return playerList.get(turnNumber % playerList.size()); }

    public Player getNextPlayer() { return playerList.get((turnNumber + 1) % playerList.size()); }

    public Card getTopCard() { return DiscardPile.get(DiscardPile.size() - 1); }

    public boolean isOngoing() { return ongoing; }

    // Checks for win condition and increments the turn counter
    public void nextTurn() {
        getCurrentPlayer().resumePlayer();
        getCurrentPlayer().resetDraw();

        // Check if either player has an empty hand
        for (int i = 0; i < playerList.size(); i++) {
            Player currPlayer = playerList.get(i);
            if (currPlayer.isOutOfCards()) {
                finishGame(currPlayer);
            }
        }
        turnNumber++;
    }

    // Displays who won and exits the application
    public void finishGame(Player Winner) {
        ongoing = false;

        UnoApp.displayWinner(Winner, turnNumber);

        // Wait 10 seconds
        try { Thread.sleep(10000); }
        catch(InterruptedException e) { Thread.currentThread().interrupt(); }
        
        System.exit(0);
    }

    public void applyCardEffects(Card card) {
        // If the card is a number card, do nothing
        if (card.getType() == Card.Type.NUMBER) { return; }

        // Get the next player then skip them
        if (card.getType() == Card.Type.SKIP || card.getType() == Card.Type.REVERSE) {
            getNextPlayer().skipPlayer();
        }

        // Get the next player then give them 2 cards from the draw pile then skip their turn
        if (card.getType() == Card.Type.DRAW_TWO) {
            for (int i = 0; i < 2; i++) {
                checkDrawEmpty();
                getNextPlayer().getHand().addCard(DrawPile.drawCard());
            }
            getNextPlayer().skipPlayer();
        }

        if (card.getColor() == Card.Color.BLACK) {
            // Use API callback if available, otherwise fall back to console prompt
            if (colorChangeCallback != null) {
                colorChangeCallback.onColorChangeNeeded(card);
            } else {
                getCurrentPlayer().changeCardColor(card);
            }
        }

        if (card.getType() == Card.Type.WILD_DRAW_FOUR) {
            for (int i = 0; i < 4; i++) {
                checkDrawEmpty();
                getNextPlayer().getHand().addCard(DrawPile.drawCard());
            }
            getNextPlayer().skipPlayer();
        }
    }

    // Draws a card from the DrawPile
    public Card takeCard() { 
        checkDrawEmpty();
        return DrawPile.drawCard();
    } 
    public void discardCard(Card discarded) { DiscardPile.add(discarded); } // Adds card to the DiscardPile

    // If the draw pile is empty, take the DiscardPile and add it to the DrawPile then shuffle
    private void checkDrawEmpty() {
        if (DrawPile.isEmpty()) {
            DrawPile.repopulateDeck(DiscardPile);
            DiscardPile.add(DrawPile.drawCard()); // Add a card as the top card
        }
    }
}

// =======================
//  (Main)
// =======================
public class UnoApp {
    public static Scanner input = new Scanner(System.in);
    public static void main(String[] args) {
        UnoGame Game = new UnoGame();

        // Loops between both players' turns until one wins
        while (Game.isOngoing()) {

            Game.nextTurn();

            switch (Game.getCurrentPlayer()) {
                case Opponent o -> o.takeTurn(Game);
                case Player _ -> promptPlayer(Game);
            }
        }
        input.close();
    }

    // Acts as the driver for user input
    public static void promptPlayer(UnoGame Game) {
        Player next = Game.getNextPlayer();
        Player curr = Game.getCurrentPlayer();
        Card topCard = Game.getTopCard();

        clearConsole();
        
        System.out.println(next + " has " + next.getHand().size() + " cards");
        System.out.println("Top card: " + topCard + "\n");

        if (curr.isSkipped() || curr.hasDrawn()) {
            System.out.println("0: -Skip turn-");
        } else {
            System.out.println("0: -Draw Card-");
        }

        // If player has been skipped, don't display any option other than skip turn
        if (!curr.isSkipped()) {
            int i = 1;
            for (Card c : curr.getHand().getList()) {
                System.out.println(i + ": " + c);
                i++;
            }
        }
        
        while (true) {
            if (!input.hasNextInt()) {
                // Error handling for when a non-integer has been entered
                System.out.println("Only numbers are accepted");
                input.next();
                continue;
            }

            int choice = input.nextInt(); 

            // If player has been skipped, they can only choose to skip
            if (curr.isSkipped() && choice != 0) {
                System.out.println("You've been skipped, you must enter 0");
                continue;
            }

            // Cannot choose numbers out of range
            if (choice < 0 || choice > curr.getHand().size()) { 
                System.out.println("Only numbers 0 to " + curr.getHand().size() + " are accepted");
                continue;
            }
            
            // If player chose to skip turn, draw card then prompt player again (unless player was forced to skip)
            if (choice == 0) {
                if (!curr.isSkipped() && !curr.hasDrawn()) {
                    curr.choseDraw();
                    curr.drawCard(Game.takeCard());
                    promptPlayer(Game);
                }
                return;
            }

            Card currCard = curr.getHand().getCard(choice - 1); // Decrement to align with array indexes

            if (currCard.isMatching(topCard)) {
                Game.discardCard(curr.playCard(choice - 1));
                Game.applyCardEffects(currCard);
            } else {
                System.out.println("Cannot play that card");
                continue;
            }
            return;
        }
    }

    public static void promptColorChange(Card blackCard) {
        System.out.println("Pick a color: ");
        System.out.println("1: Red \n2: Blue \n3: Yellow \n4: Green");

        while (true) {
            if (!input.hasNextInt()) {
                // Error handling for when a non-integer has been entered
                System.out.println("Only numbers are accepted");
                input.next();
                continue;
            }

            int choice = input.nextInt(); 

            // Cannot choose numbers out of range
            if (choice < 1 || choice > 4) { 
                System.out.println("Only numbers 1 to 4 are accepted");
                continue;
            }

            switch (choice) {
                case 1 -> blackCard.changeColor(Card.Color.RED);
                case 2 -> blackCard.changeColor(Card.Color.BLUE);
                case 3 -> blackCard.changeColor(Card.Color.YELLOW);
                case 4 -> blackCard.changeColor(Card.Color.GREEN);
            }
            return;
        }
    }

    // Clear the console for the next turn
    public static void clearConsole() {
        System.out.print("\033[H\033[2J");
        System.out.flush();
    }

    public static void displayWinner(Player Winner, int turnNumber) {
        clearConsole();
        System.out.println(Winner + " won the game after " + turnNumber + " turns!");
    }
}