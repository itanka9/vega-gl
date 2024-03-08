import * as vega from 'vega';
import { Deck, Layer, OrthographicView, MapView } from '@deck.gl/core/typed';
import { CubeGeometry } from '@luma.gl/core';
import { ScatterplotLayer, LineLayer, TextLayer, PolygonLayer } from '@deck.gl/layers/typed';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers/typed';
import { parseCSSColor } from './colors';
import { pathDataToPolys } from 'svg-path-to-polygons';

const transitionDuration = 400;

const highlightColor = [255, 0, 0, 255];

interface RenderContext {
  layerIndex: number;
  layers: Layer[];
  html: HTMLElement | null;
}

type ProjectFn = (x: number[]) => number[] & [number, number];

type DeckViewType = 'ortho' | 'orbit' | 'map';

export class DeckGlRenderer extends vega.Renderer {
  private deck: Deck | null = null;
  private viewType: DeckViewType;
  
  constructor (imageLoader: any) {
    super(imageLoader);

    this.viewType = 'ortho';
  }

  public initialize(el: HTMLElement, width: number, height: number, origin: readonly number[]): this {
    let canvas = null;

    if (el instanceof HTMLCanvasElement) {
      canvas = el;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      if (origin[0] || origin[1]) {
        canvas.style.paddingLeft = origin[0] + 'px';
        canvas.style.paddingTop = origin[1] + 'px';
      }
      el.appendChild(canvas);
    }

    if (!canvas) {
      return this;
    }

    const view = new OrthographicView({ id: 'ortho', flipY: true })

    this.deck = new Deck({
      canvas,
      views: [view],
      initialViewState: {
        target: [0, 0, 0],
        zoom: 0
      },
      controller: true,
      layers: []
    });

    return this;
  }

  public setView(viewType: DeckViewType) {
    if (!viewType) {
      return;
    }
    if (!this.deck) {
      return;
    }
    this.viewType = viewType;
    
    let view = null;
    let viewState = null;
    switch(viewType) {
      case 'ortho':
        view = new OrthographicView({ id: 'ortho', flipY: true });
        viewState = { center: [0,0], zoom: 0 }
        break;
      case 'map':
        view = new MapView({ id: 'map' });
        viewState = { longitude: 0, latitude: 0, zoom: 0 }
        break
      default:
        throw new Error('Unknown view type');
    }

    if (!view || !viewState) {
      return;
    }

    this.deck.setProps({
      views: [view],
      initialViewState: viewState
    });
  }

  public render (scene: vega.Scene) {
    if (!this.deck) {
      return;
    }

    this.setViewState(scene);

    const ctx: RenderContext = { layerIndex: 0, layers: [], html: null };
    this.createLayers(ctx, scene.items, (x: any) => x);
    this.deck.setProps({ layers: ctx.layers });
  }

  private setViewState(scene: vega.Scene) {
    if (!this.deck) {
      return;
    }
    const bounds = scene.bounds;
    const center = [(bounds.x1 + bounds.x2) / 2, (bounds.y1 + bounds.y2) / 2, 0];
    const currView = this.deck.getViews()[0];
    switch(currView.id) {
      case 'ortho':
        this.deck.setProps({
          initialViewState: {
            target: center,
            zoom: 0
          },
        });
        break;
      case 'map':
        this.deck.setProps({
          initialViewState: {
            // longitude: center[0],
            // latitude: center[1],
            longitude: 82.9203,
            latitude: 55.0274,
            zoom: 13
          },
        });
        break;
    }
  }

