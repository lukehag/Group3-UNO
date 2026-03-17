import random

class Card:
    def __init__(self, color, value):
        self.color = color
        self.value = value

    def __repr__(self):
        return f"{self.color} {self.value}"

def build_deck():
    colors = ["Red", "Green", "Yellow", "Blue"]
    values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "Skip", "Reverse", "Draw Two"]
    wilds = ["Wild", "Wild Draw Four"]
    deck = []

    for color in colors:
        for value in values:
            deck.append(Card(color, value))
            if value != 0:  # Uno has two of every card except 0
                deck.append(Card(color, value))

    for i in range(4):  # Four of each wild card
        for wild in wilds:
            deck.append(Card("Any", wild))

    random.shuffle(deck)
    return deck

if __name__ == "__main__":
    deck = build_deck()
    print(f"Deck size: {len(deck)}")
    print("First 10 cards:", deck[:10])
