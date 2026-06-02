# Edu Top Ten

Edu Top Ten is a small, polished single-page web app for browsing educational prompt cards.

## What It Does

- Shows one prompt card at a time
- Displays a prompt context, a question, and a 1-to-10 scale
- Shuffles the deck on load
- Reshuffles automatically when all cards have been used
- Supports drag/swipe discard interactions
- Supports desktop keyboard controls
- Uses a local CSV file as the canonical prompt source

## Interaction

Desktop:

- Drag the card into the discard zone
- Click the arrow button
- Press `Right Arrow`
- Press `Space`

Mobile:

- Swipe quickly to discard
- A short intro overlay explains the gesture on page load

## Tech Stack

- Vite
- React
- TypeScript
- Motion
- Plain CSS

## Prompt Data

Prompt cards are stored in:

```txt
src/data/prompts.csv
```

Each card has:

- `id`
- `context`
- `question`
- `scale1`
- `scale10`

The scale fields describe the two fixed ends of the card scale. The visual scale always runs from green to red, so card authors should treat `1 → 10` as increasing intensity, escalation, risk, chaos, or absurdity.

## License

Source code is licensed under the MIT License.

Prompt and card content: „Fanmode (edu edit) zu ‚Top Ten’“ von Frank Homp ist lizenziert unter CC BY 4.0.

This license note applies only to the original code and educational prompt content in this repository. It does not grant any rights to the original game “Top Ten”, its name, design, cards, or other protected material.

## Disclaimer

This game is a self-developed fan mode inspired by the game “Top Ten” for use in educational contexts. It uses the basic idea of estimating answers on a scale, but transfers that idea to situations from school, teaching, education, teamwork, and leadership.

The original game “Top Ten” by Aurélien Picolet serves as inspiration for this independent educational fan mode. The original game, its design, and its cards are protected by copyright; this project is not official add-on material and is not an expansion of the original game.