  private createLayers(ctx: RenderContext, items: vega.SceneGroup[] | vega.Scene[], project: ProjectFn) {
    for (const item of items) {
      ctx.layerIndex += 1;
      const layerSuffix = `:${ctx.layerIndex}`;
      if (!('marktype' in item)) {
        this.createLayers(ctx, item.items, getProjection(item, project));
      } else if (item.marktype === 'group') {
        this.createLayers(ctx, item.items, project);
      } else if (item.marktype === 'rect') {
          ctx.layers.push(new SimpleMeshLayer({
            id: item.name + layerSuffix,
            data: item.items,
            material: false,
            highlightColor,
            mesh: new CubeGeometry(),
            getPosition: this.viewType === 'map' ? d => [d.x, -d.y, d.z] : (d: any) => project([d.x + d.width / 2, d.y + d.height /2, d.z]), 
            getScale: d => [d.width / 2, d.height / 2, (d.depth ?? 1) / 2],
            getTranslation:  this.viewType === 'map' ? d => [d.width / 2, d.height / 4, (d.depth ?? 1) / 2] : d => d,
            getColor: d => { const [r, g, b, _] = parseCSSColor(d.fill); const a = (d.opacity ?? 1) * 256; return [r, g, b, a]; },
            pickable: true,
            autoHighlight: true,
            transitions: {
                getPosition: transitionDuration,
                getScale: transitionDuration,
                getTranslation: transitionDuration,
                getColor: transitionDuration,
                getSize: transitionDuration,
            },
        }));
      } else if (item.marktype === 'symbol') {
        ctx.layers.push(new ScatterplotLayer({
          id: item.name + layerSuffix,
          data: item.items,
          radiusUnits: 'pixels',
          highlightColor,
          getPosition: d => project([d.x, d.y, d.z]),
          getRadius: d => d.size / 10,
          getFillColor: d => { 
            const [r, g, b, _] = parseCSSColor(d.fill); 
            const a = (d.fillOpacity ?? 1) * 256;
            return [r, g, b, a]; 
          },
          pickable: true,
          autoHighlight: true,
          transitions: {
              getPosition: transitionDuration,
              getColor: transitionDuration,
              getSize: transitionDuration,
          },
        }));
      } else if (item.marktype === 'rule') {
        const newObj = {};
        ctx.layers.push(new LineLayer({
          id: item.name + layerSuffix,
          data: item.items,
          widthUnits: 'pixels',
          highlightColor,
          getSourcePosition: d => {
            return project([d.x, d.y, d.z])
          },
          getTargetPosition: d => {
            return project([d.x2 ?? d.x, d.y2 ?? d.y, d.z2 ?? d.z])
          },
          getColor: d => {
            const [r, g, b, _] = parseCSSColor(d.stroke); 
            const a = (d.opacity ?? 1) * 256;
            return [r, g, b, a]; 
          },
          getWidth: d => {
            return d.strokeWidth;
          },
          updateTriggers: {
            getSoucePosition: [newObj],
            getTargetPosition: [newObj]
          }
        }))
      } else if (item.marktype === 'line') {  
        const datum = item.items;
        const indexes = datum.map((_, i) => i);
        ctx.layers.push(new LineLayer({
          id: item.name + layerSuffix,
          data: indexes.slice(1),
          widthUnits: 'pixels',
          highlightColor,
          getSourcePosition: i => {
            const d = datum[i - 1] as any;
            return project([d.x, d.y, d.z])
          },
          getTargetPosition: i => {
            const d = datum[i] as any;
            return [d.x, d.y, d.z]
          },
          getColor: i => {
            const d = datum[i] as any;
            const [r, g, b, _] = parseCSSColor(d.stroke); 
            const a = (d.strokeOpacity ?? 1) * 256;
            return [r, g, b, a]; 
          },
          getWidth: i => {
            const d = datum[i] as any;
            return d.strokeWidth;
          },
        }))
      } else if (item.marktype === 'text') {
        if (!item.items.length) {
          return;
        }
        const first = item.items[0] as any;
        ctx.layers.push(new TextLayer({
          id: item.name + layerSuffix,
          data: item.items,
          highlightColor,
          // sizeUnits: 'pixels',
          fontFamily: first.font ?? 'sans-serif',
          fontWeight: first.fontWeight ?? 'normal',
          getPosition: d => project([d.x, d.y, d.z]),
          getColor: d => {
            const [r, g, b, _] = parseCSSColor(d.fill); 
            const a = (d.opacity ?? 1) * 256;
            return [r, g, b, a]; 
          },
          getText: d => String(d.text),
          getSize: d => d.fontSize,
          getAngle: d => -(d.angle ?? 0),
          getTextAnchor: d => convertAlign(d.align),
          getAlignmentBaseline: d => convertBaseline(d.baseline),
        }))
      } else if (item.marktype === 'shape') {
        (window as any).shape = item;
        ctx.layers.push(new PolygonLayer({
          id: item.name + layerSuffix,
          data: item.items,
          pickable: true,
          autoHighlight: true,
          highlightColor,
          lineWidthUnits: 'pixels',
          getPolygon: d => {
            d.shape(d.shape.context());
            const path = d.shape(d);
            const rings = pathDataToPolys(path ?? '');
            return rings;
          },
          getFillColor: d => {
            const [r, g, b, _] = parseCSSColor(d.fill); 
            const a = (d.opacity ?? 1) * 256;
            return [r, g, b, a]; 
          },
          getLineWidth: d => d.strokeWidth ?? 0.5,
          getLineColor: d => {
            const [r, g, b, _] = parseCSSColor(d.stroke ?? 'white'); 
            const a = (d.strokeOpacity ?? 1) * 256;
            return [r, g, b, a]; 
          }
        }))
      } else {
        (window as any).unhandled = item;
        console.log('UNHANDLED', item.marktype, item);
      }
    }
  }
}

function getProjection(scene: vega.SceneGroup, parent: ProjectFn) {
  const { x, y } = scene;
  return (p: number[]) => {
    const m = parent(p);
    m[0] += x;
    m[1] += y;
    return m;
  }
}

function convertAlign(vegaAlign: string) {
  switch (vegaAlign) {
    case 'left': return 'start';
    case 'center': return 'middle';
    case 'right': return 'end';
  }
  return 'middle';
}

function convertBaseline(vegaBaseline: string) {
  switch (vegaBaseline) {
    case 'top':
    case 'line-top':
      return 'top';

    case 'middle':
      return 'center';
    case 'alphabetic':
    case 'bottom':
    case 'line-bottom':
      return 'bottom';
    default:
      return 'bottom';
  }
}