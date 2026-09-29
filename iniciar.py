"""Abre o Boccaccio no navegador com armazenamento local confiável."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Timer
import webbrowser


PORT = 8765
URL = f"http://127.0.0.1:{PORT}/"


if __name__ == "__main__":
    handler = partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).parent))
    with ThreadingHTTPServer(("127.0.0.1", PORT), handler) as server:
        print(f"Boccaccio: {URL}\nPressione Ctrl+C para encerrar.")
        Timer(0.5, lambda: webbrowser.open(URL)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
