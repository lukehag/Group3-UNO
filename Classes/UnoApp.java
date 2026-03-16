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
    private List<Card> cards = new ArrayList<>();

    public Deck() {
        initializeDeck();
    }

    private void initializeDeck() {
        for (Card.Color c : Card.Color.values()) {
            if (c == Card.Color.BLACK) continue;

            for (int v = 0; v <= 9; v++) {
                cards.add(new Card(c, Card.Type.NUMBER, v));
            }

            cards.add(new Card(c, Card.Type.SKIP, -1));
            cards.add(new Card(c, Card.Type.REVERSE, -1));
            cards.add(new Card(c, Card.Type.DRAW_TWO, -1));
        }

        cards.add(new Card(Card.Color.BLACK, Card.Type.WILD, -1));
        cards.add(new Card(Card.Color.BLACK, Card.Type.WILD_DRAW_FOUR, -1));
    }

    public void shuffle() {
        Collections.shuffle(cards);
    }

    public Card drawCard() {
        return cards.remove(cards.size() - 1);
    }

    public int size() {
        return cards.size();
    }
}

// =======================
//  (Main)
// =======================
public class UnoApp {
    public static void main(String[] args) {
        Deck deck = new Deck();
        deck.shuffle();

        System.out.println("Deck created with " + deck.size() + " cards.\n");
        System.out.println("Drawing 5 cards...\n");

        for (int i = 0; i < 5; i++) {
            Card c = deck.drawCard();
            System.out.println("Card " + (i+1) + ": " + c);
        }

        System.out.println("\nRemaining cards in deck: " + deck.size());
    }
}