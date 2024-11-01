dev:
  #!/usr/bin/env -S parallel --shebang --ungroup --jobs {{ num_cpus() }}
  npm --prefix frontend run dev -- --clearScreen false
  RUST_LOG=info cargo watch -x run
build:
  #!/usr/bin/env -S parallel --shebang --ungroup --jobs {{ num_cpus() }}
  cargo build --release
  npm --prefix frontend run build

run:
  #!/usr/bin/env -S parallel --shebang --ungroup --jobs {{ num_cpus() }}
  RUST_LOG=info ./target/release/fake-artist-rs
