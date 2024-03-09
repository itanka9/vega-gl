# Vega-gl - display data from vega specs via deck.gl

Hardly working on: not all vega marks and features is supported for now.

```js
import { DeckGlRenderer } from 'vega-gl';

vega.renderModule('deck.gl', { renderer: DeckGlRenderer, handler: vega.CanvasHandler });

const runtime = vega.parse(vegaSpec);
const view = new vega.View(runtime)
          .renderer('deck.gl')
          .initialize('#view');

view.runAsync();
```