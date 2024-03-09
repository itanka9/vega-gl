# Vega-gl - display data from vega specs via deck.gl

```js
import { DeckGlRenderer, patchCanvasHandler } from 'vega-gl';

vega.renderModule('deck.gl', { renderer: DeckGlRenderer, handler: vega.CanvasHandler });
// We should patch vega handler, to avoid
patchCanvasHandler();

const runtime = vega.parse(spec);
const view = new vega.View(runtime)
          .renderer('deck.gl')
          .initialize('#view');

view.runAsync().
```