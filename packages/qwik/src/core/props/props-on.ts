import { getPlatform } from '../platform/platform';
import { parseQRL, QRLSerializeOptions, stringifyQRL } from '../import/qrl';
import { isSameQRL, QRLInternal } from '../import/qrl-class';
import { fromCamelToKebabCase } from '../util/case';
import { EMPTY_ARRAY } from '../util/flyweight';
import { isPromise } from '../util/promises';
import type { QContext } from './props';
import { RenderContext, setAttribute } from '../render/cursor';
import type { QRL } from '../import/qrl.public';
import { directGetAttribute, directSetAttribute } from '../render/fast-calls';
import { isArray } from '../util/types';

const ON_PROP_REGEX = /^(window:|document:|)on([A-Z]|-.).*Qrl$/;
const ON$_PROP_REGEX = /^(window:|document:|)on([A-Z]|-.).*\$$/;

export const isOnProp = (prop: string): boolean => {
  return ON_PROP_REGEX.test(prop);
};

export const isOn$Prop = (prop: string): boolean => {
  return ON$_PROP_REGEX.test(prop);
};

export const qPropWriteQRL = (
  rctx: RenderContext | undefined,
  ctx: QContext,
  prop: string,
  value: QRL<any>[] | QRL<any>
) => {
  if (!value) {
    return;
  }
  if (!ctx.$listeners$) {
    ctx.$listeners$ = getDomListeners(ctx.$element$);
  }

  const kebabProp = fromCamelToKebabCase(prop);
  const existingListeners = ctx.$listeners$.get(kebabProp) || [];

  const newQRLs = isArray(value) ? value : [value];
  for (const value of newQRLs) {
    const cp = (value as QRLInternal).copy();
    cp.setContainer(ctx.$element$);

    const capture = cp.$capture$;
    if (capture == null) {
      // we need to serialize the lexical scope references
      const captureRef = cp.$captureRef$;
      cp.$capture$ =
        captureRef && captureRef.length
          ? captureRef.map((ref) => String(ctx.$refMap$.$add$(ref)))
          : EMPTY_ARRAY;
    }

    // Important we modify the array as it is cached.
    for (let i = 0; i < existingListeners.length; i++) {
      const qrl = existingListeners[i];
      if (isSameQRL(qrl as any, cp)) {
        existingListeners.splice(i, 1);
        i--;
      }
    }
    existingListeners.push(cp);
  }
  ctx.$listeners$.set(kebabProp, existingListeners);
  const newValue = serializeQRLs(existingListeners, ctx);
  if (directGetAttribute(ctx.$element$, kebabProp) !== newValue) {
    if (rctx) {
      setAttribute(rctx, ctx.$element$, kebabProp, newValue);
    } else {
      directSetAttribute(ctx.$element$, kebabProp, newValue);
    }
  }
};

export const getDomListeners = (el: Element): Map<string, QRL[]> => {
  const attributes = el.attributes;
  const listeners: Map<string, QRL[]> = new Map();
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes.item(i)!;
    if (
      attr.name.startsWith('on:') ||
      attr.name.startsWith('on-window:') ||
      attr.name.startsWith('on-document:')
    ) {
      let array = listeners.get(attr.name);
      if (!array) {
        listeners.set(attr.name, (array = []));
      }
      array.push(parseQRL(attr.value, el));
    }
  }
  return listeners;
};

const serializeQRLs = (existingQRLs: QRL<any>[], ctx: QContext): string => {
  const opts: QRLSerializeOptions = {
    $platform$: getPlatform(ctx.$element$),
    $element$: ctx.$element$,
  };
  return existingQRLs
    .map((qrl) => (isPromise(qrl) ? '' : stringifyQRL(qrl, opts)))
    .filter((v) => !!v)
    .join('\n');
};
