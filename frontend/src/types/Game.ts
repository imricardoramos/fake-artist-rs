// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { GameOverState } from "./GameOverState";
import type { InGameState } from "./InGameState";
import type { LobbyState } from "./LobbyState";

export type Game = { "state": "Lobby" } & LobbyState | { "state": "InGame" } & InGameState | { "state": "GameOver" } & GameOverState;
