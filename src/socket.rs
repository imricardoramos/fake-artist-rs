use std::{collections::HashMap, future::Future};

use ractor::{call, cast, Actor, ActorRef};
use serde::{Deserialize, Serialize};
use socketioxide::{
    extract::{Data, SocketRef},
    SocketIo,
};
use ts_rs::TS;
use uuid::Uuid;

use crate::{
    game::{ChatMessage, Game, Player, Point},
    game_server::{GameServer, Message},
};

#[derive(Serialize, TS)]
struct JoinEvent {
    current_player_id: Option<Uuid>,
    game_state: Option<Game>,
    players: Option<Vec<Player>>,
    spectators: Option<Vec<Player>>,
}
#[derive(Serialize, TS)]
struct NextTurnEvent {
    current_player_index: usize,
    is_last_turn: bool,
}
#[derive(Serialize, TS)]
struct DrawEvent {
    position: Point,
}
#[derive(Serialize, TS)]
struct VotesTotalEvent {
    votes: HashMap<Uuid, Uuid>,
}

#[derive(Deserialize, TS)]
struct VoteFakeEvent {
    target: Player,
}

#[allow(dead_code)]
#[derive(Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export)]
enum EventIn {
    VoteFake(VoteFakeEvent),
}

#[allow(dead_code)]
#[derive(Serialize, TS)]
#[serde(tag = "type")]
#[ts(export)]
enum EventOut {
    JoinEvent(JoinEvent),
    NextTurn(NextTurnEvent),
    DrawEvent(DrawEvent),
    VoteFake(VotesTotalEvent),
}

async fn get_or_create_actor<T: 'static, F, Fut>(
    socket: &mut SocketRef,
    id: Uuid,
    create_f: F,
) -> ActorRef<T>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = ActorRef<T>>,
{
    match socket.extensions.get::<ActorRef<T>>() {
        Some(actor_ref) => actor_ref,
        None => {
            let actor = match ractor::registry::where_is(format!("room:{}", id)) {
                Some(actor_cell) => actor_cell.into(),
                None => create_f().await,
            };
            socket.extensions.insert(actor.clone());
            actor
        }
    }
}

pub fn setup_socket(socket: SocketRef) {
    socket.on(
        "join",
        |mut socket: SocketRef, Data(room_id): Data<Uuid>| async move {
            let player = Player::random();
            let game_server = get_or_create_actor(&mut socket, room_id, || async {
                Actor::spawn(Some(format!("room:{}", room_id)), GameServer, ())
                    .await
                    .unwrap()
                    .0
            })
            .await;
            let game_state = call!(game_server, Message::Join, player.clone()).unwrap();
            socket.extensions.insert(player.clone());
            socket.join(game_server.get_name().unwrap()).ok();
            socket
                .emit(
                    "join",
                    JoinEvent {
                        current_player_id: Some(player.id),
                        game_state: Some(game_state.clone()),
                        players: None,
                        spectators: None,
                    },
                )
                .ok();
            socket
                .to(game_server.get_name().unwrap())
                .emit(
                    "join",
                    JoinEvent {
                        current_player_id: None,
                        game_state: None,
                        players: Some(game_state.players()),
                        spectators: Some(game_state.players()),
                    },
                )
                .ok();
        },
    );
    socket.on(
        "change_name",
        |io: SocketIo, socket: SocketRef, Data(name): Data<String>| async move {
            let Some(game_server) = socket.extensions.get::<ActorRef<Message>>() else {
                return;
            };
            let Some(mut player) = socket.extensions.get::<Player>() else {
                return;
            };
            socket.extensions.remove::<Player>();
            player.name = name;
            socket.extensions.insert(player.clone());
            let game = call!(game_server, Message::UpdatePlayer, player).unwrap();
            io.to(game_server.get_name().unwrap())
                .emit(
                    "join",
                    JoinEvent {
                        current_player_id: None,
                        game_state: None,
                        players: Some(game.players()),
                        spectators: Some(game.spectators()),
                    },
                )
                .ok();
        },
    );

    socket.on("start_game", |io: SocketIo, socket: SocketRef| async move {
        let Some(game_server) = socket.extensions.get::<ActorRef<Message>>() else {
            return;
        };
        let game = call!(game_server, Message::StartGame).unwrap();
        io.to(game_server.get_name().unwrap())
            .emit("start_game", game)
            .ok();
    });

    socket.on(
        "draw",
        |socket: SocketRef, Data(point): Data<Point>| async move {
            let Some(game_server) = socket.extensions.get::<ActorRef<Message>>() else {
                return;
            };
            let _ = cast!(game_server, Message::Draw(point.clone()));
            socket
                .to(game_server.get_name().unwrap())
                .emit(
                    "draw",
                    DrawEvent {
                        position: point.clone(),
                    },
                )
                .ok();
        },
    );
    socket.on("draw_end", |io: SocketIo, socket: SocketRef| async move {
        let Some(game_server) = socket.extensions.get::<ActorRef<Message>>() else {
            return;
        };
        let (current_player_index, is_last_turn) = call!(game_server, Message::DrawEnd).unwrap();
        io.to(game_server.get_name().unwrap())
            .emit(
                "next_turn",
                NextTurnEvent {
                    current_player_index,
                    is_last_turn,
                },
            )
            .ok();
    });
    socket.on(
        "vote_fake",
        |io: SocketIo, socket: SocketRef, Data(event): Data<VoteFakeEvent>| async move {
            let Some(game_server) = socket.extensions.get::<ActorRef<Message>>() else {
                return;
            };
            let Some(player) = socket.extensions.get::<Player>() else {
                return;
            };
            let game = call!(game_server, Message::VoteFake, player, event.target).unwrap();
            match game {
                Game::InGame(ref game) => {
                    io.to(game_server.get_name().unwrap())
                        .emit(
                            "vote_fake",
                            VotesTotalEvent {
                                votes: game.votes.clone(),
                            },
                        )
                        .ok();
                }
                Game::GameOver(_) => {
                    io.to(game_server.get_name().unwrap())
                        .emit("game_over", game)
                        .ok();
                }
                _ => (),
            }
        },
    );
    socket.on(
        "chat_msg",
        |io: SocketIo, socket: SocketRef, Data(msg): Data<String>| async move {
            let Some(game_server) = socket.extensions.get::<ActorRef<Message>>() else {
                return;
            };
            let Some(player) = socket.extensions.get::<Player>() else {
                return;
            };
            dbg!(&player);
            let _ = cast!(game_server, Message::Chat(player.clone(), msg.clone()));
            io.to(game_server.get_name().unwrap())
                .emit("chat_msg", ChatMessage::new(player, &msg))
                .ok();
        },
    );
    socket.on_disconnect(|socket: SocketRef| async move {
        let Some(game_server) = socket.extensions.get::<ActorRef<Message>>() else {
            return;
        };
        let Some(player) = socket.extensions.get::<Player>() else {
            return;
        };
        let game = call!(game_server, Message::Leave, player.clone()).unwrap();
        dbg!(game);
        socket
            .to(game_server.get_name().unwrap())
            .emit("leave", player)
            .ok();
    });
}
