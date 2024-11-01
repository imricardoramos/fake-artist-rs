import { Link } from "react-router-dom";
import short from "short-uuid";
export default function HomePage() {
  console.log("HomePage");
  return (
    <div className="text-lg">
      <h1 className="text-center text-6xl text-white my-10">
        A Fake Artist goes to New York
      </h1>
      <Link
        className="mx-auto block max-w-screen-sm"
        to={`/room/${short.generate()}`}
      >
        <button
          style={{ backgroundColor: "#f63b5d" }}
          className="w-full h-24 text-white font-bold rounded-xl px-4 py-2"
        >
          New Game 🕹
        </button>
      </Link>
      <div className="mx-auto max-w-screen-sm bg-white rounded-xl p-10 my-2">
        <h2 className="text-4xl mb-10">How to play?</h2>
        <p>
          Everyone is drawing one picture together...and one doesn't even know
          what they draw. There is a fake artist hiding among the real artists -
          can you find out who it is? The fake artist has to be careful not to
          be identified and the real artists have to be careful not to make it
          too easy for the deceiver.
        </p>
        <h3 className="text-2xl my-5">General Rules</h3>
        <ol className="list-decimal list-inside">
          <li>
            Everyone must draw a single line per turn, so make sure not to lift
            your pen!
          </li>
          <li>Words are chosen at random.</li>
        </ol>
        <h3 className="text-2xl my-5">If you're a Real Artist 🧑‍🎨</h3>
        <ol className="list-decimal list-inside">
          <li>You must try to guess who the fake artist is.</li>
          <li>
            Do not reveal the correct word to the fake artist in your drawing.
          </li>
        </ol>
        <h3 className="text-2xl my-5">If you're a Fake Artist 🧑‍🎨</h3>
        <ol className="list-decimal list-inside">
          <li>
            Do not get caught by the real artists. You will draw without knowing
            the word, so act like you do!
          </li>
          <li>
            If you get caught, you must guess the correct word based on what the
            real artists drew.
          </li>
        </ol>
      </div>
      <div className="mx-auto max-w-screen-sm bg-white rounded-xl p-10 my-2">
        <h2 className="text-4xl mb-10">Sample Gameplay</h2>
        <p>
          If you're still unsure on how to play, here's a fun video of people
          playing it:
        </p>
        <iframe
          width="100%"
          height="315"
          src="https://www.youtube.com/embed/k2z8l9k38mk"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}
