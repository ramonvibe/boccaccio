# Boccaccio

Editor de livros no navegador. Sem instalação de pacotes.

## Abrir

Execute `python3 iniciar.py` nesta pasta. O navegador abre em `http://127.0.0.1:8765/`. Mantenha o terminal aberto enquanto escreve. Também é possível abrir `index.html` diretamente, mas o servidor local oferece armazenamento mais confiável para livros com imagens.

## Usar

- Edite texto diretamente nas páginas. Ao encher uma folha, o texto continua na próxima automaticamente. `Ctrl+Enter` cria uma página manualmente.
- Selecione texto para aplicar fonte, tamanho, cor, sombra e outros estilos.
- Use a barra para justificar, criar listas, ajustar entrelinhas (inclusive 1,5), espaço após parágrafos e recuo.
- `Tab` aumenta o recuo da primeira linha; `Shift+Tab` diminui. Em listas, essas teclas ajustam o nível. `Backspace` no começo do item remove o marcador; `Enter` em item vazio sai da lista.
- `Ctrl+B`, `Ctrl+I`, `Ctrl+U`, `Ctrl+J`, `Ctrl+E`, `Ctrl+L` e `Ctrl+R` aplicam formatação comum. Seleção, copiar, colar, desfazer e refazer usam atalhos normais do navegador.
- **Imagem** insere um arquivo; ajuste tamanho, posição e moldura no painel direito. O texto contorna imagens alinhadas à esquerda ou à direita.
- Cada página tem fundo, imagem de fundo, margens e formato próprios, inclusive páginas criadas automaticamente. Defina as quatro margens em milímetros com “Personalizada”. Ajuste o zoom no rodapé.
- Trabalho é salvo automaticamente neste navegador. **Salvar arquivo** baixa uma cópia editável `.boccaccio`; **Abrir** restaura essa cópia.
- **Exportar** baixa HTML independente. **PDF / Imprimir** abre impressão do navegador; escolha “Salvar como PDF”. Para imprimir fundos, ative “Gráficos de fundo” nas opções do navegador.

As 51 fontes são carregadas do Google Fonts somente quando usadas. A fonte citada como “Manufacturing Content” está disponível no catálogo como **Manufacturing Consent**, nome publicado pelo Google Fonts. Conexão com internet é necessária para carregar fontes ainda não armazenadas pelo navegador.

## Limites atuais

Documento fica neste navegador; não há contas, sincronização ou colaboração online. O arquivo `.boccaccio` serve como cópia de segurança e permite levar o livro para outro computador.

Teste funcional opcional para desenvolvimento: `python3 tests/smoke.py` (requer WebKitGTK 4.1).
