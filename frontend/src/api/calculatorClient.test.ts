import { API_BASE_URL } from '../config';
import type { CalculationRequest } from '../types/calculator';
import {
  ApiError,
  CLIENT_MESSAGES,
  NetworkError,
  calculate,
} from './calculatorClient';

const ADD_REQUEST: CalculationRequest = { operation: 'add', a: 2, b: 3 };

function fetchMock(): jest.MockedFunction<typeof fetch> {
  return global.fetch as jest.MockedFunction<typeof fetch>;
}

/**
 * A minimal stand-in for a Response. jsdom provides neither fetch nor Response,
 * and the client only ever touches `ok`, `status` and `json()`.
 */
function stubResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) {
        throw new SyntaxError('Unexpected end of JSON input');
      }
      return body;
    },
  } as unknown as Response;
}

/**
 * A fetch that never settles until its abort signal fires, mirroring how the
 * real one behaves — including rejecting straight away when it is handed a
 * signal that is already aborted.
 */
function neverSettlingFetch() {
  return jest.fn((_input: unknown, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const abort = () =>
        reject(new DOMException('The operation was aborted.', 'AbortError'));

      if (init?.signal?.aborted) {
        abort();
        return;
      }
      init?.signal?.addEventListener('abort', abort);
    });
  });
}

describe('calculate', () => {
  it('posts the request to the calculate endpoint and returns the result', async () => {
    fetchMock().mockResolvedValue(
      stubResponse(200, { operation: 'add', a: 2, b: 3, result: 5 }),
    );

    const result = await calculate(ADD_REQUEST);

    expect(result).toEqual({ operation: 'add', a: 2, b: 3, result: 5 });
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE_URL}/calculate`);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual(ADD_REQUEST);
  });

  it('omits the second operand for a unary operation', async () => {
    fetchMock().mockResolvedValue(
      stubResponse(200, { operation: 'sqrt', a: 9, result: 3 }),
    );

    await calculate({ operation: 'sqrt', a: 9 });

    const [, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toEqual({ operation: 'sqrt', a: 9 });
    expect('b' in body).toBe(false);
  });

  it('sends to a custom base url and tolerates a trailing slash', async () => {
    fetchMock().mockResolvedValue(
      stubResponse(200, { operation: 'add', a: 2, b: 3, result: 5 }),
    );

    await calculate(ADD_REQUEST, { baseUrl: 'https://api.example.com/api/' });

    const [url] = fetchMock().mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/api/calculate');
  });

  it('raises an ApiError carrying the code, status and field of a rejected request', async () => {
    fetchMock().mockResolvedValue(
      stubResponse(422, {
        error: {
          code: 'DIVISION_BY_ZERO',
          message: 'division by zero is undefined',
          field: 'b',
        },
      }),
    );

    expect.assertions(4);
    try {
      await calculate({ operation: 'divide', a: 10, b: 0 });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe('DIVISION_BY_ZERO');
      expect(apiError.status).toBe(422);
      expect(apiError.field).toBe('b');
    }
  });

  it('surfaces the message of a validation error', async () => {
    fetchMock().mockResolvedValue(
      stubResponse(400, {
        error: { code: 'VALIDATION_ERROR', message: 'field "b" is required', field: 'b' },
      }),
    );

    await expect(calculate(ADD_REQUEST)).rejects.toThrow('field "b" is required');
  });

  it('falls back to a generic ApiError when the error body is not in the expected shape', async () => {
    // A proxy in front of the API can return HTML, which parses to nothing
    // useful, or the body may be missing entirely.
    fetchMock().mockResolvedValue(stubResponse(502, undefined));

    expect.assertions(3);
    try {
      await calculate(ADD_REQUEST);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('INTERNAL_ERROR');
      expect((error as ApiError).message).toBe(CLIENT_MESSAGES.unexpectedStatus(502));
    }
  });

  it('rejects a successful response whose body is not a calculation', async () => {
    fetchMock().mockResolvedValue(stubResponse(200, { unexpected: true }));

    expect.assertions(2);
    try {
      await calculate(ADD_REQUEST);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('MALFORMED_RESPONSE');
    }
  });

  it('raises a NetworkError when the API cannot be reached', async () => {
    fetchMock().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(calculate(ADD_REQUEST)).rejects.toBeInstanceOf(NetworkError);
    await expect(calculate(ADD_REQUEST)).rejects.toThrow(CLIENT_MESSAGES.unreachable);
  });

  it('keeps the original failure as the cause of a NetworkError', async () => {
    const cause = new TypeError('Failed to fetch');
    fetchMock().mockRejectedValue(cause);

    expect.assertions(1);
    try {
      await calculate(ADD_REQUEST);
    } catch (error) {
      expect((error as NetworkError).cause).toBe(cause);
    }
  });

  describe('timeouts', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('gives up and reports a timeout once the deadline passes', async () => {
      global.fetch = neverSettlingFetch() as unknown as typeof fetch;

      const promise = calculate(ADD_REQUEST, { timeoutMs: 5000 });
      // Attach the expectation before advancing so the rejection is never
      // momentarily unhandled.
      const assertion = expect(promise).rejects.toThrow(CLIENT_MESSAGES.timeout);

      jest.advanceTimersByTime(5000);

      await assertion;
    });

    it('does not time out a request that answers in time', async () => {
      fetchMock().mockResolvedValue(
        stubResponse(200, { operation: 'add', a: 2, b: 3, result: 5 }),
      );

      await expect(calculate(ADD_REQUEST, { timeoutMs: 5000 })).resolves.toEqual({
        operation: 'add',
        a: 2,
        b: 3,
        result: 5,
      });
    });
  });

  it('rethrows a cancellation asked for by the caller instead of wrapping it', async () => {
    global.fetch = neverSettlingFetch() as unknown as typeof fetch;

    const controller = new AbortController();
    const promise = calculate(ADD_REQUEST, { signal: controller.signal });
    const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });

    controller.abort();

    await assertion;
  });

  it('rejects immediately when the caller cancelled before the call was made', async () => {
    global.fetch = neverSettlingFetch() as unknown as typeof fetch;

    const controller = new AbortController();
    controller.abort();

    await expect(
      calculate(ADD_REQUEST, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
