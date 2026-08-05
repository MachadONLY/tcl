const nativeFetch = globalThis.fetch.bind(globalThis);
const PLAYER_IMAGE = /^https:\/\/images\.fotmob\.com\/image_resources\/playerimages\/\d+\.png(?:\?.*)?$/i;
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAAEZUlEQVR42u3dwU4bMRSF4WBZKk9atU/Uqs+IkLoLK7qqhGgTAnhs33u/fwuCGfufc+xkMrl7/P3wfAIW0QwBCAgCAivohuA656fzp//G/Zd7A0nAYyX76N+vLmcn3F7HUk3ITrp9j7OCjJ10ZCQg6crK2IkX91wziNiJR0QCEq+siJ14RCQg8cqK2IlHxJU08tURUQISTxrunoDkqzW+zeCQsHwFE69uJTfyEbGsgOQjYSMfVs5HIx9Wzksn3+38+PXz5t/9/vVbWAlnbkzuZj4ZIZp87xEum5CzJJwmYCT5RooXWcQZEk4RMIJ8R0oXWcajJWzkWyPfyv+70/wdmoC7y7eTALun4VFJ2MjneFbOZyOf41o5r418jm/l/JZ6PFuERX+k49xOwJ3TL9qk7ny8I+e5kY+EK+e7kY+EK+c99Rowy1oq85qw7XAVIC6fnf+WVb5sqZG1ilNWcNbKynhebYX1UMUlNiFImoDWfs5vlBcSELESUPo5z5F+SEDESUA7X4z2RAIiRgK60dT5HpGCEhD7J6C1H45KQQmIOLtgYLqA6hdH1rAEhAoGAdUvltSwBIQKBgHD12/UZzJXOd9LPklAqGAQENhHwKgvv1RZB0b+DhIJCBUsHZyfBAQBgZQCZq3hjOeVNgGzTVbWi6rdslUGRvHar9RrwCypkXlnn34TEn3ysr+sVGIXHHUSK7yzU+ZlmGiTWeVtxVKvA0aZ1Er3Nv7zfcEZd8GRnxuTUcaX3z2cUsDMDyrKIGRKAas9HSuyjGkErChdBhlfChh2E0K+HOMRLgGJFz8NwyYg+fKNU4gEJF6uNAyVgOTLPX7N4JGQgOQrO57tWj8bLBIeuf7bMgHJV2t8m8EhIQFRluaqlILlBSRf3XFXwdhPwJkvxUi/Oin4P69alZPHnvOggmENCAJOXweq31o1fMknCQgVDAJOrWH1W6uGr3kkAaGCQcDpNYwavOXP9AS0/qu5DlTBiLsGVMM4on4lIOLsgqUgRqefBEScBJSCOMITCYg4CSgFMdoPCYhYCSgFMdILCYh4CSgFMcqH6QlY6WuoIjJ7ftoK6yH9hiUgCcm3LAGBpRX80avAOjDH+m9E+w1LQFWsepdXMAnJF2YNqIZj1++2AkpB6bc8AUlIvuUVfMvBquE49XtUqLTVVwwJ68o3ZROijtXu8l3wWychBfdMvxnh0Xa5kkhYT76pAqpjtbtcwLdOTgquT7/ZIdF2u8JIWEe+ZQKSkHzLBSQh+ZYLSMLa8m0h4N9BuDQQJDxGvmtjPpO7x98PzzsN2PnpfPFnHu+bI/W2S0CVXFO+LRNQGtYQb9sElIZ15Ns+AW9Nw6qJuMv7uSUEvFXE7DKuvn+vvIDvETGDkO9ZakS82SOsgB8RMSuR7zLqWQa/oogZbm/r2SajgoiZ7qvsmScnk4xZb+btp8REl7HCHeT9VIQoMlb72EI/FeT1JK8UsvrnZPoJVyUYIacPYxGQPJviEb0gIOryB9+xVLga1YLnAAAAAElFTkSuQmCC',
  'base64'
);

globalThis.fetch = async function touchlineFotMobFetch(input, init) {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input?.url || String(input);
  const response = await nativeFetch(input, init);

  if (PLAYER_IMAGE.test(url) && (response.status === 403 || response.status === 404)) {
    console.warn(`  FotMob sem retrato disponível: ${url} — usando imagem neutra local.`);
    return new Response(PLACEHOLDER_PNG, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'content-length': String(PLACEHOLDER_PNG.length),
        'x-touchline-fotmob-placeholder': '1'
      }
    });
  }

  return response;
};
