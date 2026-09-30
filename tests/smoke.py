"""Teste funcional do editor. Execute com `python3 tests/smoke.py` e WebKitGTK disponível."""

import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import GLib, Gtk, WebKit2  # noqa: E402


SCRIPT = r"""(() => {
  const editor = document.querySelector('.page-content');
  editor.innerHTML = '<p>texto</p><ul><li>um</li><li>dois</li></ul>';
  editor.dispatchEvent(new Event('input', {bubbles: true}));
  editor.focus();
  const select = (node, offset = 0) => {
    const range = document.createRange();
    range.setStart(node, offset); range.collapse(true);
    getSelection().removeAllRanges(); getSelection().addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  };
  const key = (name, shiftKey = false) => editor.dispatchEvent(new KeyboardEvent('keydown', {key: name, shiftKey, bubbles: true, cancelable: true}));
  const paragraph = editor.querySelector('p');
  select(paragraph.firstChild); key('Tab');
  const tabWorks = paragraph.style.textIndent === '2em' && document.activeElement === editor;
  key('Tab', true);
  const shiftTabWorks = !paragraph.style.textIndent;
  document.querySelector('#lineSpacing').value = '2';
  document.querySelector('#lineSpacing').dispatchEvent(new Event('change'));
  document.querySelector('#paragraphAfter').value = '6';
  document.querySelector('#paragraphAfter').dispatchEvent(new Event('change'));
  const spacingWorks = paragraph.style.lineHeight === '2' && paragraph.style.marginBottom === '6pt';
  select(editor.querySelectorAll('li')[1].firstChild); key('Tab');
  const listIndentWorks = editor.querySelectorAll('li > ul').length === 1;
  key('Tab', true);
  const listOutdentWorks = editor.querySelectorAll('li > ul').length === 0;
  select(editor.querySelectorAll('li')[1].firstChild); key('Backspace');
  const listExitWorks = editor.querySelectorAll('li').length === 1 && editor.textContent.includes('dois');
  const empty = document.createElement('li'); empty.append(document.createElement('br'));
  editor.querySelector('ul').append(empty); select(empty); key('Enter');
  const emptyListExitWorks = editor.querySelectorAll('li').length === 1;
  const margin = document.querySelector('#pageMargin');
  margin.value = 'custom'; margin.dispatchEvent(new Event('change'));
  const top = document.querySelector('[data-margin-side=top]');
  top.value = '30'; top.dispatchEvent(new Event('change'));
  const marginWorks = getComputedStyle(document.querySelector('.page-content')).paddingTop === '113px';
  return JSON.stringify({tabWorks, shiftTabWorks, spacingWorks, listIndentWorks, listOutdentWorks, listExitWorks, emptyListExitWorks, marginWorks});
})()"""


def main():
    root = Path(__file__).resolve().parents[1]
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    window = Gtk.Window()
    window.set_default_size(1200, 800)
    web = WebKit2.WebView.new_with_context(WebKit2.WebContext.new_ephemeral())
    window.add(web)
    window.show_all()
    loop = GLib.MainLoop()
    result = {}

    def finished(view, task):
        result.update(json.loads(view.evaluate_javascript_finish(task).to_string()))
        loop.quit()

    def ready():
        web.evaluate_javascript(SCRIPT, -1, None, None, None, finished)
        return False

    def loaded(view, event):
        if event == WebKit2.LoadEvent.FINISHED:
            GLib.timeout_add_seconds(2, ready)

    web.connect("load-changed", loaded)
    GLib.timeout_add_seconds(20, lambda: (loop.quit(), False)[1])
    web.load_uri(f"http://127.0.0.1:{server.server_port}/")
    try:
        loop.run()
        assert result and all(result.values()), result
        print("Editor: OK", result)
    finally:
        window.destroy()
        server.shutdown()


if __name__ == "__main__":
    main()
