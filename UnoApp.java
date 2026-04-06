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

    // Checks if this card can be put into the discard pile
    public boolean isMatching(Card topCard) {
        // If the card is a black card it is playable
        if (this.getColor() == Card.Color.BLACK) { return true; }

        // If the cards have the same color it is playable
        if (this.getColor() == topCard.getColor()) { return true; }

        // If the cards have the same value it is playable
        if (this.getValue() == topCard.getValue()) { return true; }

        // If the cards have the same type and isn't a number it is playable
        if (this.getType() == topCard.getType() && this.getType() != Card.Type.NUMBER) { return true; }

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
    private List<Card> cardList = new ArrayList<>();

    public Deck() {
        initializeDeck();
        shuffle();
    }

    // Populates the draw pile according to the UNO rules
    private void initializeDeck() {
        for (Card.Color c : Card.Color.values()) {
            if (c == Card.Color.BLACK) continue;

            // 19 number cards (1 zero and 2 of each number up to 9)
            cardList.add(new Card(c, Card.Type.NUMBER, 0));
            for (int v = 1; v <= 9; v++) {
                for (int i = 0; i < 2; i++) {
                    cardList.add(new Card(c, Card.Type.NUMBER, v));
                }
            }

            // 2 of each type per color
            for (int i = 0; i < 2; i++) {
                cardList.add(new Card(c, Card.Type.SKIP, -1));
                cardList.add(new Card(c, Card.Type.REVERSE, -1));
                cardList.add(new Card(c, Card.Type.DRAW_TWO, -1));
            }
        }

        // 4 of each black card type
        for (int i = 0; i < 4; i++) {
            cardList.add(new Card(Card.Color.BLACK, Card.Type.WILD, -1));
            cardList.add(new Card(Card.Color.BLACK, Card.Type.WILD_DRAW_FOUR, -1));
        }
    }

    public void shuffle() {
        Collections.shuffle(cardList);
    }

    public Card drawCard() {
        return cardList.remove(cardList.size() - 1);
    }

    public int size() {
        return cardList.size();
    }
}

// =======================
// Hand Class
// =======================
class Hand {
    private List<Card> cardList = new ArrayList<>();

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
            if (topCard.isMatching(currCard)) { return true; }
        }
        return false;
    }

    public List<Card> getList() { return cardList; }

    public Card getCard(int index) { return cardList.get(index); }
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
    public boolean isSkipped = false;
    public Hand playerHand = new Hand();
    
    public Card playCard(int cardIndex) {
        return playerHand.removeCard(cardIndex);
    }

    public void drawCard(Card newCard) {
        playerHand.addCard(newCard);
    }

    public boolean hasUno() {
        if (playerHand.size() == 1) {
            return true;
        } else {
            return false;
        }
    }

    // Win condition
    public boolean isOutOfCards() {
        if (playerHand.size() == 0) {
            return true;
        } else {
            return false;
        }
    }

    // Prevents the player from playing any cards
    public void skipPlayer() { isSkipped = true; }

    // Prompt user to change color
    public void changeCardColor(Card blackCard) {
        UnoApp.promptColorChange(blackCard);
    }

    @Override
    public String toString() {
        return name;
    }
}

// =======================
// Opponent Class
// =======================
class Opponent extends Player {
    private String name = "Opponent";

    public void takeTurn() {
        
    }

    @Override
    public String toString() {
        return this.name;
    }
}

// =======================
// UNO Game Class
// =======================
class UnoGame {
    public Deck DrawPile = new Deck();
    private List<Card> DiscardPile = new ArrayList<>(); // The top card is at the end of the array
    private List<Player> playerList = new ArrayList<>();
    private int turnNumber = 0;
    public boolean ongoing = true;

    // Initializes the playerList, deals cards to each player and adds a single card to the discard pile
    public UnoGame() {
        // Initialize players
        Player player = new Player();
        Opponent opponent = new Opponent();

        playerList.addAll(Arrays.asList(player, opponent));

        // Deal 7 cards to each player
        for (Player p : playerList) {
            for (int i = 0; i < 7; i++) {
                Card c = DrawPile.drawCard();

                p.playerHand.addCard(c);
            }
        }

        // Add card to the discard pile
        DiscardPile.add(DrawPile.drawCard());
    }

    // Checks for win condition and increments the turn counter
    public void nextTurn() {
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
        System.out.println(Winner + " won the game after " + turnNumber + " turns!");

        // Wait 10 seconds
        try { Thread.sleep(10000); }
        catch(InterruptedException e) { Thread.currentThread().interrupt(); }
        
        System.exit(0);
    }

    // Determines current player based on the turn number
    public Player getCurrentPlayer() {
        return playerList.get(turnNumber % playerList.size());
    }

    public Player getNextPlayer() {
        // Since there are 2 players right now, one player will take even turns and the other will take odds
        int playerIndex = (turnNumber + 1) % playerList.size();
        return playerList.get(playerIndex);
    }

    // If the card has an effect, it will be applied
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
                getNextPlayer().playerHand.addCard(DrawPile.drawCard());
            }
            getNextPlayer().skipPlayer();
        }

        if (card.getColor() == Card.Color.BLACK) {
            getCurrentPlayer().changeCardColor(card);
        }

        if (card.getType() == Card.Type.WILD_DRAW_FOUR) {
            for (int i = 0; i < 4; i++) {
                getNextPlayer().playerHand.addCard(DrawPile.drawCard());
            }
            getNextPlayer().skipPlayer();
        }
    }

    public Card getTopCard() { return DiscardPile.get(DiscardPile.size() - 1); }

    // Adds card to the DiscardPile
    public void discardCard (Card discarded) { DiscardPile.add(discarded); }
}

// =======================
//  (Main)
// =======================
public class UnoApp {
    public static Scanner input = new Scanner(System.in);
    public static void main(String[] args) {
        UnoGame Game = new UnoGame();

        // Loops between both players' turns until one wins
        while (Game.ongoing) {
            // Clear the console for the next turn
            System.out.print("\033[H\033[2J");
            System.out.flush();

            Game.nextTurn();

            switch (Game.getCurrentPlayer()) {
                case Opponent o -> o.takeTurn();
                case Player _ -> playerTurn(Game);
            }
        }
        input.close();
    }

    // Acts as the driver for user input
    public static void playerTurn(UnoGame Game) {
        Player o = Game.getNextPlayer();
        Player p = Game.getCurrentPlayer();
        Card topCard = Game.getTopCard();
        
        System.out.println(o + " has " + o.playerHand.size() + " cards");
        System.out.println("Top card: " + topCard + "\n");

        System.out.println("0: -Skip turn-");

        // If player has been skipped, don't display any option other than skip turn
        if (!p.isSkipped) {
            int i = 1;
            for (Card c : p.playerHand.getList()) {
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
            if (p.isSkipped && choice != 0) {
                System.out.println("You've been skipped, you must enter 0");
                continue;
            }

            // Cannot choose numbers out of range
            if (choice < 0 || choice > p.playerHand.size()) { 
                System.out.println("Only numbers 0 to " + p.playerHand.size() + " are accepted");
                continue;
            }
            
            // If player chose to skip turn, exit the function
            if (choice == 0) { return; }

            Card currCard = p.playerHand.getCard(choice - 1); // Decrement to align with array indexes

            if (currCard.isMatching(topCard)) {
                Game.discardCard(p.playCard(choice - 1));
                Game.applyCardEffects(currCard);
                return;
            } else {
                System.out.println("Cannot play that card");
            }
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
}