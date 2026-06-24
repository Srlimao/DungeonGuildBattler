# Lobby Rules & Architecture

This folder contains the vertically sliced component for the lobby phase (`STATE_LOBBY`).

## Character Guidelines
- Starting stats are configured via `CLASS_PRESETS`.
- Character name validation requires at least 3 characters.
- Character names must be unique within the current roster.

## Screen States
- **Welcome View**: Prompts the user to enter the guild.
- **Roster View**: Lists existing characters stored in local storage, handles deletion, and allows launching recruitment.
- **Recruit View**: Allows creating characters with Warrior, Mage, Rogue, or Cleric classes.
