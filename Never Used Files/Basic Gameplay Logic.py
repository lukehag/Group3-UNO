from dataclasses import dataclass
import random


@dataclass(frozen=True)
class Card:
    color: str
    value: str

    def __str__(self) -> str:
        return f"{self.color} {self.value}"


def build_deck() -> list[Card]:
    colors = ["Red", "Blue", "Green", "Yellow"]
    values = [str(n) for n in range(10)] + ["Skip", "Reverse", "+2"]

    deck: list[Card] = []
    for color in colors:
        for value in values:
            deck.append(Card(color, value))

    # Add wild cards
    for _ in range(4):
        deck.append(Card("Any", "Wild"))
        deck.append(Card("Any", "Wild +4"))

    random.shuffle(deck)
    return deck


def is_valid_play(played_card: Card, top_card: Card) -> bool:
    # Wild cards can always be played
    if played_card.color == "Any":
        return True

    # Check if color or value matches
    if played_card.color == top_card.color or played_card.value == top_card.value:
        return True

    return False


# Example of a turn sequence
def main() -> None:
    deck = build_deck()
    player_hand = [deck.pop() for _ in range(7)]
    discard_pile = [deck.pop()]

    print(f"Top card: {discard_pile[-1]}")
    print("Your hand:")
    for i, card in enumerate(player_hand):
        print(f"{i}: {card}")

    # Simple check for the first card in hand
    if is_valid_play(player_hand[0], discard_pile[-1]):
        print(f"\nYou can play {player_hand[0]}!")
    else:
        print(f"\nYou can't play {player_hand[0]}. Draw a card.")


if __name__ == "__main__":
    main()
