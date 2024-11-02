use axum::http::{header::CONTENT_SECURITY_POLICY, HeaderValue};
use socket::setup_socket;
use socketioxide::{extract::SocketRef, SocketIo};
use std::error::Error;
use tokio::signal::unix::{signal, SignalKind};
use tower_http::{
    services::{ServeDir, ServeFile},
    set_header::SetResponseHeaderLayer,
};
use tracing::info;

mod game;
mod game_server;
mod lists;
mod socket;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    start_tracing();
    start_endpoint();
    let mut sigint = signal(SignalKind::interrupt())?;
    let mut sigterm = signal(SignalKind::terminate())?;
    tokio::select! {
        _ = sigint.recv() => {},
        _ = sigterm.recv() => {},
    };
    Ok(())
}

fn start_tracing() {
    let subscriber = tracing_subscriber::FmtSubscriber::new();
    tracing::subscriber::set_global_default(subscriber).unwrap();
}
fn start_endpoint() {
    tokio::spawn(async {
        let (layer, io) = SocketIo::builder().build_layer();
        io.ns("/", |socket: SocketRef| {
            info!("Socket connected: {}", socket.id);
            setup_socket(socket)
        });

        let app = axum::Router::new()
            .route_service("/room/:room_id", ServeFile::new("frontend/dist/index.html"))
            .nest_service("/", ServeDir::new("frontend/dist"))
            .layer(layer)
            .layer(SetResponseHeaderLayer::overriding(
                CONTENT_SECURITY_POLICY,
                HeaderValue::from_static(
                    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-src www.youtube.com",
                ),
            ));
        let listener = tokio::net::TcpListener::bind("0.0.0.0:4000").await.unwrap();
        info!("Listening on 0.0.0.0:4000");
        axum::serve(listener, app).await.unwrap();
    });
}
