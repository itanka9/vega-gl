import './style.css'
import * as vega from 'vega';
import { DeckGlRenderer, patchCanvasHandler } from '../src/lib';
import {Pane} from 'tweakpane';

// Setting up vega
vega.renderModule('deck.gl', { renderer: DeckGlRenderer, handler: vega.CanvasHandler });

// Setting up tweakpane
const pane = new Pane();
pane.element.parentElement?.classList.add('tweakpane');

const cases = [
  'unemployment',
  'arc-diagram',
  'clinic_availability',
  'movies',
  'simple',
  'watch'
];

const params = {
  case: cases[0]
}

let runtime: vega.Runtime;
let view: vega.View;

pane
  .addBinding(params, 'case', { controller: 'list', options: Object.fromEntries(cases.map(c => [c,c])) })
  .on('change', ev => {
    setBindingsVisible(false);
    showSpec(ev.value);
  });

function showSpec(spec: string) {
  fetch(`./specs/${spec}.json`)
      .then(r=>r.json())
      .then(spec => {
        if (view) {
          view.finalize();
        }
        runtime = (window as any).runtime = vega.parse(spec);
        view = (window as any).vw = new vega.View(runtime)
          .renderer('deck.gl' as any)
          .initialize('#view');

        (view as any)._renderer.setView(spec.deckView);
        view.runAsync().then(() => {
          setBindingsVisible(true)
        });
      });
}

function setBindingsVisible(visible?: boolean) {
  const bindingsForm = document.querySelector('.vega-bindings') as HTMLFormElement;
  if (bindingsForm) {
    const hasChildren = bindingsForm.children.length > 0;
    bindingsForm.style.display = hasChildren && visible ? 'block' : 'none';
  }
}

showSpec(cases[0]);