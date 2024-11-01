use axum::async_trait;
use ractor::{Actor, ActorProcessingErr, ActorRef, RpcReplyPort};

use crate::game::{Game, Player, Point};

pub struct GameServer;
pub enum Message {
    Join(Player, RpcReplyPort<Game>),
    UpdatePlayer(Player, RpcReplyPort<Game>),
    Leave(Player, RpcReplyPort<Game>),
    StartGame(RpcReplyPort<Game>),
    Draw(Point),
    DrawEnd(RpcReplyPort<(usize, bool)>),
    VoteFake(Player, Player, RpcReplyPort<Game>),
    Chat(Player, String),
}

#[async_trait]
impl Actor for GameServer {
    type Msg = Message;
    type State = Game;
    type Arguments = ();
    async fn pre_start(
        &self,
        _myself: ActorRef<Self::Msg>,
        _args: Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        Ok(Game::new())
    }
    async fn handle(
        &self,
        myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        game: &mut Self::State,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            Message::Join(player, reply) => {
                game.add_player(player);
                let _ = reply.send(game.clone());
            }
            Message::UpdatePlayer(player, reply) => {
                game.update_player(player);
                let _ = reply.send(game.clone());
            }
            Message::StartGame(reply) => {
                game.start_game();
                let _ = reply.send(game.clone());
            }
            Message::Draw(point) => game.draw(point),
            Message::DrawEnd(reply) => {
                let is_last_turn = if let Game::InGame(game) = game {
                    game.is_last_turn()
                } else {
                    false
                };
                game.end_draw();
                if let Game::InGame(game) = game {
                    let _ = reply.send((game.current_player_index, is_last_turn));
                }
            }
            Message::VoteFake(player, target, reply) => {
                game.vote(player, target);
                let _ = reply.send(game.clone());
            }
            Message::Chat(author, message) => {
                if let Game::InGame(game) = game {
                    game.add_chat_msg(author, &message);
                };
            }
            Message::Leave(player, reply) => {
                game.remove_player(player);
                if game.players().len() == 0 {
                    myself.stop(None)
                };
                let _ = reply.send(game.clone());
            }
        }
        Ok(())
    }
}
