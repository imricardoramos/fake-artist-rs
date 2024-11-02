import { useState, useEffect, useRef, KeyboardEvent, useCallback } from "react";
import { Socket } from "socket.io-client";
import short from "short-uuid";
import { Player } from "@/types/Player";
import { Game as GameState } from "@/types/Game";
import { InGameState } from "@/types/InGameState";
import { Point } from "@/types/Point";
import { NextTurnEvent } from "@/types/NextTurnEvent";
import { DrawEvent } from "@/types/DrawEvent";
import { VotesTotalEvent } from "@/types/VotesTotalEvent";
import { VoteFakeEvent } from "@/types/VoteFakeEvent";
import { LobbyState } from "@/types/LobbyState";
import { JoinEvent } from "@/types/JoinEvent";
import { v5 as uuidv5 } from "uuid";
import { ChatMessage } from "@/types/ChatMessage";
import { Curve } from "@/types/Curve";
import { useParams } from "react-router-dom";
import { SocketProvider } from "@/contexts/SocketContext";
import { useSocket } from "@/hooks/useSocket";
const translator = short();

function Room() {
  const params = useParams<{ roomId: string }>();
  const { socket, isConnected, connect, disconnect } = useSocket();
  const [currentPlayerId, setCurrentPlayerId] = useState<string>();
  const [gameState, setGameState] = useState<GameState>();
  function changeState(state: GameState) {
    setGameState(state);
  }

  useEffect(() => {
    connect();
    return () => {
      disconnect(); // Disconnect when component unmounts
    };
  }, []);

  useEffect(() => {
    if (socket && isConnected && params.roomId) {
      function join() {
        const urlShortUuid = params.roomId;
        if (urlShortUuid && !currentPlayerId) {
          const uuid = translator.toUUID(urlShortUuid);
          socket?.emitWithAck("join", uuid);
        }
      }
      function onJoin(event: JoinEvent) {
        if (event.current_player_id && event.game_state) {
          setCurrentPlayerId(event.current_player_id);
          setGameState(event.game_state);
        }
        if (gameState && event.players) {
          setGameState({
            ...gameState,
            players: event.players,
          });
        }
        if (gameState && gameState.state == "InGame" && event.spectators) {
          setGameState({
            ...gameState,
            spectators: event.spectators,
          });
        }
      }

      socket.on("join", onJoin);
      socket.on("start_game", changeState);
      join();

      return () => {
        socket.off("join", onJoin);
        socket.off("start_game", changeState);
      };
    }
  }, [socket, isConnected, gameState, params.roomId, currentPlayerId]);

  return (
    <SocketProvider>
      <div>
        <h1 className="text-center text-6xl text-white my-10 mx-2">
          A Fake Artist goes to New York
        </h1>
        {socket && gameState && gameState.state == "Lobby" ? (
          <Lobby socket={socket} lobby={gameState} />
        ) : socket &&
          gameState &&
          gameState.state == "InGame" &&
          currentPlayerId ? (
          <Game
            socket={socket}
            initialState={gameState}
            currentPlayerId={currentPlayerId}
            onChangeState={changeState}
          />
        ) : gameState && gameState.state == "GameOver" && currentPlayerId ? (
          <GameOver
            initialState={gameState}
            currentPlayerId={currentPlayerId}
          />
        ) : (
          <div></div>
        )}
      </div>
    </SocketProvider>
  );
}

