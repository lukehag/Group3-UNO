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
    }
}