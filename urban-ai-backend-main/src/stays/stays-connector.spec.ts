import axios, { AxiosError } from "axios";
import { StaysConnector } from "./stays-connector";

function axiosError(
  status?: number,
  message = "request failed",
  headers: Record<string, string> = {},
) {
  return new AxiosError(
    message,
    status ? "ERR_BAD_RESPONSE" : "ECONNABORTED",
    {} as any,
    {},
    status
      ? ({
          status,
          statusText: String(status),
          headers,
          config: {} as any,
          data: { message },
        } as any)
      : undefined,
  );
}

describe("StaysConnector - local retry and idempotency contracts", () => {
  const originalBaseUrl = process.env.STAYS_API_BASE_URL;
  let http: { post: jest.Mock; get: jest.Mock };
  let connector: StaysConnector;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STAYS_API_BASE_URL = "https://stays.invalid.test";
    http = { post: jest.fn(), get: jest.fn() };
    jest.spyOn(axios, "create").mockReturnValue(http as any);
    connector = new StaysConnector();
    (connector as any).sleep = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    if (originalBaseUrl === undefined) delete process.env.STAYS_API_BASE_URL;
    else process.env.STAYS_API_BASE_URL = originalBaseUrl;
  });

  const input = {
    listingId: "listing/with space",
    date: "2026-08-01",
    priceCents: 12345,
    currency: "BRL",
    idempotencyKey: "idem-123",
  };

  it("sends the idempotency key and encoded listing without a real HTTP call", async () => {
    http.post.mockResolvedValue({ data: { id: "external-1" } });

    await expect(connector.pushPrice("token", input)).resolves.toEqual({
      ok: true,
      externalReference: "external-1",
    });

    expect(http.post).toHaveBeenCalledWith(
      "/listings/listing%2Fwith%20space/prices",
      { date: "2026-08-01", priceCents: 12345, currency: "BRL" },
      { headers: { "Idempotency-Key": "idem-123" } },
    );
  });

  it("retries timeout/network failures up to success", async () => {
    http.post
      .mockRejectedValueOnce(axiosError(undefined, "timeout"))
      .mockRejectedValueOnce(axiosError(undefined, "socket reset"))
      .mockResolvedValue({ data: { reference: "external-2" } });

    await expect(connector.pushPrice("token", input)).resolves.toEqual({
      ok: true,
      externalReference: "external-2",
    });
    expect(http.post).toHaveBeenCalledTimes(3);
    expect((connector as any).sleep).toHaveBeenCalledTimes(2);
  });

  it("retries HTTP 429 and honors a bounded Retry-After delay", async () => {
    http.post
      .mockRejectedValueOnce(
        axiosError(429, "rate limited", { "retry-after": "2" }),
      )
      .mockResolvedValue({ data: { id: "external-3" } });

    await expect(connector.pushPrice("token", input)).resolves.toEqual({
      ok: true,
      externalReference: "external-3",
    });
    expect(http.post).toHaveBeenCalledTimes(2);
    expect((connector as any).sleep).toHaveBeenCalledWith(2000);
  });

  it("does not retry a business 4xx and returns a rejection", async () => {
    http.post.mockRejectedValue(axiosError(409, "price conflict"));

    await expect(connector.pushPrice("token", input)).resolves.toEqual({
      ok: false,
      rejectedReason: "price conflict",
    });
    expect(http.post).toHaveBeenCalledTimes(1);
    expect((connector as any).sleep).not.toHaveBeenCalled();
  });

  it("throws after three retryable failures", async () => {
    http.post.mockRejectedValue(axiosError(503, "unavailable"));

    await expect(connector.pushPrice("token", input)).rejects.toThrow(
      "unavailable",
    );
    expect(http.post).toHaveBeenCalledTimes(3);
    expect((connector as any).sleep).toHaveBeenCalledTimes(2);
  });

  it("maps listing payload variants and supplies authenticated client defaults", async () => {
    http.get.mockResolvedValue({
      data: {
        items: [
          {
            id: 42,
            name: "Loft",
            address: { shortAddress: "Centro" },
            basePriceCents: 9900,
            active: false,
          },
          { id: "43", title: "Casa", address: "Praia", active: true },
          { id: "44" },
        ],
      },
    });

    await expect(connector.listListings("secret")).resolves.toEqual([
      {
        listingId: "42",
        title: "Loft",
        address: "Centro",
        basePriceCents: 9900,
        active: false,
      },
      {
        listingId: "43",
        title: "Casa",
        address: "Praia",
        basePriceCents: null,
        active: true,
      },
      {
        listingId: "44",
        title: "",
        address: null,
        basePriceCents: null,
        active: true,
      },
    ]);
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: "https://stays.invalid.test",
      timeout: 15_000,
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
    });
    expect(http.get).toHaveBeenCalledWith("/listings");
  });

  it("returns an empty listing array for malformed provider payloads", async () => {
    http.get.mockResolvedValue({ data: { items: null } });
    await expect(connector.listListings("token")).resolves.toEqual([]);
  });

  it("fails closed when the connector is constructed without a base URL", async () => {
    delete process.env.STAYS_API_BASE_URL;
    connector = new StaysConnector();

    await expect(connector.listListings("token")).rejects.toThrow(
      "STAYS_API_BASE_URL is required",
    );
    expect(axios.create).not.toHaveBeenCalled();
  });

  it.each([
    [200, true],
    [299, true],
    [300, false],
    [199, false],
  ])("maps /me HTTP status %s to ping=%s", async (status, expected) => {
    http.get.mockResolvedValue({ status });
    await expect(connector.ping("token")).resolves.toBe(expected);
  });

  it("returns false when ping cannot create or call the client", async () => {
    http.get.mockRejectedValue(new Error("offline"));
    await expect(connector.ping("token")).resolves.toBe(false);
  });

  it("uses Retry-After HTTP dates and accessor-style headers", async () => {
    const now = new Date("2026-07-15T12:00:00.000Z").getTime();
    jest.spyOn(Date, "now").mockReturnValue(now);
    const error = axiosError(429, "rate limited");
    (error.response as any).headers = {
      get: jest.fn().mockReturnValue("Wed, 15 Jul 2026 12:00:40 GMT"),
    };
    http.post.mockRejectedValueOnce(error).mockResolvedValue({ data: {} });

    await expect(connector.pushPrice("token", input)).resolves.toEqual({
      ok: true,
      externalReference: undefined,
    });
    expect((connector as any).sleep).toHaveBeenCalledWith(30_000);
  });

  it("falls back to exponential delay for invalid or missing Retry-After values", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    http.post
      .mockRejectedValueOnce(
        axiosError(429, "rate limited", { "retry-after": "invalid" }),
      )
      .mockRejectedValueOnce(axiosError(408, "timeout"))
      .mockResolvedValue({ data: { id: "ok" } });

    await expect(connector.pushPrice("token", input)).resolves.toEqual({
      ok: true,
      externalReference: "ok",
    });
    expect((connector as any).sleep).toHaveBeenNthCalledWith(1, 250);
    expect((connector as any).sleep).toHaveBeenNthCalledWith(2, 500);
  });

  it("retries non-Axios errors and rethrows them after the retry budget", async () => {
    http.post.mockRejectedValue(new Error("transport exploded"));
    await expect(connector.pushPrice("token", input)).rejects.toThrow(
      "transport exploded",
    );
    expect(http.post).toHaveBeenCalledTimes(3);
  });

  it("uses status text when a business rejection has no message body", async () => {
    const error = axiosError(403, "ignored");
    (error.response as any).data = {};
    (error.response as any).statusText = "Forbidden";
    http.post.mockRejectedValue(error);

    await expect(connector.pushPrice("token", input)).resolves.toEqual({
      ok: false,
      rejectedReason: "Forbidden",
    });
  });

  it("classifies retryable HTTP boundaries and non-Axios transports", () => {
    const subject = connector as any;
    expect(subject.isRetryable(new Error("network"))).toBe(true);
    expect(subject.isRetryable(axiosError())).toBe(true);
    expect(subject.isRetryable(axiosError(408))).toBe(true);
    expect(subject.isRetryable(axiosError(425))).toBe(true);
    expect(subject.isRetryable(axiosError(429))).toBe(true);
    expect(subject.isRetryable(axiosError(500))).toBe(true);
    expect(subject.isRetryable(axiosError(599))).toBe(true);
    expect(subject.isRetryable(axiosError(600))).toBe(false);
    expect(subject.isRetryable(axiosError(400))).toBe(false);
  });

  it("normalizes every Retry-After shape and bound", () => {
    const subject = connector as any;
    expect(subject.retryAfterMs(new Error("network"))).toBeNull();
    expect(subject.retryAfterMs(axiosError(503))).toBeNull();
    expect(
      subject.retryAfterMs(axiosError(429, "limited", { "retry-after": "" })),
    ).toBeNull();
    expect(
      subject.retryAfterMs(axiosError(429, "limited", { "retry-after": "-2" })),
    ).toBe(0);
    expect(
      subject.retryAfterMs(axiosError(429, "limited", { "retry-after": "99" })),
    ).toBe(30000);
    expect(
      subject.retryAfterMs(
        axiosError(429, "limited", { "retry-after": "not-a-date" }),
      ),
    ).toBeNull();
  });
});