type LobbyParams = {
  socket: Socket;
  lobby: { state: "Lobby" } & LobbyState;
};
function Lobby({ socket, lobby }: LobbyParams) {
  function startGame() {
    socket.emit("start_game", {});
  }
  function changeName(e: React.FormEvent<HTMLInputElement>) {
    socket.emit("change_name", e.currentTarget.value);
  }
  return (
    <div className="m-2">
      <div className="text-center mx-auto max-w-screen-sm bg-white rounded-xl p-5 mb-5">
        <p>Share this link to let other players join:</p>
        <p>{window.location.href}</p>
      </div>
      <div className="mx-auto max-w-screen-sm bg-white rounded-xl p-10">
        <input
          onInput={changeName}
          className="border border-gray-300 rounded-md p-2 m-4"
          type="text"
          name="name"
          placeholder="Enter your name"
          autoComplete="off"
        />
        <hr />
        <h2 className="text-center text-3xl font-bold my-2 text-gray-800">
          Players:
        </h2>
        <div className="flex flex-wrap justify-center">
          {[...Array(6)].map((_, index) => (
            <PlayerSlot
              key={index}
              player={lobby.players[index]}
              className="m-3"
            />
          ))}
        </div>
        <button
          onClick={startGame}
          id="start-button"
          className="px-4 py-2 rounded-xl bg-blue-500 text-white font-bold m-4"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

type PlayerSlotProps = {
  player: Player | null;
  voters?: Player[];
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
};
function PlayerSlot({ player, voters, onClick, className }: PlayerSlotProps) {
  if (player) {
    return (
      <div
        key={player.name}
        onClick={onClick}
        className={
          "shadow-lg rounded-lg bg-white border border-gray-200 w-64 h-16 " +
            className || ""
        }
      >
        <div className="flex items-center ml-2 mt-2">
          <div
            className="rounded-full w-5 h-5"
            style={{ backgroundColor: player.color }}
          ></div>
          <div className="ml-2">{player.name}</div>
        </div>
        <div className="flex ml-2 mt-1">
          {voters &&
            voters.map((voter) => (
              <div
                key={voter.id}
                className="mr-1 rounded-full w-2 h-2"
                style={{ backgroundColor: voter.color }}
              ></div>
            ))}
        </div>
      </div>
    );
  } else {
    return (
      <div className="border border-dashed border-gray-500 rounded-xl m-3 w-64 h-16"></div>
    );
  }
}

type GameProps = {
  socket: Socket;
  initialState: { state: "InGame" } & InGameState;
  currentPlayerId: string;
  onChangeState: (state: GameState) => void;
};
function Game({
  socket,
  initialState,
  currentPlayerId,
  onChangeState,
}: GameProps) {
  const [mouseIsDown, setMouseIsDown] = useState(false);
  const [game, setGame] = useState(initialState);
  const [previousPlayer, setPreviousPlayer] = useState<Player>();
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [deliberationModalOpen, setDeliberationModalOpen] = useState(false);
  const lastPositionRef = useRef<Point>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const curvesRef = useRef<Curve[]>([]);
  function normalizePosition(position: Point, canvas: HTMLCanvasElement) {
    return {
      x: position.x / canvas.width,
      y: position.y / canvas.width,
    };
  }
  function denormalizePosition(position: Point, canvas: HTMLCanvasElement) {
    return {
      x: position.x * canvas.width,
      y: position.y * canvas.width,
    };
  }
  function fixDPI(canvas: HTMLCanvasElement) {
    const dpi = window.devicePixelRatio;
    const style_height = +getComputedStyle(canvas)
      .getPropertyValue("height")
      .slice(0, -2);
    const style_width = +getComputedStyle(canvas)
      .getPropertyValue("width")
      .slice(0, -2);
    canvas.setAttribute("height", `${style_height * dpi}`);
    canvas.setAttribute("width", `${style_width * dpi}`);
  }
  const redrawCanvas = useCallback(function redrawCanvas(
    canvas: HTMLCanvasElement,
    curves: Curve[],
  ) {
    fixDPI(canvas);
    curves.forEach((curve) => {
      const context = canvas.getContext("2d")!;
      context.beginPath();
      const firstPoint = denormalizePosition(curve.points[0], canvas);
      context.moveTo(firstPoint.x, firstPoint.y);
      curve.points.slice(1).forEach((point) => {
        const denormPoint = denormalizePosition(point, canvas);
        context.lineTo(denormPoint.x, denormPoint.y);
      });
      context.strokeStyle = curve.author.color;
      context.stroke();
    });
  }, []);
  function onMouseDown(_e: React.MouseEvent<HTMLCanvasElement>) {
    if (isPlayerTurn(game)) {
      setMouseIsDown(true);
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mouseIsDown && isPlayerTurn(game)) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const normalizedPoint: Point = normalizePosition(
        {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
        },
        canvas,
      );
      addPointToCurves(curvesRef.current, turnPlayer(game), normalizedPoint);
      paintCanvas(canvas, game, normalizedPoint);
      socket.emit("draw", normalizedPoint);
    }
  }
  function onMouseUp(_e: React.MouseEvent<HTMLCanvasElement>) {
    if (isPlayerTurn(game)) {
      setMouseIsDown(false);
      lastPositionRef.current = undefined;
      socket.emit("draw_end");
    }
  }
  const paintCanvas = useCallback(
    function paintCanvas(
      canvas: HTMLCanvasElement,
      game: GameState & { state: "InGame" },
      normalizedPosition: Point,
    ) {
      const position = denormalizePosition(normalizedPosition, canvas);
      const context = canvas.getContext("2d");
      const lastPosition = lastPositionRef.current;
      if (context) {
        context.beginPath();
        if (lastPosition) {
          context.moveTo(lastPosition.x, lastPosition.y);
          context.lineTo(position.x, position.y);
        } else {
          context.moveTo(position.x, position.y);
        }
        context.strokeStyle = game.players[game.current_player_index].color;
        context.stroke();

        lastPositionRef.current = position;
      }
    },
    [lastPositionRef],
  );
  function onVote(target: Player) {
    const event: VoteFakeEvent = {
      target,
    };
    socket.emit("vote_fake", event);
  }
  function onChatKeyUp(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key == "Enter" && e.currentTarget.value != "") {
      e.preventDefault();
      socket.emit("chat_msg", e.currentTarget.value);
      e.currentTarget.value = "";
    }
  }
  function addPointToCurves(
    curves: Curve[],
    turnPlayer: Player,
    position: Point,
  ) {
    const last = curves.length - 1;
    if (curves.length == 0 || curves[last].author.id != turnPlayer.id) {
      curves.push({
        author: turnPlayer,
        points: [position],
      });
    } else {
      curves[last].points.push(position);
    }
  }

  const isFakeArtist = () => game.fake_artist.id == currentPlayerId;
  const findPlayerById = (id: string) =>
    game.players.find((player) => player.id == id);
  const currentPlayer = () => findPlayerById(currentPlayerId)!;
  const turnPlayer = (game: GameState & { state: "InGame" }) =>
    game.players[game.current_player_index];
  const isPlayerTurn = (game: GameState & { state: "InGame" }) =>
    currentPlayer().id == turnPlayer(game).id;
  useEffect(() => {
    function onNextTurn(event: NextTurnEvent) {
      setPreviousPlayer(game.players[game.current_player_index]);
      setGame({ ...game, current_player_index: event.current_player_index });
      if (event.is_last_turn) {
        setDeliberationModalOpen(true);
      } else {
        setMessageModalOpen(true);
        setTimeout(() => {
          setMessageModalOpen(false);
        }, 3000);
      }
      lastPositionRef.current = undefined;
    }

    function onDraw(event: DrawEvent) {
      addPointToCurves(curvesRef.current, turnPlayer(game), event.position);
      paintCanvas(canvasRef.current!, game, event.position);
    }

    function onVoteFake(event: VotesTotalEvent) {
      setGame({ ...game, votes: event.votes });
    }

    function onGameOver(state: GameState) {
      onChangeState(state);
    }

    function onChatMsg(msg: ChatMessage) {
      setGame({ ...game, chat: [...game.chat, msg] });
    }

    function onWindowResize() {
      redrawCanvas(canvasRef.current!, curvesRef.current);
    }

    socket.on("next_turn", onNextTurn);
    socket.on("draw", onDraw);
    socket.on("vote_fake", onVoteFake);
    socket.on("game_over", onGameOver);
    socket.on("chat_msg", onChatMsg);
    window.addEventListener("resize", onWindowResize, true);
    return () => {
      socket.off("next_turn", onNextTurn);
      socket.off("draw", onDraw);
      socket.off("vote_fake", onVoteFake);
      socket.off("game_over", onGameOver);
      socket.off("chat_msg", onChatMsg);
      window.removeEventListener("resize", onWindowResize);
    };
  }, [socket, game, onChangeState, redrawCanvas, paintCanvas]);
  useEffect(() => {
    fixDPI(canvasRef.current!);
  }, []);
  return (
    <div>
      <div className="text-center bg-white my-2">
        <div
          style={{ fontSize: "2rem", color: isFakeArtist() ? "red" : "green" }}
        >
          {isFakeArtist()
            ? "You're the fake artist"
            : "You're not the fake artist"}
        </div>
        <div style={{ fontSize: "3rem" }}>Category: {game.word.category}</div>
        {!isFakeArtist() && (
          <div style={{ fontSize: "3rem", fontWeight: "bold" }}>
            Word: {game.word.text}
          </div>
        )}
      </div>
      <div className="flex flex-wrap">
        <div className="mr-2">
          <div className="text-white m-2">Players:</div>
          <div className="flex flex-wrap lg:block">
            {game.players.map((player) => (
              <PlayerSlot key={player.name} player={player} className="m-2" />
            ))}
          </div>
          {game.spectators.length > 0 && (
            <>
              <div className="text-white">Spectators:</div>
              <div>
                {game.spectators.map((spectator) => (
                  <PlayerSlot
                    key={spectator.name}
                    player={spectator}
                    className="my-2"
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="relative flex-grow m-2">
          {deliberationModalOpen && (
            <Deliberation game={game} onVote={onVote} />
          )}
          {messageModalOpen && previousPlayer && (
            <div className="absolute top-1/2 left-1/2 text-center bg-white p-1 border border-solid border-black -translate-x-1/2 -translate-y-1/2">
              <div>
                <b>{previousPlayer.name}</b> lifted the pen...
              </div>
              <div className="text-lg">
                <b>{game.players[game.current_player_index].name}</b>
              </div>
              <div className="text-lg">is next!</div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            className="bg-white rounded-md object-contain aspect-video w-full"
          />
        </div>
        <div className="bg-white rounded-md m-2 p-2 w-full lg:w-64">
          <textarea
            onKeyUp={onChatKeyUp}
            placeholder="Say something..."
            className="p-2 w-full border border-gray-300 rounded-md"
          ></textarea>
          <div id="comments" className="w-full">
            {game.chat
              .slice()
              .reverse()
              .map((message) => (
                <div
                  key={message.message}
                  className="p-3 border-b border-gray-100"
                >
                  <div className="whitespace-pre-wrap font-bold text-gray-700">
                    {message.author.name}
                  </div>
                  <div className="whitespace-pre-wrap break-words">
                    {message.message}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type DeliberationProps = {
  game: InGameState;
  onVote: (target: Player) => void;
};
function Deliberation({ game, onVote }: DeliberationProps) {
  function voters_for(player: Player) {
    return game.players.filter((p) => game.votes[p.id] === player.id);
  }
  return (
    <div
      id="deliberation"
      className="absolute top-1/2 left-1/2 text-center bg-white p-1 border border-solid border-black -translate-x-1/2 -translate-y-1/2"
    >
      <h2>Who's the fake artist? Discuss!</h2>
      <div>
        {game.players.map((player) => (
          <PlayerSlot
            key={player.id}
            player={player}
            onClick={() => onVote(player)}
            voters={voters_for(player)}
            className="cursor-pointer"
          />
        ))}
      </div>
    </div>
  );
}

type GameOverProps = {
  initialState: { state: "GameOver" } & GameState;
  currentPlayerId: string;
};
function GameOver({ initialState, currentPlayerId }: GameOverProps) {
  const params = useParams<{ roomId: string }>();
  const [game, _setGame] = useState(initialState);
  const [secondsLeft, setSecondsLeft] = useState<number>(10);
  const redirUrl = `/room/${translator.fromUUID(uuidv5(params.roomId!, uuidv5.URL))}`;
  function playerIsFakeArtist() {
    return game.fake_artist.id == currentPlayerId;
  }
  useEffect(() => {
    const cb = () => {
      if (secondsLeft > 0) {
        setSecondsLeft(secondsLeft - 1);
        setTimeout(cb, 1000);
      } else {
        window.location.href = redirUrl;
      }
    };
    setTimeout(cb, 1000);
  }, [secondsLeft, redirUrl]);
  return (
    <div className="max-w-screen-sm p-2 mx-auto">
      <div className="bg-white text-center rounded-xl p-10">
        <h1 className="font-bold text-3xl mb-5">
          {(playerIsFakeArtist() && game.winner == "FakeArtist") ||
          (!playerIsFakeArtist() && game.winner == "RealArtists")
            ? "You Win!"
            : "You Lose!"}
        </h1>
        <div className="text-xl mb-5">
          The fake artist was: <b>{game.fake_artist.name}!</b>
        </div>
        <div>
          <a className="text-blue-500" href={redirUrl}>
            Play Again? {secondsLeft}
          </a>
        </div>
      </div>
    </div>
  );
}

export default Room;
