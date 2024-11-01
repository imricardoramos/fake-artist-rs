use crate::lists::{self, Word};
use itertools::Itertools;
use rand::seq::IteratorRandom;
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize, TS, Clone)]
pub struct Point {
    x: f32,
    y: f32,
}

#[derive(Debug, Serialize, TS, Clone)]
pub struct Curve {
    points: Vec<Point>,
    author: Player,
}

#[derive(Debug, Clone, Deserialize, Serialize, TS)]
pub struct Player {
    pub id: Uuid,
    pub name: String,
    pub color: String,
}

impl Player {
    pub fn random() -> Self {
        Player {
            id: Uuid::new_v4(),
            name: lists::random_artist().name.to_string(),
            color: lists::random_color().to_string(),
        }
    }
}

#[derive(Debug, Deserialize, Serialize, TS)]
pub struct Vote {
    author: Player,
    target: Player,
}

#[derive(Debug, Serialize, TS, Clone)]
pub struct ChatMessage {
    author: Player,
    message: String,
}
impl ChatMessage {
    pub fn new(author: Player, message: &str) -> Self {
        Self {
            author,
            message: message.to_string(),
        }
    }
}

#[derive(Debug, Serialize, TS, Clone)]
pub struct LobbyState {
    players: Vec<Player>,
}

impl LobbyState {
    fn players(&self) -> Vec<Player> {
        self.players.clone()
    }
    pub fn next(&mut self) -> Game {
        let players = &mut self.players;
        players.shuffle(&mut rand::thread_rng());

        Game::InGame(InGameState {
            players: players.clone(),
            current_round: 1,
            max_rounds: 2,
            current_player_index: 0,
            curves: vec![],
            current_curve: None,
            word: lists::random_word(),
            fake_artist: self.random_player(),
            spectators: vec![],
            chat: vec![],
            votes: HashMap::new(),
        })
    }
    fn random_player(&self) -> Player {
        self.players
            .iter()
            .choose(&mut rand::thread_rng())
            .unwrap()
            .clone()
    }
    fn add_player(&mut self, player: Player) {
        self.players.push(player)
    }
    fn remove_player(&mut self, player: Player) {
        let index = self
            .players
            .iter()
            .position(|player_iter| player_iter.id == player.id)
            .unwrap();
        self.players.remove(index);
    }
    fn update_player(&mut self, player: Player) {
        let idx = self
            .players
            .iter()
            .position(|player_iter| player_iter.id == player.id)
            .unwrap();
        self.players[idx] = player
    }
}

#[derive(Debug, Serialize, TS, Clone)]
pub struct InGameState {
    players: Vec<Player>,
    pub current_player_index: usize,
    curves: Vec<Curve>,
    current_curve: Option<Curve>,
    current_round: u8,
    max_rounds: u8,
    word: Word<'static>,
    fake_artist: Player,
    spectators: Vec<Player>,
    chat: Vec<ChatMessage>,
    pub votes: HashMap<Uuid, Uuid>,
}
impl InGameState {
    fn next(&mut self) -> Option<Game> {
        let (accused_id, _votes) = self
            .votes
            .values()
            .counts()
            .into_iter()
            .max_by_key(|(_uuid, count)| *count)
            .unwrap();
        let winner = if *accused_id == self.fake_artist.id {
            Winner::RealArtists
        } else {
            Winner::FakeArtist
        };
        if self.votes.len() >= self.players.len() {
            Some(Game::GameOver(GameOverState {
                players: self.players.clone(),
                fake_artist: self.fake_artist.clone(),
                winner,
            }))
        } else {
            None
        }
    }
    fn players(&self) -> Vec<Player> {
        self.players.clone()
    }
    fn spectators(&self) -> Vec<Player> {
        self.spectators.clone()
    }
    fn add_player(&mut self, player: Player) {
        self.spectators.push(player)
    }
    fn remove_player(&mut self, player: Player) {
        let index = self
            .players
            .iter()
            .position(|player_iter| player_iter.id == player.id)
            .unwrap();
        self.players.remove(index);
    }
    fn update_player(&mut self, player: Player) {
        let idx = self
            .players
            .iter()
            .position(|player_iter| player_iter.id == player.id)
            .unwrap();
        self.players[idx] = player
    }
    pub fn current_player(&self) -> Player {
        self.players[self.current_player_index].clone()
    }
    pub fn add_chat_msg(&mut self, author: Player, message: &str) {
        self.chat.push(ChatMessage {
            author,
            message: message.to_string(),
        })
    }
    fn draw(&mut self, point: Point) {
        match &mut self.current_curve {
            Some(curve) => curve.points.push(point),
            None => {
                self.current_curve = Some(Curve {
                    points: vec![point],
                    author: self.current_player(),
                })
            }
        }
    }
    fn end_draw(&mut self) {
        if let Some(curve) = self.current_curve.take() {
            self.curves.push(curve);
        };
        if self.current_player_index < self.players.len() - 1 {
            self.current_player_index += 1;
        } else {
            self.current_player_index = 0;
            self.current_round += 1;
        }
    }
    pub fn is_last_turn(&self) -> bool {
        self.current_round == self.max_rounds
            && self.current_player_index == self.players().len() - 1
    }
    fn vote(&mut self, player: Player, target: Player) -> Option<Game> {
        let player_id = player.id;
        let target_id = target.id;
        self.votes.insert(player_id, target_id);
        self.next()
    }
}

