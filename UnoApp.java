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

    public boolean hasPlayable(Card topCard) {
        for (int i = 0; i < cardList.size(); i++) {
            Card currCard = cardList.get(i);
            // If the hand has a black card it is playable
            if (currCard.getColor() == Card.Color.BLACK) { return true; }

            // If the hand has a card with the same color it is playable
            if (currCard.getColor() == topCard.getColor()) { return true; }

            if (currCard.getType() == topCard.getType()) {
                // If the hand has a card with the same number it is playable
                if (currCard.getType() == Card.Type.NUMBER) {
                    if (currCard.getValue() == topCard.getValue()) { return true; }
                } else {
                    // If the hand has a card with the same type, and isn't a number card it is playable
                    return true;
                }
            }
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

    void takeTurn();
}

// =======================
// Player Class
// =======================
class Player implements PlayerInterface {
    public String name = "Player";
    public boolean canPlay = true;
    public Hand playerHand = new Hand();
    
    public Card playCard(int cardIndex) {
        if (!canPlay) { return null; }
        return playerHand.removeCard(cardIndex);
    }

    public void drawCard(Card newCard) {
        if (!canPlay) { return; }
        playerHand.addCard(newCard);
    }

    public void takeTurn() {
        System.out.println(this.name + "'s turn\n");
    }

    public boolean hasUno() {
        if (playerHand.size() == 1) {
            return true;
        } else {
            return false;
        }
    }

    public boolean isOutOfCards() {
        if (playerHand.size() == 0) {
            return true;
        } else {
            return false;
        }
    }

    // Prevent the player from playing any cards
    public void skipPlayer() { canPlay = false; }
}

// =======================
// UNO Game Class
// =======================
class UnoGame {
    public Deck DrawPile = new Deck();
    public List<Card> DiscardPile = new ArrayList<>();
    private List<Player> playerList = new ArrayList<>();
    private int turnNumber = 0;

    public void setupGame() {
        // Initialize players
        Player player = new Player();
        Player opponent = new Player();

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

    public void nextTurn() {
        // TODO Figure out how advancing turns work
        turnNumber++;
        getCurrentPlayer().takeTurn();
    }

    public Player getCurrentPlayer() {
        return playerList.get(turnNumber % playerList.size());
    }

    public Player getNextPlayer() {
        // Since there are 2 players right now, one player will take even turns and the other will take odds
        int playerIndex = (turnNumber + 1) % playerList.size();
        return playerList.get(playerIndex);
    }

    public void applyCardEffects(Card card) {
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
            // TODO Right now the wild cards can only turn red. Write code to prompt player input
            card.changeColor(Card.Color.RED);
        }

        if (card.getType() == Card.Type.WILD_DRAW_FOUR) {
            for (int i = 0; i < 4; i++) {
                getNextPlayer().playerHand.addCard(DrawPile.drawCard());
            }
            getNextPlayer().skipPlayer();
        }
    }
}

// =======================
//  (Main)
// =======================
public class UnoApp {
    public static void main(String[] args) {
        Deck deck = new Deck();
        Hand playerHand = new Hand();

        System.out.println("Deck created with " + deck.size() + " cards.\n");
        System.out.println("Drawing 7 cards...\n");

        for (int i = 0; i < 7; i++) {
            Card c = deck.drawCard();
            System.out.println("Card " + (i+1) + ": " + c);

            playerHand.addCard(c);
        }

        System.out.println("\nRemaining cards in deck: " + deck.size());
        System.out.println("Remaining cards in hand: " + playerHand.size());

        Card topCard = new Card(Card.Color.GREEN, Card.Type.WILD, -1);
        System.out.println("Hand is playable: " + playerHand.hasPlayable(topCard));
    }
}