#[derive(Debug, Serialize, TS, Clone)]
enum Winner {
    FakeArtist,
    RealArtists,
}
#[derive(Debug, Serialize, TS, Clone)]
pub struct GameOverState {
    players: Vec<Player>,
    winner: Winner,
    fake_artist: Player,
}
impl GameOverState {
    fn players(&self) -> Vec<Player> {
        self.players.clone()
    }
}

#[derive(Debug, Serialize, TS, Clone)]
#[serde(tag = "state")]
#[ts(export)]
pub enum Game {
    Lobby(LobbyState),
    InGame(InGameState),
    GameOver(GameOverState),
}

impl Game {
    pub fn new() -> Self {
        Game::Lobby(LobbyState { players: vec![] })
    }
    pub fn players(&self) -> Vec<Player> {
        match self {
            Game::Lobby(lobby) => lobby.players(),
            Game::InGame(in_game) => in_game.players(),
            Game::GameOver(game_over) => game_over.players(),
        }
    }
    pub fn spectators(&self) -> Vec<Player> {
        match self {
            Game::InGame(in_game) => in_game.spectators(),
            _ => vec![],
        }
    }
    pub fn add_player(&mut self, player: Player) {
        match self {
            Game::Lobby(lobby) => {
                lobby.add_player(player);
            }
            Game::InGame(in_game) => {
                // Handle joining mid-game
                in_game.add_player(player)
            }
            _ => (),
        }
    }
    pub fn remove_player(&mut self, player: Player) {
        match self {
            Game::Lobby(lobby) => lobby.remove_player(player),
            Game::InGame(in_game) => in_game.remove_player(player),
            _ => (),
        }
    }
    pub fn update_player(&mut self, player: Player) {
        match self {
            Game::Lobby(lobby) => lobby.update_player(player),
            Game::InGame(in_game) => in_game.update_player(player),
            _ => (),
        }
    }
    pub fn start_game(&mut self) {
        match self {
            Game::Lobby(lobby) => {
                *self = lobby.next();
            }
            _ => (),
        }
    }
    pub fn draw(&mut self, point: Point) {
        match self {
            Game::InGame(in_game) => in_game.draw(point),
            _ => (),
        }
    }
    pub fn end_draw(&mut self) {
        match self {
            Game::InGame(in_game) => in_game.end_draw(),
            _ => (),
        }
    }
    pub fn vote(&mut self, player: Player, target: Player) {
        match self {
            Game::InGame(in_game) => {
                if let Some(Game::GameOver(game_over)) = in_game.vote(player, target) {
                    *self = Game::GameOver(game_over)
                }
            }
            _ => (),
        }
    }
}
